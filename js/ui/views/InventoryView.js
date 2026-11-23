/**
 * @file Paninda: product list, add/edit form, stock adjustments and categories.
 * Depends on: ui/views/BaseView.js, ui/components/*, models/Product.js, utils/*.
 */
import { ADJUSTMENT_REASONS, LIMITS } from '../../config.js';
import { ValidationError } from '../../core/AppError.js';
import { getMarginPercent, isExpiringSoon, isLowStock } from '../../models/Product.js';
import { debounce } from '../../utils/debounce.js';
import { el, readForm } from '../../utils/dom.js';
import { readFileAsDataUrl } from '../../utils/download.js';
import { t } from '../../utils/i18n.js';
import { centavosToInputValue, formatPeso } from '../../utils/money.js';
import { confirmAction, requirePin } from '../components/dialogs.js';
import { emptyState } from '../components/EmptyState.js';
import { formatStock } from '../components/format.js';
import {
  buildForm,
  clearFormErrors,
  field,
  integerField,
  moneyField,
} from '../components/FormField.js';
import { icon } from '../components/icons.js';
import { openModal } from '../components/Modal.js';
import { button, dataTable, panel } from '../components/viewHelpers.js';
import { BaseView } from './BaseView.js';

const STATUS_FILTERS = Object.freeze(['all', 'low', 'out', 'expiring', 'archived']);
const SORT_OPTIONS = Object.freeze(['name', 'stock', 'price', 'margin']);

/** Starting values of the "new product" form. */
const NEW_PRODUCT_VALUES = Object.freeze({
  name: '',
  category: '',
  unitLabel: 'pack',
  costPerPack: '',
  pricePerPack: '',
  reorderLevel: '3',
  initialStock: '0',
  expiryDate: '',
  isTingi: false,
  piecesPerPack: '',
  pricePerPiece: '',
  imageDataUrl: '',
});

export class InventoryView extends BaseView {
  constructor(context) {
    super(context);
    this.filter = { search: '', category: '', stockStatus: 'all', sortBy: 'name' };
    this.refreshTable = debounce(() => this.renderTable(), 150);
  }

  /** @returns {Node[]} */
  build() {
    this.tableHolder = el('div', { className: 'inventory__table' });
    this.renderTable();
    return [
      this.pageHeader(t('inventory.title'), t('inventory.subtitle'), [
        button({
          label: t('inventory.add'),
          variant: 'primary',
          iconName: 'plus',
          onClick: () => this.openProductForm(),
        }),
      ]),
      el('section', { className: 'panel' }, [this.buildToolbar(), this.tableHolder]),
      el('div', { className: 'layout-two inventory__extras' }, [
        this.buildCategoryPanel(),
        this.buildAdjustmentPanel(),
      ]),
    ];
  }

  /** @returns {HTMLElement} */
  buildToolbar() {
    const toOptions = (values, prefix) =>
      values.map((value) => ({ value, label: t(`${prefix}.${value}`) }));
    const categories = this.services.inventoryService
      .listCategories()
      .map((name) => ({ value: name, label: name }));
    const toolbar = el('div', { className: 'toolbar' }, [
      field({
        name: 'search',
        label: t('common.search'),
        type: 'search',
        value: this.filter.search,
        attrs: { placeholder: t('cashier.searchPlaceholder') },
      }),
      this.filterSelect('category', t('inventory.category'), [
        { value: '', label: t('common.all') },
        ...categories,
      ]),
      this.filterSelect(
        'stockStatus',
        t('inventory.show'),
        toOptions(STATUS_FILTERS, 'inventory.status'),
      ),
      this.filterSelect('sortBy', t('inventory.sortBy'), toOptions(SORT_OPTIONS, 'inventory.sort')),
    ]);
    // Typing filters after a short pause; dropdowns filter immediately.
    toolbar.querySelector('[name="search"]').addEventListener('input', (event) => {
      this.filter.search = event.target.value;
      this.refreshTable();
    });
    toolbar.addEventListener('change', (event) => {
      if (event.target.tagName === 'SELECT') {
        this.filter[event.target.name] = event.target.value;
        this.renderTable();
      }
    });
    return toolbar;
  }

  /**
   * @param {string} name - Key in this.filter.
   * @param {string} label
   * @param {Array<{value:string, label:string}>} options
   * @returns {HTMLElement}
   */
  filterSelect(name, label, options) {
    return field({ name, label, type: 'select', options, value: this.filter[name] });
  }

