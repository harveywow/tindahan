/**
 * @file Display formatting shared by several screens.
 * Depends on: models/Product.js, utils/i18n.js.
 */
import { splitStock } from '../../models/Product.js';
import { t } from '../../utils/i18n.js';

/**
 * Human-readable stock: "3 packs + 5 pcs" for tingi items, "12 lata" otherwise.
 * @param {import('../../models/Product.js').Product} product
 * @param {number} [stockPieces] - Override, e.g. stock minus what is in the basket.
 * @returns {string}
 */
export function formatStock(product, stockPieces = product.stockPieces) {
  const { packs, pieces } = splitStock({ ...product, stockPieces });
  return product.isTingi
    ? t('stock.packsPieces', { packs, pieces })
    : `${packs} ${product.unitLabel}`;
}
