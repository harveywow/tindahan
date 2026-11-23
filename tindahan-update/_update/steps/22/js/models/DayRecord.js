/**
 * @file DayRecord model: one store day from opening to closing.
 * Depends on: utils/ids.js.
 *
 * The record's id IS the date key, so there can only ever be one record per
 * calendar day and looking up "today" is a direct Map lookup.
 */
import { nowIso } from '../utils/ids.js';

export const DAY_STATUS = Object.freeze({ OPEN: 'open', CLOSED: 'closed' });

/**
 * @typedef {Object} DayRecord
 * @property {string} id - Date key YYYY-MM-DD.
 * @property {string} status - 'open' | 'closed'.
 * @property {number} openingCash - Centavos in the drawer at opening.
 * @property {string} openedAt
 * @property {string} closedAt
 * @property {Object<string, number>} cashCount - Denomination value → pieces counted.
 * @property {number} countedCash
 * @property {number} expectedCash
 * @property {number} difference - counted − expected (positive = sobra).
 * @property {string} closingNote
 * @property {Object|null} summary - Totals frozen at closing.
 * @property {number} reopenCount - How many times today was reopened after closing.
 * @property {ClosingSnapshot[]} previousClosings - Earlier counts, kept when the day is reopened.
 */

/**
 * @typedef {Object} ClosingSnapshot
 * @property {string} closedAt
 * @property {number} countedCash
 * @property {number} expectedCash
 * @property {number} difference
 * @property {string} closingNote
 */

/**
 * @param {string} dayKey
 * @param {number} openingCash
 * @returns {DayRecord}
 */
export function createDayRecord(dayKey, openingCash) {
  return {
    id: dayKey,
    status: DAY_STATUS.OPEN,
    openingCash,
    openedAt: nowIso(),
    closedAt: '',
    cashCount: {},
    countedCash: 0,
    expectedCash: 0,
    difference: 0,
    closingNote: '',
    summary: null,
    reopenCount: 0,
    previousClosings: [],
  };
}
