/**
 * @file Generates 30 days of realistic store activity for demos and testing.
 * Depends on: core/Clock.js, services/Basket.js, services/demoCatalog.js, utils/*.
 *
 * Why simulate through the real services: instead of hand-writing fake
 * records (which could break business rules, e.g. stock that doesn't match
 * sales), we run a throw-away copy of the app day by day — open, sell, collect
 * utang, close — and then import the result like a backup. The demo data is
 * therefore guaranteed to obey every rule the real app enforces.
 */
import { DENOMINATIONS, PAYMENT_TYPES, SALE_UNITS } from '../config.js';
import { createFixedClock } from '../core/Clock.js';
import { addDays } from '../utils/dates.js';
import { calculateChangeBreakdown, centavosToInputValue } from '../utils/money.js';
import { Basket } from './Basket.js';
import { DEMO_CUSTOMERS, DEMO_EXPENSES, DEMO_PRODUCTS } from './demoCatalog.js';

export const DEMO_DAYS = 30;

/**
 * Small seeded random generator (mulberry32). Why seeded: the demo (and the
 * tests that use it) produce the same data every time.
 * @param {number} seed
 * @returns {function(): number} Returns floats in [0, 1).
 */
export function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

export class DemoDataService {
  /**
   * @param {Object} deps
   * @param {import('./BackupService.js').BackupService} deps.backupService
   * @param {import('./LogService.js').LogService} deps.logService
   * @param {function(Object): Object} deps.createSandboxApp - Builds an in-memory app for a clock.
   */
  constructor({ backupService, logService, createSandboxApp }) {
    this.backupService = backupService;
    this.logService = logService;
    this.createSandboxApp = createSandboxApp;
  }

  /**
   * Replaces all data with a generated history ending yesterday.
   * Today is left unopened so the user starts with "Buksan ang tindahan".
   * @param {string} todayKey
   * @param {number} [seed]
   */
  loadDemoData(todayKey, seed = 20261122) {
    const backup = this.generateBackup(todayKey, seed);
    this.backupService.restore(backup);
    this.logService.record('settings', 'log.demoLoaded');
  }

  /**
   * @param {string} todayKey
   * @param {number} seed
   * @returns {Object} A backup object.
   */
  generateBackup(todayKey, seed) {
    const random = createRandom(seed);
    const firstDay = addDays(todayKey, -DEMO_DAYS);
    const clock = createFixedClock(firstDay);
    const sandbox = this.createSandboxApp(clock);
    this.seedCatalog(sandbox.services, todayKey);
    for (let offset = 0; offset < DEMO_DAYS; offset += 1) {
      clock.setToday(addDays(firstDay, offset));
      this.simulateDay(sandbox.services, random, offset);
    }
    const backup = sandbox.services.backupService.createBackup();
    return this.backdateTimestamps(backup, firstDay);
  }

  /**
   * Adds the sample products and suki. A few perishables get expiry dates
   * near today so the expiry warning has something to show.
   * @param {Object} services
   * @param {string} todayKey
   */
  seedCatalog(services, todayKey) {
    const expiryByName = { 'Itlog (tray na 30)': 3, 'Meat Loaf': 5 };
    DEMO_PRODUCTS.forEach((product) => {
      const daysLeft = expiryByName[product.name];
      const expiryDate = daysLeft === undefined ? '' : addDays(todayKey, daysLeft);
      services.inventoryService.addProduct({ ...product, expiryDate });
    });
    DEMO_CUSTOMERS.forEach((customer) => services.creditService.addCustomer(customer));
  }

