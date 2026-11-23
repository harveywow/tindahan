/**
 * @file Gastos: cash taken out of the drawer during the day.
 * Depends on: core/AppError.js, models/Expense.js, services/BaseService.js, utils/*.
 */
import { EXPENSE_TYPES } from '../config.js';
import { ConflictError } from '../core/AppError.js';
import { createExpense } from '../models/Expense.js';
import { isWithinRange, validateDateRange } from '../utils/dates.js';
import { formatPeso } from '../utils/money.js';
import { BaseService } from './BaseService.js';

export class ExpenseService extends BaseService {
  /**
   * @param {Object} deps
   * @param {import('../core/Repository.js').Repository} deps.expenseRepository
   * @param {import('./DayService.js').DayService} deps.dayService
   * @param {import('../core/EventBus.js').EventBus} deps.bus
   * @param {import('./LogService.js').LogService} deps.logService
   */
  constructor({ expenseRepository, dayService, bus, logService }) {
    super({ bus, logService });
    this.expenses = expenseRepository;
    this.days = dayService;
  }

  /**
   * Records cash taken from the drawer. The day must be open because the
   * amount is subtracted from the expected cash at closing.
   * @param {Object} input - { type, description, amount }
   * @returns {import('../models/Expense.js').Expense}
   * @throws {import('../core/AppError.js').ValidationError|import('../core/AppError.js').StoreClosedError}
   */
  addExpense(input) {
    const day = this.days.assertOpen();
    const expense = createExpense(input, day.id);
    this.expenses.upsert(expense);
    this.announce('expense', 'log.expenseAdded', {
      description: expense.description,
      amount: formatPeso(expense.amount),
    });
    return expense;
  }

  /**
   * Only expenses from the open day can be deleted (a closed day is final).
   * @param {string} expenseId
   * @throws {ConflictError}
   */
  deleteExpense(expenseId) {
    const expense = this.expenses.getById(expenseId);
    if (this.days.getOpenDay()?.id !== expense.dayKey) {
      throw new ConflictError('errors.dayAlreadyClosed');
    }
    this.expenses.remove(expenseId);
    this.announce('expense', 'log.expenseDeleted', { description: expense.description });
  }

  /**
   * @param {{startKey?: string, endKey?: string, type?: string}} [filter]
   * @returns {import('../models/Expense.js').Expense[]} Newest first.
   */
  listExpenses({ startKey = '', endKey = '', type = '' } = {}) {
    validateDateRange(startKey, endKey);
    return this.expenses
      .getAll()
      .filter((expense) => isWithinRange(expense.dayKey, startKey, endKey))
      .filter((expense) => !type || expense.type === type)
      .reverse();
  }

  /**
   * @param {string} dayKey
   * @returns {{expense:number, withdrawal:number, restock:number, total:number}}
   */
  getDayTotals(dayKey) {
    const totals = Object.fromEntries(EXPENSE_TYPES.map((type) => [type, 0]));
    totals.total = 0;
    this.expenses.getAll().forEach((expense) => {
      if (expense.dayKey === dayKey) {
        totals[expense.type] += expense.amount;
        totals.total += expense.amount;
      }
    });
    return totals;
  }
}
