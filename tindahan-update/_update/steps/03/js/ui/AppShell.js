/**
 * @file The storefront frame around every screen: signboard, OPEN/CLOSED
 * sign, language toggle, grille navigation and footer.
 * Depends on: core/EventBus.js, ui/components/icons.js, utils/dom.js, utils/i18n.js.
 */
import { EVENTS } from '../core/EventBus.js';
import { el } from '../utils/dom.js';
import { LANGUAGES, t } from '../utils/i18n.js';
import { icon } from './components/icons.js';

/** Navigation entries in the order of a store day. */
export const NAV_ITEMS = Object.freeze([
  { route: 'bukas', iconName: 'sun' },
  { route: 'tinda', iconName: 'basket' },
  { route: 'paninda', iconName: 'shelf' },
  { route: 'listahan', iconName: 'notebook' },
  { route: 'benta', iconName: 'receipt' },
  { route: 'pamilihan', iconName: 'bag' },
  { route: 'gastos', iconName: 'wallet' },
  { route: 'sara', iconName: 'moon' },
  { route: 'ulat', iconName: 'chart' },
  { route: 'talaan', iconName: 'clock' },
  { route: 'ayos', iconName: 'gear' },
]);

export class AppShell {
  /**
   * @param {Object} context - { services, bus }
   * @param {{signboard: HTMLElement, tools: HTMLElement, nav: HTMLElement, footer: HTMLElement}} slots
   */
  constructor(context, slots) {
    this.context = context;
    this.slots = slots;
    this.activeRoute = '';
  }

  /** Draws everything and keeps it updated. */
  mount() {
    this.render();
    const { bus } = this.context;
    [EVENTS.DAY_CHANGED, EVENTS.SETTINGS_CHANGED, EVENTS.DATA_CHANGED].forEach((eventName) =>
      bus.on(eventName, () => this.renderTools()),
    );
    bus.on(EVENTS.SETTINGS_CHANGED, () => this.render());
  }

  render() {
    const skipLink = globalThis.document?.getElementById('skip-link');
    if (skipLink) {
      skipLink.textContent = t('common.skipToContent');
    }
    this.renderSignboard();
    this.renderTools();
    this.renderNav();
    this.renderFooter();
  }

  renderSignboard() {
    const { storeName } = this.context.services.settingsService.get();
    this.slots.signboard.replaceChildren(
      el('p', { className: 'signboard__kicker', text: t('sign.kicker') }),
      el('h1', { className: 'signboard__name', text: storeName }),
    );
  }

  /** BUKAS/SARADO sign and language switch. */
  renderTools() {
    const isOpen = this.context.services.dayService.isOpen();
    const wasOpen = this.previousOpenState ?? isOpen;
    this.previousOpenState = isOpen;
    // Draw the sign showing the OLD face first, then switch, so the flip animates.
    const sign = this.buildOpenSign(wasOpen);
    this.slots.tools.replaceChildren(sign, this.buildLanguageToggle());
    if (wasOpen !== isOpen) {
      requestAnimationFrame(() => requestAnimationFrame(() => this.setSignState(sign, isOpen)));
    }
  }

  /**
   * @param {boolean} isOpen
   * @returns {HTMLElement}
   */
  buildOpenSign(isOpen) {
    const sign = el('div', { className: 'open-sign', attrs: { role: 'status' } }, [
      el('div', { className: 'open-sign__card', attrs: { 'aria-hidden': 'true' } }, [
        el('span', { className: 'open-sign__face open-sign__face--open', text: t('sign.open') }),
        el('span', {
          className: 'open-sign__face open-sign__face--closed',
          text: t('sign.closed'),
        }),
      ]),
    ]);
    this.setSignState(sign, isOpen);
    return sign;
  }

  /**
   * @param {HTMLElement} sign
   * @param {boolean} isOpen
   */
  setSignState(sign, isOpen) {
    sign.classList.toggle('open-sign--open', isOpen);
    sign.classList.toggle('open-sign--closed', !isOpen);
    sign.setAttribute('aria-label', isOpen ? t('sign.openAria') : t('sign.closedAria'));
  }

  /** @returns {HTMLElement} EN / FIL switch. */
  buildLanguageToggle() {
    const { settingsService } = this.context.services;
    const current = settingsService.get().language;
    return el(
      'div',
      { className: 'lang-toggle', attrs: { role: 'group', 'aria-label': t('settings.language') } },
      LANGUAGES.map((language) =>
        el('button', {
          className: 'lang-toggle__option',
          text: language === 'en' ? 'EN' : 'FIL',
          attrs: { type: 'button', 'aria-pressed': String(language === current), lang: language },
          on: { click: () => settingsService.setLanguage(language) },
        }),
      ),
    );
  }

  renderNav() {
    const list = el(
      'ul',
      { className: 'main-nav__list' },
      NAV_ITEMS.map((item) =>
        el('li', {}, [
          el(
            'a',
            {
              className: 'main-nav__link',
              attrs: {
                href: `#${item.route}`,
                'aria-current': item.route === this.activeRoute ? 'page' : false,
              },
            },
            [icon(item.iconName), t(`nav.${item.route}`)],
          ),
        ]),
      ),
    );
    this.slots.nav.replaceChildren(list);
  }

  renderFooter() {
    this.slots.footer.replaceChildren(
      el('div', { className: 'app-footer__inner' }, [
        el('span', { text: t('footer.tagline') }),
        el('span', {}, [
          t('footer.madeBy'),
          ' ',
          el('a', { text: t('nav.tungkol'), attrs: { href: '#tungkol' } }),
        ]),
      ]),
    );
  }

  /**
   * Highlights the current screen in the navigation.
   * @param {string} route
   */
  setActiveRoute(route) {
    this.activeRoute = route;
    this.slots.nav.querySelectorAll('.main-nav__link').forEach((link) => {
      if (link.getAttribute('href') === `#${route}`) {
        link.setAttribute('aria-current', 'page');
        link.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }
}
