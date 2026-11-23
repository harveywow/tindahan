/**
 * @file Listahan: suki (regular customers) and their utang notebook.
 * Depends on: core/AppError.js, models/Customer.js, models/CreditEntry.js,
 *   services/BaseService.js, utils/*.
 */
import { CreditLimitError, ConflictError, ValidationError } from '../core/AppError.js';
import { createCreditEntry, CREDIT_ENTRY_TYPES, getSignedAmount } from '../models/CreditEntry.js';
import { createCustomer, getDisplayName, validateCustomerInput } from '../models/Customer.js';
import { daysBetween } from '../utils/dates.js';
import { formatPeso } from '../utils/money.js';
import { normalizeName, requireMoney, requireOneOf } from '../utils/validators.js';
import { BaseService } from './BaseService.js';

export class CreditService extends BaseService {
  /**
   * @param {Object} deps
   * @param {import('../core/Repository.js').Repository} deps.customerRepository
   * @param {import('../core/Repository.js').Repository} deps.creditRepository
   * @param {import('./DayService.js').DayService} deps.dayService
   * @param {import('../core/Clock.js').Clock} deps.clock
   * @param {function(): Object} deps.getSettings
   * @param {import('../core/EventBus.js').EventBus} deps.bus
   * @param {import('./LogService.js').LogService} deps.logService
   */
  constructor({
    customerRepository,
    creditRepository,
    dayService,
    clock,
    getSettings,
    bus,
    logService,
  }) {
    super({ bus, logService });
    this.customers = customerRepository;
    this.entries = creditRepository;
    this.days = dayService;
    this.clock = clock;
    this.getSettings = getSettings;
  }

  /* ----------------------------- Customers ----------------------------- */

  /**
   * @param {{search?: string, includeArchived?: boolean}} [filter]
   * @returns {Array<import('../models/Customer.js').Customer & {balance:number}>} Sorted by name.
   */
  listCustomers({ search = '', includeArchived = false } = {}) {
    const query = normalizeName(search);
    const balances = this.getBalances();
    return this.customers
      .getAll()
      .filter((customer) => includeArchived || !customer.isArchived)
      .filter(
        (customer) =>
          !query || normalizeName(`${customer.name} ${customer.nickname}`).includes(query),
      )
      .map((customer) => ({ ...customer, balance: balances.get(customer.id) ?? 0 }))
      .sort((first, second) => getDisplayName(first).localeCompare(getDisplayName(second)));
  }

  /**
   * @param {string} customerId
   * @returns {import('../models/Customer.js').Customer}
   */
  getCustomer(customerId) {
    return this.customers.getById(customerId);
  }

  /**
   * @param {string} name
   * @param {string} [excludeId]
   * @throws {ConflictError}
   */
  assertUniqueName(name, excludeId = '') {
    const duplicate = this.customers
      .getAll()
      .find(
        (customer) =>
          customer.id !== excludeId && normalizeName(customer.name) === normalizeName(name),
      );
    if (duplicate) {
      throw new ConflictError('errors.duplicateCustomer', { name: duplicate.name }, 'name');
    }
  }

  /**
   * @param {Object} input - Raw form values.
   * @returns {import('../models/Customer.js').Customer}
   */
  addCustomer(input) {
    const customer = createCustomer(input);
    this.assertUniqueName(customer.name);
    this.customers.upsert(customer);
    this.announce('credit', 'log.customerAdded', { name: customer.name });
    return customer;
  }

  /**
   * @param {string} customerId
   * @param {Object} input
   * @returns {import('../models/Customer.js').Customer}
   */
  updateCustomer(customerId, input) {
    const customer = this.getCustomer(customerId);
    const fields = validateCustomerInput(input);
    this.assertUniqueName(fields.name, customerId);
    const updated = this.customers.upsert({ ...customer, ...fields });
    this.announce('credit', 'log.customerUpdated', { name: updated.name });
    return updated;
  }

  /**
   * Customers who still owe money can't be removed. Those with history are
   * archived so their old notebook pages remain readable.
   * @param {string} customerId
   * @returns {'deleted'|'archived'}
   * @throws {ConflictError}
   */
  removeCustomer(customerId) {
    const customer = this.getCustomer(customerId);
    const balance = this.getBalance(customerId);
    if (balance > 0) {
      throw new ConflictError('errors.customerHasBalance', {
        name: customer.name,
        balance: formatPeso(balance),
      });
    }
    const hasHistory = this.entries.getAll().some((entry) => entry.customerId === customerId);
    if (hasHistory) {
      this.customers.upsert({ ...customer, isArchived: true });
      this.announce('credit', 'log.customerArchived', { name: customer.name });
      return 'archived';
    }
    this.customers.remove(customerId);
    this.announce('credit', 'log.customerDeleted', { name: customer.name });
    return 'deleted';
  }

