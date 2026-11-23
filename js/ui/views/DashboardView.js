/**
 * @file Bukas: open the store and see today at a glance.
 * Depends on: ui/views/BaseView.js, ui/components/*, utils/*.
 */
import { formatDateKey } from '../../utils/dates.js';
import { el } from '../../utils/dom.js';
import { getLocale, t } from '../../utils/i18n.js';
import { formatPeso } from '../../utils/money.js';
import { confirmAction, requirePin } from '../components/dialogs.js';
import { emptyState } from '../components/EmptyState.js';
import { formatStock } from '../components/format.js';
import { buildForm, field } from '../components/FormField.js';
import { icon } from '../components/icons.js';
import { button, panel, statTile } from '../components/viewHelpers.js';
import { BaseView } from './BaseView.js';

const MAX_ALERTS = 6;

export class DashboardView extends BaseView {
  /** @returns {Node[]} */
  build() {
    const settings = this.services.settingsService.get();
    const today = this.context.clock.today();
    const openDay = this.services.dayService.getOpenDay();
    const subtitle = t('dashboard.greeting', {
      name: settings.ownerName,
      date: formatDateKey(today, getLocale()),
    });
    return [
      this.pageHeader(t('dashboard.title'), subtitle),
      this.buildStaleDayWarning(openDay, today),
      this.buildNoProductsCallout(),
      openDay ? this.buildTodayStats(openDay) : this.buildOpenStorePanel(),
      el('div', { className: 'layout-two dashboard__alerts' }, [
        this.buildLowStockPanel(),
        this.buildAttentionPanel(),
      ]),
    ];
  }

  /**
   * A day left open from an earlier date must be closed first.
   * @param {Object|undefined} openDay
   * @param {string} today
   * @returns {HTMLElement|null}
   */
  buildStaleDayWarning(openDay, today) {
    if (!openDay || openDay.id === today) {
      return null;
    }
    return el('div', { className: 'callout', attrs: { role: 'alert' } }, [
      icon('alert'),
      el('div', {}, [
        el('p', {
          text: t('dashboard.staleDay', { date: formatDateKey(openDay.id, getLocale()) }),
        }),
        button({
          label: t('nav.sara'),
          variant: 'primary',
          size: 'small',
          onClick: () => this.navigate('sara'),
        }),
      ]),
    ]);
  }

  /** @returns {HTMLElement|null} Hint for a brand-new install. */
  buildNoProductsCallout() {
    if (this.services.inventoryService.listProducts({ stockStatus: 'all' }).length > 0) {
      return null;
    }
    return el('div', { className: 'callout' }, [
      icon('info'),
      el('div', {}, [
        el('p', { text: t('dashboard.noProducts') }),
        el('div', { className: 'btn-row' }, [
          button({
            label: t('dashboard.addProducts'),
            variant: 'yellow',
            size: 'small',
            onClick: () => this.navigate('paninda'),
          }),
          button({
            label: t('settings.loadDemo'),
            size: 'small',
            onClick: () => this.navigate('ayos'),
          }),
        ]),
      ]),
    ]);
  }

  /** @returns {HTMLElement} Opening form, or a "closed for today" message. */
  buildOpenStorePanel() {
    const todayRecord = this.services.dayService.getTodayRecord();
    if (todayRecord) {
      return this.buildClosedTodayPanel(todayRecord);
    }
    const form = buildForm({
      className: 'open-store__form',
      children: [
        field({
          name: 'openingCash',
          label: t('dashboard.openingCash'),
          value: '500.00',
          attrs: { inputmode: 'decimal' },
        }),
      ],
      submitButton: button({
        label: t('dashboard.openButton'),
        variant: 'green',
        size: 'huge',
        type: 'submit',
        iconName: 'sun',
      }),
      onSubmit: (values) =>
        this.runAction(() => this.services.dayService.openDay(values.openingCash), {
          form,
          successMessage: t('dashboard.opened'),
        }),
    });
    return el('section', { className: 'open-store' }, [
      el('div', { className: 'open-store__sign', attrs: { 'aria-hidden': 'true' } }, [
        el('span', { text: t('sign.closed') }),
      ]),
      el('div', { className: 'open-store__body' }, [
        el('h3', { className: 'open-store__title', text: t('dashboard.openTitle') }),
        el('p', { className: 'text-muted', text: t('dashboard.openText') }),
        form,
      ]),
    ]);
  }

  /**
   * @param {import('../../models/DayRecord.js').DayRecord} todayRecord
   * @returns {HTMLElement}
   */
  buildClosedTodayPanel(todayRecord) {
    return panel({
      title: t('dashboard.closedToday'),
      iconName: 'moon',
      modifier: 'cardboard',
      children: [
        el('p', {
          text: t('dashboard.closedTodayText', {
            amount: formatPeso(todayRecord.summary?.totalSales ?? 0),
          }),
        }),
        el('div', { className: 'btn-row' }, [
          button({ label: t('dashboard.seeClosing'), onClick: () => this.navigate('sara') }),
          button({
            label: t('dashboard.reopen'),
            variant: 'green',
            iconName: 'undo',
            onClick: () => this.reopenToday(),
          }),
        ]),
      ],
    });
  }

