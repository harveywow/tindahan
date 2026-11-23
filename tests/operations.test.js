/**
 * @file Tests for ExpenseService, RestockService and ClosingService.
 */
import { ConflictError, StoreClosedError, ValidationError } from '../js/core/AppError.js';
import { Basket } from '../js/services/Basket.js';
import { calculateSuggestedPacks } from '../js/services/RestockService.js';
import { createOpenStore, createTestApp, CUSTOMER_INPUT, SARDINES_INPUT } from './helpers.js';
import { describe, expect, it } from './testRunner.js';

describe('ExpenseService', () => {
  it('records cash taken out and totals it per type', () => {
    const { services } = createOpenStore();
    services.expenseService.addExpense({ type: 'expense', description: 'Yelo', amount: '40' });
    services.expenseService.addExpense({
      type: 'withdrawal',
      description: 'Pang-ulam',
      amount: '100',
    });
    const totals = services.expenseService.getDayTotals('2026-11-22');
    expect(totals.expense).toBe(4000);
    expect(totals.total).toBe(14000);
  });

  it('[EC1][EC2] validates description, amount and type', () => {
    const { services } = createOpenStore();
    const add = (input) => () => services.expenseService.addExpense(input);
    expect(add({ type: 'expense', description: '', amount: '5' })).toThrow(
      ValidationError,
      'errors.required',
    );
    expect(add({ type: 'expense', description: 'Yelo', amount: '-5' })).toThrow(ValidationError);
    expect(add({ type: 'party', description: 'Yelo', amount: '5' })).toThrow(
      ValidationError,
      'errors.invalidChoice',
    );
  });

  it('[EC10] needs an open day', () => {
    const { services } = createTestApp();
    expect(() =>
      services.expenseService.addExpense({ type: 'expense', description: 'Yelo', amount: '5' }),
    ).toThrow(StoreClosedError);
  });
});

describe('RestockService', () => {
  it('suggests enough packs for a week of sales', () => {
    const product = { stockPieces: 2, piecesPerPack: 1, reorderLevel: 3 };
    // sold 14 in 7 days → 2/day → 14 for a week, minus 2 in stock = 12
    expect(calculateSuggestedPacks(product, 14)).toBe(12);
    // no sales → top up to 2 × reorder level = 6, minus 2 = 4
    expect(calculateSuggestedPacks(product, 0)).toBe(4);
  });

  it('rounds tingi suggestions up to whole packs', () => {
    const product = { stockPieces: 5, piecesPerPack: 12, reorderLevel: 1 };
    expect(calculateSuggestedPacks(product, 0)).toBe(2); // need 24 − 5 = 19 pieces → 2 packs
  });

  it('generates suggestions once per low product and receives them into stock', () => {
    const { services } = createOpenStore();
    const low = services.inventoryService.addProduct({
      ...SARDINES_INPUT,
      name: 'Corned Beef',
      initialStock: '1',
    });
    expect(services.restockService.generateSuggestions()).toBe(1);
    expect(services.restockService.generateSuggestions()).toBe(0);
    const [item] = services.restockService.listItems();
    services.restockService.receiveItem(item.id, { quantity: '6', costPerPack: '20' });
    expect(services.inventoryService.getProduct(low.id).stockPieces).toBe(7);
    expect(() =>
      services.restockService.receiveItem(item.id, { quantity: '6', costPerPack: '20' }),
    ).toThrow(ConflictError, 'errors.alreadyReceived');
  });

  it('[EC3] manual items need a whole-number quantity', () => {
    const { services } = createOpenStore();
    expect(() =>
      services.restockService.addManualItem({ name: 'Posporo', quantity: '1.5' }),
    ).toThrow(ValidationError);
    services.restockService.addManualItem({ name: 'Posporo', quantity: '2' });
    expect(services.restockService.listItems()).toHaveLength(1);
  });
});

describe('ClosingService', () => {
  /**
   * @returns {Object} Store with one cash sale (₱25), one GCash sale, one credit sale,
   *   a ₱10 utang payment in cash, and a ₱40 expense.
   */
  function createBusyDay() {
    const store = createOpenStore();
    const { services, sardines } = store;
    const customer = services.creditService.addCustomer({ ...CUSTOMER_INPUT, creditLimit: '500' });
    const sell = (payment) => {
      const basket = new Basket();
      basket.add(services.inventoryService.getProduct(sardines.id));
      return services.salesService.checkout(basket, payment);
    };
    sell({ paymentType: 'cash', cashReceived: '50' });
    sell({ paymentType: 'gcash', gcashReference: '1234567890123' });
    sell({ paymentType: 'credit', customerId: customer.id });
    services.creditService.recordPayment(customer.id, { amount: '10', paymentMethod: 'cash' });
    services.expenseService.addExpense({ type: 'expense', description: 'Yelo', amount: '40' });
    return store;
  }

  it('expects opening + cash sales + cash utang payments − cash out', () => {
    const { services } = createBusyDay();
    const expected = services.closingService.computeExpectedCash(services.dayService.getOpenDay());
    expect(expected.expectedCash).toBe(50000 + 2500 + 1000 - 4000);
  });

  it('excludes voided cash sales from expected cash', () => {
    const { services } = createBusyDay();
    const [latestCash] = services.salesService.listSales({ paymentType: 'cash' });
    services.salesService.voidSale(latestCash.id, 'Refund');
    const expected = services.closingService.computeExpectedCash(services.dayService.getOpenDay());
    expect(expected.cashSales).toBe(0);
  });

  it('closes with a matching count and freezes a summary', () => {
    const { services } = createBusyDay();
    const closed = services.closingService.closeDay({
      cashCount: { 20000: 2, 5000: 1, 2000: 2, 500: 1 },
    }); // ₱495
    expect(closed.difference).toBe(0);
    expect(closed.summary.totalSales).toBe(7500);
    expect(closed.summary.utangGiven).toBe(2500);
    expect(services.dayService.isOpen()).toBe(false);
  });

  it('requires a note when the count is short (kulang)', () => {
    const { services } = createBusyDay();
    const shortCount = { 20000: 2, 5000: 1, 2000: 2 }; // ₱490, ₱5 short
    expect(() => services.closingService.closeDay({ cashCount: shortCount })).toThrow(
      ValidationError,
      'errors.noteRequired',
    );
    const closed = services.closingService.closeDay({
      cashCount: shortCount,
      note: 'Kulang ng ₱5',
    });
    expect(closed.difference).toBe(-500);
  });

  it('[EC2][EC3] rejects negative or decimal piece counts', () => {
    const { services } = createBusyDay();
    expect(() => services.closingService.closeDay({ cashCount: { 100: '-1' } })).toThrow(
      ValidationError,
    );
    expect(() => services.closingService.closeDay({ cashCount: { 100: '1.5' } })).toThrow(
      ValidationError,
    );
  });
});
