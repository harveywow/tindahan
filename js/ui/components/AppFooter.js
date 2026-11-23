/**
 * @file The wooden-counter footer shown under every screen: store name and
 * today's status, quick links, the group members, a storage reminder and a
 * "back to top" button.
 * Depends on: config.js, utils/dates.js, utils/dom.js, utils/i18n.js, ui/components/icons.js.
 *
 * Its position (always at the bottom of the window on short screens) comes
 * from the flex layout on <body> in css/base.css, not from this file.
 */
import { APP_VERSION, CONTRIBUTORS } from '../../config.js';
import { formatDateKey } from '../../utils/dates.js';
import { el } from '../../utils/dom.js';
import { getLocale, t } from '../../utils/i18n.js';
import { icon } from './icons.js';

/** Screens most owners jump to, in the order they use them. */
const QUICK_LINK_ROUTES = Object.freeze(['tinda', 'paninda', 'listahan', 'ulat', 'tungkol']);

/**
 * @param {Object} state
 * @param {string} state.storeName
 * @param {string} state.todayKey - Today's date key (YYYY-MM-DD).
 * @param {boolean} state.isOpen
 * @returns {Node[]} Children for the <footer> element.
 */
export function buildFooter({ storeName, todayKey, isOpen }) {
  return [
    el('div', { className: 'app-footer__inner' }, [
      buildBrand({ storeName, todayKey, isOpen }),
      buildQuickLinks(),
      buildMembers(),
    ]),
    buildBottomBar(todayKey),
  ];
}

/**
 * @param {{storeName: string, todayKey: string, isOpen: boolean}} state
 * @returns {HTMLElement}
 */
function buildBrand({ storeName, todayKey, isOpen }) {
  const statusModifier = isOpen ? 'open' : 'closed';
  return el('section', { className: 'app-footer__brand' }, [
    el('p', { className: 'app-footer__name' }, [icon('store'), storeName]),
    el('p', { className: 'app-footer__tagline', text: t('footer.tagline') }),
    el('p', { className: 'app-footer__today' }, [
      el('span', { text: `${t('footer.today')}: ${formatDateKey(todayKey, getLocale())}` }),
      el('span', {
        className: `app-footer__status app-footer__status--${statusModifier}`,
        text: isOpen ? t('sign.open') : t('sign.closed'),
      }),
    ]),
  ]);
}

/** @returns {HTMLElement} */
function buildQuickLinks() {
  return el(
    'nav',
    { className: 'app-footer__col', attrs: { 'aria-label': t('footer.quickLinks') } },
    [
      el('h2', { className: 'app-footer__heading', text: t('footer.quickLinks') }),
      el(
        'ul',
        { className: 'app-footer__list' },
        QUICK_LINK_ROUTES.map((route) =>
          el('li', {}, [el('a', { text: t(`nav.${route}`), attrs: { href: `#${route}` } })]),
        ),
      ),
    ],
  );
}

/** @returns {HTMLElement} */
function buildMembers() {
  return el('section', { className: 'app-footer__col' }, [
    el('h2', { className: 'app-footer__heading', text: t('footer.madeBy') }),
    el(
      'ul',
      { className: 'app-footer__list app-footer__list--names' },
      CONTRIBUTORS.map((name) => el('li', { text: name })),
    ),
  ]);
}

/**
 * @param {string} todayKey - Used for the copyright year, so tests with a fixed clock stay stable.
 * @returns {HTMLElement}
 */
function buildBottomBar(todayKey) {
  return el('div', { className: 'app-footer__bottom' }, [
    el('p', { className: 'app-footer__note' }, [
      t('footer.storageNote'),
      ' ',
      el('a', { text: t('footer.backupLink'), attrs: { href: '#ayos' } }),
    ]),
    el('p', {
      className: 'app-footer__meta',
      text: `${t('footer.version', { version: APP_VERSION })} · ${t('footer.rights', {
        year: todayKey.slice(0, 4),
      })}`,
    }),
    el(
      'button',
      {
        className: 'app-footer__top',
        attrs: { type: 'button' },
        on: { click: scrollToTop },
      },
      [icon('upload'), t('footer.backToTop')],
    ),
  ]);
}

/** Smoothly returns to the top and puts keyboard focus back on the screen. */
function scrollToTop() {
  globalThis.scrollTo({ top: 0, behavior: 'smooth' });
  globalThis.document.getElementById('app-main')?.focus({ preventScroll: true });
}