  /** Confirms, asks for the owner PIN (if one is set), then opens today again. */
  async reopenToday() {
    const confirmed = await confirmAction({
      title: t('dashboard.reopenTitle'),
      message: t('dashboard.reopenText'),
      confirmLabel: t('dashboard.reopen'),
    });
    if (confirmed && (await requirePin(this.services.authService, t('dashboard.pinForReopen')))) {
      this.runAction(() => this.services.dayService.reopenToday(), {
        successMessage: t('dashboard.reopened'),
      });
    }
  }

  /**
   * @param {Object} openDay
   * @returns {HTMLElement}
   */
  buildTodayStats(openDay) {
    const summary = this.services.closingService.buildSummary(openDay.id);
    const cash = this.services.closingService.computeExpectedCash(openDay);
    const tiles = [
      statTile({
        label: t('dashboard.salesToday'),
        value: formatPeso(summary.totalSales),
        tone: 'red',
      }),
      statTile({
        label: t('dashboard.profitToday'),
        value: formatPeso(summary.profit),
        tone: 'green',
      }),
      statTile({ label: t('dashboard.transactions'), value: String(summary.transactionCount) }),
      statTile({
        label: t('dashboard.cashInDrawer'),
        value: formatPeso(cash.expectedCash),
        hint: t('dashboard.cashHint'),
      }),
      statTile({ label: t('dashboard.utangGiven'), value: formatPeso(summary.utangGiven) }),
      statTile({ label: t('dashboard.utangCollected'), value: formatPeso(summary.utangCollected) }),
    ];
    return el(
      'section',
      { className: 'dashboard__today', attrs: { 'aria-label': t('dashboard.todayStats') } },
      [el('div', { className: 'stat-grid' }, tiles), this.buildQuickActions()],
    );
  }

  /** @returns {HTMLElement} Shortcuts to the screens used most during the day. */
  buildQuickActions() {
    const go = (route) => () => this.navigate(route);
    return el('div', { className: 'btn-row dashboard__actions' }, [
      button({
        label: t('dashboard.goSell'),
        variant: 'primary',
        iconName: 'basket',
        onClick: go('tinda'),
      }),
      button({ label: t('nav.listahan'), iconName: 'notebook', onClick: go('listahan') }),
      button({ label: t('nav.gastos'), iconName: 'wallet', onClick: go('gastos') }),
      button({
        label: t('dashboard.closeStore'),
        variant: 'yellow',
        iconName: 'moon',
        onClick: go('sara'),
      }),
    ]);
  }

  /** @returns {HTMLElement} */
  buildLowStockPanel() {
    const lowStock = this.services.inventoryService.getLowStockProducts();
    const items = lowStock.slice(0, MAX_ALERTS).map((product) => {
      return el(
        'li',
        {
          className: `alert-list__item${product.stockPieces === 0 ? ' alert-list__item--danger' : ''}`,
        },
        [
          el('span', { text: product.name }),
          el('span', {
            className: 'stamp',
            text: product.stockPieces === 0 ? t('stock.out') : formatStock(product),
          }),
        ],
      );
    });
    return panel({
      title: t('dashboard.lowStock', { count: lowStock.length }),
      iconName: 'box',
      action: lowStock.length
        ? button({
            label: t('nav.pamilihan'),
            size: 'small',
            onClick: () => this.navigate('pamilihan'),
          })
        : null,
      children: [
        items.length
          ? el('ul', { className: 'alert-list' }, items)
          : emptyState(t('dashboard.stockOk'), 'check'),
      ],
    });
  }

  /** @returns {HTMLElement} Overdue utang and expiring products. */
  buildAttentionPanel() {
    const overdue = this.services.creditService.getOverdueCustomers().slice(0, MAX_ALERTS);
    const expiring = this.services.inventoryService.getExpiringProducts().slice(0, MAX_ALERTS);
    const items = [
      ...overdue.map((row) =>
        el('li', { className: 'alert-list__item alert-list__item--danger' }, [
          el('span', {
            text: t('dashboard.overdueLine', {
              name: row.customer.nickname || row.customer.name,
              days: row.daysUnpaid,
            }),
          }),
          el('span', { className: 'text-money', text: formatPeso(row.balance) }),
        ]),
      ),
      ...expiring.map((product) =>
        el('li', { className: 'alert-list__item' }, [
          el('span', { text: product.name }),
          el('span', {
            className: 'stamp stamp--warn',
            text: t('stock.expires', { date: product.expiryDate }),
          }),
        ]),
      ),
    ];
    return panel({
      title: t('dashboard.attention'),
      iconName: 'alert',
      children: [
        items.length
          ? el('ul', { className: 'alert-list' }, items)
          : emptyState(t('dashboard.allGood'), 'heart'),
      ],
    });
  }
}
