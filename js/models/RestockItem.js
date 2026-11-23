/**
 * @file RestockItem model: one line on the pamilihan (shopping) list.
 * Depends on: utils/ids.js, utils/validators.js, config.js.
 */
import { LIMITS } from '../config.js';
import { generateId, nowIso } from '../utils/ids.js';
import { requireInteger, requireText } from '../utils/validators.js';

/**
 * @typedef {Object} RestockItem
 * @property {string} id
 * @property {string} productId - '' for manual items not in inventory.
 * @property {string} name
 * @property {number} quantity - In packs.
 * @property {boolean} isSuggested - Generated automatically from low stock.
 * @property {boolean} isChecked - Ticked while shopping.
 * @property {boolean} isReceived - Added to stock.
 * @property {string} createdAt
 */

/**
 * @param {Object} details
 * @param {string} details.name
 * @param {number|string} details.quantity
 * @param {string} [details.productId]
 * @param {boolean} [details.isSuggested]
 * @returns {RestockItem}
 * @throws {import('../core/AppError.js').ValidationError}
 */
export function createRestockItem({ name, quantity, productId = '', isSuggested = false }) {
  return {
    id: generateId('rst'),
    productId,
    name: requireText(name, 'name'),
    quantity: requireInteger(quantity, 'quantity', { min: 1, max: LIMITS.MAX_QUANTITY }),
    isSuggested,
    isChecked: false,
    isReceived: false,
    createdAt: nowIso(),
  };
}
