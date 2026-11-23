/**
 * @file Expense (gastos) model: cash taken out of the drawer.
 * Depends on: config.js, utils/validators.js, utils/ids.js.
 */
import { EXPENSE_TYPES } from '../config.js';
import { generateId, nowIso } from '../utils/ids.js';
import { requireMoney, requireOneOf, requireText } from '../utils/validators.js';

/**
 * @typedef {Object} Expense
 * @property {string} id
 * @property {string} type - 'expense' | 'withdrawal' | 'restock'.
 * @property {string} description
 * @property {number} amount - Centavos.
 * @property {string} dayKey
 * @property {string} createdAt
 */

/**
 * @param {Object} input - Raw form values.
 * @param {string} dayKey
 * @returns {Expense}
 * @throws {import('../core/AppError.js').ValidationError}
 */
export function createExpense(input, dayKey) {
  return {
    id: generateId('exp'),
    type: requireOneOf(input.type, 'type', EXPENSE_TYPES),
    description: requireText(input.description, 'description'),
    amount: requireMoney(input.amount, 'amount'),
    dayKey,
    createdAt: nowIso(),
  };
}
