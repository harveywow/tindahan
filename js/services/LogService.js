/**
 * @file Activity log (Talaan): an append-only record of important actions.
 * Depends on: models/LogEntry.js.
 */
import { createLogEntry } from '../models/LogEntry.js';

/**
 * Oldest entries beyond this are dropped. Why: localStorage holds ~5 MB per
 * site; an unbounded log would eventually crowd out sales data.
 */
export const MAX_LOG_ENTRIES = 3000;

export class LogService {
  /**
   * @param {import('../core/Repository.js').Repository} logRepository
   */
  constructor(logRepository) {
    this.repository = logRepository;
  }

  /**
   * Appends an entry. Logging must never break the action being logged,
   * so a storage failure here is swallowed (and reported to the console).
   * @param {string} action
   * @param {string} messageKey
   * @param {Object<string, (string|number)>} [params]
   */
  record(action, messageKey, params = {}) {
    try {
      const entry = createLogEntry(action, messageKey, params);
      this.repository.records.set(entry.id, entry);
      this.trimToLimit();
      this.repository.save();
    } catch (error) {
      console.error('Could not write activity log', error);
    }
  }

  /** Drops the oldest entries above MAX_LOG_ENTRIES (Map keeps insertion order). */
  trimToLimit() {
    const overflow = this.repository.records.size - MAX_LOG_ENTRIES;
    if (overflow <= 0) {
      return;
    }
    [...this.repository.records.keys()].slice(0, overflow).forEach((id) => {
      this.repository.records.delete(id);
    });
  }

  /**
   * @param {{action?: string}} [filter] - '' or undefined means all actions.
   * @returns {import('../models/LogEntry.js').LogEntry[]} Newest first.
   */
  list({ action = '' } = {}) {
    return this.repository
      .getAll()
      .filter((entry) => !action || entry.action === action)
      .reverse();
  }
}
