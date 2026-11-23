/**
 * @file Basket (supot): items picked on the cashier screen before payment.
 * Depends on: config.js, core/AppError.js, models/Product.js, utils/ids.js, utils/validators.js.
 *
 * A line is identified by product AND unit, so "1 pack of candy" and
 * "3 pieces of candy" are separate lines but share the same stock check.
 */
import { LIMITS, SALE_UNITS } from '../config.js';
import { ConflictError, StockError } from '../core/AppError.js';
import { getPiecesPerSaleUnit, getUnitPrice } from '../models/Product.js';
import { generateId } from '../utils/ids.js';
import { requireInteger } from '../utils/validators.js';

/**
 * @typedef {Object} BasketLine
 * @property {string} key
 * @property {import('../models/Product.js').Product} product
 * @property {string} saleUnit
 * @property {number} quantity
 */

export class Basket {
  constructor() {
    /** @type {Map<string, BasketLine>} */
    this.lines = new Map();
    this.renewCheckoutToken();
  }

  /**
   * Why a token: a double-click on "Bayad" fires checkout twice. The sales
   * service remembers tokens it has processed and rejects a repeat, so the
   * same basket can never become two sales.
   */
  renewCheckoutToken() {
    this.checkoutToken = generateId('chk');
  }

  /**
   * @param {string} productId
   * @param {string} saleUnit
   * @returns {string}
   */
  static buildKey(productId, saleUnit) {
    return `${productId}:${saleUnit}`;
  }

  /**
   * Pieces of a product already in the basket, optionally ignoring one line.
   * @param {string} productId
   * @param {string} [ignoredKey]
   * @returns {number}
   */
  getPiecesInBasket(productId, ignoredKey = '') {
    let pieces = 0;
    this.lines.forEach((line) => {
      if (line.product.id === productId && line.key !== ignoredKey) {
        pieces += getPiecesPerSaleUnit(line.product, line.saleUnit) * line.quantity;
      }
    });
    return pieces;
  }

  /**
   * @param {import('../models/Product.js').Product} product
   * @param {string} saleUnit
   * @param {number} quantity
   * @param {string} lineKey
   * @throws {StockError}
   */
  assertFits(product, saleUnit, quantity, lineKey) {
    const otherPieces = this.getPiecesInBasket(product.id, lineKey);
    const neededPieces = otherPieces + getPiecesPerSaleUnit(product, saleUnit) * quantity;
    if (neededPieces > product.stockPieces) {
      throw new StockError('errors.notEnoughStock', {
        name: product.name,
        available: product.stockPieces - otherPieces,
      });
    }
  }

  /**
   * Adds one (or more) of a product.
   * @param {import('../models/Product.js').Product} product
   * @param {string} [saleUnit]
   * @param {number} [quantity]
   * @throws {StockError|ConflictError}
   */
  add(product, saleUnit = SALE_UNITS.PACK, quantity = 1) {
    if (product.isArchived) {
      throw new ConflictError('errors.productArchived', { name: product.name });
    }
    const unit = product.isTingi ? saleUnit : SALE_UNITS.PACK;
    const key = Basket.buildKey(product.id, unit);
    const newQuantity = (this.lines.get(key)?.quantity ?? 0) + quantity;
    this.assertFits(product, unit, newQuantity, key);
    this.lines.set(key, { key, product, saleUnit: unit, quantity: newQuantity });
  }

  /**
   * Sets a line's quantity; 0 removes it. Decimals are rejected.
   * @param {string} key
   * @param {string|number} quantityInput
   * @throws {import('../core/AppError.js').ValidationError|StockError}
   */
  setQuantity(key, quantityInput) {
    const line = this.lines.get(key);
    if (!line) {
      return;
    }
    const quantity = requireInteger(quantityInput, 'quantity', {
      min: 0,
      max: LIMITS.MAX_QUANTITY,
    });
    if (quantity === 0) {
      this.lines.delete(key);
      return;
    }
    this.assertFits(line.product, line.saleUnit, quantity, key);
    line.quantity = quantity;
  }

  /** @param {string} key */
  remove(key) {
    this.lines.delete(key);
  }

  /** Empties the basket and issues a new checkout token. */
  clear() {
    this.lines.clear();
    this.renewCheckoutToken();
  }

  /**
   * Replaces stale product copies with fresh ones (after stock changes elsewhere).
   * Lines for products that no longer exist are dropped.
   * @param {function(string): (import('../models/Product.js').Product|undefined)} findProduct
   */
  refreshProducts(findProduct) {
    this.lines.forEach((line, key) => {
      const fresh = findProduct(line.product.id);
      if (fresh) {
        line.product = fresh;
      } else {
        this.lines.delete(key);
      }
    });
  }

  /** @returns {Array<BasketLine & {unitPrice:number, lineTotal:number}>} */
  getLines() {
    return [...this.lines.values()].map((line) => {
      const unitPrice = getUnitPrice(line.product, line.saleUnit);
      return { ...line, unitPrice, lineTotal: unitPrice * line.quantity };
    });
  }

  /** @returns {number} Total in centavos. */
  getTotal() {
    return this.getLines().reduce((sum, line) => sum + line.lineTotal, 0);
  }

  /** @returns {number} Number of items (sum of quantities). */
  getItemCount() {
    return [...this.lines.values()].reduce((sum, line) => sum + line.quantity, 0);
  }

  /** @returns {boolean} */
  isEmpty() {
    return this.lines.size === 0;
  }
}
