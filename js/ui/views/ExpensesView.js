/**
 * @file Gastos: record cash taken out of the drawer.
 * Depends on: ui/views/BaseView.js, ui/components/*, utils/*.
 */
import { EXPENSE_TYPES } from '../../config.js';
import { el } from '../../utils/dom.js';
import { formatDateTime } from '../../utils/dates.js';
import { getLocale, t } from '../../utils/i18n.js';
import { formatPeso } from '../../utils/money.js';
import { confirmAction } from '../components/dialogs.js';
import { emptyState } from '../components/EmptyState.js';
import { buildForm, field, moneyField } from '../components/FormField.js';
import { icon } from '../components/icons.js';
import { button, dataTable, panel, statTile } from '../components/viewHelpers.js';
import { BaseView } from './BaseView.js';

export class ExpensesView extends BaseView {
  /** @returns {Node[]} */
  build() {
    const openDay = this.services.dayService.getOpenDay();
    const dayKey = openDay?.id ?? this.context.clock.today();
    const expenses = this.services.expenseService.listExpenses({
      startKey: dayKey,
      endKey: dayKey,
    });
    const totals = this.services.expenseService.getDayTotals(dayKey);
    return [
      this.pageHeader(t('expenses.title'), t('expenses.subtitle')),
      el('div', { className: 'stat-grid expenses__totals' }, [
        statTile({ label: t('expenses.type.expense'), value: formatPeso(totals.expense) }),
        statTile({ label: t('expenses.type.withdrawal'), value: formatPeso(totals.withdrawal) }),
        statTile({ label: t('expenses.type.restock'), value: formatPeso(totals.restock) }),
        statTile({ label: t('expenses.total'), value: formatPeso(totals.total), tone: 'red' }),
      ]),
      el('div', { className: 'layout-split expenses__layout' }, [
        this.buildList(expenses, Boolean(openDay)),
        openDay ? this.buildForm() : this.buildClosedNotice(),
      ]),
    ];
  }

  /** @returns {HTMLElement} */
  buildForm() {
    const typeOptions = EXPENSE_TYPES.map((type) => ({
      value: type,
      label: t(`expenses.type.${type}`),
    }));
    const form = buildForm({
      children: [
        field({ name: 'type', label: t('expenses.kind'), type: 'select', options: typeOptions }),
        field({
          name: 'description',
          label: t('expenses.description'),
          attrs: { placeholder: t('expenses.placeholder') },
        }),
        moneyField({ name: 'amount', label: t('credit.amount') }),
      ],
      submitButton: button({
        label: t('common.save'),
        variant: 'primary',
        type: 'submit',
        iconName: 'check',
      }),
      onSubmit: (values) =>
        this.runAction(() => this.services.expenseService.addExpense(values), {
          form,
          successMessage: t('expenses.saved'),
        }),
    });
    return panel({
      title: t('expenses.add'),
      iconName: 'wallet',
      children: [el('p', { className: 'text-small text-muted', text: t('expenses.help') }), form],
    });
  }

  /** @returns {HTMLElement} */
  buildClosedNotice() {
    return el('div', { className: 'callout' }, [
      icon('lock'),
      el('p', { text: t('expenses.closed') }),
    ]);
  }

  /**
   * @param {import('../../models/Expense.js').Expense[]} expenses
   * @param {boolean} canDelete
   * @returns {HTMLElement}
   */
  buildList(expenses, canDelete) {
    const title = t('expenses.today');
    if (expenses.length === 0) {
      return panel({
        title,
        iconName: 'receipt',
        children: [emptyState(t('expenses.empty'), 'wallet')],
      });
    }
    const headers = [
      t('history.time'),
      t('expenses.description'),
      t('expenses.kind'),
      t('credit.amount'),
      '',
    ];
    const rows = expenses.map((expense) => this.buildRow(expense, canDelete));
    return panel({ title, iconName: 'receipt', children: [dataTable(headers, rows, title)] });
  }

  /**
   * @param {import('../../models/Expense.js').Expense} expense
   * @param {boolean} canDelete - Only the open day's cash-outs can be removed.
   * @returns {HTMLTableRowElement}
   */
  buildRow(expense, canDelete) {
    const deleteButton = canDelete
      ? button({
          label: t('common.delete'),
          iconName: 'trash',
          size: 'icon',
          onClick: () => this.deleteExpense(expense),
        })
      : null;
    return el('tr', {}, [
      el('td', { className: 'text-small', text: formatDateTime(expense.createdAt, getLocale()) }),
      el('td', { text: expense.description }),
      el('td', {}, [el('span', { className: 'badge', text: t(`expenses.type.${expense.type}`) })]),
      el('td', { className: 'text-money text-right', text: formatPeso(expense.amount) }),
      el('td', {}, [deleteButton]),
    ]);
  }

  /**
   * @param {import('../../models/Expense.js').Expense} expense
   */
  async deleteExpense(expense) {
    const confirmed = await confirmAction({
      title: t('common.delete'),
      message: t('expenses.deleteConfirm', { description: expense.description }),
      isDanger: true,
      confirmLabel: t('common.delete'),
    });
    if (confirmed) {
      this.runAction(() => this.services.expenseService.deleteExpense(expense.id), {
        successMessage: t('expenses.deleted'),
      });
    }
  }
}
