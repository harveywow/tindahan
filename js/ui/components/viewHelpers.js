/**
 * @file Small UI builders shared by several views (buttons, stat tiles, panels).
 * Depends on: utils/dom.js, ui/components/icons.js.
 */
import { el } from '../../utils/dom.js';
import { icon } from './icons.js';

const BUTTON_DEFAULTS = Object.freeze({
  variant: '',
  iconName: '',
  size: '',
  type: 'button',
  attrs: {},
});

/**
 * @param {Object} options
 * @param {string} options.label
 * @param {function(Event): void} [options.onClick]
 * @param {string} [options.variant] - '', 'primary', 'yellow', 'green', 'ghost'.
 * @param {string} [options.iconName]
 * @param {string} [options.size] - '', 'small', 'huge', 'icon'.
 * @param {string} [options.type] - 'button' or 'submit'.
 * @param {Object} [options.attrs]
 * @returns {HTMLButtonElement}
 */
export function button(options) {
  const { label, onClick, variant, iconName, size, type, attrs } = {
    ...BUTTON_DEFAULTS,
    ...options,
  };
  const classes = ['btn', variant && `btn--${variant}`, size && `btn--${size}`]
    .filter(Boolean)
    .join(' ');
  // Icon-only buttons still need a text name for screen readers and a tooltip.
  const isIconOnly = size === 'icon';
  const nameAttrs = isIconOnly ? { 'aria-label': label, title: label } : {};
  return el(
    'button',
    {
      className: classes,
      attrs: { type, ...nameAttrs, ...attrs },
      on: onClick ? { click: onClick } : {},
    },
    [iconName ? icon(iconName) : null, isIconOnly ? null : label],
  );
}

/**
 * @param {Object} options
 * @param {string} options.label
 * @param {string} options.value
 * @param {string} [options.hint]
 * @param {string} [options.tone] - '', 'red', 'green'.
 * @returns {HTMLElement}
 */
export function statTile({ label, value, hint = '', tone = '' }) {
  return el('div', { className: `stat-tile${tone ? ` stat-tile--${tone}` : ''}` }, [
    el('p', { className: 'stat-tile__label', text: label }),
    el('p', { className: 'stat-tile__value text-money', text: value }),
    hint ? el('p', { className: 'stat-tile__hint', text: hint }) : null,
  ]);
}

/**
 * @param {Object} options
 * @param {string} options.title
 * @param {string} [options.iconName]
 * @param {Node[]} options.children
 * @param {string} [options.modifier] - e.g. 'cardboard'.
 * @param {HTMLElement|null} [options.action] - Shown at the right of the title.
 * @returns {HTMLElement}
 */
export function panel({ title, iconName = '', children, modifier = '', action = null }) {
  return el('section', { className: `panel${modifier ? ` panel--${modifier}` : ''}` }, [
    el('h3', { className: 'panel__title' }, [
      el('span', { className: 'panel__title-text' }, [
        iconName ? icon(iconName) : null,
        ` ${title}`,
      ]),
      action,
    ]),
    ...children,
  ]);
}

/**
 * Segmented toggle (one choice of several).
 * @param {Object} options
 * @param {Array<{value:string, label:string}>} options.options
 * @param {string} options.selected
 * @param {function(string): void} options.onSelect
 * @param {string} options.label - Accessible group label.
 * @returns {HTMLElement}
 */
export function segmented({ options, selected, onSelect, label }) {
  return el(
    'div',
    { className: 'segmented', attrs: { role: 'group', 'aria-label': label } },
    options.map((option) =>
      el('button', {
        className: 'segmented__option',
        text: option.label,
        attrs: { type: 'button', 'aria-pressed': String(option.value === selected) },
        on: { click: () => onSelect(option.value) },
      }),
    ),
  );
}

/**
 * Builds a data table.
 * @param {string[]} headers
 * @param {HTMLElement[]} rows - <tr> elements.
 * @param {string} caption - Accessible caption (visually hidden).
 * @returns {HTMLElement}
 */
export function dataTable(headers, rows, caption) {
  return el('div', { className: 'table-wrap' }, [
    el('table', { className: 'data-table' }, [
      el('caption', { className: 'visually-hidden', text: caption }),
      el('thead', {}, [
        el(
          'tr',
          {},
          headers.map((header) => el('th', { text: header, attrs: { scope: 'col' } })),
        ),
      ]),
      el('tbody', {}, rows),
    ]),
  ]);
}

/**
 * Panel-style heading with an icon, for forms that sit inside other panels.
 * @param {string} iconName
 * @param {string} text
 * @returns {HTMLElement}
 */
export function panelHeading(iconName, text) {
  return el('h3', { className: 'panel__title' }, [
    el('span', { className: 'panel__title-text' }, [icon(iconName), ` ${text}`]),
  ]);
}