  /**
   * One store day: open, restock, sell, collect, spend, close.
   * @param {Object} services
   * @param {function(): number} random
   * @param {number} dayIndex
   */
  simulateDay(services, random, dayIndex) {
    services.dayService.openDay('500');
    if (dayIndex % 4 === 3) {
      this.restockLowItems(services, random);
    }
    const transactionCount = 14 + Math.floor(random() * 18);
    for (let count = 0; count < transactionCount; count += 1) {
      this.trySale(services, random);
    }
    this.collectSomeUtang(services, random);
    this.recordSomeExpenses(services, random, dayIndex);
    if (dayIndex % 9 === 5) {
      this.voidOneSale(services);
    }
    this.closeDay(services, random);
  }

  /**
   * @param {Object} services
   * @param {function(): number} random
   */
  restockLowItems(services, random) {
    services.inventoryService.getLowStockProducts().forEach((product) => {
      services.inventoryService.receiveStock(product.id, {
        quantity: String(product.reorderLevel * 3 + 1 + Math.floor(random() * 3)),
        costPerPack: centavosToInputValue(product.costPerPack),
      });
    });
  }

  /**
   * Builds a random basket and tries to check it out. Rule violations
   * (out of stock, credit limit) are expected sometimes and simply skipped,
   * just like a real customer being told "wala na po".
   * @param {Object} services
   * @param {function(): number} random
   */
  trySale(services, random) {
    const products = services.inventoryService
      .listProducts()
      .filter((product) => product.stockPieces > 0);
    const basket = new Basket();
    const itemCount = 1 + Math.floor(random() * 3);
    try {
      for (let index = 0; index < itemCount && products.length > 0; index += 1) {
        const product = products[Math.floor(random() * products.length)];
        const unit = product.isTingi && random() < 0.75 ? SALE_UNITS.PIECE : SALE_UNITS.PACK;
        basket.add(
          services.inventoryService.getProduct(product.id),
          unit,
          1 + Math.floor(random() * 2),
        );
      }
      services.salesService.checkout(basket, this.pickPayment(services, random, basket.getTotal()));
    } catch {
      // Skipped: not enough stock or over the credit limit.
    }
  }

  /**
   * @param {Object} services
   * @param {function(): number} random
   * @param {number} total - Centavos.
   * @returns {Object} Payment input.
   */
  pickPayment(services, random, total) {
    const roll = random();
    if (roll < 0.15) {
      const customers = services.creditService.listCustomers();
      const customer = customers[Math.floor(random() * customers.length)];
      return { paymentType: PAYMENT_TYPES.CREDIT, customerId: customer.id };
    }
    if (roll < 0.27) {
      const reference = String(1000000000000 + Math.floor(random() * 8999999999999));
      return { paymentType: PAYMENT_TYPES.GCASH, gcashReference: reference };
    }
    const roundTo = [2000, 5000, 10000][Math.floor(random() * 3)];
    const cash = Math.max(total, Math.ceil(total / roundTo) * roundTo);
    return { paymentType: PAYMENT_TYPES.CASH, cashReceived: centavosToInputValue(cash) };
  }

  /**
   * Some suki pay part of their balance. Kuya Pedro never does, so the demo
   * always has an overdue account to show.
   * @param {Object} services
   * @param {function(): number} random
   */
  collectSomeUtang(services, random) {
    services.creditService
      .listCustomers()
      .filter(
        (customer) => customer.balance > 0 && customer.nickname !== 'Kuya Pedro' && random() < 0.2,
      )
      .forEach((customer) => {
        const amount = Math.max(2500, Math.floor((customer.balance * 0.6) / 2500) * 2500);
        services.creditService.recordPayment(customer.id, {
          amount: centavosToInputValue(
            Math.min(amount, customer.balance - (customer.balance % 25)),
          ),
          paymentMethod: random() < 0.8 ? 'cash' : 'gcash',
        });
      });
  }

  /**
   * @param {Object} services
   * @param {function(): number} random
   * @param {number} dayIndex
   */
  recordSomeExpenses(services, random, dayIndex) {
    services.expenseService.addExpense(DEMO_EXPENSES[0]);
    if (random() < 0.4) {
      services.expenseService.addExpense(
        DEMO_EXPENSES[1 + (dayIndex % (DEMO_EXPENSES.length - 1))],
      );
    }
  }

