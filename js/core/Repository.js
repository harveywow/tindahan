/**
 * @file Generic in-memory collection backed by Storage.
 * Depends on: core/Storage.js, core/AppError.js.
 *
 * Why a Map: services look records up by id constantly (basket → product,
 * sale → customer). A Map gives O(1) lookups instead of scanning an array,
 * and it keeps insertion order so lists still display chronologically.
 * Every service reuses this class, so persistence code is written once.
 */
import { NotFoundError } from './AppError.js';

export class Repository {
  /**
   * @param {import('./Storage.js').Storage} storage
   * @param {string} collectionName - Storage key for this collection.
   */
  constructor(storage, collectionName) {
    this.storage = storage;
    this.collectionName = collectionName;
    /** @type {Map<string, Object>} */
    this.records = new Map();
    this.load();
  }

  /** Reloads records from storage, ignoring anything that is not a list of objects with ids. */
  load() {
    const storedList = this.storage.read(this.collectionName, []);
    const safeList = Array.isArray(storedList) ? storedList : [];
    if (!Array.isArray(storedList)) {
      this.storage.recoveredKeys.push(this.collectionName);
    }
    this.records = new Map(
      safeList.filter((record) => record && typeof record.id === 'string').map((r) => [r.id, r]),
    );
  }

  /** Persists the whole collection. */
  save() {
    this.storage.write(this.collectionName, [...this.records.values()]);
  }

  /** @returns {Object[]} All records in insertion order. */
  getAll() {
    return [...this.records.values()];
  }

  /**
   * @param {string} id
   * @returns {Object|undefined}
   */
  findById(id) {
    return this.records.get(id);
  }

  /**
   * @param {string} id
   * @returns {Object}
   * @throws {NotFoundError} When the record does not exist.
   */
  getById(id) {
    const record = this.records.get(id);
    if (!record) {
      throw new NotFoundError('errors.notFound');
    }
    return record;
  }

  /**
   * Adds or replaces a record and saves. If saving fails (e.g. storage full),
   * the in-memory change is rolled back so memory and storage stay in sync.
   * @param {Object} record - Must have a string id.
   * @returns {Object} The saved record.
   */
  upsert(record) {
    const previous = this.records.get(record.id);
    this.records.set(record.id, record);
    try {
      this.save();
    } catch (error) {
      this.rollback(record.id, previous);
      throw error;
    }
    return record;
  }

  /**
   * Deletes a record and saves.
   * @param {string} id
   */
  remove(id) {
    const previous = this.records.get(id);
    this.records.delete(id);
    try {
      this.save();
    } catch (error) {
      this.rollback(id, previous);
      throw error;
    }
  }

  /**
   * Restores a record to its state before a failed save.
   * @param {string} id
   * @param {Object|undefined} previous
   */
  rollback(id, previous) {
    if (previous) {
      this.records.set(id, previous);
    } else {
      this.records.delete(id);
    }
  }

  /**
   * Replaces every record (used by restore and demo data).
   * @param {Object[]} records
   */
  replaceAll(records) {
    this.records = new Map(records.map((record) => [record.id, record]));
    this.save();
  }
}