  /** Re-draws only the product table (keeps focus in the search box). */
  renderTable() {
    const products = this.services.inventoryService.listProducts(this.filter);
    if (products.length === 0) {
      this.tableHolder.replaceChildren(emptyState(t('inventory.empty'), 'shelf'));
      return;
    }
    const headers = [
      t('inventory.product'),
      t('inventory.price'),
      t('inventory.cost'),
      t('inventory.margin'),
      t('inventory.stock'),
      '',
    ];
    const table = dataTable(
      headers,
      products.map((product) => this.buildRow(product)),
      t('inventory.title'),
    );
    table.addEventListener('click', (event) => this.handleRowAction(event));
    this.tableHolder.replaceChildren(table);
  }

  /**
   * @param {import('../../models/Product.js').Product} product
   * @returns {HTMLTableRowElement}
   */
  buildRow(product) {
    return el('tr', { className: product.isArchived ? 'row--muted' : '' }, [
      el('td', {}, [this.buildProductCell(product)]),
      el('td', { className: 'text-money' }, [
        `${formatPeso(product.pricePerPack)}/${product.unitLabel}`,
        product.isTingi
          ? el('div', {
              className: 'text-small text-muted',
              text: `${formatPeso(product.pricePerPiece)}/${t('units.pc')}`,
            })
          : null,
      ]),
      el('td', { className: 'text-money', text: formatPeso(product.costPerPack) }),
      el('td', { text: `${getMarginPercent(product)}%` }),
      el('td', {}, [el('div', { text: formatStock(product) }), ...this.buildStockStamps(product)]),
      el('td', {}, [this.buildRowActions(product)]),
    ]);
  }

  /**
   * @param {import('../../models/Product.js').Product} product
   * @returns {HTMLElement} Picture, name and category.
   */
  buildProductCell(product) {
    const details = product.isTingi
      ? `${product.category} · ${t('inventory.tingiBadge', { count: product.piecesPerPack })}`
      : product.category;
    return el('div', { className: 'product-cell' }, [
      product.imageDataUrl
        ? el('img', {
            className: 'product-cell__thumb',
            attrs: { src: product.imageDataUrl, alt: '' },
          })
        : null,
      el('div', {}, [
        el('strong', { text: product.name }),
        el('div', { className: 'text-small text-muted', text: details }),
      ]),
    ]);
  }

  /**
   * @param {import('../../models/Product.js').Product} product
   * @returns {HTMLElement[]} Low-stock, expiry and archived stamps.
   */
  buildStockStamps(product) {
    const { expiryWarningDays } = this.services.settingsService.get();
    const stamps = [];
    if (product.isArchived) {
      stamps.push(el('span', { className: 'stamp stamp--ink', text: t('inventory.archived') }));
    } else if (isLowStock(product)) {
      stamps.push(el('span', { className: 'stamp', text: t('stock.low') }));
    }
    if (isExpiringSoon(product, this.context.clock.today(), expiryWarningDays)) {
      stamps.push(
        el('span', {
          className: 'stamp stamp--warn',
          text: t('stock.expires', { date: product.expiryDate }),
        }),
      );
    }
    return stamps;
  }

  /**
   * @param {import('../../models/Product.js').Product} product
   * @returns {HTMLElement}
   */
  buildRowActions(product) {
    const action = (name, label, iconName) =>
      el(
        'button',
        {
          className: 'btn btn--icon btn--small',
          attrs: { type: 'button', 'aria-label': `${label}: ${product.name}`, title: label },
          dataset: { action: name, productId: product.id },
        },
        [icon(iconName)],
      );
    if (product.isArchived) {
      return el('div', { className: 'data-table__actions' }, [
        action('unarchive', t('inventory.unarchive'), 'undo'),
      ]);
    }
    return el('div', { className: 'data-table__actions' }, [
      action('edit', t('common.edit'), 'edit'),
      action('adjust', t('inventory.adjust'), 'box'),
      action('remove', t('common.delete'), 'trash'),
    ]);
  }

  /**
   * Event delegation for the table's action buttons.
   * @param {MouseEvent} event
   */
  handleRowAction(event) {
    const target = event.target.closest('[data-action]');
    if (!target) {
      return;
    }
    const product = this.services.inventoryService.getProduct(target.dataset.productId);
    const actions = {
      edit: () => this.openProductForm(product),
      adjust: () => this.openAdjustForm(product),
      remove: () => this.removeProduct(product),
      unarchive: () =>
        this.runAction(() => this.services.inventoryService.unarchiveProduct(product.id), {
          successMessage: t('inventory.restored'),
        }),
    };
    actions[target.dataset.action]?.();
  }

