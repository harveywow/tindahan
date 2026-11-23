/**
 * @file Tests for Basket, SalesService (checkout and void) and DayService.
 */
import {
  ConflictError,
  StockError,
  StoreClosedError,
  ValidationError,
} from '../js/core/AppError.js';
import { Basket } from '../js/services/Basket.js';
import { createOpenStore, createTestApp, SARDINES_INPUT } from './helpers.js';
import { describe, expect, it } from './testRunner.js';

describe('Basket', () => {
  it('[EC5] limits a product to its stock across pack and piece lines', () => {
    const { shampoo } = createOpenStore(); // 2 strips × 12 = 24 pieces
    const basket = new Basket();
    basket.add(shampoo, 'pack', 1); // 12 pieces
    basket.add(shampoo, 'piece', 12); // 24 pieces total
    expect(() => basket.add(shampoo, 'piece', 1)).toThrow(StockError, 'errors.notEnoughStock');
    expect(basket.getTotal()).toBe(8400 + 12 * 750);
  });

  it('[EC3] rejects decimal quantities and removes lines set to 0', () => {
    const { sardines } = createOpenStore();
    const basket = new Basket();
    basket.add(sardines);
    const [line] = basket.getLines();
    expect(() => basket.setQuantity(line.key, '1.5')).toThrow(
      ValidationError,
      'errors.wholeNumber',
    );
    basket.setQuantity(line.key, '0');
    expect(basket.isEmpty()).toBe(true);
  });

  it('sells non-tingi products by pack even if "piece" is requested', () => {
    const { sardines } = createOpenStore();
    const basket = new Basket();
    basket.add(sardines, 'piece');
    expect(basket.getLines()[0].saleUnit).toBe('pack');
  });

  it('issues a new checkout token when cleared', () => {
    const basket = new Basket();
    const firstToken = basket.checkoutToken;
    basket.clear();
    expect(basket.checkoutToken === firstToken).toBe(false);
  });
});

