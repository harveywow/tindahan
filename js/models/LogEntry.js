/**
 * @file LogEntry model for the activity log (Talaan).
 * Depends on: utils/ids.js.
 *
 * Why the message is stored as an i18n key plus params instead of text:
 * the log can then be read in either language, even for old entries.
 */
import { generateId, nowIso } from '../utils/ids.js';

/**
 * @typedef {Object} LogEntry
 * @property {string} id
 * @property {string} action - Category used for filtering: 'sale', 'void', 'product', ...
 * @property {string} messageKey
 * @property {Object<string, (string|number)>} params
 * @property {string} createdAt
 */

/**
 * @param {string} action
 * @param {string} messageKey
 * @param {Object<string, (string|number)>} [params]
 * @returns {LogEntry}
 */
export function createLogEntry(action, messageKey, params = {}) {
  return { id: generateId('log'), action, messageKey, params, createdAt: nowIso() };
}