  /* ------------------------------ Balances ------------------------------ */

  /** @returns {Map<string, number>} Customer id → balance, computed in one pass. */
  getBalances() {
    const balances = new Map();
    this.entries.getAll().forEach((entry) => {
      balances.set(
        entry.customerId,
        (balances.get(entry.customerId) ?? 0) + getSignedAmount(entry),
      );
    });
    return balances;
  }

  /**
   * @param {string} customerId
   * @returns {number} Centavos owed.
   */
  getBalance(customerId) {
    return this.entries
      .getAll()
      .filter((entry) => entry.customerId === customerId)
      .reduce((sum, entry) => sum + getSignedAmount(entry), 0);
  }

  /** @returns {number} Total utang across all customers. */
  getTotalOutstanding() {
    let total = 0;
    this.getBalances().forEach((balance) => {
      total += Math.max(0, balance);
    });
    return total;
  }

  /* ------------------------------ Charging ------------------------------ */

  /**
   * Checks that a customer may take this amount on credit.
   * @param {string} customerId
   * @param {number} amount
   * @param {{allowOverLimit?: boolean}} [options]
   * @returns {import('../models/Customer.js').Customer}
   * @throws {ValidationError|CreditLimitError}
   */
  assertCanCharge(customerId, amount, { allowOverLimit = false } = {}) {
    if (!customerId) {
      throw new ValidationError('errors.chooseCustomer', {}, 'customerId');
    }
    const customer = this.getCustomer(customerId);
    if (customer.isArchived) {
      throw new ValidationError('errors.customerArchived', { name: customer.name }, 'customerId');
    }
    const balance = this.getBalance(customerId);
    if (!allowOverLimit && balance + amount > customer.creditLimit) {
      throw new CreditLimitError('errors.creditLimitExceeded', {
        name: getDisplayName(customer),
        available: formatPeso(Math.max(0, customer.creditLimit - balance)),
      });
    }
    return customer;
  }

  /**
   * Writes a utang charge for a credit sale.
   * @param {Object} details
   * @param {string} details.customerId
   * @param {number} details.amount
   * @param {string} details.saleId
   * @param {string} details.dayKey
   * @param {import('../models/SaleItem.js').SaleItem[]} details.items
   * @returns {import('../models/CreditEntry.js').CreditEntry}
   */
  charge({ customerId, amount, saleId, dayKey, items }) {
    const description = items.map((item) => `${item.quantity} ${item.productName}`).join(', ');
    const entry = createCreditEntry({
      customerId,
      type: CREDIT_ENTRY_TYPES.CHARGE,
      amount,
      saleId,
      dayKey,
      description,
    });
    this.entries.upsert(entry);
    return entry;
  }

  /**
   * Cancels the utang of a voided sale.
   * @param {import('../models/Sale.js').Sale} sale
   * @param {string} dayKey
   */
  reverseCharge(sale, dayKey) {
    const entry = createCreditEntry({
      customerId: sale.customerId,
      type: CREDIT_ENTRY_TYPES.REVERSAL,
      amount: sale.total,
      saleId: sale.id,
      dayKey,
      description: `Void #${sale.receiptNumber}`,
    });
    this.entries.upsert(entry);
  }

  /**
   * Records a payment toward utang. Requires an open day because the cash
   * goes into today's drawer and must show up in the closing count.
   * @param {string} customerId
   * @param {{amount: (string|number), paymentMethod: string}} input
   * @returns {import('../models/CreditEntry.js').CreditEntry}
   * @throws {ValidationError|import('../core/AppError.js').StoreClosedError}
   */
  recordPayment(customerId, input) {
    const day = this.days.assertOpen();
    const customer = this.getCustomer(customerId);
    const paymentMethod = requireOneOf(input.paymentMethod, 'paymentMethod', ['cash', 'gcash']);
    const amount = requireMoney(input.amount, 'amount', {
      mustBePayable: paymentMethod === 'cash',
    });
    const balance = this.getBalance(customerId);
    if (amount > balance) {
      throw new ValidationError(
        'errors.paymentExceedsBalance',
        { balance: formatPeso(balance) },
        'amount',
      );
    }
    const entry = createCreditEntry({
      customerId,
      type: CREDIT_ENTRY_TYPES.PAYMENT,
      amount,
      dayKey: day.id,
      paymentMethod,
    });
    this.entries.upsert(entry);
    this.announce('credit', 'log.paymentRecorded', {
      name: customer.name,
      amount: formatPeso(amount),
    });
    return entry;
  }