describe('SalesService.checkout', () => {
  it('completes a cash sale, deducts stock and computes change', () => {
    const { services, sardines, shampoo } = createOpenStore();
    const basket = new Basket();
    basket.add(sardines, 'pack', 2);
    basket.add(shampoo, 'piece', 3);
    const sale = services.salesService.checkout(basket, {
      paymentType: 'cash',
      cashReceived: '100',
    });
    expect(sale.total).toBe(5000 + 2250);
    expect(sale.change).toBe(10000 - 7250);
    expect(sale.receiptNumber).toBe('000001');
    expect(services.inventoryService.getProduct(sardines.id).stockPieces).toBe(8);
    expect(services.inventoryService.getProduct(shampoo.id).stockPieces).toBe(21);
  });

  it('[EC16] computes tingi cost per line without fractional centavos', () => {
    const { services, shampoo } = createOpenStore();
    const basket = new Basket();
    basket.add(shampoo, 'piece', 1);
    const sale = services.salesService.checkout(basket, {
      paymentType: 'cash',
      cashReceived: '7.50',
    });
    expect(sale.items[0].lineCost).toBe(600); // ₱72 / 12
    expect(Number.isInteger(sale.totalCost)).toBe(true);
  });

  it('[EC6] rejects cash lower than the total', () => {
    const { services, sardines } = createOpenStore();
    const basket = new Basket();
    basket.add(sardines);
    expect(() =>
      services.salesService.checkout(basket, { paymentType: 'cash', cashReceived: '20' }),
    ).toThrow(ValidationError, 'errors.cashNotEnough');
  });

  it('[EC6] requires a GCash reference for GCash payments', () => {
    const { services, sardines } = createOpenStore();
    const basket = new Basket();
    basket.add(sardines);
    expect(() =>
      services.salesService.checkout(basket, { paymentType: 'gcash', gcashReference: '' }),
    ).toThrow(ValidationError, 'errors.gcashRequired');
    const sale = services.salesService.checkout(basket, {
      paymentType: 'gcash',
      gcashReference: '1234567890123',
    });
    expect(sale.change).toBe(0);
  });

  it('[EC5] re-checks stock at checkout using fresh data', () => {
    const { services, sardines } = createOpenStore();
    const basket = new Basket();
    basket.add(sardines, 'pack', 10);
    services.inventoryService.adjustStock(sardines.id, {
      quantity: '1',
      unit: 'pack',
      direction: 'remove',
      reason: 'lost',
    });
    expect(() =>
      services.salesService.checkout(basket, { paymentType: 'cash', cashReceived: '250' }),
    ).toThrow(StockError);
    expect(services.inventoryService.getProduct(sardines.id).stockPieces).toBe(9); // nothing deducted
  });

  it('[EC18] a double-clicked checkout cannot create two sales', () => {
    const { services, sardines } = createOpenStore();
    const basket = new Basket();
    basket.add(sardines);
    services.salesService.checkout(basket, { paymentType: 'cash', cashReceived: '25' });
    expect(() =>
      services.salesService.checkout(basket, { paymentType: 'cash', cashReceived: '25' }),
    ).toThrow(ConflictError, 'errors.duplicateCheckout');
    expect(services.salesService.listSales()).toHaveLength(1);
  });

  it('rejects an empty basket', () => {
    const { services } = createOpenStore();
    expect(() =>
      services.salesService.checkout(new Basket(), { paymentType: 'cash', cashReceived: '5' }),
    ).toThrow(ValidationError, 'errors.emptyBasket');
  });

  it('[EC10] cannot sell before the day is opened', () => {
    const { services } = createTestApp();
    const product = services.inventoryService.addProduct(SARDINES_INPUT);
    const basket = new Basket();
    basket.add(product);
    expect(() =>
      services.salesService.checkout(basket, { paymentType: 'cash', cashReceived: '25' }),
    ).toThrow(StoreClosedError, 'errors.storeNotOpen');
  });

  it('[EC10] cannot sell after the day is closed', () => {
    const { services, sardines } = createOpenStore();
    services.closingService.closeDay({ cashCount: { 50000: 1 } });
    const basket = new Basket();
    basket.add(sardines);
    expect(() =>
      services.salesService.checkout(basket, { paymentType: 'cash', cashReceived: '25' }),
    ).toThrow(StoreClosedError, 'errors.storeClosedToday');
  });

  it('[EC17] a sale after midnight belongs to the still-open store day', () => {
    const { app, services, sardines } = createOpenStore();
    app.clock.setToday('2026-11-23');
    const basket = new Basket();
    basket.add(sardines);
    const sale = services.salesService.checkout(basket, {
      paymentType: 'cash',
      cashReceived: '25',
    });
    expect(sale.dayKey).toBe('2026-11-22');
  });
});

describe('SalesService.voidSale', () => {
  it('restores stock and keeps the voided record', () => {
    const { services, sardines } = createOpenStore();
    const basket = new Basket();
    basket.add(sardines, 'pack', 2);
    const sale = services.salesService.checkout(basket, {
      paymentType: 'cash',
      cashReceived: '50',
    });
    services.salesService.voidSale(sale.id, 'Maling item');
    expect(services.inventoryService.getProduct(sardines.id).stockPieces).toBe(10);
    expect(services.salesService.getSale(sale.id).status).toBe('voided');
  });

  it('[EC11] cannot void the same sale twice', () => {
    const { services, sardines } = createOpenStore();
    const basket = new Basket();
    basket.add(sardines);
    const sale = services.salesService.checkout(basket, {
      paymentType: 'cash',
      cashReceived: '25',
    });
    services.salesService.voidSale(sale.id, 'Mali');
    expect(() => services.salesService.voidSale(sale.id, 'Mali ulit')).toThrow(
      ConflictError,
      'errors.alreadyVoided',
    );
  });

  it('[EC1] requires a reason', () => {
    const { services, sardines } = createOpenStore();
    const basket = new Basket();
    basket.add(sardines);
    const sale = services.salesService.checkout(basket, {
      paymentType: 'cash',
      cashReceived: '25',
    });
    expect(() => services.salesService.voidSale(sale.id, '  ')).toThrow(
      ValidationError,
      'errors.required',
    );
  });

  it('cannot void a sale from a closed day', () => {
    const { services, sardines } = createOpenStore();
    const basket = new Basket();
    basket.add(sardines);
    const sale = services.salesService.checkout(basket, {
      paymentType: 'cash',
      cashReceived: '25',
    });
    services.closingService.closeDay({ cashCount: { 50000: 1, 2000: 1, 500: 1 } });
    expect(() => services.salesService.voidSale(sale.id, 'Late')).toThrow(
      ConflictError,
      'errors.voidClosedDay',
    );
  });

  it('[EC17] rejects history filters where start is after end', () => {
    const { services } = createOpenStore();
    expect(() =>
      services.salesService.listSales({ startKey: '2026-12-01', endKey: '2026-11-01' }),
    ).toThrow(ValidationError, 'errors.startAfterEnd');
  });
});

