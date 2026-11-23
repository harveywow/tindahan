/**
 * @file Pamilihan: shopping list for restocking, written like a notebook checklist.
 * Depends on: ui/views/BaseView.js, ui/components/*, utils/*.
 */
import { el } from '../../utils/dom.js';
import { t } from '../../utils/i18n.js';
import { centavosToInputValue } from '../../utils/money.js';
import { emptyState } from '../components/EmptyState.js';
import { buildForm, field, integerField, moneyField } from '../components/FormField.js';
import { openModal } from '../components/Modal.js';
import { printElement } from '../components/print.js';
import { button, panel } from '../components/viewHelpers.js';
import { BaseView } from './BaseView.js';

export class RestockView extends BaseView {
  /** @returns {Node[]} */
  build() {
    const items = this.services.restockService.listItems();
    const listPage = this.buildList(items);
    return [
      this.pageHeader(t('restock.title'), t('restock.subtitle'), [
        button({
          label: t('restock.generate'),
          variant: 'yellow',
          iconName: 'box',
          onClick: () => this.generate(),
        }),
        button({
          label: t('common.print'),
          iconName: 'print',
          onClick: () => printElement(listPage),
        }),
      ]),
      el('div', { className: 'layout-split' }, [
        listPage,
        el('div', { className: 'layout-stack' }, [this.buildAddForm(), this.buildHelp(items)]),
      ]),
    ];
  }

  /** Adds low-stock products to the list. */
  generate() {
    this.runAction(() => {
      const added = this.services.restockService.generateSuggestions();
      this.toast.show(
        added ? t('restock.generated', { count: added }) : t('restock.nothingToAdd'),
        added ? 'success' : 'info',
      );
    });
  }

  /**
   * @param {import('../../models/RestockItem.js').RestockItem[]} items
   * @returns {HTMLElement}
   */
  buildList(items) {
    const lines = items.map((item) => this.buildLine(item));
    const hasReceived = items.some((item) => item.isReceived);
    const clearButton = hasReceived
      ? button({
          label: t('restock.clearReceived'),
          size: 'small',
          variant: 'ghost',
          onClick: () => this.runAction(() => this.services.restockService.clearReceived()),
        })
      : null;
    return el(
      'section',
      { className: 'notebook checklist', attrs: { 'aria-label': t('restock.title') } },
      [
        el('p', { className: 'notebook__title', text: t('restock.listTitle') }),
        ...(lines.length ? lines : [emptyState(t('restock.empty'), 'bag')]),
        clearButton,
      ],
    );
  }

  /**
   * One handwritten line: tick box, quantity, name and actions.
   * @param {import('../../models/RestockItem.js').RestockItem} item
   * @returns {HTMLElement}
   */
  buildLine(item) {
    const { restockService } = this.services;
    const checkbox = el('input', {
      attrs: {
        type: 'checkbox',
        checked: item.isChecked,
        disabled: item.isReceived,
        'aria-label': t('restock.tick', { name: item.name }),
      },
      on: { change: () => this.runAction(() => restockService.toggleChecked(item.id)) },
    });
    const status = item.isReceived
      ? el('span', { className: 'stamp stamp--ok', text: t('restock.received') })
      : el('span', { className: 'checklist__actions' }, [
          button({
            label: t('restock.receive'),
            size: 'small',
            variant: 'green',
            onClick: () => this.openReceiveForm(item),
          }),
          button({
            label: t('common.delete'),
            size: 'icon',
            iconName: 'trash',
            onClick: () => this.runAction(() => restockService.removeItem(item.id)),
          }),
        ]);
    return el(
      'div',
      { className: `checklist__line${item.isChecked ? ' checklist__line--checked' : ''}` },
      [
        checkbox,
        el('span', { className: 'checklist__qty', text: `${item.quantity}×` }),
        el('span', { className: 'checklist__name', text: item.name }),
        item.isSuggested ? el('span', { className: 'badge', text: t('restock.suggested') }) : null,
        status,
      ],
    );
  }

  /** @returns {HTMLElement} */
  buildAddForm() {
    const products = this.services.inventoryService.listProducts();
    const productOptions = [
      { value: '', label: t('restock.notInInventory') },
      ...products.map((product) => ({ value: product.id, label: product.name })),
    ];
    const form = buildForm({
      children: [
        field({
          name: 'productId',
          label: t('restock.product'),
          type: 'select',
          options: productOptions,
        }),
        field({ name: 'name', label: t('restock.otherName'), hint: t('restock.otherHint') }),
        integerField({ name: 'quantity', label: t('restock.quantityPacks'), value: '1' }),
      ],
      submitButton: button({ label: t('common.add'), type: 'submit', iconName: 'plus' }),
      onSubmit: (values) =>
        this.runAction(() => this.services.restockService.addManualItem(values), {
          form,
          successMessage: t('restock.added'),
        }),
    });
    return panel({ title: t('restock.addItem'), iconName: 'plus', children: [form] });
  }

  /**
   * @param {Array} items
   * @returns {HTMLElement}
   */
  buildHelp(items) {
    const pending = items.filter((item) => !item.isReceived).length;
    return panel({
      title: t('restock.howTitle'),
      iconName: 'info',
      modifier: 'cardboard',
      children: [
        el('p', { text: t('restock.howText') }),
        el('p', { className: 'text-small', text: t('restock.pendingCount', { count: pending }) }),
      ],
    });
  }

  /**
   * Enter what actually arrived and what it cost.
   * @param {import('../../models/RestockItem.js').RestockItem} item
   */
  openReceiveForm(item) {
    const product = item.productId
      ? this.services.inventoryService.findProduct(item.productId)
      : null;
    const help = product
      ? t('restock.receiveHelp', { name: item.name })
      : t('restock.receiveManual', { name: item.name });
    const costField = product
      ? moneyField({
          name: 'costPerPack',
          label: t('restock.newCost'),
          value: centavosToInputValue(product.costPerPack),
        })
      : null;
    const form = buildForm({
      children: [
        el('p', { text: help }),
        el('div', { className: 'form-grid' }, [
          integerField({
            name: 'quantity',
            label: t('restock.actualQuantity'),
            value: String(item.quantity),
          }),
          costField,
        ]),
      ],
      submitButton: button({ label: t('restock.receive'), variant: 'green', type: 'submit' }),
      onSubmit: async (values) => {
        const receive = () => {
          this.services.restockService.receiveItem(item.id, values);
          return true;
        };
        if (await this.runAction(receive, { form, successMessage: t('restock.receivedToast') })) {
          modal.close();
        }
      },
    });
    const modal = openModal({ title: t('restock.receiveTitle'), content: form });
  }
}
