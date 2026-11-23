/**
 * @file Tinda: the cashier screen — shelf behind the window grille, the
 * supot (basket), payment and sukli.
 * Depends on: ui/views/BaseView.js, services/Basket.js, ui/components/*, utils/*.
 */
import { PAYMENT_TYPES, QUICK_CASH_AMOUNTS, SALE_UNITS } from '../../config.js';
import { CreditLimitError } from '../../core/AppError.js';
import { getDisplayName } from '../../models/Customer.js';
import { isLowStock } from '../../models/Product.js';
import { debounce } from '../../utils/debounce.js';
import { el, setChildren } from '../../utils/dom.js';
import { t } from '../../utils/i18n.js';
import {
  calculateChangeBreakdown,
  centavosToInputValue,
  formatPeso,
  parsePesoToCentavos,
} from '../../utils/money.js';
import { normalizeName } from '../../utils/validators.js';
import { confirmAction, requirePin } from '../components/dialogs.js';
import { emptyState } from '../components/EmptyState.js';
import { formatPriceLine, formatStock } from '../components/format.js';
import { clearFormErrors, field, formErrorBanner } from '../components/FormField.js';
import { icon } from '../components/icons.js';
import { zoomableImage } from '../components/ImageViewer.js';
import { openModal } from '../components/Modal.js';
import { moneyChips } from '../components/MoneyChips.js';
import { printElement } from '../components/print.js';
import { renderReceipt } from '../components/ReceiptRenderer.js';
import { button, segmented } from '../components/viewHelpers.js';
import { BaseView } from './BaseView.js';

const TONE_COUNT = 8;

export class CashierView extends BaseView {
  constructor(context) {
    super(context);
    this.basket = context.basket;
    this.searchQuery = '';
    this.category = '';
    this.paymentType = PAYMENT_TYPES.CASH;
    this.isPaying = false;
    this.handleKeydown = this.handleKeydown.bind(this);
    this.filterShelf = debounce(() => this.renderShelf(), 150);
  }

  onMount() {
    document.addEventListener('keydown', this.handleKeydown);
  }

  onUnmount() {
    document.removeEventListener('keydown', this.handleKeydown);
  }