  /** @param {Object} services */
  voidOneSale(services) {
    const openDay = services.dayService.getOpenDay();
    const [latest] = services.salesService.listSales({
      startKey: openDay.id,
      endKey: openDay.id,
      status: 'completed',
    });
    if (latest) {
      services.salesService.voidSale(latest.id, 'Mali ang na-punch na item');
    }
  }

  /**
   * Counts the drawer. Usually exact; occasionally ₱5 short with a note,
   * so the closing history shows both outcomes.
   * @param {Object} services
   * @param {function(): number} random
   */
  closeDay(services, random) {
    const openDay = services.dayService.getOpenDay();
    const { expectedCash } = services.closingService.computeExpectedCash(openDay);
    const isShort = random() < 0.15 && expectedCash >= 500;
    const counted = isShort ? expectedCash - 500 : expectedCash;
    const cashCount = Object.fromEntries(
      DENOMINATIONS.map((denomination) => [denomination.value, 0]),
    );
    calculateChangeBreakdown(counted).pieces.forEach((piece) => {
      cashCount[piece.value] = piece.count;
    });
    const note = isShort ? 'Kulang ng ₱5 — baka mali ang naibigay na sukli.' : '';
    services.closingService.closeDay({ cashCount, note });
  }

  /**
   * The sandbox ran "today", so every createdAt is the real current time.
   * Spread records evenly across their store day (6 AM – 9 PM), keeping
   * their original order so receipt numbers still rise with the clock.
   * @param {Object} backup
   * @param {string} firstDay
   * @returns {Object} The same backup, adjusted.
   */
  backdateTimestamps(backup, firstDay) {
    const { collections } = backup;
    ['sales', 'expenses'].forEach((name) => spreadAcrossDays(collections[name]));
    const saleTimes = new Map(collections.sales.map((sale) => [sale.id, sale.createdAt]));
    spreadAcrossDays(collections.creditEntries);
    collections.creditEntries.forEach((entry) => {
      entry.createdAt = saleTimes.get(entry.saleId) ?? entry.createdAt;
    });
    collections.sales.forEach((sale) => {
      sale.voidedAt = sale.voidedAt ? sale.createdAt : '';
    });
    collections.days.forEach((day) => {
      day.openedAt = atLocalTime(day.id, 6 * 60);
      day.closedAt = atLocalTime(day.id, 21 * 60 + 30);
    });
    collections.products.forEach((product) => {
      product.createdAt = atLocalTime(firstDay, 5 * 60);
    });
    collections.logEntries = [];
    collections.stockAdjustments = [];
    collections.restockItems = [];
    return backup;
  }
}

/**
 * @param {string} dayKey
 * @param {number} minutesAfterMidnight
 * @returns {string} ISO timestamp for that local time.
 */
function atLocalTime(dayKey, minutesAfterMidnight) {
  const [year, month, day] = dayKey.split('-').map(Number);
  return new Date(year, month - 1, day, 0, minutesAfterMidnight).toISOString();
}

/**
 * Gives records of each day evenly spaced times between 6:00 AM and 9:00 PM.
 * @param {Array<{dayKey: string, createdAt: string}>} records - Mutated in place.
 */
function spreadAcrossDays(records) {
  const recordsByDay = new Map();
  records.forEach((record) => {
    recordsByDay.set(record.dayKey, [...(recordsByDay.get(record.dayKey) ?? []), record]);
  });
  const openMinutes = 15 * 60;
  recordsByDay.forEach((dayRecords, dayKey) => {
    const step = openMinutes / (dayRecords.length + 1);
    dayRecords.forEach((record, index) => {
      record.createdAt = atLocalTime(dayKey, 6 * 60 + Math.round(step * (index + 1)));
    });
  });
}
