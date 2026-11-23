/**
 * @file In-memory implementation of the Web Storage interface.
 * Depends on: nothing.
 *
 * Why it exists: (1) tests run services without a browser, and (2) when the
 * browser blocks localStorage (some private modes), the app still runs for the
 * session instead of crashing.
 */

export class MemoryBackend {
  /**
   * @param {number} [quotaChars=Infinity] - Max total characters; lets tests simulate a full storage.
   */
  constructor(quotaChars = Infinity) {
    this.entries = new Map();
    this.quotaChars = quotaChars;
  }

  /**
   * @param {string} key
   * @returns {string|null} Stored string or null when missing.
   */
  getItem(key) {
    return this.entries.has(key) ? this.entries.get(key) : null;
  }

  /**
   * @param {string} key
   * @param {string} value
   * @throws {DOMException|Error} Named "QuotaExceededError" when the quota is exceeded,
   *   matching what browsers throw.
   */
  setItem(key, value) {
    const text = String(value);
    const currentSize = this.getUsedChars() - (this.entries.get(key)?.length ?? 0);
    if (currentSize + text.length > this.quotaChars) {
      const quotaError = new Error('Storage quota exceeded');
      quotaError.name = 'QuotaExceededError';
      throw quotaError;
    }
    this.entries.set(key, text);
  }

  /** @param {string} key */
  removeItem(key) {
    this.entries.delete(key);
  }

  /** @returns {number} Number of stored keys. */
  get length() {
    return this.entries.size;
  }

  /**
   * @param {number} index
   * @returns {string|null} Key at the given position.
   */
  key(index) {
    return [...this.entries.keys()][index] ?? null;
  }

  /** @returns {number} Total characters stored. */
  getUsedChars() {
    let total = 0;
    this.entries.forEach((value) => {
      total += value.length;
    });
    return total;
  }
}
