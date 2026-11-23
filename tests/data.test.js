/**
 * @file Tests for reports, backup/restore, demo data, PIN and settings.
 */
import { AuthError, ValidationError } from '../js/core/AppError.js';
import { Basket } from '../js/services/Basket.js';
import { createOpenStore, createTestApp, TODAY } from './helpers.js';
import { describe, expect, it } from './testRunner.js';

describe('ReportService', () => {
  it('builds daily buckets ending today and totals sales and profit', () => {
    const { services, sardines } = createOpenStore();
    const basket = new Basket();
    basket.add(sardines, 'pack', 2);
    services.salesService.checkout(basket, { paymentType: 'cash', cashReceived: '50' });
    const series = services.reportService.getSeries('day');
    expect(series).toHaveLength(14);
    expect(series[13]).toEqual({ key: TODAY, sales: 5000, profit: 1000, expenses: 0 });
  });

  it('counts only operating expenses against profit', () => {
    const { services } = createOpenStore();
    services.expenseService.addExpense({ type: 'expense', description: 'Yelo', amount: '40' });
    services.expenseService.addExpense({ type: 'withdrawal', description: 'Owner', amount: '100' });
    expect(services.reportService.getRangeSummary(TODAY, TODAY).expenses).toBe(4000);
  });

  it('produces weekly and monthly buckets', () => {
    const { services } = createOpenStore();
    expect(services.reportService.getSeries('week')).toHaveLength(8);
    expect(
      services.reportService
        .getSeries('month')
        .map((bucket) => bucket.key)
        .at(-1),
    ).toBe('2026-11');
  });

  it('exports sales to CSV with a header row', () => {
    const { services, sardines } = createOpenStore();
    const basket = new Basket();
    basket.add(sardines);
    services.salesService.checkout(basket, { paymentType: 'cash', cashReceived: '25' });
    const lines = services.reportService.exportCsv('sales').split('\r\n');
    expect(lines[0]).toContain('Receipt');
    expect(lines).toHaveLength(2);
  });
});

describe('BackupService', () => {
  it('round-trips all data through a backup file', () => {
    const { services } = createOpenStore();
    const text = JSON.stringify(services.backupService.createBackup());
    const fresh = createTestApp();
    fresh.services.backupService.restore(fresh.services.backupService.parseBackup(text));
    expect(fresh.services.inventoryService.listProducts()).toHaveLength(2);
    expect(fresh.services.dayService.isOpen()).toBe(true);
  });

  it('[EC14] rejects text that is not JSON', () => {
    const { services } = createTestApp();
    expect(() => services.backupService.parseBackup('hello')).toThrow(
      ValidationError,
      'errors.invalidBackup',
    );
  });

  it('[EC14] rejects files from other apps, unknown sections and bad records', () => {
    const { services } = createOpenStore();
    const good = services.backupService.createBackup();
    const variants = [
      { ...good, app: 'other' },
      { ...good, schemaVersion: 999 },
      { ...good, collections: { ...good.collections, hacker: [] } },
      { ...good, collections: { ...good.collections, products: [{ id: 'x', name: 5 }] } },
      { ...good, collections: { ...good.collections, sales: 'nope' } },
      { ...good, documents: { ...good.documents, categories: [1, 2] } },
    ];
    variants.forEach((variant) => {
      expect(() => services.backupService.validateBackup(variant)).toThrow(
        ValidationError,
        'errors.invalidBackup',
      );
    });
  });

  it('[EC14] leaves current data untouched when a restore is rejected', () => {
    const { services } = createOpenStore();
    try {
      services.backupService.restore({
        app: 'tindahan',
        schemaVersion: 1,
        collections: {},
        documents: {},
      });
    } catch {
      // expected
    }
    expect(services.inventoryService.listProducts()).toHaveLength(2);
  });

  it('never includes the owner PIN in a backup', async () => {
    const { services } = createTestApp();
    await services.authService.setPin('1234');
    expect(JSON.stringify(services.backupService.createBackup()).includes('pinHash')).toBe(false);
  });

  it('reset deletes everything', () => {
    const { services } = createOpenStore();
    services.backupService.resetAll();
    expect(services.inventoryService.listProducts()).toHaveLength(0);
    expect(services.dayService.isOpen()).toBe(false);
  });
});

describe('DemoDataService', () => {
  it('generates 30 closed days of consistent data with today unopened', () => {
    const { services } = createTestApp();
    services.demoDataService.loadDemoData(TODAY);
    const closedDays = services.dayService.listClosedDays();
    expect(closedDays).toHaveLength(30);
    expect(services.dayService.isOpen()).toBe(false);
    expect(services.salesService.listSales().length).toBeGreaterThan(300);
    const negativeStock = services.inventoryService
      .listProducts()
      .filter((product) => product.stockPieces < 0);
    expect(negativeStock).toHaveLength(0);
    expect(services.creditService.getOverdueCustomers().length).toBeGreaterThan(0);
  });
});

describe('AuthService', () => {
  it('verifies the PIN and never stores it in plain text', async () => {
    const { services, storage } = createTestApp();
    await services.authService.setPin('2580');
    expect(await services.authService.verifyPin('2580')).toBe(true);
    expect(await services.authService.verifyPin('0000')).toBe(false);
    expect(JSON.stringify(storage.read('auth', {})).includes('2580')).toBe(false);
  });

  it('requires 4–6 digits', async () => {
    const { services } = createTestApp();
    await expect(services.authService.setPin('12')).toReject(ValidationError, 'errors.invalidPin');
    await expect(services.authService.setPin('abcd')).toReject(
      ValidationError,
      'errors.invalidPin',
    );
  });

  it('needs the current PIN to change or remove it', async () => {
    const { services } = createTestApp();
    await services.authService.setPin('1234');
    await expect(services.authService.setPin('5678', '0000')).toReject(
      AuthError,
      'errors.wrongPin',
    );
    await services.authService.setPin('5678', '1234');
    await expect(services.authService.removePin('1234')).toReject(AuthError);
    await services.authService.removePin('5678');
    expect(services.authService.hasPin()).toBe(false);
  });
});

describe('SettingsService and LogService', () => {
  it('fills missing settings with defaults and validates updates', () => {
    const { services } = createTestApp();
    expect(services.settingsService.get().overdueDays).toBe(15);
    expect(() =>
      services.settingsService.update({ ...services.settingsService.get(), overdueDays: '0' }),
    ).toThrow(ValidationError, 'errors.outOfRange');
  });

  it('logs important actions, newest first', () => {
    const { services } = createOpenStore();
    const [latest] = services.logService.list();
    expect(latest.messageKey).toBe('log.productAdded');
    expect(services.logService.list({ action: 'day' })).toHaveLength(1);
  });
});
