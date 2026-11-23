/**
 * @file Store settings (name, owner, thresholds, language).
 * Depends on: config.js, core/EventBus.js, utils/validators.js, utils/i18n.js.
 */
import { DEFAULT_SETTINGS, LIMITS } from '../config.js';
import { EVENTS } from '../core/EventBus.js';
import { LANGUAGES } from '../utils/i18n.js';
import { requireInteger, requireOneOf, requireText } from '../utils/validators.js';

export class SettingsService {
  /**
   * @param {Object} deps
   * @param {import('../core/Storage.js').Storage} deps.storage
   * @param {import('../core/EventBus.js').EventBus} deps.bus
   * @param {import('./LogService.js').LogService} deps.logService
   */
  constructor({ storage, bus, logService }) {
    this.storage = storage;
    this.bus = bus;
    this.logService = logService;
  }

  /**
   * Missing keys (e.g. after an upgrade added a new setting) are filled from defaults.
   * @returns {typeof DEFAULT_SETTINGS}
   */
  get() {
    const stored = this.storage.read('settings', {});
    const safeStored = stored && typeof stored === 'object' ? stored : {};
    return { ...DEFAULT_SETTINGS, ...safeStored };
  }

  /**
   * @param {Object} input - Raw form values.
   * @returns {typeof DEFAULT_SETTINGS} Saved settings.
   * @throws {import('../core/AppError.js').ValidationError}
   */
  update(input) {
    const dayLimit = { min: 1, max: LIMITS.MAX_DAYS_SETTING };
    const settings = {
      storeName: requireText(input.storeName, 'storeName'),
      ownerName: requireText(input.ownerName, 'ownerName'),
      overdueDays: requireInteger(input.overdueDays, 'overdueDays', dayLimit),
      expiryWarningDays: requireInteger(input.expiryWarningDays, 'expiryWarningDays', {
        min: 0,
        max: LIMITS.MAX_DAYS_SETTING,
      }),
      slowMoverDays: requireInteger(input.slowMoverDays, 'slowMoverDays', dayLimit),
      language: requireOneOf(input.language, 'language', LANGUAGES),
    };
    this.storage.write('settings', settings);
    this.logService.record('settings', 'log.settingsUpdated');
    this.bus.emit(EVENTS.SETTINGS_CHANGED, settings);
    return settings;
  }

  /**
   * Changes only the language (used by the header toggle).
   * @param {string} language
   */
  setLanguage(language) {
    const settings = { ...this.get(), language: requireOneOf(language, 'language', LANGUAGES) };
    this.storage.write('settings', settings);
    this.bus.emit(EVENTS.SETTINGS_CHANGED, settings);
  }
}
