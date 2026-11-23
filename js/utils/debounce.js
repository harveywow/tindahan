/**
 * @file Debounce helper.
 * Depends on: nothing.
 */

/**
 * Delays calling a function until input stops for `waitMs`.
 * Why: filtering the product list on every keystroke re-renders the whole
 * shelf; waiting until the owner pauses typing keeps the screen smooth.
 * @param {Function} callback
 * @param {number} [waitMs=200]
 * @returns {Function} Debounced function.
 */
export function debounce(callback, waitMs = 200) {
  let timerId = null;
  return (...args) => {
    clearTimeout(timerId);
    timerId = setTimeout(() => callback(...args), waitMs);
  };
}
