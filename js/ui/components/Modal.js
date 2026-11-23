/**
 * @file Accessible modal dialog: focus moves in, Tab stays in, Esc closes,
 * focus returns to the button that opened it.
 * Depends on: utils/dom.js, utils/i18n.js, ui/components/icons.js.
 */
import { el } from '../../utils/dom.js';
import { t } from '../../utils/i18n.js';
import { icon } from './icons.js';

/** How long after opening a click outside the dialog is ignored. */
const IGNORE_CLICKS_MS = 500;

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * @typedef {Object} ModalHandle
 * @property {function(): void} close
 * @property {HTMLElement} body - Where content lives (for re-rendering inside the modal).
 */

/**
 * Opens a modal.
 * @param {Object} options
 * @param {string} options.title
 * @param {HTMLElement} options.content
 * @param {boolean} [options.isWide]
 * @param {function(): void} [options.onClose]
 * @returns {ModalHandle}
 */
export function openModal({ title, content, isWide = false, onClose = () => {} }) {
  const previouslyFocused = document.activeElement;
  const { backdrop, dialog, body, closeButton } = buildDialog({ title, content, isWide });
  let isClosed = false;
  const close = () => {
    if (isClosed) {
      return; // closing twice (button + Esc) must not run onClose twice
    }
    isClosed = true;
    document.removeEventListener('keydown', handleKeydown);
    backdrop.remove();
    previouslyFocused?.focus?.();
    onClose();
  };
  const handleKeydown = (event) => {
    if (event.key === 'Escape') {
      close();
    } else if (event.key === 'Tab') {
      trapFocus(event, dialog);
    }
  };
  closeButton.addEventListener('click', close);
  // Ignore backdrop clicks right after opening: the second click of a
  // double-clicked "Bayad" would otherwise close the receipt immediately.
  const openedAt = Date.now();
  backdrop.addEventListener('mousedown', (event) => {
    if (event.target === backdrop && Date.now() - openedAt > IGNORE_CLICKS_MS) {
      close();
    }
  });
  document.addEventListener('keydown', handleKeydown);
  document.body.append(backdrop);
  (dialog.querySelector('input, select, textarea') ?? closeButton).focus();
  return { close, body };
}

/**
 * Builds the dialog markup (not yet attached to the page).
 * @param {{title: string, content: HTMLElement, isWide: boolean}} options
 * @returns {{backdrop: HTMLElement, dialog: HTMLElement, body: HTMLElement, closeButton: HTMLElement}}
 */
function buildDialog({ title, content, isWide }) {
  const titleId = `modal-title-${Date.now()}`;
  const body = el('div', { className: 'modal__body' }, [content]);
  const closeButton = el(
    'button',
    {
      className: 'btn btn--icon btn--ghost',
      attrs: { type: 'button', 'aria-label': t('common.close') },
    },
    [icon('close')],
  );
  const dialog = el(
    'div',
    {
      className: `modal${isWide ? ' modal--wide' : ''}`,
      attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId },
    },
    [
      el('div', { className: 'modal__header' }, [
        el('h2', { className: 'modal__title', text: title, attrs: { id: titleId } }),
        closeButton,
      ]),
      body,
    ],
  );
  return {
    backdrop: el('div', { className: 'modal-backdrop' }, [dialog]),
    dialog,
    body,
    closeButton,
  };
}

/**
 * Keeps Tab / Shift+Tab cycling inside the dialog.
 * @param {KeyboardEvent} event
 * @param {HTMLElement} dialog
 */
function trapFocus(event, dialog) {
  const focusable = [...dialog.querySelectorAll(FOCUSABLE)].filter((node) => !node.disabled);
  if (focusable.length === 0) {
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
