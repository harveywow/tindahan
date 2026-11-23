/**
 * @file Friendly placeholder for empty lists.
 * Depends on: utils/dom.js, ui/components/icons.js.
 */
import { el } from '../../utils/dom.js';
import { icon } from './icons.js';

/**
 * @param {string} message - Already translated.
 * @param {string} [iconName]
 * @param {HTMLElement|null} [action] - Optional button.
 * @returns {HTMLElement}
 */
export function emptyState(message, iconName = 'box', action = null) {
  return el('div', { className: 'empty-state' }, [
    icon(iconName),
    el('p', { className: 'empty-state__text', text: message }),
    action,
  ]);
}
