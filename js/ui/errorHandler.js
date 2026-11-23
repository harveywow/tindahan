/**
 * @file Last line of defense: catches any error no view handled, so the app
 * shows a friendly message instead of silently breaking or going blank.
 * Depends on: core/AppError.js, utils/i18n.js.
 */
import { AppError } from '../core/AppError.js';
import { t } from '../utils/i18n.js';

/**
 * @param {*} error
 * @returns {string} Message safe to show the user.
 */
function toUserMessage(error) {
  if (error instanceof AppError) {
    return t(error.messageKey, error.params);
  }
  return t('errors.unexpected');
}

/**
 * Installs window-level handlers for thrown errors and rejected promises.
 * @param {import('./components/Toast.js').Toast} toast
 */
export function installGlobalErrorHandler(toast) {
  window.addEventListener('error', (event) => {
    console.error('Unhandled error:', event.error ?? event.message);
    toast.show(toUserMessage(event.error), 'error');
  });
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    toast.show(toUserMessage(event.reason), 'error');
    event.preventDefault();
  });
}

/**
 * Renders a full-page fallback when the app cannot even start
 * (e.g. a browser too old for ES modules features we use).
 * @param {HTMLElement} container
 * @param {Error} error
 */
export function showStartupFailure(container, error) {
  console.error('Startup failed:', error);
  const message = document.createElement('div');
  message.className = 'callout';
  message.setAttribute('role', 'alert');
  message.textContent = t('errors.startup');
  container.replaceChildren(message);
}
