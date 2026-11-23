/**
 * @file Promise-based confirm, text-confirm and PIN dialogs built on Modal.
 * Depends on: ui/components/Modal.js, ui/components/FormField.js, utils/dom.js, utils/i18n.js.
 */
import { AuthError } from '../../core/AppError.js';
import { el } from '../../utils/dom.js';
import { t } from '../../utils/i18n.js';
import { clearFormErrors, field, showFormError } from './FormField.js';
import { openModal } from './Modal.js';

/**
 * Asks a yes/no question.
 * @param {Object} options
 * @param {string} options.title
 * @param {string} options.message
 * @param {string} [options.confirmLabel]
 * @param {boolean} [options.isDanger]
 * @returns {Promise<boolean>} True when confirmed.
 */
export function confirmAction({
  title,
  message,
  confirmLabel = t('common.yes'),
  isDanger = false,
}) {
  return new Promise((resolve) => {
    let isResolved = false;
    const finish = (answer) => {
      if (!isResolved) {
        isResolved = true;
        resolve(answer);
      }
    };
    const confirmButton = el('button', {
      className: `btn ${isDanger ? 'btn--primary' : 'btn--yellow'}`,
      text: confirmLabel,
      attrs: { type: 'button' },
    });
    const cancelButton = el('button', {
      className: 'btn btn--ghost',
      text: t('common.cancel'),
      attrs: { type: 'button' },
    });
    const content = el('div', {}, [
      el('p', { text: message }),
      el('div', { className: 'form-actions' }, [cancelButton, confirmButton]),
    ]);
    const modal = openModal({ title, content, onClose: () => finish(false) });
    confirmButton.addEventListener('click', () => {
      finish(true);
      modal.close();
    });
    cancelButton.addEventListener('click', () => modal.close());
    confirmButton.focus();
  });
}

/**
 * Asks for a typed confirmation word before something destructive (reset).
 * @param {Object} options
 * @param {string} options.title
 * @param {string} options.message
 * @param {string} options.word - What the user must type exactly.
 * @returns {Promise<boolean>}
 */
export function confirmByTyping({ title, message, word }) {
  return promptInModal({
    title,
    message,
    fieldOptions: {
      name: 'confirmWord',
      label: t('dialogs.typeToConfirm', { word }),
      attrs: { autocomplete: 'off' },
    },
    submitLabel: t('common.confirm'),
    validate: async (value) => {
      if (value.trim() !== word) {
        throw new AuthError('dialogs.wordMismatch', { word }, 'confirmWord');
      }
    },
  });
}

/**
 * Asks for the owner PIN when one is set. Resolves true immediately when no PIN exists.
 * @param {import('../../services/AuthService.js').AuthService} authService
 * @param {string} reason - Shown in the dialog ("to void a sale").
 * @returns {Promise<boolean>}
 */
export function requirePin(authService, reason) {
  if (!authService.hasPin()) {
    return Promise.resolve(true);
  }
  return promptInModal({
    title: t('dialogs.pinTitle'),
    message: reason,
    fieldOptions: {
      name: 'pin',
      label: t('settings.pin'),
      type: 'password',
      attrs: { inputmode: 'numeric', autocomplete: 'off', maxlength: 6 },
    },
    submitLabel: t('common.confirm'),
    validate: async (value) => {
      if (!(await authService.verifyPin(value))) {
        throw new AuthError('errors.wrongPin', {}, 'pin');
      }
    },
  });
}

/**
 * Shared single-field modal: resolves true once validate() passes.
 * @param {Object} options
 * @returns {Promise<boolean>}
 */
function promptInModal({ title, message, fieldOptions, submitLabel, validate }) {
  return new Promise((resolve) => {
    let isResolved = false;
    const form = el('form', { attrs: { novalidate: true } }, [
      el('p', { text: message }),
      field(fieldOptions),
      el('div', { className: 'form-actions' }, [
        el('button', {
          className: 'btn btn--primary',
          text: submitLabel,
          attrs: { type: 'submit' },
        }),
      ]),
    ]);
    const modal = openModal({ title, content: form, onClose: () => !isResolved && resolve(false) });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearFormErrors(form);
      try {
        await validate(form.elements[fieldOptions.name].value);
        isResolved = true;
        resolve(true);
        modal.close();
      } catch (error) {
        showFormError(form, error);
      }
    });
  });
}
