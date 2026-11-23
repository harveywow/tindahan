/**
 * @file Customer (suki) model.
 * Depends on: config.js, utils/validators.js, utils/ids.js.
 */
import { LIMITS } from '../config.js';
import { generateId, nowIso } from '../utils/ids.js';
import { optionalPhMobile, optionalText, requireMoney, requireText } from '../utils/validators.js';

/**
 * @typedef {Object} Customer
 * @property {string} id
 * @property {string} name
 * @property {string} nickname - What the owner actually calls them ("Mang Kanor").
 * @property {string} contact - 09XXXXXXXXX or ''.
 * @property {number} creditLimit - Centavos. 0 means no utang allowed.
 * @property {string} notes
 * @property {boolean} isArchived
 * @property {string} createdAt
 */

/**
 * @param {Object} input - Raw form values.
 * @returns {Object} Clean editable fields.
 * @throws {import('../core/AppError.js').ValidationError}
 */
export function validateCustomerInput(input) {
  return {
    name: requireText(input.name, 'name'),
    nickname: optionalText(input.nickname, 'nickname', { maxLength: LIMITS.MAX_NAME_LENGTH }),
    contact: optionalPhMobile(input.contact, 'contact'),
    creditLimit: requireMoney(input.creditLimit, 'creditLimit', { allowZero: true }),
    notes: optionalText(input.notes, 'notes'),
  };
}

/**
 * @param {Object} input
 * @returns {Customer}
 */
export function createCustomer(input) {
  return {
    id: generateId('cus'),
    ...validateCustomerInput(input),
    isArchived: false,
    createdAt: nowIso(),
  };
}

/**
 * @param {Customer} customer
 * @returns {string} Nickname when set, otherwise the name.
 */
export function getDisplayName(customer) {
  return customer.nickname || customer.name;
}
