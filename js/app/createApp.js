/**
 * @file Composition root: builds storage, repositories and services and
 * wires their dependencies together.
 * Depends on: every core module and service.
 *
 * Why one place: services receive what they need through their constructor
 * (dependency injection) instead of importing each other's singletons. Tests
 * call createApp() with in-memory storage and a fixed clock and get a fully
 * working app with no browser at all.
 */
import { COLLECTION_NAMES } from '../config.js';
import { systemClock } from '../core/Clock.js';
import { EventBus } from '../core/EventBus.js';
import { MemoryBackend } from '../core/MemoryBackend.js';
import { Repository } from '../core/Repository.js';
import { Storage } from '../core/Storage.js';
import { AuthService } from '../services/AuthService.js';
import { BackupService } from '../services/BackupService.js';
import { ClosingService } from '../services/ClosingService.js';
import { CreditService } from '../services/CreditService.js';
import { DayService } from '../services/DayService.js';
import { DemoDataService } from '../services/DemoDataService.js';
import { ExpenseService } from '../services/ExpenseService.js';
import { InventoryService } from '../services/InventoryService.js';
import { LogService } from '../services/LogService.js';
import { ReportService } from '../services/ReportService.js';
import { RestockService } from '../services/RestockService.js';
import { SalesService } from '../services/SalesService.js';
import { SettingsService } from '../services/SettingsService.js';

/**
 * @typedef {ReturnType<typeof createApp>} App
 */

/**
 * @param {Object} [options]
 * @param {Storage} [options.storage] - Defaults to browser localStorage.
 * @param {import('../core/Clock.js').Clock} [options.clock]
 * @returns {Object} { storage, bus, clock, repositories, services }
 */
export function createApp({ storage = new Storage(), clock = systemClock } = {}) {
  storage.migrate();
  const bus = new EventBus();
  const repositories = Object.fromEntries(
    COLLECTION_NAMES.map((name) => [name, new Repository(storage, name)]),
  );
  const services = buildServices({ storage, clock, bus, repositories });
  return { storage, bus, clock, repositories, services };
}

/**
 * @param {{storage: Storage, clock: Object, bus: EventBus, repositories: Object<string, Repository>}} context
 * @returns {Object<string, Object>} All services by name.
 */
function buildServices({ storage, clock, bus, repositories }) {
  const logService = new LogService(repositories.logEntries);
  const settingsService = new SettingsService({ storage, bus, logService });
  const shared = { bus, logService, clock, getSettings: () => settingsService.get() };
  const dayService = new DayService({ dayRepository: repositories.days, ...shared });
  const coreServices = {
    logService,
    settingsService,
    dayService,
    ...buildTradingServices({ storage, repositories, shared, dayService }),
  };
  return {
    ...coreServices,
    ...buildSecondaryServices({ storage, repositories, shared, coreServices }),
  };
}

/**
 * Services for products, utang, sales and cash-outs.
 * @param {Object} context
 * @returns {Object<string, Object>}
 */
function buildTradingServices({ storage, repositories, shared, dayService }) {
  const inventoryService = new InventoryService({
    productRepository: repositories.products,
    adjustmentRepository: repositories.stockAdjustments,
    storage,
    ...shared,
  });
  const creditService = new CreditService({
    customerRepository: repositories.customers,
    creditRepository: repositories.creditEntries,
    dayService,
    ...shared,
  });
  const salesService = new SalesService({
    saleRepository: repositories.sales,
    storage,
    inventoryService,
    creditService,
    dayService,
    ...shared,
  });
  const expenseService = new ExpenseService({
    expenseRepository: repositories.expenses,
    dayService,
    ...shared,
  });
  return { inventoryService, creditService, salesService, expenseService };
}

/**
 * Services that only combine the core services above.
 * @param {Object} context
 * @returns {Object<string, Object>}
 */
function buildSecondaryServices({ storage, repositories, shared, coreServices }) {
  const { dayService, inventoryService, creditService, salesService, expenseService, logService } =
    coreServices;
  const backupService = new BackupService({ storage, repositories, ...shared });
  return {
    authService: new AuthService({ storage, logService }),
    restockService: new RestockService({
      restockRepository: repositories.restockItems,
      inventoryService,
      salesService,
      ...shared,
    }),
    closingService: new ClosingService({
      dayService,
      salesService,
      creditService,
      expenseService,
      ...shared,
    }),
    reportService: new ReportService({
      salesService,
      expenseService,
      inventoryService,
      creditService,
      ...shared,
    }),
    backupService,
    demoDataService: new DemoDataService({
      backupService,
      logService,
      createSandboxApp: (sandboxClock) =>
        createApp({ storage: new Storage(new MemoryBackend(), 'sandbox'), clock: sandboxClock }),
    }),
  };
}
