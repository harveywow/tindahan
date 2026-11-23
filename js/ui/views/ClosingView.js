/**
 * @file Sara: count the drawer, compare with expected cash, close the day,
 * and look back at past closings.
 * Depends on: ui/views/BaseView.js, ui/components/*, utils/*.
 */
import { DENOMINATIONS } from '../../config.js';
import { el, setChildren } from '../../utils/dom.js';
import { formatDateKey } from '../../utils/dates.js';
import { getLocale, t } from '../../utils/i18n.js';
import { formatPeso, sumCashCount } from '../../utils/money.js';
import { confirmAction } from '../components/dialogs.js';
import { emptyState } from '../components/EmptyState.js';
import { clearFormErrors, field, formErrorBanner } from '../components/FormField.js';
import { openModal } from '../components/Modal.js';
import { moneyPiece } from '../components/MoneyChips.js';
import { printElement } from '../components/print.js';
import { button, dataTable, panel } from '../components/viewHelpers.js';
import { BaseView } from './BaseView.js';

const HISTORY_LIMIT = 14;

/**
 * @param {number} difference - counted − expected, in centavos.
 * @returns {{key: string, modifier: string}} Stamp text key and color.
 */
function describeDifference(difference) {
  if (difference === 0) {
    return { key: 'closing.exact', modifier: 'stamp--ok' };
  }
  return difference > 0
    ? { key: 'closing.over', modifier: 'stamp--warn' }
    : { key: 'closing.short', modifier: '' };
}

/** Used for days closed before a summary existed (defensive default). */
const EMPTY_SUMMARY = Object.freeze({
  totalSales: 0,
  profit: 0,
  transactionCount: 0,
  byPayment: {},
  expenses: { total: 0 },
  utangCollected: 0,
  topItems: [],
});

/**
 * One "label ....... value" receipt line.
 * @param {string} label
 * @param {string} value
 * @returns {HTMLElement}
 */
function summaryLine(label, value) {
  return el('div', { className: 'receipt__line' }, [
    el('span', { text: label }),
    el('span', { className: 'text-money', text: value }),
  ]);
}

export class ClosingView extends BaseView {
  /** @returns {Node[]} */
  build() {
    const openDay = this.services.dayService.getOpenDay();
    return [
      this.pageHeader(
        t('closing.title'),
        openDay
          ? t('closing.subtitleOpen', { date: formatDateKey(openDay.id, getLocale()) })
          : t('closing.subtitleClosed'),
      ),
      openDay ? this.buildCountForm(openDay) : this.buildLatestSummary(),
      this.buildHistory(),
    ];
  }