  /* ---------------------------- Product form ---------------------------- */

  /**
   * @param {import('../../models/Product.js').Product} [product] - Omit to add a new one.
   */
  openProductForm(product = null) {
    const values = product ? this.toFormValues(product) : NEW_PRODUCT_VALUES;
    const form = buildForm({
      children: [this.buildProductFields(values, Boolean(product))],
      submitButton: button({
        label: t('common.save'),
        variant: 'primary',
        type: 'submit',
        iconName: 'check',
      }),
      onSubmit: (input) => this.saveProduct(form, input, { product, modal }),
    });
    const tingiCheckbox = form.querySelector('[name="isTingi"]');
    const tingiFields = form.querySelector('.tingi-fields');
    const syncTingi = () => tingiFields.toggleAttribute('hidden', !tingiCheckbox.checked);
    tingiCheckbox.addEventListener('change', syncTingi);
    syncTingi();
    const modal = openModal({
      title: product ? t('inventory.editTitle') : t('inventory.addTitle'),
      content: form,
      isWide: true,
    });
  }

  /**
   * @param {Object} values - Current input values.
   * @param {boolean} isEditing - Starting stock is only asked for new products.
   * @returns {HTMLElement}
   */
  buildProductFields(values, isEditing) {
    return el('div', { className: 'form-grid' }, [
      ...this.buildIdentityFields(values),
      ...this.buildPriceAndStockFields(values, isEditing),
      field({
        name: 'expiryDate',
        label: t('inventory.expiryDate'),
        type: 'date',
        value: values.expiryDate,
      }),
      field({
        name: 'isTingi',
        label: t('inventory.isTingi'),
        type: 'checkbox',
        value: values.isTingi,
        className: 'form-grid--full',
      }),
      this.buildTingiFields(values),
      this.buildImageField(values.imageDataUrl),
    ]);
  }

  /**
   * Name, category and unit name.
   * @param {Object} values
   * @returns {HTMLElement[]}
   */
  buildIdentityFields(values) {
    const categoryOptions = this.services.inventoryService
      .listCategories()
      .map((name) => ({ value: name, label: name }));
    return [
      field({
        name: 'name',
        label: t('inventory.name'),
        value: values.name,
        className: 'form-grid--full',
        attrs: { maxlength: LIMITS.MAX_NAME_LENGTH },
      }),
      field({
        name: 'category',
        label: t('inventory.category'),
        type: 'select',
        options: categoryOptions,
        value: values.category,
      }),
      field({
        name: 'unitLabel',
        label: t('inventory.unitLabel'),
        value: values.unitLabel,
        hint: t('inventory.unitHint'),
      }),
    ];
  }

  /**
   * @param {Object} values
   * @param {boolean} isEditing
   * @returns {Array<HTMLElement|null>}
   */
  buildPriceAndStockFields(values, isEditing) {
    return [
      moneyField({
        name: 'costPerPack',
        label: t('inventory.costPerPack'),
        value: values.costPerPack,
      }),
      moneyField({
        name: 'pricePerPack',
        label: t('inventory.pricePerPack'),
        value: values.pricePerPack,
      }),
      integerField({
        name: 'reorderLevel',
        label: t('inventory.reorderLevel'),
        value: values.reorderLevel,
        hint: t('inventory.reorderHint'),
      }),
      // Stock of an existing product only changes through sales, restocks and adjustments.
      isEditing
        ? null
        : integerField({
            name: 'initialStock',
            label: t('inventory.initialStock'),
            value: values.initialStock,
          }),
    ];
  }

  /**
   * Fields shown only when "sold by piece" is ticked.
   * @param {Object} values
   * @returns {HTMLElement}
   */
  buildTingiFields(values) {
    return el('div', { className: 'form-grid form-grid--full tingi-fields' }, [
      integerField({
        name: 'piecesPerPack',
        label: t('inventory.piecesPerPack'),
        value: values.piecesPerPack,
        hint: t('inventory.piecesHint'),
      }),
      moneyField({
        name: 'pricePerPiece',
        label: t('inventory.pricePerPiece'),
        value: values.pricePerPiece,
      }),
    ]);
  }

