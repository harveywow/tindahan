/**
 * @file Tinda & Benta: checkout, sales history and voiding.
 * Depends on: config.js, core/AppError.js, models/Sale.js, models/SaleItem.js,
 *   services/BaseService.js, utils/validators.js, utils/dates.js.
 */
import { PAYMENT_TYPES } from '../config.js';
import { ConflictError, ValidationError } from '../core/AppError.js';
import { getDisplayName } from '../models/Customer.js';
import { createSale, isCompleted } from '../models/Sale.js';
import { createSaleItem } from '../models/SaleItem.js';
import { isWithinRange, validateDateRange } from '../utils/dates.js';
import { formatPeso } from '../utils/money.js';
import { nowIso } from '../utils/ids.js';
import {
  requireGcashReference,
  requireMoney,
  requireOneOf,
  requireText,
} from '../utils/validators.js';
import { BaseService } from './BaseService.js';

export class SalesService extends BaseService {
  /**
   * @param {Object} deps
   * @param {import('../core/Repository.js').Repository} deps.saleRepository
   * @param {import('../core/Storage.js').Storage} deps.storage - Holds the receipt counter.
   * @param {import('./InventoryService.js').InventoryService} deps.inventoryService
   * @param {import('./CreditService.js').CreditService} deps.creditService
   * @param {import('./DayService.js').DayService} deps.dayService
   * @param {import('../core/EventBus.js').EventBus} deps.bus
   * @param {import('./LogService.js').LogService} deps.logService
   */
  constructor({
    saleRepository,
    storage,
    inventoryService,
    creditService,
    dayService,
    bus,
    logService,
  }) {
    super({ bus, logService });
    this.sales = saleRepository;
    this.storage = storage;
    this.inventory = inventoryService;
    this.credit = creditService;
    this.days = dayService;
    /** Checkout tokens already turned into sales (see Basket.renewCheckoutToken). */
    this.processedTokens = new Set();
  }

  /* ------------------------------ Checkout ------------------------------ */

  /**
   * Turns a basket into a sale.
   * @param {import('./Basket.js').Basket} basket
   * @param {Object} paymentInput - { paymentType, cashReceived, gcashReference, customerId }
   * @param {{allowOverLimit?: boolean}} [options] - true after the owner's PIN override.
   * @returns {import('../models/Sale.js').Sale}
   * @throws {ValidationError|ConflictError|import('../core/AppError.js').StockError|
   *   import('../core/AppError.js').StoreClosedError|import('../core/AppError.js').CreditLimitError}
   */
  checkout(basket, paymentInput, { allowOverLimit = false } = {}) {
    if (this.processedTokens.has(basket.checkoutToken)) {
      throw new ConflictError('errors.duplicateCheckout');
    }
    const day = this.days.assertOpen();
    if (basket.isEmpty()) {
      throw new ValidationError('errors.emptyBasket');
    }
    const { items, piecesByProductId } = this.buildItems(basket);
    const total = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const payment = this.validatePayment(paymentInput, total, allowOverLimit);

    // Every check has passed; from here on, data is written.
    this.inventory.deductForSale(piecesByProductId);
    const sale = createSale({
      items,
      dayKey: day.id,
      receiptCounter: this.nextReceiptNumber(),
      payment,
    });
    this.sales.upsert(sale);
    if (sale.paymentType === PAYMENT_TYPES.CREDIT) {
      this.credit.charge({
        customerId: sale.customerId,
        amount: sale.total,
        saleId: sale.id,
        dayKey: day.id,
        items,
      });
    }
    this.processedTokens.add(basket.checkoutToken);
    this.announce('sale', 'log.saleCompleted', {
      receipt: sale.receiptNumber,
      total: formatPeso(sale.total),
    });
    return sale;
  }

  /**
   * Builds sale items from FRESH product data (the basket may hold copies
   * that are minutes old) and totals pieces per product for the stock check.
   * @param {import('./Basket.js').Basket} basket
   * @returns {{items: import('../models/SaleItem.js').SaleItem[], piecesByProductId: Map<string, number>}}
   */
  buildItems(basket) {
    const piecesByProductId = new Map();
    const items = basket.getLines().map((line) => {
      const product = this.inventory.getProduct(line.product.id);
      const item = createSaleItem(product, line.saleUnit, line.quantity);
      piecesByProductId.set(product.id, (piecesByProductId.get(product.id) ?? 0) + item.piecesUsed);
      return item;
    });
    piecesByProductId.forEach((pieces, productId) => {
      const product = this.inventory.getProduct(productId);
      this.inventory.assertActive(product);
      this.inventory.assertStockAvailable(product, pieces);
    });
    return { items, piecesByProductId };
  }

