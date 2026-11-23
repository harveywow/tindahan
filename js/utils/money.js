/**
 * @file Money helpers. All money in the app is an integer number of centavos.
 * Depends on: config.js, core/AppError.js.
 *
 * Why centavos: JavaScript numbers are binary floating point, so
 * 0.1 + 0.2 === 0.30000000000000004. Summing ₱12.10 items would drift by
 * fractions of a centavo and break the end-of-day cash count. Integers are exact.
 */
import { DENOMINATIONS, LIMITS, SMALLEST_COIN_CENTAVOS } from '../config.js';
import { ValidationError } from '../core/AppError.js';

const PESO_PATTERN = /^\d+(\.\d{1,2})?$/;

/**
 * Converts user input like "12.50" or 12.5 into centavos.
 * Commas and a leading peso sign are accepted because people type "₱1,000".
 * @param {string|number} input
 * @param {string} [field] - Form field name for the error.
 * @returns {number} Integer centavos.
 * @throws {ValidationError} When empty, negative, not a number, Infinity,
 *   has more than 2 decimals, or exceeds the maximum.
 * @example parsePesoToCentavos('₱1,234.50') // 123450
 */
export function parsePesoToCentavos(input, field = '') {
  const text = String(input ?? '')
    .replace(/[₱,\s]/g, '')
    .trim();
  if (text === '') {
    throw new ValidationError('errors.required', {}, field);
  }
  if (!PESO_PATTERN.test(text)) {
    throw new ValidationError('errors.invalidMoney', {}, field);
  }
  // Split on the decimal point instead of multiplying by 100, which would
  // reintroduce float error (e.g. 1.15 * 100 === 114.99999999999999).
  const [wholePart, decimalPart = ''] = text.split('.');
  const centavos = Number(wholePart) * 100 + Number(decimalPart.padEnd(2, '0'));
  if (centavos > LIMITS.MAX_MONEY_CENTAVOS) {
    throw new ValidationError(
      'errors.moneyTooLarge',
      { max: formatPeso(LIMITS.MAX_MONEY_CENTAVOS) },
      field,
    );
  }
  return centavos;
}

/**
 * Formats centavos for display.
 * @param {number} centavos
 * @returns {string} e.g. "₱1,234.50" or "-₱5.00".
 */
export function formatPeso(centavos) {
  const sign = centavos < 0 ? '-' : '';
  const absolute = Math.abs(Math.round(centavos));
  const pesos = Math.floor(absolute / 100).toLocaleString('en-PH');
  const cents = String(absolute % 100).padStart(2, '0');
  return `${sign}₱${pesos}.${cents}`;
}

/**
 * Formats centavos for an <input>, without symbol or thousands separators.
 * @param {number} centavos
 * @returns {string} e.g. "1234.50"
 */
export function centavosToInputValue(centavos) {
  return (centavos / 100).toFixed(2);
}

/**
 * @param {number} centavos
 * @returns {boolean} True when the amount can be paid with real PH coins.
 */
export function isPayableAmount(centavos) {
  return Number.isInteger(centavos) && centavos % SMALLEST_COIN_CENTAVOS === 0;
}

/**
 * Splits an amount of change into the fewest bills and coins.
 *
 * Why greedy works here: the PH denominations follow the 1-2-5 pattern per
 * power of ten (plus 25¢). Such "canonical" coin systems are proven to give an
 * optimal answer by always taking the largest piece that fits. Our tests
 * confirm it by comparing against a slower dynamic-programming solution for
 * every amount up to ₱2,000.
 *
 * @param {number} changeCentavos - Non-negative integer.
 * @param {ReadonlyArray<{value:number,label:string}>} [denominations] - Largest first.
 * @returns {{pieces: Array<{value:number,label:string,count:number}>, remainder:number}}
 *   remainder is non-zero only if the amount is not a multiple of 25¢.
 * @example calculateChangeBreakdown(7550).pieces
 *   // [{label:'₱50',count:1},{label:'₱20',count:1},{label:'₱5',count:1},{label:'25¢',count:2}]
 */
export function calculateChangeBreakdown(changeCentavos, denominations = DENOMINATIONS) {
  let remaining = Math.max(0, Math.round(changeCentavos));
  const pieces = [];
  for (const denomination of denominations) {
    const count = Math.floor(remaining / denomination.value);
    if (count > 0) {
      pieces.push({ value: denomination.value, label: denomination.label, count });
      remaining -= count * denomination.value;
    }
  }
  return { pieces, remainder: remaining };
}

/**
 * Totals a cash count.
 * @param {Object<string, number>} countsByValue - Denomination value → number of pieces.
 * @returns {number} Total in centavos.
 */
export function sumCashCount(countsByValue) {
  return DENOMINATIONS.reduce(
    (total, denomination) =>
      total + denomination.value * (Number(countsByValue[denomination.value]) || 0),
    0,
  );
}

/**
 * Percentage of the selling price that is profit.
 * @param {number} priceCentavos
 * @param {number} costCentavos
 * @returns {number} Rounded to one decimal; 0 when price is 0.
 */
export function calculateMarginPercent(priceCentavos, costCentavos) {
  if (priceCentavos <= 0) {
    return 0;
  }
  return Math.round(((priceCentavos - costCentavos) / priceCentavos) * 1000) / 10;
}
