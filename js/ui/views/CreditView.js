/**
 * @file Listahan: suki list and each suki's utang notebook page.
 * Depends on: ui/views/BaseView.js, ui/components/*, models/*, utils/*.
 */
import { CREDIT_ENTRY_TYPES } from '../../models/CreditEntry.js';
import { getDisplayName } from '../../models/Customer.js';
import { debounce } from '../../utils/debounce.js';
import { el } from '../../utils/dom.js';
import { t } from '../../utils/i18n.js';
import { centavosToInputValue, formatPeso } from '../../utils/money.js';
import { confirmAction } from '../components/dialogs.js';
import { emptyState } from '../components/EmptyState.js';
import { buildForm, field, moneyField } from '../components/FormField.js';
import { openModal } from '../components/Modal.js';
import { button, panel, panelHeading } from '../components/viewHelpers.js';
import { BaseView } from './BaseView.js';

export class CreditView extends BaseView {
  constructor(context) {
    super(context);
    this.search = '';
    this.selectedId = '';
    this.refreshList = debounce(() => this.renderCustomerList(), 150);
  }

  /** @returns {Node[]} */
  build() {
    const customers = this.services.creditService.listCustomers();
    if (!customers.some((customer) => customer.id === this.selectedId)) {
      this.selectedId = customers[0]?.id ?? '';
    }
    this.listHolder = el('ul', {
      className: 'suki-list',
      attrs: { 'aria-label': t('credit.sukiList') },
    });
    this.renderCustomerList();
    return [
      this.pageHeader(
        t('credit.title'),
        t('credit.subtitle', {
          total: formatPeso(this.services.creditService.getTotalOutstanding()),
        }),
        [
          button({
            label: t('credit.addSuki'),
            variant: 'primary',
            iconName: 'plus',
            onClick: () => this.openCustomerForm(),
          }),
        ],
      ),
      el('div', { className: 'listahan' }, [
        el('div', { className: 'layout-stack' }, [
          el('section', { className: 'panel panel--cardboard' }, [
            this.buildSearch(),
            this.listHolder,
          ]),
          this.buildTopDebtors(),
        ]),
        this.buildNotebook(),
      ]),
    ];
  }

  /** @returns {HTMLElement} */
  buildSearch() {
    const wrapper = field({
      name: 'search',
      label: t('credit.findSuki'),
      type: 'search',
      value: this.search,
    });
    wrapper.querySelector('input').addEventListener('input', (event) => {
      this.search = event.target.value;
      this.refreshList();
    });
    return wrapper;
  }

  /** Re-draws only the suki list (keeps focus in the search box). */
  renderCustomerList() {
    const customers = this.services.creditService.listCustomers({ search: this.search });
    const overdueIds = new Set(
      this.services.creditService.getOverdueCustomers().map((row) => row.customer.id),
    );
    if (customers.length === 0) {
      this.listHolder.replaceChildren(el('li', {}, [emptyState(t('credit.noSuki'), 'notebook')]));
      return;
    }
    this.listHolder.replaceChildren(
      ...customers.map((customer) =>
        el('li', {}, [
          el(
            'button',
            {
              className: 'suki-list__item',
              attrs: { type: 'button', 'aria-current': String(customer.id === this.selectedId) },
              on: {
                click: () => {
                  this.selectedId = customer.id;
                  this.render();
                },
              },
            },
            [
              el('span', { className: 'suki-list__name', text: getDisplayName(customer) }),
              overdueIds.has(customer.id)
                ? el('span', { className: 'stamp', text: t('credit.overdue') })
                : null,
              el('span', {
                className: 'suki-list__balance text-money',
                text: formatPeso(customer.balance),
              }),
            ],
          ),
        ]),
      ),
    );
  }

