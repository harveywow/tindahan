/**
 * @file Ulat: sales/profit/expense series, rankings and CSV exports.
 * Depends on: models/Sale.js, utils/dates.js, utils/csv.js, utils/money.js.
 *
 * Efficiency: each report walks the sales list ONCE, adding into buckets
 * looked up by key in a Map, instead of re-filtering all sales per bucket
 * (which would be buckets × sales work).
 */
import { getProfit } from '../models/Sale.js';
import { toCsv } from '../utils/csv.js';
import { addDays, toMonthKey, toWeekKey, validateDateRange } from '../utils/dates.js';
import { centavosToInputValue } from '../utils/money.js';

/** How many buckets each period shows on the chart. */
const BUCKET_COUNTS = Object.freeze({ day: 14, week: 8, month: 6 });

const BUCKET_KEY_BUILDERS = Object.freeze({
  day: (dateKey) => dateKey,
  week: toWeekKey,
  month: toMonthKey,
});

export class ReportService {
  /**
   * @param {Object} deps
   * @param {import('./SalesService.js').SalesService} deps.salesService
   * @param {import('./ExpenseService.js').ExpenseService} deps.expenseService
   * @param {import('./InventoryService.js').InventoryService} deps.inventoryService
   * @param {import('./CreditService.js').CreditService} deps.creditService
   * @param {import('../core/Clock.js').Clock} deps.clock
   */
  constructor({ salesService, expenseService, inventoryService, creditService, clock }) {
    this.sales = salesService;
    this.expenses = expenseService;
    this.inventory = inventoryService;
    this.credit = creditService;
    this.clock = clock;
  }

  /**
   * @param {string} period - 'day' | 'week' | 'month'.
   * @returns {string[]} Bucket keys, oldest first, ending with the current one.
   */
  buildBucketKeys(period) {
    const toKey = BUCKET_KEY_BUILDERS[period] ?? BUCKET_KEY_BUILDERS.day;
    const keys = [];
    let cursor = this.clock.today();
    while (keys.length < (BUCKET_COUNTS[period] ?? BUCKET_COUNTS.day)) {
      const key = toKey(cursor);
      if (!keys.includes(key)) {
        keys.unshift(key);
      }
      cursor = addDays(cursor, -1);
    }
    return keys;
  }

  /**
   * The date range covered by a period's buckets (used for the summary tiles).
   * @param {string} period
   * @returns {{startKey: string, endKey: string}}
   */
  getPeriodRange(period) {
    const [firstKey] = this.buildBucketKeys(period);
    return {
      startKey: period === 'month' ? `${firstKey}-01` : firstKey,
      endKey: this.clock.today(),
    };
  }

  /**
   * Chart data: sales, profit and operating expenses per bucket.
   * Only "expense" type counts against profit — owner withdrawals are the
   * owner's take, and restock payments are already counted as cost of goods
   * when the items sell. Subtracting them too would count them twice.
   * @param {string} period
   * @returns {Array<{key:string, sales:number, profit:number, expenses:number}>}
   */
  getSeries(period) {
    const toKey = BUCKET_KEY_BUILDERS[period] ?? BUCKET_KEY_BUILDERS.day;
    const buckets = new Map(
      this.buildBucketKeys(period).map((key) => [key, { key, sales: 0, profit: 0, expenses: 0 }]),
    );
    this.sales.getCompletedSales().forEach((sale) => {
      const bucket = buckets.get(toKey(sale.dayKey));
      if (bucket) {
        bucket.sales += sale.total;
        bucket.profit += getProfit(sale);
      }
    });
    this.expenses.listExpenses({ type: 'expense' }).forEach((expense) => {
      const bucket = buckets.get(toKey(expense.dayKey));
      if (bucket) {
        bucket.expenses += expense.amount;
      }
    });
    return [...buckets.values()];
  }

  /**
   * @param {string} startKey
   * @param {string} endKey
   * @returns {{totalSales:number, profit:number, expenses:number, netProfit:number, transactions:number,
   *   byPayment:Object<string, number>, byCategory:Array<{category:string,total:number}>,
   *   topSellers:Array<{name:string,quantity:number,total:number}>}}
   */
  getRangeSummary(startKey, endKey) {
    validateDateRange(startKey, endKey);
    const totals = {
      totalSales: 0,
      profit: 0,
      transactions: 0,
      byPayment: { cash: 0, gcash: 0, credit: 0 },
    };
    const byCategory = new Map();
    const byProduct = new Map();
    this.sales.getCompletedSales(startKey, endKey).forEach((sale) => {
      totals.totalSales += sale.total;
      totals.profit += getProfit(sale);
      totals.transactions += 1;
      totals.byPayment[sale.paymentType] += sale.total;
      sale.items.forEach((item) => this.addItemToRankings(item, byCategory, byProduct));
    });
    const expenses = this.expenses
      .listExpenses({ startKey, endKey, type: 'expense' })
      .reduce((sum, expense) => sum + expense.amount, 0);
    return {
      ...totals,
      expenses,
      netProfit: totals.profit - expenses,
      byCategory: [...byCategory.entries()]
        .map(([category, total]) => ({ category, total }))
        .sort((first, second) => second.total - first.total),
      topSellers: [...byProduct.values()]
        .sort((first, second) => second.total - first.total)
        .slice(0, 5),
    };
  }

