/**
 * @file Tests for Storage, Repository and EventBus.
 */
import { SCHEMA_VERSION } from '../js/config.js';
import { StorageQuotaError } from '../js/core/AppError.js';
import { EventBus } from '../js/core/EventBus.js';
import { MemoryBackend } from '../js/core/MemoryBackend.js';
import { Repository } from '../js/core/Repository.js';
import { Storage } from '../js/core/Storage.js';
import { createTestApp, SARDINES_INPUT } from './helpers.js';
import { describe, expect, it } from './testRunner.js';

describe('Storage', () => {
  it('round-trips JSON values under a prefix', () => {
    const backend = new MemoryBackend();
    const storage = new Storage(backend, 'demo');
    storage.write('settings', { storeName: 'Tindahan' });
    expect(backend.getItem('demo:settings')).toBe('{"storeName":"Tindahan"}');
    expect(storage.read('settings', null)).toEqual({ storeName: 'Tindahan' });
  });

  it('[EC12] returns the fallback for missing data', () => {
    expect(new Storage(new MemoryBackend()).read('products', [])).toEqual([]);
  });

  it('[EC12] recovers from corrupted JSON and reports which key', () => {
    const backend = new MemoryBackend();
    backend.setItem('tindahan:products', '{not valid json');
    const storage = new Storage(backend);
    expect(storage.read('products', [])).toEqual([]);
    expect(storage.recoveredKeys).toEqual(['products']);
  });

  it('[EC12] a repository ignores stored data that is not a list of records', () => {
    const backend = new MemoryBackend();
    backend.setItem('tindahan:sales', '{"oops":true}');
    const storage = new Storage(backend);
    const repository = new Repository(storage, 'sales');
    expect(repository.getAll()).toEqual([]);
    expect(storage.recoveredKeys).toContain('sales');
  });

  it('[EC12] runs migrations for old-version data', () => {
    const backend = new MemoryBackend();
    backend.setItem('tindahan:schemaVersion', '0');
    const storage = new Storage(backend);
    let migratedFrom = -1;
    storage.migrate({ 0: () => (migratedFrom = 0) });
    expect(migratedFrom).toBe(0);
    expect(storage.read('schemaVersion', null)).toBe(SCHEMA_VERSION);
  });

  it('[EC13] turns a browser quota error into StorageQuotaError', () => {
    const storage = new Storage(new MemoryBackend(10));
    expect(() => storage.write('products', ['a long value that does not fit'])).toThrow(
      StorageQuotaError,
      'errors.storageFull',
    );
  });

  it('[EC13] keeps memory and storage in sync when a save fails', () => {
    const app = createTestApp({ quotaChars: 900 });
    const hugeImage = `data:image/png;base64,${'A'.repeat(800)}`;
    expect(() =>
      app.services.inventoryService.addProduct({ ...SARDINES_INPUT, imageDataUrl: hugeImage }),
    ).toThrow(StorageQuotaError);
    expect(app.services.inventoryService.listProducts()).toHaveLength(0);
  });
});

describe('EventBus', () => {
  it('delivers events and supports unsubscribing', () => {
    const bus = new EventBus();
    const received = [];
    const unsubscribe = bus.on('ping', (payload) => received.push(payload));
    bus.emit('ping', 1);
    unsubscribe();
    bus.emit('ping', 2);
    expect(received).toEqual([1]);
  });

  it('keeps notifying other handlers when one fails', () => {
    const bus = new EventBus();
    const originalError = console.error;
    console.error = () => {};
    let reached = false;
    bus.on('ping', () => {
      throw new Error('boom');
    });
    bus.on('ping', () => (reached = true));
    bus.emit('ping');
    console.error = originalError;
    expect(reached).toBe(true);
  });
});
