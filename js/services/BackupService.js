/**
 * @file Full JSON backup, schema-checked restore, and reset.
 * Depends on: config.js, core/AppError.js, core/EventBus.js.
 *
 * Why strict validation before restoring: a backup file can be edited by
 * hand or come from somewhere else. Writing an unchecked file would leave the
 * app with records missing fields (crashes later) or unexpected keys. We
 * reject the whole file unless every record has the right shape, and nothing
 * is overwritten until validation passes.
 */
import { COLLECTION_NAMES, SCHEMA_VERSION } from '../config.js';
import { ValidationError } from '../core/AppError.js';
import { EVENTS } from '../core/EventBus.js';
import { nowIso } from '../utils/ids.js';

const APP_SIGNATURE = 'tindahan';

/** Documents included in backups. The PIN is deliberately excluded. */
const BACKUP_DOCUMENTS = Object.freeze(['settings', 'categories', 'counters']);

/** Required fields and their types for each collection. */
const RECORD_SCHEMAS = Object.freeze({
  products: {
    id: 'string',
    name: 'string',
    category: 'string',
    costPerPack: 'int',
    pricePerPack: 'int',
    pricePerPiece: 'int',
    piecesPerPack: 'int',
    stockPieces: 'int',
    reorderLevel: 'int',
    isTingi: 'boolean',
    isArchived: 'boolean',
  },
  sales: {
    id: 'string',
    receiptNumber: 'string',
    dayKey: 'string',
    items: 'array',
    total: 'int',
    totalCost: 'int',
    paymentType: 'string',
    status: 'string',
  },
  customers: { id: 'string', name: 'string', creditLimit: 'int' },
  creditEntries: {
    id: 'string',
    customerId: 'string',
    type: 'string',
    amount: 'int',
    dayKey: 'string',
  },
  expenses: {
    id: 'string',
    type: 'string',
    description: 'string',
    amount: 'int',
    dayKey: 'string',
  },
  stockAdjustments: { id: 'string', productId: 'string', changePieces: 'int' },
  days: { id: 'string', status: 'string', openingCash: 'int' },
  restockItems: { id: 'string', name: 'string', quantity: 'int' },
  logEntries: { id: 'string', action: 'string', messageKey: 'string' },
});

const TYPE_CHECKS = Object.freeze({
  string: (value) => typeof value === 'string',
  int: (value) => Number.isInteger(value),
  boolean: (value) => typeof value === 'boolean',
  array: (value) => Array.isArray(value),
});

/**
 * @param {*} value
 * @returns {boolean} True for a plain object (not null, not an array).
 */
function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * @param {string} reason
 * @returns {ValidationError}
 */
function invalidBackup(reason) {
  return new ValidationError('errors.invalidBackup', { reason }, 'backupFile');
}

export class BackupService {
  /**
   * @param {Object} deps
   * @param {import('../core/Storage.js').Storage} deps.storage
   * @param {Object<string, import('../core/Repository.js').Repository>} deps.repositories - By collection name.
   * @param {import('../core/EventBus.js').EventBus} deps.bus
   * @param {import('./LogService.js').LogService} deps.logService
   */
  constructor({ storage, repositories, bus, logService }) {
    this.storage = storage;
    this.repositories = repositories;
    this.bus = bus;
    this.logService = logService;
  }

  /** @returns {Object} Everything needed to rebuild the store's data. */
  createBackup() {
    const collections = Object.fromEntries(
      COLLECTION_NAMES.map((name) => [name, this.repositories[name].getAll()]),
    );
    const documents = Object.fromEntries(
      BACKUP_DOCUMENTS.map((name) => [name, this.storage.read(name, null)]),
    );
    return {
      app: APP_SIGNATURE,
      schemaVersion: SCHEMA_VERSION,
      exportedAt: nowIso(),
      collections,
      documents,
    };
  }