  /**
   * @param {import('../models/SaleItem.js').SaleItem} item
   * @param {Map<string, number>} byCategory
   * @param {Map<string, {name:string, quantity:number, total:number}>} byProduct
   */
  addItemToRankings(item, byCategory, byProduct) {
    byCategory.set(item.category, (byCategory.get(item.category) ?? 0) + item.lineTotal);
    const entry = byProduct.get(item.productId) ?? {
      name: item.productName,
      quantity: 0,
      total: 0,
    };
    entry.quantity += item.quantity;
    entry.total += item.lineTotal;
    byProduct.set(item.productId, entry);
  }

  /**
   * Products with stock that haven't sold within the window.
   * @param {number} days
   * @returns {Array<{product: Object, lastSoldKey: string}>}
   */
  getSlowMovers(days) {
    const cutoffKey = addDays(this.clock.today(), -days);
    const lastSoldByProduct = new Map();
    this.sales.getCompletedSales().forEach((sale) => {
      sale.items.forEach((item) => {
        if ((lastSoldByProduct.get(item.productId) ?? '') < sale.dayKey) {
          lastSoldByProduct.set(item.productId, sale.dayKey);
        }
      });
    });
    return (
      this.inventory
        .listProducts()
        .filter((product) => product.stockPieces > 0 && product.createdAt.slice(0, 10) <= cutoffKey)
        .map((product) => ({ product, lastSoldKey: lastSoldByProduct.get(product.id) ?? '' }))
        // '' (never sold) sorts before every date key, so it counts as slow too.
        .filter((row) => row.lastSoldKey < cutoffKey)
    );
  }

  /* -------------------------------- CSV -------------------------------- */

  /**
   * @param {'products'|'sales'|'customers'|'credit'} kind
   * @returns {string} CSV text.
   */
  exportCsv(kind) {
    const builders = {
      products: () => this.buildProductsCsv(),
      sales: () => this.buildSalesCsv(),
      customers: () => this.buildCustomersCsv(),
      credit: () => this.buildCreditCsv(),
    };
    return (builders[kind] ?? builders.products)();
  }

  /** @returns {string} */
  buildProductsCsv() {
    const rows = this.inventory.listProducts({ stockStatus: 'all' }).map((product) => ({
      ...product,
      cost: centavosToInputValue(product.costPerPack),
      price: centavosToInputValue(product.pricePerPack),
      piecePrice: centavosToInputValue(product.pricePerPiece),
    }));
    return toCsv(rows, [
      { key: 'name', header: 'Product' },
      { key: 'category', header: 'Category' },
      { key: 'cost', header: 'Cost per pack' },
      { key: 'price', header: 'Price per pack' },
      { key: 'piecesPerPack', header: 'Pieces per pack' },
      { key: 'piecePrice', header: 'Price per piece' },
      { key: 'stockPieces', header: 'Stock (pieces)' },
      { key: 'reorderLevel', header: 'Reorder level (packs)' },
      { key: 'expiryDate', header: 'Expiry' },
    ]);
  }

  /** @returns {string} */
  buildSalesCsv() {
    const rows = this.sales.listSales().map((sale) => ({
      ...sale,
      items: sale.items
        .map((item) => `${item.quantity} ${item.unitLabel} ${item.productName}`)
        .join('; '),
      totalPeso: centavosToInputValue(sale.total),
      profitPeso: centavosToInputValue(getProfit(sale)),
    }));
    return toCsv(rows, [
      { key: 'receiptNumber', header: 'Receipt' },
      { key: 'createdAt', header: 'Date/time' },
      { key: 'items', header: 'Items' },
      { key: 'totalPeso', header: 'Total' },
      { key: 'profitPeso', header: 'Profit' },
      { key: 'paymentType', header: 'Payment' },
      { key: 'customerName', header: 'Customer' },
      { key: 'status', header: 'Status' },
    ]);
  }

  /** @returns {string} */
  buildCustomersCsv() {
    const rows = this.credit.listCustomers({ includeArchived: true }).map((customer) => ({
      ...customer,
      limit: centavosToInputValue(customer.creditLimit),
      balancePeso: centavosToInputValue(customer.balance),
    }));
    return toCsv(rows, [
      { key: 'name', header: 'Name' },
      { key: 'nickname', header: 'Nickname' },
      { key: 'contact', header: 'Contact' },
      { key: 'limit', header: 'Credit limit' },
      { key: 'balancePeso', header: 'Balance' },
    ]);
  }

  /** @returns {string} */
  buildCreditCsv() {
    const namesById = new Map(
      this.credit.listCustomers({ includeArchived: true }).map((c) => [c.id, c.name]),
    );
    const rows = this.credit.listEntries().map((entry) => ({
      ...entry,
      customer: namesById.get(entry.customerId) ?? '',
      amountPeso: centavosToInputValue(entry.amount),
    }));
    return toCsv(rows, [
      { key: 'createdAt', header: 'Date/time' },
      { key: 'customer', header: 'Customer' },
      { key: 'type', header: 'Type' },
      { key: 'amountPeso', header: 'Amount' },
      { key: 'description', header: 'Description' },
      { key: 'paymentMethod', header: 'Method' },
    ]);
  }
}
