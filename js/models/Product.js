/**
 * @file Product model: validation, creation and stock/price helpers.
 * Depends on: config.js, utils/validators.js, utils/dates.js, utils/ids.js, utils/money.js.
 *
 * Why stock is stored in PIECES: a pack of 10 candies can be sold whole or
 * one piece at a time (tingi). If stock were stored in packs, selling one
 * piece would leave 9.9 packs and invite rounding bugs. Storing the smallest
 * sellable unit keeps stock an exact integer; packs are derived for display.
 */
import { LIMITS, SALE_UNITS } from '../config.js';
import { ValidationError } from '../core/AppError.js';
import { daysBetween, isValidDateKey } from '../utils/dates.js';
import { generateId, nowIso } from '../utils/ids.js';
import { calculateMarginPercent } from '../utils/money.js';
import { optionalText, requireInteger, requireMoney, requireText } from '../utils/validators.js';

/**
 * @typedef {Object} Product
 * @property {string} id
 * @property {string} name
 * @property {string} category
 * @property {string} unitLabel - What one pack is called: "pack", "bote", "sachet"...
 * @property {number} costPerPack - Centavos (puhunan).
 * @property {number} pricePerPack - Centavos.
 * @property {boolean} isTingi - Can be sold per piece.
 * @property {number} piecesPerPack - 1 when not tingi.
 * @property {number} pricePerPiece - Centavos; equals pricePerPack when not tingi.
 * @property {number} stockPieces
 * @property {number} reorderLevel - In packs.
 * @property {string} expiryDate - YYYY-MM-DD or ''.
 * @property {string} imageDataUrl - '' when none.
 * @property {boolean} hasSalesHistory - Set on first sale; such products are archived, not deleted.
 * @property {boolean} isArchived
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * Validates the pricing part of a product form.
 * @param {Object} input - Raw form values.
 * @returns {{costPerPack:number, pricePerPack:number, isTingi:boolean, piecesPerPack:number, pricePerPiece:number}}
 * @throws {ValidationError}
 */
function validatePricing(input) {
  const costPerPack = requireMoney(input.costPerPack, 'costPerPack', { allowZero: true });
  const pricePerPack = requireMoney(input.pricePerPack, 'pricePerPack', { mustBePayable: true });
  const isTingi = input.isTingi === true || input.isTingi === 'true' || input.isTingi === 'on';
  if (!isTingi) {
    return { costPerPack, pricePerPack, isTingi, piecesPerPack: 1, pricePerPiece: pricePerPack };
  }
  const piecesPerPack = requireInteger(input.piecesPerPack, 'piecesPerPack', {
    min: 2,
    max: LIMITS.MAX_PIECES_PER_PACK,
  });
  const pricePerPiece = requireMoney(input.pricePerPiece, 'pricePerPiece', { mustBePayable: true });
  return { costPerPack, pricePerPack, isTingi, piecesPerPack, pricePerPiece };
}

/**
 * Validates every editable product field (not stock, which only changes
 * through sales, restocks and adjustments so each change is logged).
 * @param {Object} input - Raw form values.
 * @returns {Object} Clean field values.
 * @throws {ValidationError}
 */
export function validateProductInput(input) {
  const expiryDate = String(input.expiryDate ?? '').trim();
  if (expiryDate && !isValidDateKey(expiryDate)) {
    throw new ValidationError('errors.invalidDate', {}, 'expiryDate');
  }
  return {
    name: requireText(input.name, 'name'),
    category: requireText(input.category, 'category'),
    unitLabel: optionalText(input.unitLabel, 'unitLabel', { maxLength: 20 }) || 'pack',
    ...validatePricing(input),
    reorderLevel: requireInteger(input.reorderLevel, 'reorderLevel', {
      min: 0,
      max: LIMITS.MAX_QUANTITY,
    }),
    expiryDate,
    imageDataUrl: String(input.imageDataUrl ?? ''),
  };
}

/**
 * Creates a new product record.
 * @param {Object} input - Raw form values, including initialStock (in packs).
 * @returns {Product}
 * @throws {ValidationError}
 */
export function createProduct(input) {
  const fields = validateProductInput(input);
  const initialPacks = requireInteger(input.initialStock ?? '0', 'initialStock', {
    min: 0,
    max: LIMITS.MAX_QUANTITY,
  });
  const timestamp = nowIso();
  return {
    id: generateId('prd'),
    ...fields,
    stockPieces: initialPacks * fields.piecesPerPack,
    hasSalesHistory: false,
    isArchived: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

/**
 * @param {Product} product
 * @returns {boolean} True when either the pack price or the per-piece price
 *   (times pieces) is below the pack cost — selling would lose money.
 */
export function isPricedBelowCost(product) {
  const tingiRevenue = product.pricePerPiece * product.piecesPerPack;
  return product.pricePerPack < product.costPerPack || tingiRevenue < product.costPerPack;
}

/**
 * @param {Product} product
 * @param {string} saleUnit - SALE_UNITS.PACK or SALE_UNITS.PIECE.
 * @returns {number} How many stock pieces one unit consumes.
 */
export function getPiecesPerSaleUnit(product, saleUnit) {
  return saleUnit === SALE_UNITS.PIECE ? 1 : product.piecesPerPack;
}

/**
 * @param {Product} product
 * @param {string} saleUnit
 * @returns {number} Price of one unit in centavos.
 */
export function getUnitPrice(product, saleUnit) {
  return saleUnit === SALE_UNITS.PIECE ? product.pricePerPiece : product.pricePerPack;
}

/**
 * Cost of a number of pieces, rounded once per line to avoid
 * accumulating fractional centavos (e.g. ₱10 pack / 3 pieces).
 * @param {Product} product
 * @param {number} pieces
 * @returns {number} Centavos.
 */
export function getCostOfPieces(product, pieces) {
  return Math.round((product.costPerPack * pieces) / product.piecesPerPack);
}

/**
 * @param {Product} product
 * @returns {{packs:number, pieces:number}} e.g. 35 pieces of a 10-pack → 3 packs + 5 pcs.
 */
export function splitStock(product) {
  return {
    packs: Math.floor(product.stockPieces / product.piecesPerPack),
    pieces: product.stockPieces % product.piecesPerPack,
  };
}

/**
 * @param {Product} product
 * @returns {boolean} True when stock is at or below the reorder level.
 */
export function isLowStock(product) {
  return product.stockPieces <= product.reorderLevel * product.piecesPerPack;
}

/**
 * @param {Product} product
 * @param {string} todayKey
 * @param {number} warningDays
 * @returns {boolean} True when the expiry date is within the warning window (or passed).
 */
export function isExpiringSoon(product, todayKey, warningDays) {
  return Boolean(product.expiryDate) && daysBetween(todayKey, product.expiryDate) <= warningDays;
}

/**
 * @param {Product} product
 * @returns {number} Margin percent of the pack price.
 */
export function getMarginPercent(product) {
  return calculateMarginPercent(product.pricePerPack, product.costPerPack);
}
