/**
 * @file Sara: end-of-day cash count and daily summary.
 * Depends on: config.js, core/AppError.js, core/EventBus.js, models/DayRecord.js, utils/*.
 */
import { DENOMINATIONS, LIMITS, PAYMENT_TYPES } from '../config.js';
import { ValidationError } from '../core/AppError.js';
import { DAY_STATUS } from '../models/DayRecord.js';
import { getProfit } from '../models/Sale.js';
import { nowIso } from '../utils/ids.js';
import { formatPeso, sumCashCount } from '../utils/money.js';
import { optionalText, requireInteger } from '../utils/validators.js';
import { BaseService } from './BaseService.js';

export class ClosingService extends BaseService {
  /**
   * @param {Object} deps
   * @param {import('./DayService.js').DayService} deps.dayService
   * @param {import('./SalesService.js').SalesService} deps.salesService
   * @param {import('./CreditService.js').CreditService} deps.creditService
   * @param {import('./ExpenseService.js').ExpenseService} deps.expenseService
   * @param {import('../core/EventBus.js').EventBus} deps.bus
   * @param {import('./LogService.js').LogService} deps.logService
   */
  constructor({ dayService, salesService, creditService, expenseService, bus, logService }) {
    super({ bus, logService });
    this.days = dayService;
    this.sales = salesService;
    this.credit = creditService;
    this.expenses = expenseService;
  }

  /**
   * How much cash SHOULD be in the drawer.
   *   expected = opening cash + cash sales + utang paid in cash − cash taken out
   * Voided sales are excluded from "cash sales" because their money was
   * handed back to the customer, which is the same as subtracting refunds.
   * GCash and credit sales never touch the drawer, so they are not included.
   * @param {import('../models/DayRecord.js').DayRecord} dayRecord
   * @returns {{openingCash:number, cashSales:number, utangCollectedCash:number, cashOut:number, expectedCash:number}}
   */
  computeExpectedCash(dayRecord) {
    const cashSales = this.sales
      .getCompletedSales(dayRecord.id, dayRecord.id)
      .filter((sale) => sale.paymentType === PAYMENT_TYPES.CASH)
      .reduce((sum, sale) => sum + sale.total, 0);
    const utangCollectedCash = this.credit.getDayTotals(dayRecord.id).collectedCash;
    const cashOut = this.expenses.getDayTotals(dayRecord.id).total;
    return {
      openingCash: dayRecord.openingCash,
      cashSales,
      utangCollectedCash,
      cashOut,
      expectedCash: dayRecord.openingCash + cashSales + utangCollectedCash - cashOut,
    };
  }

  /**
   * Totals for one day (shown on the dashboard and frozen at closing).
   * @param {string} dayKey
   * @returns {Object}
   */
  buildSummary(dayKey) {
    const completed = this.sales.getCompletedSales(dayKey, dayKey);
    const byPayment = { cash: 0, gcash: 0, credit: 0 };
    const quantityByName = new Map();
    completed.forEach((sale) => {
      byPayment[sale.paymentType] += sale.total;
      sale.items.forEach((item) => {
        quantityByName.set(
          item.productName,
          (quantityByName.get(item.productName) ?? 0) + item.quantity,
        );
      });
    });
    const creditTotals = this.credit.getDayTotals(dayKey);
    return {
      totalSales: completed.reduce((sum, sale) => sum + sale.total, 0),
      profit: completed.reduce((sum, sale) => sum + getProfit(sale), 0),
      transactionCount: completed.length,
      voidedCount: this.sales.listSales({ startKey: dayKey, endKey: dayKey, status: 'voided' })
        .length,
      byPayment,
      utangGiven: creditTotals.charged,
      utangCollected: creditTotals.collectedCash + creditTotals.collectedGcash,
      expenses: this.expenses.getDayTotals(dayKey),
      topItems: [...quantityByName.entries()]
        .sort((first, second) => second[1] - first[1])
        .slice(0, 3)
        .map(([name, quantity]) => ({ name, quantity })),
    };
  }

  /**
   * Validates the counted pieces per denomination.
   * @param {Object<string, (string|number)>} countInput - Denomination value → pieces.
   * @returns {Object<string, number>}
   * @throws {ValidationError}
   */
  validateCashCount(countInput) {
    const counts = {};
    DENOMINATIONS.forEach((denomination) => {
      const rawValue = countInput[denomination.value];
      counts[denomination.value] =
        rawValue === '' || rawValue === undefined
          ? 0
          : requireInteger(rawValue, `count-${denomination.value}`, {
              min: 0,
              max: LIMITS.MAX_QUANTITY,
            });
    });
    return counts;
  }

  /**
   * Closes the open day. If the count doesn't match, a note explaining the
   * difference is required so "kulang" is never silently accepted.
   * @param {{cashCount: Object<string, (string|number)>, note?: string}} input
   * @returns {import('../models/DayRecord.js').DayRecord} The closed record.
   * @throws {ValidationError|import('../core/AppError.js').StoreClosedError}
   */
  closeDay({ cashCount, note = '' }) {
    const day = this.days.assertOpen();
    const counts = this.validateCashCount(cashCount);
    const countedCash = sumCashCount(counts);
    const { expectedCash } = this.computeExpectedCash(day);
    const difference = countedCash - expectedCash;
    const closingNote = optionalText(note, 'note');
    if (difference !== 0 && closingNote === '') {
      throw new ValidationError('errors.noteRequired', {}, 'note');
    }
    const closed = {
      ...day,
      status: DAY_STATUS.CLOSED,
      closedAt: nowIso(),
      cashCount: counts,
      countedCash,
      expectedCash,
      difference,
      closingNote,
      summary: this.buildSummary(day.id),
    };
    this.days.saveRecord(closed);
    this.announce('day', 'log.dayClosed', { date: day.id, difference: formatPeso(difference) });
    return closed;
  }
}