  /**
   * Shortcuts: "/" search, Esc clears the search (then the basket).
   * Enter pays because the payment fields are inside a form.
   * @param {KeyboardEvent} event
   */
  handleKeydown(event) {
    const isTyping = ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName);
    if (event.key === '/' && !isTyping && !document.querySelector('.modal')) {
      event.preventDefault();
      this.searchInput?.focus();
    } else if (event.key === 'Escape' && !document.querySelector('.modal')) {
      this.handleEscape();
    }
  }

  /** Esc: first clears the search, a second Esc offers to empty the basket. */
  async handleEscape() {
    if (this.searchQuery) {
      this.searchQuery = '';
      this.searchInput.value = '';
      this.renderShelf();
      return;
    }
    await this.confirmClearBasket();
  }

  /** Asks, then empties the supot (used by Esc and the "Empty the supot" button). */
  async confirmClearBasket() {
    if (this.basket.isEmpty()) {
      return;
    }
    if (await confirmAction({ title: t('cashier.clearTitle'), message: t('cashier.clearText') })) {
      this.basket.clear();
      this.renderBasket();
      this.renderShelf();
    }
  }

  /** @returns {Node[]} */
  build() {
    this.basket.refreshProducts((id) => this.services.inventoryService.findProduct(id));
    this.shelfGrid = el('div', {
      className: 'shelf',
      attrs: { role: 'list', 'aria-label': t('cashier.shelf') },
    });
    this.shelfGrid.addEventListener('click', (event) => this.handleShelfClick(event));
    this.basketHolder = el('aside', {
      className: 'supot',
      attrs: { 'aria-label': t('cashier.basket') },
    });
    this.renderShelf();
    this.renderBasket();
    return [
      this.pageHeader(t('cashier.title'), t('cashier.subtitle')),
      this.buildClosedNotice(),
      el('div', { className: 'layout-split' }, [
        el('div', { className: 'grille' }, [
          el('div', { className: 'grille__window' }, [this.buildShelfToolbar(), this.shelfGrid]),
        ]),
        this.basketHolder,
      ]),
    ];
  }

  /** @returns {HTMLElement|null} */
  buildClosedNotice() {
    if (this.services.dayService.isOpen()) {
      return null;
    }
    return el('div', { className: 'callout', attrs: { role: 'status' } }, [
      icon('lock'),
      el('div', {}, [
        el('p', { text: t('cashier.closedNotice') }),
        button({
          label: t('dashboard.openButton'),
          variant: 'green',
          size: 'small',
          onClick: () => this.navigate('bukas'),
        }),
      ]),
    ]);
  }

  /** @returns {HTMLElement} Search box and category chips. */
  buildShelfToolbar() {
    this.searchInput = el('input', {
      className: 'shelf-toolbar__search',
      attrs: {
        type: 'search',
        placeholder: t('cashier.searchPlaceholder'),
        'aria-label': t('common.search'),
        value: this.searchQuery,
      },
      on: {
        input: (event) => {
          this.searchQuery = event.target.value;
          this.filterShelf();
        },
      },
    });
    const categories = [{ value: '', label: t('common.all') }, ...this.listCategoryOptions()];
    return el('div', { className: 'shelf-toolbar' }, [
      el('label', { className: 'shelf-toolbar__search-wrap' }, [icon('search'), this.searchInput]),
      segmented({
        options: categories,
        selected: this.category,
        label: t('inventory.category'),
        onSelect: (value) => {
          this.category = value;
          this.render();
        },
      }),
    ]);
  }

  /** @returns {Array<{value:string, label:string}>} */
  listCategoryOptions() {
    return this.services.inventoryService
      .listCategories()
      .map((category) => ({ value: category, label: category }));
  }

  /** Re-draws only the product shelf (keeps search focus while typing). */
  renderShelf() {
    const query = normalizeName(this.searchQuery);
    const categories = this.services.inventoryService.listCategories();
    const products = this.services.inventoryService
      .listProducts({ category: this.category })
      .filter((product) => !query || normalizeName(product.name).includes(query));
    if (products.length === 0) {
      const message = query || this.category ? t('cashier.noMatch') : t('inventory.empty');
      this.shelfGrid.replaceChildren(emptyState(message, 'shelf'));
      return;
    }
    this.shelfGrid.replaceChildren(
      ...products.map((product) =>
        this.buildShelfItem(product, categories.indexOf(product.category)),
      ),
    );
  }

  /**
   * @param {import('../../models/Product.js').Product} product
   * @param {number} categoryIndex
   * @returns {HTMLElement}
   */
  buildShelfItem(product, categoryIndex) {
    const piecesLeft = product.stockPieces - this.basket.getPiecesInBasket(product.id);
    const isOut = piecesLeft <= 0;
    const tone = Math.max(0, categoryIndex) % TONE_COUNT;
    const stockText = product.isTingi
      ? formatStock(product, piecesLeft)
      : t('stock.left', { count: Math.max(0, piecesLeft), unit: product.unitLabel });
    return el(
      'div',
      { className: `shelf__item${isOut ? ' shelf__item--out' : ''}`, attrs: { role: 'listitem' } },
      [
        el('div', { className: `shelf__product shelf__product--tone-${tone}` }, [
          product.imageDataUrl
            ? zoomableImage({
                src: product.imageDataUrl,
                name: product.name,
                caption: formatPriceLine(product),
                className: 'shelf__image',
              })
            : null,
          el('span', { className: 'shelf__name', text: product.name }),
        ]),
        isOut ? el('span', { className: 'stamp shelf__stamp', text: t('stock.out') }) : null,
        !isOut && isLowStock({ ...product, stockPieces: piecesLeft })
          ? el('span', { className: 'stamp shelf__stamp', text: t('stock.low') })
          : null,
        el('div', { className: 'shelf__prices' }, this.buildPriceTags(product)),
        el('span', { className: 'shelf__stock', text: stockText }),
        el('div', { className: 'shelf__buttons' }, this.buildAddButtons(product, piecesLeft)),
      ],
    );
  }

  /**
   * @param {import('../../models/Product.js').Product} product
   * @returns {HTMLElement[]}
   */
  buildPriceTags(product) {
    const tags = [
      el('span', {
        className: 'price-tag',
        text: `${formatPeso(product.pricePerPack)}/${product.unitLabel}`,
      }),
    ];
    if (product.isTingi) {
      tags.push(
        el('span', {
          className: 'price-tag price-tag--piece',
          text: `${formatPeso(product.pricePerPiece)}/${t('units.pc')}`,
        }),
      );
    }
    return tags;
  }

  /**
   * A button is disabled when what is left can't fill one unit
   * (e.g. 7 loose pieces can still be sold, but not a 10-piece pack).
   * @param {import('../../models/Product.js').Product} product
   * @param {number} piecesLeft - Stock minus what is already in the basket.
   * @returns {HTMLElement[]}
   */
  buildAddButtons(product, piecesLeft) {
    const makeButton = (unit, label) =>
      el(
        'button',
        {
          className: 'btn btn--small shelf__add',
          attrs: {
            type: 'button',
            disabled: piecesLeft < (unit === SALE_UNITS.PACK ? product.piecesPerPack : 1),
            'aria-label': t('cashier.addAria', { unit: label, name: product.name }),
          },
          dataset: { productId: product.id, unit },
        },
        [icon('plus'), label],
      );
    const buttons = [makeButton(SALE_UNITS.PACK, product.unitLabel)];
    if (product.isTingi) {
      buttons.push(makeButton(SALE_UNITS.PIECE, t('units.piece')));
    }
    return buttons;
  }

  /**
   * Event delegation: one listener for every "+" button on the shelf.
   * @param {MouseEvent} event
   */
  handleShelfClick(event) {
    const addButton = event.target.closest('[data-product-id]');
    if (!addButton) {
      return;
    }
    const product = this.services.inventoryService.getProduct(addButton.dataset.productId);
    this.runAction(() => {
      this.basket.add(product, addButton.dataset.unit);
      this.renderShelf();
      this.renderBasket();
    });
  }

  /* ------------------------------- Basket ------------------------------- */

  /** Re-draws only the basket panel. */
  renderBasket() {
    const lines = this.basket.getLines();
    setChildren(
      this.basketHolder,
      el('div', { className: 'supot__top' }, [
        el('h3', { className: 'supot__title' }, [icon('bag'), ` ${t('cashier.basket')}`]),
        el('span', {
          className: 'badge',
          text: t('cashier.itemCount', { count: this.basket.getItemCount() }),
        }),
      ]),
      lines.length
        ? el(
            'ul',
            { className: 'supot__lines' },
            lines.map((line) => this.buildBasketLine(line)),
          )
        : emptyState(t('cashier.emptyBasket'), 'bag'),
      el('div', { className: 'supot__total' }, [
        el('span', { text: t('receipt.total') }),
        el('strong', { className: 'text-money', text: formatPeso(this.basket.getTotal()) }),
      ]),
      lines.length ? this.buildPaymentForm() : null,
    );
  }

  /**
   * @param {Object} line - Basket line with unitPrice and lineTotal.
   * @returns {HTMLElement}
   */
  buildBasketLine(line) {
    const unitText = line.saleUnit === SALE_UNITS.PIECE ? t('units.pc') : line.product.unitLabel;
    const quantityInput = el('input', {
      className: 'supot__qty-input',
      attrs: {
        type: 'text',
        inputmode: 'numeric',
        value: line.quantity,
        'aria-label': t('cashier.quantityFor', { name: line.product.name }),
      },
      on: { change: (event) => this.updateQuantity(line.key, event.target.value) },
    });
    return el('li', { className: 'supot__line' }, [
      el('div', { className: 'supot__line-info' }, [
        el('span', { className: 'supot__line-name', text: line.product.name }),
        el('span', {
          className: 'text-small text-muted',
          text: `${formatPeso(line.unitPrice)} / ${unitText}`,
        }),
      ]),
      el('div', { className: 'supot__qty' }, [
        button({
          label: t('cashier.less'),
          iconName: 'minus',
          size: 'icon',
          onClick: () => this.updateQuantity(line.key, line.quantity - 1),
        }),
        quantityInput,
        button({
          label: t('cashier.more'),
          iconName: 'plus',
          size: 'icon',
          onClick: () => this.updateQuantity(line.key, line.quantity + 1),
        }),
      ]),
      el('span', { className: 'supot__line-total text-money', text: formatPeso(line.lineTotal) }),
    ]);
  }

  /**
   * @param {string} key
   * @param {string|number} quantity
   */
  updateQuantity(key, quantity) {
    this.runAction(() => this.basket.setQuantity(key, String(quantity))).finally(() => {
      this.renderBasket();
      this.renderShelf();
    });
  }

  /* ------------------------------- Payment ------------------------------- */

  /** @returns {HTMLFormElement} */
  buildPaymentForm() {
    const form = el('form', { className: 'supot__payment', attrs: { novalidate: true } }, [
      segmented({
        label: t('cashier.paymentType'),
        selected: this.paymentType,
        options: [
          { value: PAYMENT_TYPES.CASH, label: t('payment.cash') },
          { value: PAYMENT_TYPES.GCASH, label: 'GCash' },
          { value: PAYMENT_TYPES.CREDIT, label: t('payment.credit') },
        ],
        onSelect: (value) => {
          this.paymentType = value;
          this.renderBasket();
        },
      }),
      formErrorBanner(),
      ...this.buildPaymentFields(),
      el('div', { className: 'supot__pay-row' }, [
        button({
          label: t('cashier.pay'),
          variant: 'primary',
          size: 'huge',
          type: 'submit',
          attrs: { disabled: !this.services.dayService.isOpen() },
        }),
        button({
          label: t('cashier.clear'),
          variant: 'ghost',
          size: 'small',
          iconName: 'trash',
          onClick: () => this.confirmClearBasket(),
        }),
      ]),
    ]);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.pay(form);
    });
    return form;
  }

  /** @returns {HTMLElement[]} Fields for the selected payment type. */
  buildPaymentFields() {
    if (this.paymentType === PAYMENT_TYPES.GCASH) {
      return [
        field({
          name: 'gcashReference',
          label: t('cashier.gcashReference'),
          hint: t('cashier.gcashHint'),
          attrs: { inputmode: 'numeric', autocomplete: 'off' },
        }),
      ];
    }
    if (this.paymentType === PAYMENT_TYPES.CREDIT) {
      return [this.buildCustomerSelect()];
    }
    return this.buildCashFields();
  }

  /** @returns {HTMLElement} */
  buildCustomerSelect() {
    const customers = this.services.creditService.listCustomers();
    const options = [
      { value: '', label: t('cashier.chooseCustomer') },
      ...customers.map((customer) => ({
        value: customer.id,
        label: `${getDisplayName(customer)} — ${t('cashier.owes', { amount: formatPeso(customer.balance), limit: formatPeso(customer.creditLimit) })}`,
      })),
    ];
    return field({ name: 'customerId', label: t('cashier.customer'), type: 'select', options });
  }

  /** @returns {HTMLElement[]} Cash input, quick buttons and live sukli preview. */
  buildCashFields() {
    const total = this.basket.getTotal();
    const cashField = field({
      name: 'cashReceived',
      label: t('cashier.cashReceived'),
      attrs: { inputmode: 'decimal', autocomplete: 'off', placeholder: '0.00' },
    });
    const cashInput = cashField.querySelector('input');
    const preview = el('div', { className: 'sukli', attrs: { 'aria-live': 'polite' } });
    const updatePreview = () => this.renderChangePreview(preview, cashInput.value, total);
    cashInput.addEventListener('input', updatePreview);
    const quickAmounts = [total, ...QUICK_CASH_AMOUNTS.filter((amount) => amount > total)];
    const quickButtons = el(
      'div',
      { className: 'btn-row supot__quick' },
      quickAmounts.map((amount, index) =>
        button({
          label: index === 0 ? t('cashier.exact') : formatPeso(amount).replace('.00', ''),
          size: 'small',
          variant: 'yellow',
          onClick: () => {
            cashInput.value = centavosToInputValue(amount);
            updatePreview();
          },
        }),
      ),
    );
    updatePreview();
    return [cashField, quickButtons, preview];
  }

  /**
   * Shows the change and which bills/coins to hand back, as the cashier types.
   * @param {HTMLElement} preview
   * @param {string} cashText
   * @param {number} total
   */
  renderChangePreview(preview, cashText, total) {
    let cash;
    try {
      cash = parsePesoToCentavos(cashText);
    } catch {
      preview.replaceChildren();
      return;
    }
    if (cash < total) {
      preview.replaceChildren(
        el('p', {
          className: 'sukli__short',
          text: t('cashier.stillShort', { amount: formatPeso(total - cash) }),
        }),
      );
      return;
    }
    const { pieces } = calculateChangeBreakdown(cash - total);
    setChildren(
      preview,
      el('p', { className: 'sukli__label' }, [
        t('cashier.change'),
        ' ',
        el('strong', { className: 'text-money', text: formatPeso(cash - total) }),
      ]),
      pieces.length ? moneyChips(pieces) : null,
    );
  }

  /**
   * Checks out. Over the credit limit, the owner may approve with the PIN.
   * @param {HTMLFormElement} form
   */
  async pay(form) {
    if (this.isPaying) {
      return; // second click while the first is still processing
    }
    this.isPaying = true;
    form.querySelector('[type="submit"]').disabled = true;
    clearFormErrors(form);
    const payment = { paymentType: this.paymentType, ...Object.fromEntries(new FormData(form)) };
    try {
      const sale = await this.checkoutWithOverride(payment, form);
      if (sale) {
        this.finishSale(sale);
      }
    } finally {
      this.isPaying = false;
      if (form.isConnected) {
        form.querySelector('[type="submit"]').disabled = false;
      }
    }
  }

  /**
   * @param {Object} payment
   * @param {HTMLFormElement} form
   * @returns {Promise<Object|undefined>} The sale, or undefined when cancelled/failed.
   */
  async checkoutWithOverride(payment, form) {
    try {
      return this.services.salesService.checkout(this.basket, payment);
    } catch (error) {
      if (!(error instanceof CreditLimitError)) {
        this.showError(error, form);
        return undefined;
      }
      const wantsOverride = await confirmAction({
        title: t('cashier.overLimitTitle'),
        message: `${t(error.messageKey, error.params)} ${t('cashier.overLimitAsk')}`,
        confirmLabel: t('cashier.allowOnce'),
      });
      if (
        !wantsOverride ||
        !(await requirePin(this.services.authService, t('cashier.overLimitPin')))
      ) {
        return undefined;
      }
      return this.runAction(
        () => this.services.salesService.checkout(this.basket, payment, { allowOverLimit: true }),
        { form },
      );
    }
  }

  /**
   * @param {import('../../models/Sale.js').Sale} sale
   */
  finishSale(sale) {
    this.basket.clear();
    this.renderBasket();
    this.renderShelf();
    this.toast.show(t('cashier.saleDone', { receipt: sale.receiptNumber }), 'success');
    const receipt = renderReceipt(sale, this.services.settingsService.get());
    const changePieces = sale.change > 0 ? calculateChangeBreakdown(sale.change).pieces : [];
    const content = el('div', { className: 'sale-done' }, [
      sale.change > 0
        ? el('div', { className: 'sale-done__change' }, [
            el('p', { className: 'sale-done__change-label', text: t('cashier.giveChange') }),
            el('p', {
              className: 'sale-done__change-amount text-money',
              text: formatPeso(sale.change),
            }),
            moneyChips(changePieces),
          ])
        : null,
      receipt,
    ]);
    const modal = openModal({ title: t('cashier.saleDoneTitle'), content, isWide: true });
    content.append(
      el('div', { className: 'form-actions' }, [
        button({
          label: t('common.print'),
          iconName: 'print',
          onClick: () => printElement(receipt),
        }),
        button({ label: t('cashier.newSale'), variant: 'primary', onClick: () => modal.close() }),
      ]),
    );
  }
}