  /** @returns {HTMLElement} "Pinaka-malaking utang" ranking. */
  buildTopDebtors() {
    const top = this.services.creditService.getTopDebtors(5);
    const rows = top.map((customer, index) =>
      el('li', { className: 'alert-list__item alert-list__item--danger' }, [
        el('span', { text: `${index + 1}. ${getDisplayName(customer)}` }),
        el('span', { className: 'text-money', text: formatPeso(customer.balance) }),
      ]),
    );
    return panel({
      title: t('credit.topDebtors'),
      iconName: 'chart',
      children: [
        rows.length
          ? el('ol', { className: 'alert-list' }, rows)
          : emptyState(t('credit.noDebt'), 'heart'),
      ],
    });
  }

  /** @returns {HTMLElement} The selected suki's notebook page. */
  buildNotebook() {
    if (!this.selectedId) {
      return el('section', { className: 'notebook' }, [
        el('p', { className: 'notebook__title', text: t('credit.noSuki') }),
      ]);
    }
    const customer = this.services.creditService.getCustomer(this.selectedId);
    const ledger = this.services.creditService.getLedger(customer.id);
    const balance = ledger.at(-1)?.runningBalance ?? 0;
    const title = t('credit.notebookOf', { name: getDisplayName(customer) });
    return el('section', { className: 'notebook-wrap', attrs: { 'aria-label': title } }, [
      this.buildNotebookPage(customer, ledger, balance),
      this.buildPaymentForm(customer, balance),
      el('div', { className: 'btn-row notebook-wrap__actions' }, [
        button({
          label: t('common.edit'),
          iconName: 'edit',
          size: 'small',
          onClick: () => this.openCustomerForm(customer),
        }),
        button({
          label: t('common.delete'),
          iconName: 'trash',
          size: 'small',
          variant: 'ghost',
          onClick: () => this.removeCustomer(customer),
        }),
      ]),
    ]);
  }

  /**
   * The lined notebook page itself.
   * @param {Object} customer
   * @param {Array<Object>} ledger
   * @param {number} balance
   * @returns {HTMLElement}
   */
  buildNotebookPage(customer, ledger, balance) {
    const meta = [
      customer.name,
      customer.contact,
      t('credit.limitLine', { limit: formatPeso(customer.creditLimit) }),
    ];
    const lines = ledger.length
      ? ledger.map((entry) => this.buildNotebookLine(entry))
      : [el('p', { text: t('credit.blankPage') })];
    return el('div', { className: 'notebook' }, [
      el('p', {
        className: 'notebook__title',
        text: t('credit.notebookOf', { name: getDisplayName(customer) }),
      }),
      el('p', { className: 'notebook__meta', text: meta.filter(Boolean).join(' · ') }),
      customer.notes ? el('p', { className: 'notebook__meta', text: customer.notes }) : null,
      ...lines,
      el('p', { className: 'notebook__total' }, [
        el('span', { text: t('credit.balance') }),
        el('span', { className: 'text-money', text: formatPeso(balance) }),
      ]),
    ]);
  }

  /**
   * @param {Object} entry - Ledger line with runningBalance and isSettled.
   * @returns {HTMLElement}
   */
  buildNotebookLine(entry) {
    const isCharge = entry.type === CREDIT_ENTRY_TYPES.CHARGE;
    const description = {
      [CREDIT_ENTRY_TYPES.CHARGE]: entry.description,
      [CREDIT_ENTRY_TYPES.PAYMENT]: t('credit.paid', {
        method: t(`payment.${entry.paymentMethod}`),
      }),
      [CREDIT_ENTRY_TYPES.REVERSAL]: t('credit.reversed', { note: entry.description }),
    }[entry.type];
    return el(
      'div',
      { className: `notebook__line${entry.isSettled ? ' notebook__line--settled' : ''}` },
      [
        el('span', { className: 'notebook__date', text: entry.dayKey.slice(5).replace('-', '/') }),
        el('span', { className: 'notebook__text', text: description }),
        el('span', {
          className: `notebook__amount${isCharge ? '' : ' notebook__amount--payment'}`,
          text: `${isCharge ? '+' : '−'}${formatPeso(entry.amount)}`,
        }),
        el('span', {
          className: 'notebook__balance text-money',
          text: formatPeso(entry.runningBalance),
        }),
      ],
    );
  }

