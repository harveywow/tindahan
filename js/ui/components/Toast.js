/**
 * @file Short status messages in the corner (aria-live, auto-dismiss).
 * Depends on: utils/dom.js, ui/components/icons.js.
 */
import { el } from '../../utils/dom.js';
import { icon } from './icons.js';

const ICON_BY_TYPE = { success: 'check', error: 'alert', info: 'info' };
const DISPLAY_MS = 4500;

export class Toast {
  /** @param {HTMLElement} region - Container with aria-live="polite". */
  constructor(region) {
    this.region = region;
  }

  /**
   * @param {string} message
   * @param {'success'|'error'|'info'} [type]
   */
  show(message, type = 'success') {
    const toast = el(
      'div',
      { className: `toast toast--${type}`, attrs: { role: type === 'error' ? 'alert' : 'status' } },
      [icon(ICON_BY_TYPE[type] ?? 'info'), el('span', { text: message })],
    );
    this.region.append(toast);
    setTimeout(() => toast.remove(), DISPLAY_MS);
  }
}