  /**
   * @param {import('../../models/DayRecord.js').DayRecord} openDay
   * @returns {HTMLElement}
   */
  buildCountForm(openDay) {
    const expected = this.services.closingService.computeExpectedCash(openDay);
    const resultHolder = el('div', {
      className: 'closing__result',
      attrs: { 'aria-live': 'polite' },
    });
    const rows = DENOMINATIONS.map((denomination) => this.buildCountRow(denomination));
    const form = el('form', { className: 'cash-count', attrs: { novalidate: true } }, [
      formErrorBanner(),
      el('div', { className: 'cash-count__rows' }, rows),
      field({
        name: 'note',
        label: t('closing.note'),
        type: 'textarea',
        hint: t('closing.noteHint'),
      }),
    ]);
    const update = () =>
      this.renderResult(resultHolder, this.readCounts(form), expected.expectedCash);
    form.addEventListener('input', update);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.closeDay(form);
    });
    update();
    const help = el('p', { className: 'text-small text-muted', text: t('closing.countHelp') });
    const countPanel = panel({
      title: t('closing.countTitle'),
      iconName: 'coins',
      children: [help, form],
    });
    return el('div', { className: 'layout-split' }, [
      countPanel,
      this.buildSidePanel(expected, resultHolder, form),
    ]);
  }

  /**
   * Expected cash, the live result stamp and the close button.
   * @param {Object} expected
   * @param {HTMLElement} resultHolder
   * @param {HTMLFormElement} form
   * @returns {HTMLElement}
   */
  buildSidePanel(expected, resultHolder, form) {
    const closeButton = button({
      label: t('closing.closeButton'),
      variant: 'primary',
      size: 'huge',
      iconName: 'moon',
      onClick: () => form.requestSubmit(),
    });
    return el('div', { className: 'layout-stack closing__side' }, [
      this.buildExpectedPanel(expected),
      resultHolder,
      closeButton,
    ]);
  }

  /**
   * @param {{value:number, label:string}} denomination
   * @returns {HTMLElement}
   */
  buildCountRow(denomination) {
    const inputId = `count-${denomination.value}`;
    return el('div', { className: 'cash-count__row' }, [
      el('label', { className: 'cash-count__label', attrs: { for: inputId } }, [
        moneyPiece(denomination),
        el('span', { className: 'visually-hidden', text: denomination.label }),
      ]),
      el('span', { className: 'cash-count__times', text: '×', attrs: { 'aria-hidden': 'true' } }),
      el('input', {
        className: 'cash-count__input',
        attrs: {
          id: inputId,
          name: inputId,
          type: 'text',
          inputmode: 'numeric',
          placeholder: '0',
          autocomplete: 'off',
        },
      }),
      el('span', { className: 'field__error cash-count__error', dataset: { errorFor: inputId } }),
    ]);
  }

  /**
   * @param {HTMLFormElement} form
   * @returns {Object<string, string>} Denomination value → typed count.
   */
  readCounts(form) {
    return Object.fromEntries(
      DENOMINATIONS.map((denomination) => [
        denomination.value,
        form.elements[`count-${denomination.value}`].value.trim(),
      ]),
    );
  }

  /**
   * Live total and Sobra/Kulang/Tama stamp while counting.
   * @param {HTMLElement} holder
   * @param {Object<string, string>} counts
   * @param {number} expectedCash
   */
  renderResult(holder, counts, expectedCash) {
    const isValid = Object.values(counts).every((count) => count === '' || /^\d+$/.test(count));
    if (!isValid) {
      holder.replaceChildren(el('p', { className: 'field__error', text: t('errors.wholeNumber') }));
      return;
    }
    const counted = sumCashCount(counts);
    const difference = counted - expectedCash;
    const { key, modifier } = describeDifference(difference);
    setChildren(
      holder,
      el('p', { className: 'closing__counted' }, [
        t('closing.counted'),
        ' ',
        el('strong', { className: 'text-money', text: formatPeso(counted) }),
      ]),
      el('p', {}, [el('span', { className: `stamp stamp--big ${modifier}`, text: t(key) })]),
      difference !== 0
        ? el('p', {
            className: 'text-money',
            text: t('closing.difference', { amount: formatPeso(Math.abs(difference)) }),
          })
        : null,
    );
  }

  /**
   * @param {Object} expected - From ClosingService.computeExpectedCash.
   * @returns {HTMLElement}
   */
  buildExpectedPanel(expected) {
    const total = summaryLine(t('closing.expected'), formatPeso(expected.expectedCash));
    total.classList.add('receipt__line--total');
    return panel({
      title: t('closing.expectedTitle'),
      iconName: 'wallet',
      modifier: 'cardboard',
      children: [
        summaryLine(t('closing.openingCash'), formatPeso(expected.openingCash)),
        summaryLine(t('closing.cashSales'), `+ ${formatPeso(expected.cashSales)}`),
        summaryLine(t('closing.utangCash'), `+ ${formatPeso(expected.utangCollectedCash)}`),
        summaryLine(t('closing.cashOut'), `− ${formatPeso(expected.cashOut)}`),
        el('hr', { className: 'receipt__rule' }),
        total,
      ],
    });
  }

  /**
   * @param {HTMLFormElement} form
   */
  async closeDay(form) {
    clearFormErrors(form);
    const confirmed = await confirmAction({
      title: t('closing.confirmTitle'),
      message: t('closing.confirmText'),
      confirmLabel: t('closing.closeButton'),
    });
    if (!confirmed) {
      return;
    }
    const closed = await this.runAction(
      () =>
        this.services.closingService.closeDay({
          cashCount: this.readCounts(form),
          note: form.elements.note.value,
        }),
      { form, successMessage: t('closing.closedToast') },
    );
    if (closed) {
      this.openSummary(closed);
    }
  }

  /** @returns {HTMLElement} Most recent closing, shown when no day is open. */
  buildLatestSummary() {
    const [latest] = this.services.dayService.listClosedDays();
    if (!latest) {
      return panel({
        title: t('closing.noneYet'),
        iconName: 'moon',
        children: [
          emptyState(
            t('closing.noneYetText'),
            'coins',
            button({ label: t('nav.bukas'), onClick: () => this.navigate('bukas') }),
          ),
        ],
      });
    }
    return el('div', { className: 'closing__latest' }, [
      this.buildSummaryCard(latest),
      button({
        label: t('common.print'),
        iconName: 'print',
        onClick: (event) =>
          printElement(event.target.closest('.closing__latest').querySelector('.day-summary')),
      }),
    ]);
  }

  /**
   * @param {import('../../models/DayRecord.js').DayRecord} day
   * @returns {HTMLElement}
   */
  buildSummaryCard(day) {
    const summary = day.summary ?? EMPTY_SUMMARY;
    const { key, modifier } = describeDifference(day.difference);
    const topItems = summary.topItems.map((item) => `${item.name} (${item.quantity})`).join(', ');
    return el('article', { className: 'receipt day-summary' }, [
      el('header', { className: 'receipt__header' }, [
        el('p', { className: 'receipt__store', text: t('closing.summaryTitle') }),
        el('p', { className: 'receipt__meta', text: formatDateKey(day.id, getLocale()) }),
      ]),
      ...this.buildSummaryLines(summary),
      el('hr', { className: 'receipt__rule' }),
      summaryLine(t('closing.expected'), formatPeso(day.expectedCash)),
      summaryLine(t('closing.counted'), formatPeso(day.countedCash)),
      el('p', { className: 'receipt__void' }, [
        el('span', { className: `stamp stamp--big ${modifier}`, text: t(key) }),
      ]),
      day.closingNote
        ? el('p', { className: 'receipt__footer', text: `“${day.closingNote}”` })
        : null,
      topItems
        ? el('p', {
            className: 'receipt__footer',
            text: t('closing.topItems', { items: topItems }),
          })
        : null,
      day.reopenCount > 0
        ? el('p', {
            className: 'receipt__footer',
            text: t('closing.reopenedNote', { count: day.reopenCount }),
          })
        : null,
    ]);
  }

  /**
   * @param {Object} summary - DayRecord.summary
   * @returns {HTMLElement[]}
   */
  buildSummaryLines(summary) {
    return [
      summaryLine(t('closing.totalSales'), formatPeso(summary.totalSales)),
      summaryLine(t('dashboard.profitToday'), formatPeso(summary.profit)),
      summaryLine(t('dashboard.transactions'), String(summary.transactionCount)),
      summaryLine(t('payment.cash'), formatPeso(summary.byPayment.cash ?? 0)),
      summaryLine('GCash', formatPeso(summary.byPayment.gcash ?? 0)),
      summaryLine(t('payment.credit'), formatPeso(summary.byPayment.credit ?? 0)),
      summaryLine(t('dashboard.utangCollected'), formatPeso(summary.utangCollected)),
      summaryLine(t('expenses.total'), formatPeso(summary.expenses.total)),
    ];
  }

  /**
   * @param {import('../../models/DayRecord.js').DayRecord} day
   */
  openSummary(day) {
    const card = this.buildSummaryCard(day);
    openModal({
      title: t('closing.summaryTitle'),
      content: el('div', {}, [
        card,
        el('div', { className: 'form-actions' }, [
          button({
            label: t('common.print'),
            iconName: 'print',
            onClick: () => printElement(card),
          }),
        ]),
      ]),
    });
  }

  /** @returns {HTMLElement} Recent closed days. */
  buildHistory() {
    const days = this.services.dayService.listClosedDays().slice(0, HISTORY_LIMIT);
    if (days.length === 0) {
      return el('div');
    }
    const rows = days.map((day) => {
      const { key, modifier } = describeDifference(day.difference);
      return el('tr', {}, [
        el('td', { text: formatDateKey(day.id, getLocale()) }),
        el('td', { className: 'text-money', text: formatPeso(day.summary?.totalSales ?? 0) }),
        el('td', { className: 'text-money', text: formatPeso(day.difference) }),
        el('td', {}, [el('span', { className: `stamp ${modifier}`, text: t(key) })]),
        el('td', {}, [
          button({ label: t('history.view'), size: 'small', onClick: () => this.openSummary(day) }),
        ]),
      ]);
    });
    const headers = [
      t('closing.date'),
      t('closing.totalSales'),
      t('closing.differenceLabel'),
      '',
      '',
    ];
    return el('section', { className: 'panel closing__history' }, [
      el('h3', { className: 'panel__title', text: t('closing.historyTitle') }),
      dataTable(headers, rows, t('closing.historyTitle')),
    ]);
  }
}