  /**
   * @param {Object} customer
   * @param {number} balance
   * @returns {HTMLElement|null}
   */
  buildPaymentForm(customer, balance) {
    if (balance <= 0) {
      return null;
    }
    const methodOptions = [
      { value: 'cash', label: t('payment.cash') },
      { value: 'gcash', label: 'GCash' },
    ];
    const fields = el('div', { className: 'form-grid' }, [
      moneyField({
        name: 'amount',
        label: t('credit.amount'),
        value: centavosToInputValue(balance),
      }),
      field({
        name: 'paymentMethod',
        label: t('credit.method'),
        type: 'select',
        options: methodOptions,
      }),
    ]);
    return buildForm({
      className: 'panel panel--flat payment-form',
      children: [panelHeading('coins', t('credit.recordPayment')), fields],
      submitButton: button({
        label: t('credit.savePayment'),
        variant: 'green',
        type: 'submit',
        iconName: 'check',
      }),
      onSubmit: (values, form) =>
        this.runAction(() => this.services.creditService.recordPayment(customer.id, values), {
          form,
          successMessage: t('credit.paymentSaved'),
        }),
    });
  }

  /**
   * @param {Object} [customer] - Omit to add a new suki.
   */
  openCustomerForm(customer = null) {
    const values = customer
      ? { ...customer, creditLimit: centavosToInputValue(customer.creditLimit) }
      : { name: '', nickname: '', contact: '', notes: '', creditLimit: '500.00' };
    const { creditService } = this.services;
    const form = buildForm({
      children: [this.buildCustomerFields(values)],
      submitButton: button({ label: t('common.save'), variant: 'primary', type: 'submit' }),
      onSubmit: async (input) => {
        const save = () =>
          customer
            ? creditService.updateCustomer(customer.id, input)
            : creditService.addCustomer(input);
        const saved = await this.runAction(save, { form, successMessage: t('credit.saved') });
        if (saved) {
          this.selectedId = saved.id;
          modal.close();
          this.render();
        }
      },
    });
    const modal = openModal({
      title: customer ? t('credit.editSuki') : t('credit.addSuki'),
      content: form,
    });
  }

  /**
   * @param {Object} values - Current values for the inputs.
   * @returns {HTMLElement}
   */
  buildCustomerFields(values) {
    return el('div', { className: 'form-grid' }, [
      field({ name: 'name', label: t('credit.name'), value: values.name }),
      field({
        name: 'nickname',
        label: t('credit.nickname'),
        value: values.nickname,
        hint: t('credit.nicknameHint'),
      }),
      field({
        name: 'contact',
        label: t('credit.contact'),
        value: values.contact,
        attrs: { inputmode: 'tel', placeholder: '09XXXXXXXXX' },
      }),
      moneyField({
        name: 'creditLimit',
        label: t('credit.limit'),
        value: values.creditLimit,
        hint: t('credit.limitHint'),
      }),
      field({
        name: 'notes',
        label: t('common.note'),
        type: 'textarea',
        value: values.notes,
        className: 'form-grid--full',
      }),
    ]);
  }

  /**
   * @param {Object} customer
   */
  async removeCustomer(customer) {
    const confirmed = await confirmAction({
      title: t('common.delete'),
      message: t('credit.deleteConfirm', { name: customer.name }),
      confirmLabel: t('common.delete'),
      isDanger: true,
    });
    if (confirmed) {
      const outcome = await this.runAction(() =>
        this.services.creditService.removeCustomer(customer.id),
      );
      if (outcome) {
        this.toast.show(
          t(outcome === 'archived' ? 'credit.archivedToast' : 'credit.deletedToast'),
          'success',
        );
      }
    }
  }
}
