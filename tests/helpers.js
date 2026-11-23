/**
 * @file Shared test fixtures: a fresh in-memory app with a fixed date.
 * Depends on: js/app/createApp.js, js/core/*.
 */
import { createApp } from '../js/app/createApp.js';
import { createFixedClock } from '../js/core/Clock.js';
import { MemoryBackend } from '../js/core/MemoryBackend.js';
import { Storage } from '../js/core/Storage.js';

export const TODAY = '2026-11-22';

/**
 * @param {Object} [options]
 * @param {string} [options.today]
 * @param {number} [options.quotaChars] - Simulate a nearly full browser storage.
 * @returns {Object} App plus its clock.
 */
export function createTestApp({ today = TODAY, quotaChars = Infinity } = {}) {
  const clock = createFixedClock(today);
  const storage = new Storage(new MemoryBackend(quotaChars), 'test');
  return createApp({ storage, clock });
}

/** Raw form values for a simple product (₱25 can, 10 in stock). */
export const SARDINES_INPUT = Object.freeze({
  name: 'Sardinas',
  category: 'Delata',
  unitLabel: 'lata',
  costPerPack: '20',
  pricePerPack: '25',
  reorderLevel: '3',
  initialStock: '10',
});

/** Raw form values for a tingi product (12-piece shampoo strip, 2 strips). */
export const SHAMPOO_INPUT = Object.freeze({
  name: 'Shampoo Sachet',
  category: 'Sabon',
  unitLabel: 'strip',
  costPerPack: '72',
  pricePerPack: '84',
  isTingi: true,
  piecesPerPack: '12',
  pricePerPiece: '7.50',
  reorderLevel: '1',
  initialStock: '2',
});

/** Raw form values for a suki with a ₱100 limit. */
export const CUSTOMER_INPUT = Object.freeze({
  name: 'Juan Dela Cruz',
  nickname: 'Mang Juan',
  contact: '09171234567',
  creditLimit: '100',
  notes: '',
});

/**
 * Builds an app with today's store open and two products.
 * @returns {Object} { app, services, sardines, shampoo }
 */
export function createOpenStore() {
  const app = createTestApp();
  const { services } = app;
  services.dayService.openDay('500');
  const sardines = services.inventoryService.addProduct(SARDINES_INPUT);
  const shampoo = services.inventoryService.addProduct(SHAMPOO_INPUT);
  return { app, services, sardines, shampoo };
}
