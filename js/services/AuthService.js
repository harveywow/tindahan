/**
 * @file Owner PIN: setting, verifying and removing it.
 * Depends on: config.js, core/AppError.js.
 *
 * SECURITY NOTE: this is a basic deterrent against a helper casually voiding
 * sales or changing prices — not real security. Anyone with the browser's dev
 * tools can read or clear localStorage. We still hash the PIN (SHA-256 with a
 * random salt) so it is never stored as plain text.
 */
import { LIMITS } from '../config.js';
import { AuthError, ValidationError } from '../core/AppError.js';

const AUTH_KEY = 'auth';

/**
 * @param {Uint8Array} bytes
 * @returns {string} Lowercase hex.
 */
function toHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export class AuthService {
  /**
   * @param {Object} deps
   * @param {import('../core/Storage.js').Storage} deps.storage
   * @param {import('./LogService.js').LogService} deps.logService
   */
  constructor({ storage, logService }) {
    this.storage = storage;
    this.logService = logService;
  }

  /** @returns {boolean} True when an owner PIN has been set. */
  hasPin() {
    return Boolean(this.storage.read(AUTH_KEY, null)?.pinHash);
  }

  /**
   * @param {string} pin
   * @param {string} salt
   * @returns {Promise<string>} Hex SHA-256 of salt + pin.
   */
  async hashPin(pin, salt) {
    const encoded = new TextEncoder().encode(`${salt}:${pin}`);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', encoded);
    return toHex(new Uint8Array(digest));
  }

  /**
   * @param {string} pin
   * @returns {string} The PIN when it is 4–6 digits.
   * @throws {ValidationError}
   */
  validatePinFormat(pin) {
    const text = String(pin ?? '');
    const pattern = new RegExp(`^\\d{${LIMITS.MIN_PIN_LENGTH},${LIMITS.MAX_PIN_LENGTH}}$`);
    if (!pattern.test(text)) {
      throw new ValidationError('errors.invalidPin', {}, 'pin');
    }
    return text;
  }

  /**
   * @param {string} pin
   * @returns {Promise<boolean>} True when the PIN matches. Always true when no PIN is set.
   */
  async verifyPin(pin) {
    const auth = this.storage.read(AUTH_KEY, null);
    if (!auth?.pinHash) {
      return true;
    }
    return (await this.hashPin(String(pin ?? ''), auth.salt)) === auth.pinHash;
  }

  /**
   * Sets or changes the PIN. Changing requires the current PIN.
   * @param {string} newPin
   * @param {string} [currentPin]
   * @returns {Promise<void>}
   * @throws {ValidationError|AuthError}
   */
  async setPin(newPin, currentPin = '') {
    const validPin = this.validatePinFormat(newPin);
    if (this.hasPin() && !(await this.verifyPin(currentPin))) {
      throw new AuthError('errors.wrongPin', {}, 'currentPin');
    }
    const salt = toHex(globalThis.crypto.getRandomValues(new Uint8Array(16)));
    this.storage.write(AUTH_KEY, { salt, pinHash: await this.hashPin(validPin, salt) });
    this.logService.record('settings', 'log.pinChanged');
  }

  /**
   * @param {string} currentPin
   * @returns {Promise<void>}
   * @throws {AuthError}
   */
  async removePin(currentPin) {
    if (!(await this.verifyPin(currentPin))) {
      throw new AuthError('errors.wrongPin', {}, 'currentPin');
    }
    this.storage.remove(AUTH_KEY);
    this.logService.record('settings', 'log.pinRemoved');
  }
}
