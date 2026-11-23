/**
 * @file Paninda: products, categories and every change to stock.
 * Depends on: config.js, core/AppError.js, models/Product.js, models/StockAdjustment.js,
 *   services/BaseService.js, utils/validators.js.
 */
import { ADJUSTMENT_REASONS, DEFAULT_CATEGORIES, LIMITS, SALE_UNITS } from '../config.js';
import { ConflictError, StockError, ValidationError } from '../core/AppError.js';
import {
  createProduct,
  getMarginPercent,
  isExpiringSoon,
  isLowStock,
  isPricedBelowCost,
  validateProductInput,
} from '../models/Product.js';
import { createStockAdjustment } from '../models/StockAdjustment.js';
import { nowIso } from '../utils/ids.js';
import {
  normalizeName,
  optionalText,
  requireInteger,
  requireMoney,
  requireOneOf,
  requireText,
} from '../utils/validators.js';
import { BaseService } from './BaseService.js';

const SORTERS = {
  name: (first, second) => first.name.localeCompare(second.name),
  stock: (first, second) => first.stockPieces - second.stockPieces,
  price: (first, second) => first.pricePerPack - second.pricePerPack,
  margin: (first, second) => getMarginPercent(second) - getMarginPercent(first),
};

export class InventoryService extends BaseService {
  /**
   * @param {Object} deps
   * @param {import('../core/Repository.js').Repository} deps.productRepository
   * @param {import('../core/Repository.js').Repository} deps.adjustmentRepository
   * @param {import('../core/Storage.js').Storage} deps.storage - Holds the category list.
   * @param {import('../core/Clock.js').Clock} deps.clock
   * @param {function(): Object} deps.getSettings
   * @param {import('../core/EventBus.js').EventBus} deps.bus
   * @param {import('./LogService.js').LogService} deps.logService
   */
  constructor({
    productRepository,
    adjustmentRepository,
    storage,
    clock,
    getSettings,
    bus,
    logService,
  }) {
    super({ bus, logService });
    this.products = productRepository;
    this.adjustments = adjustmentRepository;
    this.storage = storage;
    this.clock = clock;
    this.getSettings = getSettings;
  }

  /* ----------------------------- Queries ----------------------------- */

  /**
   * @param {Object} [filter]
   * @param {string} [filter.search]
   * @param {string} [filter.category] - '' for all.
   * @param {string} [filter.stockStatus] - 'all' | 'low' | 'out' | 'expiring' | 'archived'.
   * @param {string} [filter.sortBy] - 'name' | 'stock' | 'price' | 'margin'.
   * @returns {import('../models/Product.js').Product[]}
   */
  listProducts({ search = '', category = '', stockStatus = 'all', sortBy = 'name' } = {}) {
    const query = normalizeName(search);
    const matchesStatus = this.buildStatusFilter(stockStatus);
    return this.products
      .getAll()
      .filter((product) => matchesStatus(product))
      .filter((product) => !category || product.category === category)
      .filter((product) => !query || normalizeName(product.name).includes(query))
      .sort(SORTERS[sortBy] ?? SORTERS.name);
  }

  /**
   * @param {string} stockStatus
   * @returns {function(import('../models/Product.js').Product): boolean}
   */
  buildStatusFilter(stockStatus) {
    const { expiryWarningDays } = this.getSettings();
    const today = this.clock.today();
    const filters = {
      archived: (product) => product.isArchived,
      low: (product) => !product.isArchived && isLowStock(product),
      out: (product) => !product.isArchived && product.stockPieces === 0,
      expiring: (product) =>
        !product.isArchived && isExpiringSoon(product, today, expiryWarningDays),
    };
    return filters[stockStatus] ?? ((product) => !product.isArchived);
  }

  /**
   * @param {string} productId
   * @returns {import('../models/Product.js').Product}
   * @throws {import('../core/AppError.js').NotFoundError}
   */
  getProduct(productId) {
    return this.products.getById(productId);
  }

  /**
   * Like getProduct but returns undefined instead of throwing (for refreshing UI copies).
   * @param {string} productId
   * @returns {import('../models/Product.js').Product|undefined}
   */
  findProduct(productId) {
    return this.products.findById(productId);
  }

  /** @returns {import('../models/Product.js').Product[]} Active products at or below reorder level. */
  getLowStockProducts() {
    return this.listProducts({ stockStatus: 'low', sortBy: 'stock' });
  }

  /** @returns {import('../models/Product.js').Product[]} Active products near or past expiry. */
  getExpiringProducts() {
    return this.listProducts({ stockStatus: 'expiring' });
  }

  /* ----------------------------- Products ----------------------------- */

