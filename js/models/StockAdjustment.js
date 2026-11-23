/**
 * @file StockAdjustment model: a manual stock change with a reason.
 * Depends on: utils/ids.js.
 *
 * Why every change needs a reason: if the cash count is short at closing,
 * the owner can check whether stock went missing ("lost") or was used at home.
 */
import { generateId, nowIso } from '../utils/ids.js';

/**
 * @typedef {Object} StockAdjustment
 * @property {string} id
 * @property {string} productId
 * @property {string} productName
 * @property {number} changePieces - Negative removes stock.
 * @property {string} reason - 'spoiled' | 'lost' | 'personalUse' | 'correction' | 'restock'.
 * @property {string} note
 * @property {string} createdAt
 */

/**
 * @param {Object} details
 * @param {import('./Product.js').Product} details.product
 * @param {number} details.changePieces
 * @param {string} details.reason
 * @param {string} [details.note]
 * @returns {StockAdjustment}
 */
export function createStockAdjustment({ product, changePieces, reason, note = '' }) {
  return {
    id: generateId('adj'),
    productId: product.id,
    productName: product.name,
    changePieces,
    reason,
    note,
    createdAt: nowIso(),
  };
}