  /**
   * @param {string} text - File contents.
   * @returns {Object} Parsed and validated backup.
   * @throws {ValidationError}
   */
  parseBackup(text) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw invalidBackup('not JSON');
    }
    this.validateBackup(parsed);
    return parsed;
  }

  /**
   * @param {*} backup
   * @throws {ValidationError} Describing the first problem found.
   */
  validateBackup(backup) {
    if (!isPlainObject(backup) || backup.app !== APP_SIGNATURE) {
      throw invalidBackup('not a Tindahan backup');
    }
    if (!Number.isInteger(backup.schemaVersion) || backup.schemaVersion > SCHEMA_VERSION) {
      throw invalidBackup('unsupported version');
    }
    if (!isPlainObject(backup.collections) || !isPlainObject(backup.documents)) {
      throw invalidBackup('missing sections');
    }
    const unknownKeys = Object.keys(backup.collections).filter(
      (name) => !COLLECTION_NAMES.includes(name),
    );
    if (unknownKeys.length > 0) {
      throw invalidBackup(`unknown section "${unknownKeys[0]}"`);
    }
    COLLECTION_NAMES.forEach((name) => this.validateCollection(name, backup.collections[name]));
    this.validateDocuments(backup.documents);
  }

  /**
   * @param {string} name
   * @param {*} records
   * @throws {ValidationError}
   */
  validateCollection(name, records) {
    if (!Array.isArray(records)) {
      throw invalidBackup(`"${name}" is not a list`);
    }
    const schema = RECORD_SCHEMAS[name];
    const seenIds = new Set();
    records.forEach((record, index) => {
      if (!isPlainObject(record)) {
        throw invalidBackup(`${name}[${index}] is not a record`);
      }
      Object.entries(schema).forEach(([field, type]) => {
        if (!TYPE_CHECKS[type](record[field])) {
          throw invalidBackup(`${name}[${index}].${field} should be ${type}`);
        }
      });
      if (seenIds.has(record.id)) {
        throw invalidBackup(`${name} has duplicate id ${record.id}`);
      }
      seenIds.add(record.id);
    });
  }

  /**
   * @param {Object} documents
   * @throws {ValidationError}
   */
  validateDocuments(documents) {
    // A document may be missing (null) — e.g. settings never changed — but if
    // present it must have the right shape.
    const isMissing = (value) => value === null || value === undefined;
    const isNameList = (value) =>
      Array.isArray(value) && value.every((category) => typeof category === 'string');
    const checks = [
      ['settings', isPlainObject, 'settings should be an object'],
      ['categories', isNameList, 'categories should be a list of names'],
      ['counters', isPlainObject, 'counters should be an object'],
    ];
    checks.forEach(([name, isValid, reason]) => {
      if (!isMissing(documents[name]) && !isValid(documents[name])) {
        throw invalidBackup(reason);
      }
    });
  }

  /**
   * Replaces all data with a validated backup.
   * @param {Object} backup - Output of parseBackup.
   */
  restore(backup) {
    this.validateBackup(backup);
    COLLECTION_NAMES.forEach((name) =>
      this.repositories[name].replaceAll(backup.collections[name]),
    );
    BACKUP_DOCUMENTS.forEach((name) => {
      const value = backup.documents[name];
      if (value === null || value === undefined) {
        this.storage.remove(name);
      } else {
        this.storage.write(name, value);
      }
    });
    this.logService.record('settings', 'log.backupRestored');
    this.announceEverythingChanged();
  }

  /** Deletes every record and document, including the PIN. */
  resetAll() {
    this.storage.clear([...COLLECTION_NAMES, ...BACKUP_DOCUMENTS, 'auth']);
    COLLECTION_NAMES.forEach((name) => this.repositories[name].load());
    this.announceEverythingChanged();
  }

  /** Tells every screen to re-render from scratch. */
  announceEverythingChanged() {
    this.bus.emit(EVENTS.SETTINGS_CHANGED, null);
    this.bus.emit(EVENTS.DAY_CHANGED, null);
    this.bus.emit(EVENTS.DATA_CHANGED, { source: 'backup' });
  }
}
