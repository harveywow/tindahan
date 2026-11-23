/**
 * @file Safe wrapper around localStorage: JSON parsing, quota errors,
 * corrupted-data recovery and schema migrations.
 * Depends on: config.js, core/AppError.js, core/MemoryBackend.js.
 */
import { SCHEMA_VERSION, STORAGE_PREFIX } from '../config.js';
import { StorageQuotaError } from './AppError.js';
import { MemoryBackend } from './MemoryBackend.js';

const VERSION_KEY = 'schemaVersion';

/**
 * Migrations keyed by the version they upgrade FROM. Each receives the Storage
 * instance and rewrites data into the next version's shape.
 * Version 1 is the first release, so the table is empty; it is kept so a
 * future change (e.g. adding a field) has an obvious place to go.
 * @type {Object<number, function(Storage): void>}
 */
const MIGRATIONS = {};

export class Storage {
  /**
   * @param {Storage|MemoryBackend} [backend] - Object implementing getItem/setItem/removeItem.
   *   Defaults to window.localStorage, falling back to memory when it is blocked.
   * @param {string} [prefix] - Namespace added before every key.
   */
  constructor(backend = Storage.detectBackend(), prefix = STORAGE_PREFIX) {
    this.backend = backend;
    this.prefix = prefix;
    /** Keys whose stored value was unreadable and had to be reset. Shown to the user once. */
    this.recoveredKeys = [];
    this.isPersistent = !(backend instanceof MemoryBackend);
  }

  /**
   * Picks localStorage when usable. Accessing it can throw in sandboxed or
   * private contexts, so the check itself is wrapped.
   * @returns {Storage|MemoryBackend}
   */
  static detectBackend() {
    try {
      const probeKey = `${STORAGE_PREFIX}:probe`;
      globalThis.localStorage.setItem(probeKey, '1');
      globalThis.localStorage.removeItem(probeKey);
      return globalThis.localStorage;
    } catch {
      return new MemoryBackend();
    }
  }

  /**
   * @param {string} name
   * @returns {string} Fully-qualified storage key.
   */
  buildKey(name) {
    return `${this.prefix}:${name}`;
  }

  /**
   * Reads and parses a value. Corrupted JSON is reported and replaced by the
   * fallback instead of crashing the whole app.
   * @template T
   * @param {string} name - Key without prefix.
   * @param {T} fallback - Returned when missing or unreadable.
   * @returns {T}
   */
  read(name, fallback) {
    const rawValue = this.backend.getItem(this.buildKey(name));
    if (rawValue === null) {
      return fallback;
    }
    try {
      return JSON.parse(rawValue);
    } catch {
      this.recoveredKeys.push(name);
      return fallback;
    }
  }

  /**
   * Serializes and saves a value.
   * @param {string} name - Key without prefix.
   * @param {*} value - Any JSON-serializable value.
   * @throws {StorageQuotaError} When the browser storage is full.
   */
  write(name, value) {
    try {
      this.backend.setItem(this.buildKey(name), JSON.stringify(value));
    } catch (error) {
      if (Storage.isQuotaError(error)) {
        throw new StorageQuotaError('errors.storageFull');
      }
      throw error;
    }
  }

  /** @param {string} name - Key without prefix. */
  remove(name) {
    this.backend.removeItem(this.buildKey(name));
  }

  /**
   * Browsers name this error differently (Chrome/Safari vs. old Firefox).
   * @param {Error} error
   * @returns {boolean}
   */
  static isQuotaError(error) {
    return ['QuotaExceededError', 'NS_ERROR_DOM_QUOTA_REACHED'].includes(error?.name);
  }

  /**
   * Brings stored data up to SCHEMA_VERSION by running migrations in order.
   * A missing version means a fresh install (or data from before versioning).
   * @param {Object<number, function(Storage): void>} [migrations]
   * @returns {number} The version the data was at before migrating.
   */
  migrate(migrations = MIGRATIONS) {
    const storedValue = this.read(VERSION_KEY, SCHEMA_VERSION);
    const storedVersion = Number.isInteger(storedValue) ? storedValue : SCHEMA_VERSION;
    for (let version = storedVersion; version < SCHEMA_VERSION; version += 1) {
      migrations[version]?.(this);
    }
    this.write(VERSION_KEY, SCHEMA_VERSION);
    return storedVersion;
  }

  /**
   * Removes every key belonging to this app (used by "Reset all data").
   * @param {string[]} names - Keys without prefix.
   */
  clear(names) {
    names.forEach((name) => this.remove(name));
    this.remove(VERSION_KEY);
  }
}
