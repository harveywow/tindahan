/**
 * @file Source of "now" for services.
 * Depends on: utils/dates.js.
 *
 * Why inject a clock: overdue utang, expiry warnings and reports all depend on
 * today's date. Tests pass a fixed clock so results never change with the
 * real calendar.
 */
import { toDateKey } from '../utils/dates.js';

/**
 * @typedef {Object} Clock
 * @property {function(): string} today - Today's date key.
 */

/** @type {Clock} */
export const systemClock = Object.freeze({
  today: () => toDateKey(new Date()),
});

/**
 * @param {string} dateKey - The date the clock should always report.
 * @returns {Clock & {setToday: function(string): void}}
 */
export function createFixedClock(dateKey) {
  let currentKey = dateKey;
  return {
    today: () => currentKey,
    setToday: (newKey) => {
      currentKey = newKey;
    },
  };
}
