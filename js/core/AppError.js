/**
 * @file Custom error classes thrown by models and services.
 * Depends on: nothing.
 *
 * Why custom errors: services must not touch the DOM, so they cannot show
 * messages themselves. They throw a typed error carrying an i18n key; the
 * view catches it and displays the translated message next to the right field.
 */

/** Base class for every expected, user-facing error in the app. */
export class AppError extends Error {
  /**
   * @param {string} messageKey - i18n key of the message shown to the user.
   * @param {Object<string, (string|number)>} [params] - Values interpolated into the message.
   * @param {string} [field] - Name of the form field the error belongs to, if any.
   */
  constructor(messageKey, params = {}, field = '') {
    super(messageKey);
    this.name = this.constructor.name;
    this.messageKey = messageKey;
    this.params = params;
    this.field = field;
  }
}

/** Input failed validation (empty, negative, too long, wrong format...). */
export class ValidationError extends AppError {}

/** Not enough stock to complete the requested operation. */
export class StockError extends AppError {}

/** A credit sale would push a customer above their credit limit. */
export class CreditLimitError extends AppError {}

/** Operation requires the store day to be open (or not yet closed). */
export class StoreClosedError extends AppError {}

/** A record with the given id does not exist. */
export class NotFoundError extends AppError {}

/** The operation conflicts with existing data (duplicates, deleting used records...). */
export class ConflictError extends AppError {}

/** Browser storage is full. */
export class StorageQuotaError extends AppError {}

/** Wrong or missing owner PIN. */
export class AuthError extends AppError {}
