/**
 * @file SaleItem model: one line of a receipt.
 * Depends on: models/Product.js.
 *
 * Why name and prices are copied ("snapshots"): if the owner later renames
 * a product or raises its price, old receipts and profit reports must still
 * show what was actually charged on that day.
 */
import { getCostOfPieces, getPiecesPerSaleUnit, getUnitPrice } from './Product.js';

/**
 * @typedef {Object} SaleItem
 * @property {string} productId
 * @property {string} productName - Snapshot at time of sale.
 * @property {string} category - Snapshot, used by category reports.
 * @property {string} saleUnit - 'pack' or 'piece'.
 * @property {string} unitLabel
 * @property {number} quantity
 * @property {number} unitPrice - Centavos.
 * @property {number} piecesUsed - Stock pieces consumed.
 * @property {number} lineTotal - Centavos.
 * @property {number} lineCost - Centavos.
 */

/**
 * @param {import('./Product.js').Product} product
 * @param {string} saleUnit
 * @param {number} quantity
 * @returns {SaleItem}
 */
export function createSaleItem(product, saleUnit, quantity) {
  const unitPrice = getUnitPrice(product, saleUnit);
  const piecesUsed = getPiecesPerSaleUnit(product, saleUnit) * quantity;
  return {
    productId: product.id,
    productName: product.name,
    category: product.category,
    saleUnit,
    unitLabel: saleUnit === 'piece' ? 'pc' : product.unitLabel,
    quantity,
    unitPrice,
    piecesUsed,
    lineTotal: unitPrice * quantity,
    lineCost: getCostOfPieces(product, piecesUsed),
  };
}