  /**
   * Checks rules shared by add and edit.
   * @param {Object} fields - Output of validateProductInput.
   * @param {{confirmBelowCost?: boolean, excludeId?: string}} options
   * @throws {ValidationError|ConflictError}
   */
  assertProductRules(fields, { confirmBelowCost = false, excludeId = '' }) {
    const duplicate = this.products
      .getAll()
      .find(
        (product) =>
          product.id !== excludeId && normalizeName(product.name) === normalizeName(fields.name),
      );
    if (duplicate) {
      throw new ConflictError('errors.duplicateProduct', { name: duplicate.name }, 'name');
    }
    if (!this.listCategories().includes(fields.category)) {
      throw new ValidationError('errors.unknownCategory', {}, 'category');
    }
    if (fields.imageDataUrl.length > LIMITS.MAX_IMAGE_BYTES * 1.37) {
      // base64 is ~37% larger than the original bytes.
      throw new ValidationError('errors.imageTooLarge', { max: '200 KB' }, 'image');
    }
    if (!confirmBelowCost && isPricedBelowCost(fields)) {
      throw new ValidationError('errors.priceBelowCost', {}, 'pricePerPack');
    }
  }

  /**
   * @param {Object} input - Raw form values.
   * @param {{confirmBelowCost?: boolean}} [options] - Pass true after the owner confirms
   *   selling below cost (e.g. a loss-leader or expiring item).
   * @returns {import('../models/Product.js').Product}
   * @throws {ValidationError|ConflictError}
   */
  addProduct(input, { confirmBelowCost = false } = {}) {
    const product = createProduct(input);
    this.assertProductRules(product, { confirmBelowCost });
    this.products.upsert(product);
    this.announce('product', 'log.productAdded', { name: product.name });
    return product;
  }

  /**
   * @param {string} productId
   * @param {Object} input
   * @returns {boolean} True when a price or cost would change (the UI asks for the PIN).
   */
  wouldChangePrice(productId, input) {
    const product = this.getProduct(productId);
    try {
      const fields = validateProductInput(input);
      return ['costPerPack', 'pricePerPack', 'pricePerPiece'].some(
        (key) => fields[key] !== product[key],
      );
    } catch {
      return false; // invalid input will be reported by updateProduct itself
    }
  }

  /**
   * @param {string} productId
   * @param {Object} input - Raw form values.
   * @param {{confirmBelowCost?: boolean}} [options]
   * @returns {import('../models/Product.js').Product}
   * @throws {ValidationError|ConflictError}
   */
  updateProduct(productId, input, { confirmBelowCost = false } = {}) {
    const product = this.getProduct(productId);
    const fields = validateProductInput(input);
    this.assertProductRules(fields, { confirmBelowCost, excludeId: productId });
    // Pack size can't change while stock exists: 30 stored pieces of a 10-pack
    // would silently become 30 PACKS if the product stopped being tingi.
    if (fields.piecesPerPack !== product.piecesPerPack && product.stockPieces > 0) {
      throw new ConflictError('errors.cannotChangePackSize', {}, 'piecesPerPack');
    }
    const updated = { ...product, ...fields, updatedAt: nowIso() };
    this.products.upsert(updated);
    this.announce('product', 'log.productUpdated', { name: updated.name });
    return updated;
  }

  /**
   * Deletes a product, or archives it if it appears in past sales so old
   * receipts and reports keep working.
   * @param {string} productId
   * @returns {'deleted'|'archived'}
   */
  removeProduct(productId) {
    const product = this.getProduct(productId);
    if (product.hasSalesHistory) {
      this.products.upsert({ ...product, isArchived: true, updatedAt: nowIso() });
      this.announce('product', 'log.productArchived', { name: product.name });
      return 'archived';
    }
    this.products.remove(productId);
    this.announce('product', 'log.productDeleted', { name: product.name });
    return 'deleted';
  }

  /**
   * Brings an archived product back to the shelf.
   * @param {string} productId
   */
  unarchiveProduct(productId) {
    const product = this.getProduct(productId);
    this.products.upsert({ ...product, isArchived: false, updatedAt: nowIso() });
    this.announce('product', 'log.productRestored', { name: product.name });
  }

  /* ------------------------------- Stock ------------------------------- */

  /**
   * Manual stock correction with a reason.
   * @param {string} productId
   * @param {Object} input - { quantity, unit: 'pack'|'piece', direction: 'add'|'remove', reason, note }
   * @returns {import('../models/StockAdjustment.js').StockAdjustment}
   * @throws {ValidationError|StockError|ConflictError}
   */
  adjustStock(productId, input) {
    const product = this.getProduct(productId);
    this.assertActive(product);
    const quantity = requireInteger(input.quantity, 'quantity', {
      min: 1,
      max: LIMITS.MAX_QUANTITY,
    });
    const unit = requireOneOf(input.unit, 'unit', Object.values(SALE_UNITS));
    const direction = requireOneOf(input.direction, 'direction', ['add', 'remove']);
    const reason = requireOneOf(input.reason, 'reason', ADJUSTMENT_REASONS);
    const pieces = quantity * (unit === SALE_UNITS.PACK ? product.piecesPerPack : 1);
    const changePieces = direction === 'add' ? pieces : -pieces;
    this.assertStockAvailable(product, -changePieces);
    const adjustment = createStockAdjustment({
      product,
      changePieces,
      reason,
      note: optionalText(input.note, 'note'),
    });
    this.applyStockChange(product, changePieces);
    this.adjustments.upsert(adjustment);
    this.announce('stock', 'log.stockAdjusted', {
      name: product.name,
      change: changePieces,
      reason,
    });
    return adjustment;
  }