describe('DayService', () => {
  it('opens the day once', () => {
    const { services } = createTestApp();
    services.dayService.openDay('500');
    expect(() => services.dayService.openDay('500')).toThrow(ConflictError, 'errors.dayStillOpen');
  });

  it('openDay refuses a day that was already closed (reopenToday is separate)', () => {
    const { services } = createTestApp();
    services.dayService.openDay('0');
    services.closingService.closeDay({ cashCount: {} });
    expect(() => services.dayService.openDay('0')).toThrow(
      ConflictError,
      'errors.storeClosedToday',
    );
  });

  it('[EC2] rejects invalid opening cash', () => {
    const { services } = createTestApp();
    expect(() => services.dayService.openDay('-100')).toThrow(ValidationError);
  });
});

describe('DayService.reopenToday', () => {
  /** @returns {Object} Store that sold one ₱25 can for cash and was closed with an exact count. */
  function createClosedStore() {
    const store = createOpenStore();
    const { services, sardines } = store;
    const basket = new Basket();
    basket.add(services.inventoryService.getProduct(sardines.id));
    services.salesService.checkout(basket, { paymentType: 'cash', cashReceived: '25' });
    // ₱500 opening + ₱25 sale = ₱525: one ₱500 bill, one ₱20 bill, one ₱5 coin.
    services.closingService.closeDay({ cashCount: { 50000: 1, 2000: 1, 500: 1 } });
    return store;
  }

  it('opens a closed today again and lets selling continue', () => {
    const { services, sardines } = createClosedStore();
    const reopened = services.dayService.reopenToday();
    expect(services.dayService.isOpen()).toBe(true);
    expect(reopened.reopenCount).toBe(1);
    const basket = new Basket();
    basket.add(services.inventoryService.getProduct(sardines.id));
    const sale = services.salesService.checkout(basket, {
      paymentType: 'cash',
      cashReceived: '25',
    });
    expect(sale.dayKey).toBe(reopened.id);
  });

  it('keeps the earlier count and logs it', () => {
    const { services } = createClosedStore();
    const reopened = services.dayService.reopenToday();
    expect(reopened.previousClosings).toHaveLength(1);
    expect(reopened.previousClosings[0].countedCash).toBe(52500);
    expect(reopened.summary).toBe(null);
    const [latest] = services.logService.list();
    expect(latest.messageKey).toBe('log.dayReopened');
  });

  it('expects every sale of the day at the next closing', () => {
    const { services, sardines } = createClosedStore();
    services.dayService.reopenToday();
    const basket = new Basket();
    basket.add(services.inventoryService.getProduct(sardines.id));
    services.salesService.checkout(basket, { paymentType: 'cash', cashReceived: '25' });
    const day = services.dayService.getOpenDay();
    // opening ₱500 + two ₱25 cash sales (one before and one after reopening)
    expect(services.closingService.computeExpectedCash(day).expectedCash).toBe(55000);
    const closed = services.closingService.closeDay({ cashCount: { 50000: 1, 5000: 1 } });
    expect(closed.difference).toBe(0);
    expect(closed.summary.transactionCount).toBe(2);
    expect(closed.reopenCount).toBe(1);
  });

  it('refuses when today is still open or was never opened', () => {
    const { services } = createTestApp();
    expect(() => services.dayService.reopenToday()).toThrow(
      ConflictError,
      'errors.nothingToReopen',
    );
    services.dayService.openDay('0');
    expect(() => services.dayService.reopenToday()).toThrow(ConflictError, 'errors.dayStillOpen');
  });

  it('only reopens today, never a past day', () => {
    const { app, services } = createClosedStore();
    app.clock.setToday('2026-11-23');
    expect(() => services.dayService.reopenToday()).toThrow(
      ConflictError,
      'errors.nothingToReopen',
    );
  });
});
