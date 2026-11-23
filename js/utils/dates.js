/**
 * @file Date helpers built around "date keys" (YYYY-MM-DD in local time).
 * Depends on: core/AppError.js.
 *
 * Why date keys instead of Date objects: a store day is a calendar day in the
 * Philippines, not a UTC instant. A sale at 11:30 PM must belong to today,
 * but toISOString() would put it on tomorrow (UTC is 8 hours behind Manila).
 * Strings like "2026-11-22" also sort and compare correctly as plain text.
 */
import { ValidationError } from '../core/AppError.js';

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * @param {Date} [date]
 * @returns {string} Local calendar date as YYYY-MM-DD.
 */
export function toDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * @param {string} dateKey
 * @returns {Date} Local midnight of that day.
 */
export function fromDateKey(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * @param {string} dateKey
 * @returns {boolean} True for a real calendar date (rejects 2026-02-30).
 */
export function isValidDateKey(dateKey) {
  if (!DATE_KEY_PATTERN.test(String(dateKey))) {
    return false;
  }
  return toDateKey(fromDateKey(dateKey)) === dateKey;
}

/**
 * @param {string} dateKey
 * @param {number} days - May be negative.
 * @returns {string}
 */
export function addDays(dateKey, days) {
  const date = fromDateKey(dateKey);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

/**
 * Whole days from one date key to another. Uses UTC math on the parts so a
 * daylight-saving shift (in other time zones) can't produce 0.958 days.
 * @param {string} fromKey
 * @param {string} toKey
 * @returns {number}
 */
export function daysBetween(fromKey, toKey) {
  const toUtc = (key) => {
    const [year, month, day] = key.split('-').map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((toUtc(toKey) - toUtc(fromKey)) / MS_PER_DAY);
}

/**
 * Validates an optional date range from filter inputs.
 * @param {string} startKey - '' means unbounded.
 * @param {string} endKey - '' means unbounded.
 * @returns {{startKey: string, endKey: string}}
 * @throws {ValidationError} When a date is invalid or start is after end.
 */
export function validateDateRange(startKey, endKey) {
  if (startKey && !isValidDateKey(startKey)) {
    throw new ValidationError('errors.invalidDate', {}, 'startDate');
  }
  if (endKey && !isValidDateKey(endKey)) {
    throw new ValidationError('errors.invalidDate', {}, 'endDate');
  }
  if (startKey && endKey && startKey > endKey) {
    throw new ValidationError('errors.startAfterEnd', {}, 'startDate');
  }
  return { startKey, endKey };
}

/**
 * @param {string} dateKey
 * @param {string} startKey - '' means no lower bound.
 * @param {string} endKey - '' means no upper bound.
 * @returns {boolean}
 */
export function isWithinRange(dateKey, startKey, endKey) {
  return (!startKey || dateKey >= startKey) && (!endKey || dateKey <= endKey);
}

/**
 * Monday-based week key: the date key of that week's Monday.
 * @param {string} dateKey
 * @returns {string}
 */
export function toWeekKey(dateKey) {
  const weekday = fromDateKey(dateKey).getDay(); // 0 = Sunday
  const daysSinceMonday = (weekday + 6) % 7;
  return addDays(dateKey, -daysSinceMonday);
}

/**
 * @param {string} dateKey
 * @returns {string} YYYY-MM
 */
export function toMonthKey(dateKey) {
  return dateKey.slice(0, 7);
}

/**
 * @param {string} isoTimestamp
 * @param {string} [locale]
 * @returns {string} e.g. "Nov 22, 2026, 6:30 PM"
 */
export function formatDateTime(isoTimestamp, locale = 'en-PH') {
  return new Date(isoTimestamp).toLocaleString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * @param {string} dateKey
 * @param {string} [locale]
 * @returns {string} e.g. "Sun, Nov 22, 2026"
 */
export function formatDateKey(dateKey, locale = 'en-PH') {
  return fromDateKey(dateKey).toLocaleDateString(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
