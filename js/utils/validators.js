/**
 * @file Reusable input validators. Each returns the cleaned value or throws
 * a ValidationError carrying the field name, so forms can show the message
 * right under the offending input.
 * Depends on: config.js, core/AppError.js, utils/money.js.
 */
import { LIMITS, SMALLEST_COIN_CENTAVOS } from '../config.js';
import { ValidationError } from '../core/AppError.js';
import { formatPeso, isPayableAmount, parsePesoToCentavos } from './money.js';

/**
 * Requires non-blank text within a maximum length.
 * @param {*} value
 * @param {string} field
 * @param {{maxLength?: number}} [options]
 * @returns {string} Trimmed text with inner whitespace collapsed.
 * @throws {ValidationError}
 */
export function requireText(value, field, { maxLength = LIMITS.MAX_NAME_LENGTH } = {}) {
  const text = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text === '') {
    throw new ValidationError('errors.required', {}, field);
  }
  if (text.length > maxLength) {
    throw new ValidationError('errors.tooLong', { max: maxLength }, field);
  }
  return text;
}

/**
 * Like requireText but allows empty input.
 * @param {*} value
 * @param {string} field
 * @param {{maxLength?: number}} [options]
 * @returns {string}
 * @throws {ValidationError} Only when too long.
 */
export function optionalText(value, field, { maxLength = LIMITS.MAX_NOTE_LENGTH } = {}) {
  const text = String(value ?? '').trim();
  if (text.length > maxLength) {
    throw new ValidationError('errors.tooLong', { max: maxLength }, field);
  }
  return text;
}

/**
 * Requires a money amount.
 * @param {*} value
 * @param {string} field
 * @param {{allowZero?: boolean, mustBePayable?: boolean}} [options]
 *   mustBePayable: amount must be a multiple of 25¢ (selling prices, cash received)
 *   so change can always be handed back with real coins.
 * @returns {number} Centavos.
 * @throws {ValidationError}
 */
export function requireMoney(value, field, { allowZero = false, mustBePayable = false } = {}) {
  const centavos = parsePesoToCentavos(value, field);
  if (!allowZero && centavos === 0) {
    throw new ValidationError('errors.mustBePositive', {}, field);
  }
  if (mustBePayable && !isPayableAmount(centavos)) {
    throw new ValidationError(
      'errors.notPayable',
      { coin: formatPeso(SMALLEST_COIN_CENTAVOS) },
      field,
    );
  }
  return centavos;
}

/**
 * Requires a whole number in a range. Rejects decimals such as "1.5" for
 * items that cannot be split.
 * @param {*} value
 * @param {string} field
 * @param {{min?: number, max?: number}} [options]
 * @returns {number}
 * @throws {ValidationError}
 */
export function requireInteger(value, field, { min = 0, max = LIMITS.MAX_QUANTITY } = {}) {
  const text = String(value ?? '').trim();
  if (text === '') {
    throw new ValidationError('errors.required', {}, field);
  }
  if (!/^-?\d+$/.test(text)) {
    throw new ValidationError('errors.wholeNumber', {}, field);
  }
  const number = Number(text);
  if (number < min || number > max) {
    throw new ValidationError('errors.outOfRange', { min, max }, field);
  }
  return number;
}

/**
 * Philippine mobile number in the local 11-digit format. Empty is allowed.
 * @param {*} value
 * @param {string} field
 * @returns {string} Digits only, or ''.
 * @throws {ValidationError}
 */
export function optionalPhMobile(value, field) {
  const digits = String(value ?? '').replace(/[\s-]/g, '');
  if (digits === '') {
    return '';
  }
  if (!/^09\d{9}$/.test(digits)) {
    throw new ValidationError('errors.invalidMobile', {}, field);
  }
  return digits;
}

/**
 * GCash reference numbers are 13 digits.
 * @param {*} value
 * @param {string} field
 * @returns {string}
 * @throws {ValidationError}
 */
export function requireGcashReference(value, field) {
  const digits = String(value ?? '').replace(/\s/g, '');
  if (digits === '') {
    throw new ValidationError('errors.gcashRequired', {}, field);
  }
  if (!new RegExp(`^\\d{${LIMITS.GCASH_REFERENCE_LENGTH}}$`).test(digits)) {
    throw new ValidationError(
      'errors.invalidGcash',
      { length: LIMITS.GCASH_REFERENCE_LENGTH },
      field,
    );
  }
  return digits;
}

/**
 * Requires one of a fixed set of values.
 * @param {*} value
 * @param {string} field
 * @param {ReadonlyArray<string>} allowedValues
 * @returns {string}
 * @throws {ValidationError}
 */
export function requireOneOf(value, field, allowedValues) {
  if (!allowedValues.includes(value)) {
    throw new ValidationError('errors.invalidChoice', {}, field);
  }
  return value;
}

/**
 * Normalizes a name for duplicate detection: "  Lucky  Me " equals "lucky me".
 * @param {string} name
 * @returns {string}
 */
export function normalizeName(name) {
  return String(name ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
