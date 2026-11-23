/**
 * @file CreditEntry model: one line in a suki's utang notebook.
 * Depends on: utils/ids.js.
 *
 * Why entries instead of a single "balance" number: the notebook must show
 * history (what was bought, when it was paid). The balance is always the sum
 * of entries, so it can never drift out of sync with the history.
 */
import { generateId, nowIso } from '../utils/ids.js';

export const CREDIT_ENTRY_TYPES = Object.freeze({
  CHARGE: 'charge',
  PAYMENT: 'payment',
  REVERSAL: 'reversal',
});

/**
 * @typedef {Object} CreditEntry
 * @property {string} id
 * @property {string} customerId
 * @property {string} type - 'charge' (adds to utang), 'payment' or 'reversal' (subtract).
 * @property {number} amount - Positive centavos.
 * @property {string} saleId - Linked sale for charges/reversals.
 * @property {string} description - e.g. items bought.
 * @property {string} paymentMethod - 'cash' | 'gcash' for payments.
 * @property {string} dayKey
 * @property {string} createdAt
 */

/**
 * @param {Object} details
 * @param {string} details.customerId
 * @param {string} details.type
 * @param {number} details.amount
 * @param {string} details.dayKey
 * @param {string} [details.saleId]
 * @param {string} [details.description]
 * @param {string} [details.paymentMethod]
 * @returns {CreditEntry}
 */
export function createCreditEntry({
  customerId,
  type,
  amount,
  dayKey,
  saleId = '',
  description = '',
  paymentMethod = '',
}) {
  return {
    id: generateId('crd'),
    customerId,
    type,
    amount,
    saleId,
    description,
    paymentMethod,
    dayKey,
    createdAt: nowIso(),
  };
}

/**
 * @param {CreditEntry} entry
 * @returns {number} +amount for charges, -amount for payments and reversals.
 */
export function getSignedAmount(entry) {
  return entry.type === CREDIT_ENTRY_TYPES.CHARGE ? entry.amount : -entry.amount;
}
