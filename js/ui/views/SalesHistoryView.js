/**
 * @file Benta: sales history with filters, receipt reprint and void/refund.
 * Depends on: ui/views/BaseView.js, ui/components/*, utils/*.
 */
import { PAYMENT_TYPES } from '../../config.js';
import { el, readForm } from '../../utils/dom.js';
import { formatDateTime } from '../../utils/dates.js';
import { getLocale, t } from '../../utils/i18n.js';
import { formatPeso } from '../../utils/money.js';
import { requirePin } from '../components/dialogs.js';
import { emptyState } from '../components/EmptyState.js';
import { clearFormErrors, field, formErrorBanner } from '../components/FormField.js';
import { openModal } from '../components/Modal.js';
import { printElement } from '../components/print.js';
import { renderReceipt } from '../components/ReceiptRenderer.js';
import { button, dataTable, statTile } from '../components/viewHelpers.js';
import { BaseView } from './BaseView.js';

const PAGE_SIZE = 50;

export class SalesHistoryView extends BaseView {
  constructor(context) {
    super(context);
    const today = context.clock.today();
    this.filter = { startKey: today, endKey: today, paymentType: '', status: '' };
    this.visibleCount = PAGE_SIZE;
  }

  /** @returns {Node[]} */
  build() {
    const filterForm = this.buildFilterForm();
    let sales = [];
    try {
      sales = this.services.salesService.listSales(this.filter);
    } catch (error) {
      queueMicrotask(() => this.showError(error, filterForm));
    }
    return [
      this.pageHeader(t('history.title'), t('history.subtitle')),
      el('section', { className: 'panel' }, [
        filterForm,
        this.buildSummary(sales),
        this.buildList(sales),
      ]),
    ];
  }