  /**
   * @param {import('../../models/Product.js').Product} product
   * @returns {Object} Values for the form inputs.
   */
  toFormValues(product) {
    return {
      ...NEW_PRODUCT_VALUES,
      ...product,
      costPerPack: centavosToInputValue(product.costPerPack),
      pricePerPack: centavosToInputValue(product.pricePerPack),
      pricePerPiece: product.isTingi ? centavosToInputValue(product.pricePerPiece) : '',
      piecesPerPack: product.isTingi ? String(product.piecesPerPack) : '',
      reorderLevel: String(product.reorderLevel),
    };
  }

  /**
   * Image picker with preview and a size check before reading the file.
   * @param {string} imageDataUrl - Current picture ('' when none).
   * @returns {HTMLElement}
   */
  buildImageField(imageDataUrl) {
    const hiddenInput = el('input', {
      attrs: { type: 'hidden', name: 'imageDataUrl', value: imageDataUrl },
    });
    const preview = el('img', {
      className: 'image-field__preview',
      attrs: { alt: '', hidden: !imageDataUrl, src: imageDataUrl || null },
    });
    const wrapper = field({
      name: 'image',
      label: t('inventory.image'),
      type: 'file',
      hint: t('inventory.imageHint'),
      attrs: { accept: 'image/png, image/jpeg, image/webp' },
      className: 'form-grid--full image-field',
    });
    const fileInput = wrapper.querySelector('input[type="file"]');
    const setImage = (dataUrl) => {
      hiddenInput.value = dataUrl;
      preview.src = dataUrl;
      preview.hidden = !dataUrl;
    };
    fileInput.addEventListener('change', () =>
      this.loadImage(fileInput, wrapper.querySelector('.field__error'), setImage),
    );
    const removeButton = button({
      label: t('inventory.removeImage'),
      size: 'small',
      variant: 'ghost',
      onClick: () => {
        setImage('');
        fileInput.value = '';
      },
    });
    wrapper.append(
      hiddenInput,
      el('div', { className: 'image-field__row' }, [preview, removeButton]),
    );
    return wrapper;
  }

  /**
   * Reads the chosen picture, refusing files over the size limit BEFORE
   * reading them (a 5 MB photo would otherwise fill the browser storage).
   * @param {HTMLInputElement} fileInput
   * @param {HTMLElement} errorSlot
   * @param {function(string): void} setImage
   */
  async loadImage(fileInput, errorSlot, setImage) {
    const [file] = fileInput.files;
    errorSlot.textContent = '';
    if (!file) {
      return;
    }
    if (file.size > LIMITS.MAX_IMAGE_BYTES) {
      errorSlot.textContent = t('errors.imageTooLarge', { max: '200 KB' });
      fileInput.value = '';
      return;
    }
    setImage(await readFileAsDataUrl(file));
  }

  /**
   * Saves the form. Price changes on existing products need the PIN; prices
   * below cost need an explicit confirmation.
   * @param {HTMLFormElement} form
   * @param {Object} input - Form values.
   * @param {{product: (Object|null), modal: {close: function(): void}}} context
   */
  async saveProduct(form, input, { product, modal }) {
    const inventory = this.services.inventoryService;
    const changesPrice = product && inventory.wouldChangePrice(product.id, input);
    if (
      changesPrice &&
      !(await requirePin(this.services.authService, t('inventory.pinForPrice')))
    ) {
      return;
    }
    const save = (options) =>
      product
        ? inventory.updateProduct(product.id, input, options)
        : inventory.addProduct(input, options);
    try {
      save({});
    } catch (error) {
      const isBelowCost =
        error instanceof ValidationError && error.messageKey === 'errors.priceBelowCost';
      if (!isBelowCost) {
        this.showError(error, form);
        return;
      }
      if (
        !(await this.confirmBelowCost()) ||
        (await this.runAction(() => save({ confirmBelowCost: true }), { form })) === undefined
      ) {
        return;
      }
    }
    modal.close();
    this.toast.show(t('inventory.saved'), 'success');
  }

  /** @returns {Promise<boolean>} True when the owner chooses to sell at a loss anyway. */
  confirmBelowCost() {
    return confirmAction({
      title: t('inventory.belowCostTitle'),
      message: t('errors.priceBelowCost'),
      confirmLabel: t('inventory.sellAnyway'),
    });
  }

  /* ---------------------------- Other actions ---------------------------- */

