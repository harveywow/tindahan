/**
 * @file Pamilihan: the shopping list for the next palengke or grocery trip.
 * Depends on: config.js, models/RestockItem.js, models/Product.js, services/BaseService.js, utils/dates.js.
 */
import { RESTOCK_LOOKBACK_DAYS, RESTOCK_TARGET_DAYS } from '../config.js';
import { ConflictError } from '../core/AppError.js';
import { EVENTS } from '../core/EventBus.js';
import { createRestockItem } from '../models/RestockItem.js';
import { addDays } from '../utils/dates.js';
import { BaseService } from './BaseService.js';

/**
 * Suggested number of packs to buy.
 *
 * Formula (all in pieces, then rounded UP to whole packs):
 *   averageDaily = pieces sold in the last 7 days ÷ 7
 *   target       = max(averageDaily × 7 days, reorderLevel × 2 packs, 1 pack)
 *   suggestion   = target − current stock
 * Why: fast sellers get a week's worth; slow sellers still get topped up to
 * twice the reorder level so they don't hit the warning again right away.
 *
 * @param {import('../models/Product.js').Product} product
 * @param {number} piecesSoldInLookback
 * @returns {number} Packs to buy (at least 1).
 */
export function calculateSuggestedPacks(product, piecesSoldInLookback) {
  const averageDailyPieces = piecesSoldInLookback / RESTOCK_LOOKBACK_DAYS;
  const targetPieces = Math.max(
    Math.ceil(averageDailyPieces * RESTOCK_TARGET_DAYS),
    product.reorderLevel * 2 * product.piecesPerPack,
    product.piecesPerPack,
  );
  const neededPieces = Math.max(0, targetPieces - product.stockPieces);
  return Math.max(1, Math.ceil(neededPieces / product.piecesPerPack));
}

export class RestockService extends BaseService {
  /**
   * @param {Object} deps
   * @param {import('../core/Repository.js').Repository} deps.restockRepository
   * @param {import('./InventoryService.js').InventoryService} deps.inventoryService
   * @param {import('./SalesService.js').SalesService} deps.salesService
   * @param {import('../core/Clock.js').Clock} deps.clock
   * @param {import('../core/EventBus.js').EventBus} deps.bus
   * @param {import('./LogService.js').LogService} deps.logService
   */
  constructor({ restockRepository, inventoryService, salesService, clock, bus, logService }) {
    super({ bus, logService });
    this.items = restockRepository;
    this.inventory = inventoryService;
    this.sales = salesService;
    this.clock = clock;
  }

  /** @returns {import('../models/RestockItem.js').RestockItem[]} Pending first, then received. */
  listItems() {
    const all = this.items.getAll();
    return [...all.filter((item) => !item.isReceived), ...all.filter((item) => item.isReceived)];
  }

  /** @returns {Map<string, number>} Product id → pieces sold during the lookback window. */
  getRecentPiecesSold() {
    const today = this.clock.today();
    const piecesSold = new Map();
    this.sales.getCompletedSales(addDays(today, -RESTOCK_LOOKBACK_DAYS), today).forEach((sale) => {
      sale.items.forEach((item) => {
        piecesSold.set(item.productId, (piecesSold.get(item.productId) ?? 0) + item.piecesUsed);
      });
    });
    return piecesSold;
  }

  /**
   * Adds every low-stock product that is not already waiting on the list.
   * @returns {number} How many items were added.
   */
  generateSuggestions() {
    const pendingProductIds = new Set(
      this.items
        .getAll()
        .filter((item) => !item.isReceived && item.productId)
        .map((item) => item.productId),
    );
    const piecesSold = this.getRecentPiecesSold();
    const newItems = this.inventory
      .getLowStockProducts()
      .filter((product) => !pendingProductIds.has(product.id))
      .map((product) =>
        createRestockItem({
          name: product.name,
          quantity: calculateSuggestedPacks(product, piecesSold.get(product.id) ?? 0),
          productId: product.id,
          isSuggested: true,
        }),
      );
    newItems.forEach((item) => this.items.records.set(item.id, item));
    this.items.save();
    if (newItems.length > 0) {
      this.announce('restock', 'log.restockGenerated', { count: newItems.length });
    }
    return newItems.length;
  }

  /**
   * @param {{name: string, quantity: (string|number), productId?: string}} input
   * @returns {import('../models/RestockItem.js').RestockItem}
   */
  addManualItem(input) {
    const product = input.productId ? this.inventory.getProduct(input.productId) : null;
    const item = createRestockItem({
      name: product ? product.name : input.name,
      quantity: input.quantity,
      productId: product?.id ?? '',
    });
    this.items.upsert(item);
    this.announce('restock', 'log.restockItemAdded', { name: item.name });
    return item;
  }

  /**
   * Ticks or unticks an item while shopping.
   * @param {string} itemId
   */
  toggleChecked(itemId) {
    const item = this.items.getById(itemId);
    this.items.upsert({ ...item, isChecked: !item.isChecked });
    this.bus.emit(EVENTS.DATA_CHANGED, { source: 'restock' });
  }

  /** @param {string} itemId */
  removeItem(itemId) {
    this.items.remove(itemId);
    this.bus.emit(EVENTS.DATA_CHANGED, { source: 'restock' });
  }

  /**
   * Marks an item as received. Linked products get the stock and new cost.
   * @param {string} itemId
   * @param {{quantity: (string|number), costPerPack: (string|number)}} input
   * @throws {ConflictError} When already received or the product is archived.
   */
  receiveItem(itemId, input) {
    const item = this.items.getById(itemId);
    if (item.isReceived) {
      throw new ConflictError('errors.alreadyReceived');
    }
    if (item.productId) {
      this.inventory.receiveStock(item.productId, input);
    }
    this.items.upsert({ ...item, isReceived: true, isChecked: true });
    this.announce('restock', 'log.restockReceived', { name: item.name });
  }

  /** Removes received items from the list. */
  clearReceived() {
    this.items
      .getAll()
      .filter((item) => item.isReceived)
      .forEach((item) => this.items.records.delete(item.id));
    this.items.save();
    this.bus.emit(EVENTS.DATA_CHANGED, { source: 'restock' });
  }
}