  /**
   * @param {Object} input
   * @param {number} total
   * @param {boolean} allowOverLimit
   * @returns {{paymentType:string, cashReceived:number, gcashReference:string, customerId:string, customerName:string}}
   */
  validatePayment(input, total, allowOverLimit) {
    const paymentType = requireOneOf(
      input.paymentType,
      'paymentType',
      Object.values(PAYMENT_TYPES),
    );
    const payment = {
      paymentType,
      cashReceived: 0,
      gcashReference: '',
      customerId: '',
      customerName: '',
    };
    if (paymentType === PAYMENT_TYPES.CASH) {
      payment.cashReceived = requireMoney(input.cashReceived, 'cashReceived', {
        mustBePayable: true,
      });
      if (payment.cashReceived < total) {
        throw new ValidationError(
          'errors.cashNotEnough',
          { total: formatPeso(total) },
          'cashReceived',
        );
      }
    } else if (paymentType === PAYMENT_TYPES.GCASH) {
      payment.gcashReference = requireGcashReference(input.gcashReference, 'gcashReference');
    } else {
      const customer = this.credit.assertCanCharge(input.customerId, total, { allowOverLimit });
      payment.customerId = customer.id;
      payment.customerName = getDisplayName(customer);
    }
    return payment;
  }

  /** @returns {number} Next running receipt number (persisted so it survives reloads). */
  nextReceiptNumber() {
    const counters = this.storage.read('counters', {}) ?? {};
    const next = (Number(counters.receipt) || 0) + 1;
    this.storage.write('counters', { ...counters, receipt: next });
    return next;
  }

  /* ------------------------------ Voiding ------------------------------ */

  /**
   * Cancels a sale: stock goes back, utang is reversed, the record stays
   * (marked voided) so the audit trail is never lost.
   * Only sales from the currently open day can be voided — a closed day's
   * cash count is final and must not change afterwards.
   * @param {string} saleId
   * @param {string} reasonInput
   * @returns {import('../models/Sale.js').Sale}
   * @throws {ValidationError|ConflictError}
   */
  voidSale(saleId, reasonInput) {
    const sale = this.sales.getById(saleId);
    if (!isCompleted(sale)) {
      throw new ConflictError('errors.alreadyVoided');
    }
    if (this.days.getOpenDay()?.id !== sale.dayKey) {
      throw new ConflictError('errors.voidClosedDay');
    }
    const voidReason = requireText(reasonInput, 'reason');
    const piecesByProductId = new Map();
    sale.items.forEach((item) => {
      piecesByProductId.set(
        item.productId,
        (piecesByProductId.get(item.productId) ?? 0) + item.piecesUsed,
      );
    });
    this.inventory.restoreFromVoid(piecesByProductId);
    if (sale.paymentType === PAYMENT_TYPES.CREDIT) {
      this.credit.reverseCharge(sale, sale.dayKey);
    }
    const voided = { ...sale, status: 'voided', voidReason, voidedAt: nowIso() };
    this.sales.upsert(voided);
    this.announce('void', 'log.saleVoided', { receipt: sale.receiptNumber, reason: voidReason });
    return voided;
  }

  /* ------------------------------ Queries ------------------------------ */

  /**
   * @param {string} saleId
   * @returns {import('../models/Sale.js').Sale}
   */
  getSale(saleId) {
    return this.sales.getById(saleId);
  }

  /**
   * @param {Object} [filter]
   * @param {string} [filter.startKey]
   * @param {string} [filter.endKey]
   * @param {string} [filter.paymentType] - '' for all.
   * @param {string} [filter.customerId] - '' for all.
   * @param {string} [filter.status] - '' | 'completed' | 'voided'.
   * @returns {import('../models/Sale.js').Sale[]} Newest first.
   * @throws {ValidationError} When the date range is invalid.
   */
  listSales({ startKey = '', endKey = '', paymentType = '', customerId = '', status = '' } = {}) {
    validateDateRange(startKey, endKey);
    return this.sales
      .getAll()
      .filter((sale) => isWithinRange(sale.dayKey, startKey, endKey))
      .filter((sale) => !paymentType || sale.paymentType === paymentType)
      .filter((sale) => !customerId || sale.customerId === customerId)
      .filter((sale) => !status || sale.status === status)
      .reverse();
  }

  /**
   * @param {string} startKey
   * @param {string} endKey
   * @returns {import('../models/Sale.js').Sale[]} Completed sales in the range, oldest first.
   */
  getCompletedSales(startKey = '', endKey = '') {
    return this.sales
      .getAll()
      .filter((sale) => isCompleted(sale) && isWithinRange(sale.dayKey, startKey, endKey));
  }
}
