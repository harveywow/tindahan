/**
 * @file Sale model: a completed (or voided) transaction.
 * Depends on: utils/ids.js.
 */
import { generateId, nowIso } from '../utils/ids.js';

/**
 * @typedef {Object} Sale
 * @property {string} id
 * @property {string} receiptNumber - Human-friendly running number, e.g. "000042".
 * @property {string} dayKey - Store day the sale belongs to.
 * @property {string} createdAt
 * @property {import('./SaleItem.js').SaleItem[]} items
 * @property {number} total - Centavos.
 * @property {number} totalCost - Centavos.
 * @property {string} paymentType - 'cash' | 'gcash' | 'credit'.
 * @property {number} cashReceived - Centavos (0 for non-cash).
 * @property {number} change - Centavos.
 * @property {string} gcashReference
 * @property {string} customerId - '' unless paid by credit.
 * @property {string} customerName - Snapshot for receipts.
 * @property {string} status - 'completed' | 'voided'.
 * @property {string} voidReason
 * @property {string} voidedAt
 */

/**
 * @param {Object} details
 * @param {import('./SaleItem.js').SaleItem[]} details.items
 * @param {string} details.dayKey
 * @param {number} details.receiptCounter - Next running number.
 * @param {{paymentType:string, cashReceived:number, gcashReference:string,
 *   customerId:string, customerName:string}} details.payment
 * @returns {Sale}
 */
export function createSale({ items, dayKey, receiptCounter, payment }) {
  const total = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const totalCost = items.reduce((sum, item) => sum + item.lineCost, 0);
  const cashReceived = payment.paymentType === 'cash' ? payment.cashReceived : 0;
  return {
    id: generateId('sal'),
    receiptNumber: String(receiptCounter).padStart(6, '0'),
    dayKey,
    createdAt: nowIso(),
    items,
    total,
    totalCost,
    paymentType: payment.paymentType,
    cashReceived,
    change: payment.paymentType === 'cash' ? cashReceived - total : 0,
    gcashReference: payment.gcashReference ?? '',
    customerId: payment.customerId ?? '',
    customerName: payment.customerName ?? '',
    status: 'completed',
    voidReason: '',
    voidedAt: '',
  };
}

/**
 * @param {Sale} sale
 * @returns {boolean}
 */
export function isCompleted(sale) {
  return sale.status === 'completed';
}

/**
 * @param {Sale} sale
 * @returns {number} Profit (kita) in centavos.
 */
export function getProfit(sale) {
  return sale.total - sale.totalCost;
}
