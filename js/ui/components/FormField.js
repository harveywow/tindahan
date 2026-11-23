/**
 * @file Form building blocks with labels, hints and inline error messages.
 * Depends on: core/AppError.js, utils/dom.js, utils/i18n.js.
 *
 * Every input gets a real <label> and an error slot linked with
 * aria-describedby, so screen readers announce errors next to the field.
 */
import { AppError } from '../../core/AppError.js';
import { el, readForm } from '../../utils/dom.js';
import { t } from '../../utils/i18n.js';

let fieldCounter = 0;

/**
 * @typedef {Object} FieldOptions
 * @property {string} name
 * @property {string} label
 * @property {string} [type] - input type, or 'select' / 'textarea'.
 * @property {string|number} [value]
 * @property {string} [hint]
 * @property {Array<{value:string, label:string}>} [options] - For selects.
 * @property {Object<string, (string|number|boolean)>} [attrs] - Extra input attributes.
 * @property {string} [className]
 */

const FIELD_DEFAULTS = Object.freeze({
  type: 'text',
  value: '',
  hint: '',
  options: [],
  attrs: {},
  className: '',
});

/**
 * @param {FieldOptions} options
 * @returns {HTMLElement} Wrapper containing label, control, hint and error slot.
 */
export function field(options) {
  const spec = { ...FIELD_DEFAULTS, ...options };
  fieldCounter += 1;
  const inputId = `field-${spec.name}-${fieldCounter}`;
  const errorId = `${inputId}-error`;
  const hintId = spec.hint ? `${inputId}-hint` : '';
  const control = buildControl({ ...spec, attrs: { ...spec.attrs, id: inputId } });
  control.setAttribute('aria-describedby', [hintId, errorId].filter(Boolean).join(' '));
  const isCheckbox = spec.type === 'checkbox';
  const labelElement = el('label', {
    className: 'field__label',
    text: spec.label,
    attrs: { for: inputId },
  });
  // A checkbox reads best with its label AFTER the box.
  const [first, second] = isCheckbox ? [control, labelElement] : [labelElement, control];
  return el(
    'div',
    { className: `field${isCheckbox ? ' field--checkbox' : ''} ${spec.className}`.trim() },
    [
      first,
      second,
      spec.hint
        ? el('span', { className: 'field__hint', text: spec.hint, attrs: { id: hintId } })
        : null,
      el('span', {
        className: 'field__error',
        attrs: { id: errorId, 'aria-live': 'polite' },
        dataset: { errorFor: spec.name },
      }),
    ],
  );
}

/**
 * @param {Object} spec
 * @returns {HTMLElement}
 */
function buildControl({ type, name, value, options, attrs }) {
  if (type === 'select') {
    const select = el('select', { attrs: { name, ...attrs } });
    options.forEach((option) => {
      select.append(el('option', { text: option.label, attrs: { value: option.value } }));
    });
    // Only pre-select a value that exists; otherwise the browser shows a blank select.
    if (options.some((option) => option.value === String(value))) {
      select.value = String(value);
    }
    return select;
  }
  if (type === 'textarea') {
    const textarea = el('textarea', { attrs: { name, ...attrs } });
    textarea.value = String(value);
    return textarea;
  }
  if (type === 'checkbox') {
    return el('input', { attrs: { type, name, checked: Boolean(value), ...attrs } });
  }
  const input = el('input', { attrs: { type, name, ...attrs } });
  input.value = String(value);
  return input;
}

/**
 * Shortcut for a money input (₱, decimal keyboard on phones).
 * @param {FieldOptions} options
 * @returns {HTMLElement}
 */
export function moneyField(options) {
  return field({
    ...options,
    type: 'text',
    attrs: { inputmode: 'decimal', autocomplete: 'off', placeholder: '0.00', ...options.attrs },
  });
}

/**
 * Shortcut for a whole-number input.
 * @param {FieldOptions} options
 * @returns {HTMLElement}
 */
export function integerField(options) {
  return field({
    ...options,
    type: 'text',
    attrs: { inputmode: 'numeric', autocomplete: 'off', ...options.attrs },
  });
}

/**
 * Clears every inline error in a form.
 * @param {HTMLElement} form
 */
export function clearFormErrors(form) {
  form.querySelectorAll('.field__error').forEach((slot) => {
    slot.textContent = '';
  });
  form
    .querySelectorAll('[aria-invalid="true"]')
    .forEach((input) => input.removeAttribute('aria-invalid'));
  const banner = form.querySelector('.form-error-banner');
  if (banner) {
    banner.textContent = '';
  }
}

/**
 * Shows an AppError next to its field (or in the form banner when it has no field).
 * @param {HTMLElement} form
 * @param {AppError} error
 * @returns {boolean} True when the error was shown inside the form.
 */
export function showFormError(form, error) {
  if (!(error instanceof AppError)) {
    return false;
  }
  const message = t(error.messageKey, error.params);
  const slot = error.field
    ? form.querySelector(`[data-error-for="${CSS.escape(error.field)}"]`)
    : null;
  if (slot) {
    slot.textContent = message;
    const input = form.querySelector(`[name="${CSS.escape(error.field)}"]`);
    input?.setAttribute('aria-invalid', 'true');
    input?.focus();
    return true;
  }
  const banner = form.querySelector('.form-error-banner');
  if (banner) {
    banner.textContent = message;
    return true;
  }
  return false;
}

/** @returns {HTMLElement} Empty banner for errors that don't belong to one field. */
export function formErrorBanner() {
  return el('p', { className: 'form-error-banner', attrs: { role: 'alert' } });
}

/**
 * Builds a form with an error banner, the given fields and an actions row.
 * Submitting clears old errors, then calls onSubmit with the values.
 * Why: every form in the app needs exactly this wiring, so it lives in one place.
 * @param {Object} options
 * @param {Array<Node|null>} options.children - Fields and other content.
 * @param {HTMLElement} options.submitButton - A button with type="submit".
 * @param {function(Object<string, string>, HTMLFormElement): void} options.onSubmit
 * @param {Array<HTMLElement|null>} [options.extraActions] - Shown before the submit button.
 * @param {string} [options.className]
 * @returns {HTMLFormElement}
 */
export function buildForm({ children, submitButton, onSubmit, extraActions = [], className = '' }) {
  const form = el('form', { className, attrs: { novalidate: true } }, [
    formErrorBanner(),
    ...children,
    el('div', { className: 'form-actions' }, [...extraActions, submitButton]),
  ]);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    clearFormErrors(form);
    onSubmit(readForm(form), form);
  });
  return form;
}
