/**
 * @file Application-wide constants: denominations, validation limits and defaults.
 * Depends on: nothing (leaf module).
 *
 * Every number that would otherwise be "magic" lives here so business rules
 * can be changed in one place and tests can import the same values.
 */

/** Version of the saved data shape. Bump it and add a migration in Storage when models change. */
export const SCHEMA_VERSION = 1;

/** Prefix for every localStorage key so the app never collides with other sites on localhost. */
export const STORAGE_PREFIX = 'tindahan';

/** Collections persisted by the app. Backup/restore iterates over this list. */
export const COLLECTION_NAMES = Object.freeze([
  'products',
  'sales',
  'customers',
  'creditEntries',
  'expenses',
  'stockAdjustments',
  'days',
  'restockItems',
  'logEntries',
]);

/** Single-object documents (not lists) persisted by the app. */
export const DOCUMENT_NAMES = Object.freeze(['settings', 'categories', 'auth', 'counters']);

/**
 * Philippine bills and coins, in centavos, largest first.
 * The ₱20 exists as both a bill and a coin; they have the same value,
 * so it appears once for change-giving and cash counting.
 */
export const DENOMINATIONS = Object.freeze([
  { value: 100000, label: '₱1,000', kind: 'bill' },
  { value: 50000, label: '₱500', kind: 'bill' },
  { value: 20000, label: '₱200', kind: 'bill' },
  { value: 10000, label: '₱100', kind: 'bill' },
  { value: 5000, label: '₱50', kind: 'bill' },
  { value: 2000, label: '₱20', kind: 'bill' },
  { value: 1000, label: '₱10', kind: 'coin' },
  { value: 500, label: '₱5', kind: 'coin' },
  { value: 100, label: '₱1', kind: 'coin' },
  { value: 25, label: '25¢', kind: 'coin' },
]);

/**
 * Smallest amount a cashier can physically hand back. Selling prices and cash
 * received must be multiples of this so change can always be given exactly.
 */
export const SMALLEST_COIN_CENTAVOS = 25;

/** Quick-cash buttons on the cashier screen, in centavos. */
export const QUICK_CASH_AMOUNTS = Object.freeze([5000, 10000, 50000, 100000]);

export const LIMITS = Object.freeze({
  MAX_NAME_LENGTH: 60,
  MAX_NOTE_LENGTH: 200,
  MAX_MONEY_CENTAVOS: 10000000, // ₱100,000 — far above any sari-sari transaction
  MAX_QUANTITY: 10000,
  MAX_PIECES_PER_PACK: 500,
  MAX_IMAGE_BYTES: 200 * 1024,
  MIN_PIN_LENGTH: 4,
  MAX_PIN_LENGTH: 6,
  GCASH_REFERENCE_LENGTH: 13,
  MAX_DAYS_SETTING: 365,
});

export const PAYMENT_TYPES = Object.freeze({ CASH: 'cash', GCASH: 'gcash', CREDIT: 'credit' });

export const SALE_UNITS = Object.freeze({ PACK: 'pack', PIECE: 'piece' });

export const EXPENSE_TYPES = Object.freeze(['expense', 'withdrawal', 'restock']);

export const ADJUSTMENT_REASONS = Object.freeze(['spoiled', 'lost', 'personalUse', 'correction']);

export const DEFAULT_CATEGORIES = Object.freeze([
  'Delata',
  'Sabon',
  'Sitsirya',
  'Inumin',
  'Kape',
  'Bigas',
  'Pampalasa',
  'Iba pa',
]);

export const DEFAULT_SETTINGS = Object.freeze({
  storeName: 'Tindahan ni Aling Nena',
  ownerName: 'Aling Nena',
  overdueDays: 15,
  expiryWarningDays: 7,
  slowMoverDays: 14,
  language: 'en',
});

/** How many days of sales history the restock suggestion looks at. */
export const RESTOCK_LOOKBACK_DAYS = 7;

/** How many days of stock the restock suggestion aims to cover. */
export const RESTOCK_TARGET_DAYS = 7;

/** Shown in the footer; keep in step with package.json. */
export const APP_VERSION = '1.2.0';

export const CONTRIBUTORS = Object.freeze([
  'HERNANDEZ, Harvey Daniel T. (Leader)',
  'BARRIETA, Raychel G.',
  'LITABAN, Winfred Mikhail S.',
  'TANTING, Sherreh Mah S.',
  'TURADO, Jimwel R.',
]);
