/**
 * @file Shared behaviour for services: logging actions and announcing changes.
 * Depends on: core/EventBus.js.
 *
 * Why a base class: every service that changes data must (1) write an
 * activity-log entry and (2) tell the UI to refresh. Putting both here
 * avoids repeating the same two lines in a dozen places.
 */
import { EVENTS } from '../core/EventBus.js';

export class BaseService {
  /**
   * @param {Object} deps
   * @param {import('../core/EventBus.js').EventBus} deps.bus
   * @param {import('./LogService.js').LogService} [deps.logService]
   */
  constructor({ bus, logService }) {
    this.bus = bus;
    this.logService = logService;
  }

  /**
   * Records an activity-log entry (if logging is wired) and notifies listeners.
   * @param {string} action - Log category, e.g. 'sale'.
   * @param {string} messageKey - i18n key describing what happened.
   * @param {Object<string, (string|number)>} [params]
   */
  announce(action, messageKey, params = {}) {
    this.logService?.record(action, messageKey, params);
    this.bus.emit(EVENTS.DATA_CHANGED, { source: action });
  }
}
