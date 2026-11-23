/**
 * @file Thermal-paper receipt for a sale.
 * Depends on: utils/dom.js, utils/i18n.js, utils/money.js, utils/dates.js.
 */
import { el } from '../../utils/dom.js';
import { formatDateTime } from '../../utils/dates.js';
import { getLocale, t } from '../../utils/i18n.js';
import { formatPeso } from '../../utils/money.js';

/**
 * @param {string} label
 * @param {string} value
 * @param {string} [modifier]
 * @returns {HTMLElement}
 */
function receiptLine(label, value, modifier = '') {
  return el('div', { className: `receipt__line ${modifier}`.trim() }, [
    el('span', { text: label }),
    el('span', { text: value }),
  ]);
}

/**
 * @param {import('../../models/Sale.js').Sale} sale
 * @returns {HTMLElement[]} Payment lines.
 */
function paymentLines(sale) {
  if (sale.paymentType === 'cash') {
    return [
      receiptLine(t('receipt.cash'), formatPeso(sale.cashReceived)),
      receiptLine(t('receipt.change'), formatPeso(sale.change)),
    ];
  }
  if (sale.paymentType === 'gcash') {
    return [
      receiptLine('GCash', formatPeso(sale.total)),
      receiptLine(t('receipt.reference'), sale.gcashReference),
    ];
  }
  return [receiptLine(t('receipt.creditTo'), sale.customerName)];
}

/**
 * @param {import('../../models/Sale.js').Sale} sale
 * @param {{storeName: string, ownerName: string}} settings
 * @returns {HTMLElement}
 */
export function renderReceipt(sale, settings) {
  const itemNodes = sale.items.flatMap((item) => [
    receiptLine(item.productName, formatPeso(item.lineTotal)),
    el('div', {
      className: 'receipt__item-detail',
      text: `${item.quantity} ${item.unitLabel} × ${formatPeso(item.unitPrice)}`,
    }),
  ]);
  return el('article', { className: 'receipt', attrs: { 'aria-label': t('receipt.title') } }, [
    el('header', { className: 'receipt__header' }, [
      el('p', { className: 'receipt__store', text: settings.storeName }),
      el('p', {
        className: 'receipt__meta',
        text: t('receipt.owner', { name: settings.ownerName }),
      }),
      el('p', {
        className: 'receipt__meta',
        text: `#${sale.receiptNumber} · ${formatDateTime(sale.createdAt, getLocale())}`,
      }),
    ]),
    sale.status === 'voided'
      ? el('p', { className: 'receipt__void' }, [
          el('span', { className: 'stamp stamp--big', text: t('receipt.voided') }),
        ])
      : null,
    el('hr', { className: 'receipt__rule' }),
    ...itemNodes,
    el('hr', { className: 'receipt__rule' }),
    receiptLine(t('receipt.total'), formatPeso(sale.total), 'receipt__line--total'),
    ...paymentLines(sale),
    el('hr', { className: 'receipt__rule' }),
    el('p', { className: 'receipt__footer', text: t('receipt.thanks') }),
  ]);
}