  /* ------------------------------ Notebook ------------------------------ */

  /**
   * Notebook lines with a running balance. Charges already covered by
   * payments (first-in, first-out) are flagged isSettled so the notebook can
   * strike them through, like crossing out a paid line by hand.
   * @param {string} customerId
   * @returns {Array<import('../models/CreditEntry.js').CreditEntry & {runningBalance:number, isSettled:boolean}>}
   *   Oldest first.
   */
  getLedger(customerId) {
    const entries = this.entries.getAll().filter((entry) => entry.customerId === customerId);
    let creditsLeft = entries
      .filter((entry) => entry.type !== CREDIT_ENTRY_TYPES.CHARGE)
      .reduce((sum, entry) => sum + entry.amount, 0);
    let runningBalance = 0;
    return entries.map((entry) => {
      runningBalance += getSignedAmount(entry);
      let isSettled = false;
      if (entry.type === CREDIT_ENTRY_TYPES.CHARGE && creditsLeft >= entry.amount) {
        creditsLeft -= entry.amount;
        isSettled = true;
      } else if (entry.type === CREDIT_ENTRY_TYPES.CHARGE) {
        creditsLeft = 0;
      }
      return { ...entry, runningBalance, isSettled };
    });
  }

  /**
   * Finds the oldest charge not yet covered by payments (first-in, first-out).
   * Why FIFO: a ₱50 payment is understood to settle the oldest utang first,
   * which is how store owners count "how long has this been unpaid".
   * @param {string} customerId
   * @returns {string} Date key of that charge, or '' when nothing is owed.
   */
  getOldestUnpaidDate(customerId) {
    const firstUnpaid = this.getLedger(customerId).find(
      (entry) => entry.type === CREDIT_ENTRY_TYPES.CHARGE && !entry.isSettled,
    );
    return firstUnpaid?.dayKey ?? '';
  }

  /**
   * @returns {Array<{customer: Object, balance: number, daysUnpaid: number}>}
   *   Customers whose oldest unpaid utang is older than the overdue setting, oldest first.
   */
  getOverdueCustomers() {
    const { overdueDays } = this.getSettings();
    const today = this.clock.today();
    return this.listCustomers({ includeArchived: true })
      .filter((customer) => customer.balance > 0)
      .map((customer) => {
        const oldestDate = this.getOldestUnpaidDate(customer.id);
        return {
          customer,
          balance: customer.balance,
          daysUnpaid: oldestDate ? daysBetween(oldestDate, today) : 0,
        };
      })
      .filter((row) => row.daysUnpaid > overdueDays)
      .sort((first, second) => second.daysUnpaid - first.daysUnpaid);
  }

  /**
   * @param {number} [limit=5]
   * @returns {Array<import('../models/Customer.js').Customer & {balance:number}>} Largest balances first.
   */
  getTopDebtors(limit = 5) {
    return this.listCustomers({ includeArchived: true })
      .filter((customer) => customer.balance > 0)
      .sort((first, second) => second.balance - first.balance)
      .slice(0, limit);
  }

  /**
   * @param {string} dayKey
   * @returns {{charged:number, collectedCash:number, collectedGcash:number}}
   */
  getDayTotals(dayKey) {
    const totals = { charged: 0, collectedCash: 0, collectedGcash: 0 };
    this.entries.getAll().forEach((entry) => {
      if (entry.dayKey !== dayKey) {
        return;
      }
      if (entry.type === CREDIT_ENTRY_TYPES.CHARGE) {
        totals.charged += entry.amount;
      } else if (entry.type === CREDIT_ENTRY_TYPES.REVERSAL) {
        totals.charged -= entry.amount;
      } else if (entry.paymentMethod === 'cash') {
        totals.collectedCash += entry.amount;
      } else {
        totals.collectedGcash += entry.amount;
      }
    });
    return totals;
  }

  /** @returns {import('../models/CreditEntry.js').CreditEntry[]} All entries, oldest first. */
  listEntries() {
    return this.entries.getAll();
  }
}