  /**
   * @param {import('../models/Product.js').Product} product
   * @throws {ConflictError} When the product is archived.
   */
  assertActive(product) {
    if (product.isArchived) {
      throw new ConflictError('errors.productArchived', { name: product.name });
    }
  }

  /**
   * @param {import('../models/Product.js').Product} product
   * @param {number} piecesNeeded
   * @throws {StockError}
   */
  assertStockAvailable(product, piecesNeeded) {
    if (piecesNeeded > product.stockPieces) {
      throw new StockError(
        'errors.notEnoughStock',
        { name: product.name, available: product.stockPieces },
        'quantity',
      );
    }
  }

  /**
   * @param {import('../models/Product.js').Product} product
   * @param {number} changePieces
   * @param {Object} [extraFields]
   */
  applyStockChange(product, changePieces, extraFields = {}) {
    this.products.upsert({
      ...product,
      ...extraFields,
      stockPieces: product.stockPieces + changePieces,
      updatedAt: nowIso(),
    });
  }

  /**
   * Removes sold pieces for several products at once. Everything is checked
   * BEFORE anything changes, so a sale never half-deducts stock.
   * @param {Map<string, number>} piecesByProductId
   * @throws {StockError|ConflictError}
   */
  deductForSale(piecesByProductId) {
    piecesByProductId.forEach((pieces, productId) => {
      const product = this.getProduct(productId);
      this.assertActive(product);
      this.assertStockAvailable(product, pieces);
    });
    piecesByProductId.forEach((pieces, productId) => {
      this.applyStockChange(this.getProduct(productId), -pieces, { hasSalesHistory: true });
    });
  }

  /**
   * Puts pieces back after a voided sale. Works even for archived products,
   * because the goods physically returned to the shelf.
   * @param {Map<string, number>} piecesByProductId
   */
  restoreFromVoid(piecesByProductId) {
    piecesByProductId.forEach((pieces, productId) => {
      const product = this.products.findById(productId);
      if (product) {
        this.applyStockChange(product, pieces);
      }
    });
  }

  /**
   * Adds restocked packs and records the new cost.
   * @param {string} productId
   * @param {{quantity: (string|number), costPerPack: (string|number)}} input
   * @returns {import('../models/Product.js').Product}
   * @throws {ValidationError|ConflictError}
   */
  receiveStock(productId, input) {
    const product = this.getProduct(productId);
    this.assertActive(product);
    const packs = requireInteger(input.quantity, 'quantity', { min: 1, max: LIMITS.MAX_QUANTITY });
    const costPerPack = requireMoney(input.costPerPack, 'costPerPack', { allowZero: true });
    const changePieces = packs * product.piecesPerPack;
    this.applyStockChange(product, changePieces, { costPerPack });
    this.adjustments.upsert(createStockAdjustment({ product, changePieces, reason: 'restock' }));
    this.announce('stock', 'log.stockReceived', { name: product.name, packs });
    return this.getProduct(productId);
  }

  /** @returns {import('../models/StockAdjustment.js').StockAdjustment[]} Newest first. */
  listAdjustments() {
    return this.adjustments.getAll().reverse();
  }

  /* ----------------------------- Categories ----------------------------- */

  /** @returns {string[]} */
  listCategories() {
    const stored = this.storage.read('categories', null);
    return Array.isArray(stored) ? stored : [...DEFAULT_CATEGORIES];
  }

  /**
   * @param {string} nameInput
   * @returns {string}
   * @throws {ValidationError|ConflictError}
   */
  addCategory(nameInput) {
    const name = requireText(nameInput, 'categoryName', { maxLength: 30 });
    const categories = this.listCategories();
    if (categories.some((existing) => normalizeName(existing) === normalizeName(name))) {
      throw new ConflictError('errors.duplicateCategory', { name }, 'categoryName');
    }
    this.storage.write('categories', [...categories, name]);
    this.announce('product', 'log.categoryAdded', { name });
    return name;
  }

  /**
   * @param {string} name
   * @throws {ConflictError} When any product (even archived) still uses it.
   */
  removeCategory(name) {
    const usageCount = this.products.getAll().filter((product) => product.category === name).length;
    if (usageCount > 0) {
      throw new ConflictError('errors.categoryInUse', { name, count: usageCount });
    }
    this.storage.write(
      'categories',
      this.listCategories().filter((category) => category !== name),
    );
    this.announce('product', 'log.categoryRemoved', { name });
  }
}
