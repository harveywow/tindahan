/**
 * @file Tests for CreditService (suki and utang).
 */
import {
  ConflictError,
  CreditLimitError,
  StoreClosedError,
  ValidationError,
} from '../js/core/AppError.js';
import { Basket } from '../js/services/Basket.js';
import { createOpenStore, createTestApp, CUSTOMER_INPUT } from './helpers.js';
import { describe, expect, it } from './testRunner.js';

/**
 * Sells sardines on credit.
 * @param {Object} services
 * @param {Object} product
 * @param {string} customerId
 * @param {{quantity?: number, allowOverLimit?: boolean}} [options]
 * @returns {Object} The sale.
 */
function sellOnCredit(
  services,
  product,
  customerId,
  { quantity = 1, allowOverLimit = false } = {},
) {
  const basket = new Basket();
  basket.add(product, 'pack', quantity);
  return services.salesService.checkout(
    basket,
    { paymentType: 'credit', customerId },
    { allowOverLimit },
  );
}

describe('CreditService', () => {
  it('[EC7] rejects duplicate customer names', () => {
    const { services } = createTestApp();
    services.creditService.addCustomer(CUSTOMER_INPUT);
    expect(() =>
      services.creditService.addCustomer({ ...CUSTOMER_INPUT, name: 'juan  dela cruz' }),
    ).toThrow(ConflictError, 'errors.duplicateCustomer');
  });

  it('a credit sale adds to the balance', () => {
    const { services, sardines } = createOpenStore();
    const customer = services.creditService.addCustomer(CUSTOMER_INPUT);
    sellOnCredit(services, sardines, customer.id, { quantity: 2 });
    expect(services.creditService.getBalance(customer.id)).toBe(5000);
  });

  it('[EC8] blocks a sale above the credit limit, unless overridden by the owner', () => {
    const { services, sardines } = createOpenStore();
    const customer = services.creditService.addCustomer(CUSTOMER_INPUT); // ₱100 limit
    sellOnCredit(services, sardines, customer.id, { quantity: 4 }); // ₱100
    expect(() => sellOnCredit(services, sardines, customer.id, { quantity: 1 })).toThrow(
      CreditLimitError,
      'errors.creditLimitExceeded',
    );
    sellOnCredit(services, sardines, customer.id, { quantity: 1, allowOverLimit: true });
    expect(services.creditService.getBalance(customer.id)).toBe(12500);
  });

  it('requires choosing a customer for credit sales', () => {
    const { services, sardines } = createOpenStore();
    expect(() => sellOnCredit(services, sardines, '')).toThrow(
      ValidationError,
      'errors.chooseCustomer',
    );
  });

  it('[EC8] rejects a payment larger than the balance, and a payment of 0', () => {
    const { services, sardines } = createOpenStore();
    const customer = services.creditService.addCustomer(CUSTOMER_INPUT);
    sellOnCredit(services, sardines, customer.id, { quantity: 2 });
    const pay = (amount) =>
      services.creditService.recordPayment(customer.id, { amount, paymentMethod: 'cash' });
    expect(() => pay('60')).toThrow(ValidationError, 'errors.paymentExceedsBalance');
    expect(() => pay('0')).toThrow(ValidationError, 'errors.mustBePositive');
    pay('30');
    expect(services.creditService.getBalance(customer.id)).toBe(2000);
  });

  it('payments need an open store day (cash goes into the drawer)', () => {
    const { services } = createTestApp();
    const customer = services.creditService.addCustomer(CUSTOMER_INPUT);
    expect(() =>
      services.creditService.recordPayment(customer.id, { amount: '10', paymentMethod: 'cash' }),
    ).toThrow(StoreClosedError);
  });

  it('voiding a credit sale reverses the utang', () => {
    const { services, sardines } = createOpenStore();
    const customer = services.creditService.addCustomer(CUSTOMER_INPUT);
    const sale = sellOnCredit(services, sardines, customer.id, { quantity: 2 });
    services.salesService.voidSale(sale.id, 'Ibinalik');
    expect(services.creditService.getBalance(customer.id)).toBe(0);
  });

  it('[EC9] blocks removing a customer with a balance; archives one with history', () => {
    const { services, sardines } = createOpenStore();
    const customer = services.creditService.addCustomer(CUSTOMER_INPUT);
    sellOnCredit(services, sardines, customer.id, { quantity: 1 });
    expect(() => services.creditService.removeCustomer(customer.id)).toThrow(
      ConflictError,
      'errors.customerHasBalance',
    );
    services.creditService.recordPayment(customer.id, { amount: '25', paymentMethod: 'gcash' });
    expect(services.creditService.removeCustomer(customer.id)).toBe('archived');
    const newcomer = services.creditService.addCustomer({ ...CUSTOMER_INPUT, name: 'Bagong Suki' });
    expect(services.creditService.removeCustomer(newcomer.id)).toBe('deleted');
  });

  it('builds a notebook with a running balance', () => {
    const { services, sardines } = createOpenStore();
    const customer = services.creditService.addCustomer(CUSTOMER_INPUT);
    sellOnCredit(services, sardines, customer.id, { quantity: 2 });
    services.creditService.recordPayment(customer.id, { amount: '20', paymentMethod: 'cash' });
    expect(
      services.creditService.getLedger(customer.id).map((entry) => entry.runningBalance),
    ).toEqual([5000, 3000]);
  });

  it('marks utang overdue using first-in, first-out payments', () => {
    const { app, services, sardines } = createOpenStore();
    const customer = services.creditService.addCustomer({ ...CUSTOMER_INPUT, creditLimit: '1000' });
    sellOnCredit(services, sardines, customer.id, { quantity: 1 }); // Nov 22
    services.closingService.closeDay({ cashCount: { 50000: 1 } });
    app.clock.setToday('2026-11-23');
    services.dayService.openDay('500');
    sellOnCredit(services, sardines, customer.id, { quantity: 1 }); // Nov 23
    services.creditService.recordPayment(customer.id, { amount: '25', paymentMethod: 'gcash' }); // pays Nov 22
    expect(services.creditService.getOldestUnpaidDate(customer.id)).toBe('2026-11-23');
    app.clock.setToday('2026-12-20');
    const overdue = services.creditService.getOverdueCustomers();
    expect(overdue).toHaveLength(1);
    expect(overdue[0].daysUnpaid).toBe(27);
  });

  it('[EC1] validates customer fields', () => {
    const { services } = createTestApp();
    expect(() =>
      services.creditService.addCustomer({ ...CUSTOMER_INPUT, contact: '0917' }),
    ).toThrow(ValidationError, 'errors.invalidMobile');
    expect(() =>
      services.creditService.addCustomer({ ...CUSTOMER_INPUT, creditLimit: 'abc' }),
    ).toThrow(ValidationError);
  });
});