  /** @returns {HTMLFormElement} */
  buildFilterForm() {
    const { startKey, endKey, paymentType, status } = this.filter;
    const { paymentOptions, statusOptions } = this.buildFilterOptions();
    const form = el('form', { className: 'toolbar', attrs: { novalidate: true } }, [
      field({ name: 'startDate', label: t('common.from'), type: 'date', value: startKey }),
      field({ name: 'endDate', label: t('common.to'), type: 'date', value: endKey }),
      field({
        name: 'paymentType',
        label: t('cashier.paymentType'),
        type: 'select',
        options: paymentOptions,
        value: paymentType,
      }),
      field({
        name: 'status',
        label: t('history.status'),
        type: 'select',
        options: statusOptions,
        value: status,
      }),
      button({ label: t('common.filter'), type: 'submit', iconName: 'search' }),
      button({
        label: t('history.allDates'),
        variant: 'ghost',
        onClick: () => this.applyFilter({ startDate: '', endDate: '' }, form),
      }),
    ]);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.applyFilter(readForm(form), form);
    });
    return form;
  }

  /** @returns {{paymentOptions: Array<Object>, statusOptions: Array<Object>}} */
  buildFilterOptions() {
    const all = { value: '', label: t('common.all') };
    const toOption = (prefix) => (value) => ({ value, label: t(`${prefix}.${value}`) });
    return {
      paymentOptions: [all, ...Object.values(PAYMENT_TYPES).map(toOption('payment'))],
      statusOptions: [all, ...['completed', 'voided'].map(toOption('history'))],
    };
  }

  /**
   * @param {Object} values
   * @param {HTMLFormElement} form
   */
  applyFilter(values, form) {
    clearFormErrors(form);
    const merged = { ...readForm(form), ...values };
    this.filter = {
      startKey: merged.startDate,
      endKey: merged.endDate,
      paymentType: merged.paymentType,
      status: merged.status,
    };
    this.visibleCount = PAGE_SIZE;
    this.render();
  }

  /**
   * @param {import('../../models/Sale.js').Sale[]} sales
   * @returns {HTMLElement}
   */
  buildSummary(sales) {
    const completed = sales.filter((sale) => sale.status === 'completed');
    return el('div', { className: 'stat-grid history__summary' }, [
      statTile({ label: t('history.count'), value: String(completed.length) }),
      statTile({
        label: t('history.total'),
        value: formatPeso(completed.reduce((sum, sale) => sum + sale.total, 0)),
        tone: 'red',
      }),
      statTile({ label: t('history.voidedCount'), value: String(sales.length - completed.length) }),
    ]);
  }

  /**
   * @param {import('../../models/Sale.js').Sale[]} sales
   * @returns {HTMLElement}
   */
  buildList(sales) {
    if (sales.length === 0) {
      return emptyState(t('history.empty'), 'receipt');
    }
    const headers = [
      '#',
      t('history.time'),
      t('history.items'),
      t('cashier.paymentType'),
      t('receipt.total'),
      '',
    ];
    const rows = sales.slice(0, this.visibleCount).map((sale) => this.buildRow(sale));
    return el('div', {}, [
      dataTable(headers, rows, t('history.title')),
      this.showMoreButton(sales.length, PAGE_SIZE),
    ]);
  }

  /**
   * @param {import('../../models/Sale.js').Sale} sale
   * @returns {HTMLTableRowElement}
   */
  buildRow(sale) {
    const itemsText = sale.items.map((item) => `${item.quantity}× ${item.productName}`).join(', ');
    return el('tr', { className: sale.status === 'voided' ? 'row--muted' : '' }, [
      el('td', { text: `#${sale.receiptNumber}` }),
      el('td', { className: 'text-small', text: formatDateTime(sale.createdAt, getLocale()) }),
      el('td', { className: 'history__items', text: itemsText }),
      el('td', {}, [
        el('span', { className: 'badge', text: t(`payment.${sale.paymentType}`) }),
        sale.customerName ? ` ${sale.customerName}` : '',
      ]),
      el('td', { className: 'text-money text-right', text: formatPeso(sale.total) }),
      el('td', {}, [
        button({ label: t('history.view'), size: 'small', onClick: () => this.openSale(sale.id) }),
      ]),
    ]);
  }

  /**
   * Receipt modal with reprint and void.
   * @param {string} saleId
   */
  openSale(saleId) {
    const sale = this.services.salesService.getSale(saleId);
    const receipt = renderReceipt(sale, this.services.settingsService.get());
    const canVoid =
      sale.status === 'completed' && this.services.dayService.getOpenDay()?.id === sale.dayKey;
    const content = el('div', {}, [
      receipt,
      sale.status === 'voided'
        ? el('p', {
            className: 'text-center text-muted',
            text: t('history.voidReason', { reason: sale.voidReason }),
          })
        : null,
      el('div', { className: 'form-actions' }, [
        button({
          label: t('common.print'),
          iconName: 'print',
          onClick: () => printElement(receipt),
        }),
        canVoid
          ? button({
              label: t('history.void'),
              variant: 'primary',
              iconName: 'undo',
              onClick: () => this.voidSale(sale, modal),
            })
          : null,
      ]),
      sale.status === 'completed' && !canVoid
        ? el('p', { className: 'text-small text-muted', text: t('history.cannotVoid') })
        : null,
    ]);
    const modal = openModal({
      title: t('history.receiptTitle', { receipt: sale.receiptNumber }),
      content,
    });
  }

  /**
   * Asks for the PIN and a reason, then voids.
   * @param {import('../../models/Sale.js').Sale} sale
   * @param {{close: function(): void}} parentModal
   */
  async voidSale(sale, parentModal) {
    if (!(await requirePin(this.services.authService, t('history.pinForVoid')))) {
      return;
    }
    parentModal.close();
    const form = el('form', { attrs: { novalidate: true } }, [
      el('p', {
        text: t('history.voidHelp', { receipt: sale.receiptNumber, total: formatPeso(sale.total) }),
      }),
      formErrorBanner(),
      field({
        name: 'reason',
        label: t('history.reason'),
        attrs: { placeholder: t('history.reasonPlaceholder') },
      }),
      el('div', { className: 'form-actions' }, [
        button({ label: t('history.void'), variant: 'primary', type: 'submit' }),
      ]),
    ]);
    const modal = openModal({ title: t('history.voidTitle'), content: form });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearFormErrors(form);
      const result = await this.runAction(
        () => this.services.salesService.voidSale(sale.id, readForm(form).reason),
        { form, successMessage: t('history.voidedToast') },
      );
      if (result) {
        modal.close();
      }
    });
  }
}