  /**
   * @param {import('../../models/Product.js').Product} product
   */
  openAdjustForm(product) {
    const form = buildForm({
      children: [
        el('p', {
          className: 'text-muted',
          text: t('inventory.adjustHelp', { name: product.name }),
        }),
        this.buildAdjustFields(product),
      ],
      submitButton: button({ label: t('common.save'), variant: 'primary', type: 'submit' }),
      onSubmit: async (values) => {
        const result = await this.runAction(
          () => this.services.inventoryService.adjustStock(product.id, values),
          {
            form,
            successMessage: t('inventory.adjusted'),
          },
        );
        if (result) {
          modal.close();
        }
      },
    });
    const modal = openModal({ title: t('inventory.adjustTitle'), content: form });
  }

  /**
   * @param {import('../../models/Product.js').Product} product
   * @returns {HTMLElement}
   */
  buildAdjustFields(product) {
    const directions = [
      { value: 'remove', label: t('inventory.remove') },
      { value: 'add', label: t('inventory.addStock') },
    ];
    const units = [{ value: 'pack', label: product.unitLabel }];
    if (product.isTingi) {
      units.push({ value: 'piece', label: t('units.piece') });
    }
    const reasons = ADJUSTMENT_REASONS.map((reason) => ({
      value: reason,
      label: t(`reasons.${reason}`),
    }));
    return el('div', { className: 'form-grid' }, [
      field({
        name: 'direction',
        label: t('inventory.direction'),
        type: 'select',
        options: directions,
      }),
      integerField({ name: 'quantity', label: t('common.quantity'), value: '1' }),
      field({ name: 'unit', label: t('inventory.unit'), type: 'select', options: units }),
      field({ name: 'reason', label: t('inventory.reason'), type: 'select', options: reasons }),
      field({ name: 'note', label: t('common.note'), className: 'form-grid--full' }),
    ]);
  }

  /**
   * @param {import('../../models/Product.js').Product} product
   */
  async removeProduct(product) {
    const message = product.hasSalesHistory
      ? t('inventory.archiveConfirm', { name: product.name })
      : t('inventory.deleteConfirm', { name: product.name });
    if (
      await confirmAction({
        title: t('common.delete'),
        message,
        confirmLabel: t('common.delete'),
        isDanger: true,
      })
    ) {
      const outcome = await this.runAction(() =>
        this.services.inventoryService.removeProduct(product.id),
      );
      if (outcome) {
        this.toast.show(
          t(outcome === 'archived' ? 'inventory.archivedToast' : 'inventory.deletedToast'),
          'success',
        );
      }
    }
  }

  /** @returns {HTMLElement} */
  buildCategoryPanel() {
    const categories = this.services.inventoryService.listCategories();
    const form = el('form', { className: 'category-form', attrs: { novalidate: true } }, [
      field({ name: 'categoryName', label: t('inventory.newCategory') }),
      button({ label: t('common.add'), type: 'submit', iconName: 'plus' }),
    ]);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      clearFormErrors(form);
      this.runAction(
        () => this.services.inventoryService.addCategory(readForm(form).categoryName),
        { form, successMessage: t('inventory.categoryAdded') },
      );
    });
    const chips = el(
      'ul',
      { className: 'category-chips' },
      categories.map((name) =>
        el('li', { className: 'category-chips__item' }, [
          el('span', { text: name }),
          el('button', {
            className: 'category-chips__remove',
            text: '×',
            attrs: { type: 'button', 'aria-label': t('inventory.removeCategory', { name }) },
            on: {
              click: () =>
                this.runAction(() => this.services.inventoryService.removeCategory(name)),
            },
          }),
        ]),
      ),
    );
    return panel({ title: t('inventory.categories'), iconName: 'shelf', children: [chips, form] });
  }

  /** @returns {HTMLElement} */
  buildAdjustmentPanel() {
    const adjustments = this.services.inventoryService.listAdjustments().slice(0, 8);
    const rows = adjustments.map((adjustment) =>
      el('li', { className: 'alert-list__item' }, [
        el('span', { text: `${adjustment.productName} — ${t(`reasons.${adjustment.reason}`)}` }),
        el('span', {
          className: 'badge',
          text: `${adjustment.changePieces > 0 ? '+' : ''}${adjustment.changePieces} ${t('units.pcs')}`,
        }),
      ]),
    );
    return panel({
      title: t('inventory.recentAdjustments'),
      iconName: 'clock',
      children: [
        rows.length
          ? el('ul', { className: 'alert-list' }, rows)
          : emptyState(t('inventory.noAdjustments'), 'box'),
      ],
    });
  }
}
