/**
 * @file Ulat: charts, rankings and CSV exports.
 * Depends on: ui/views/BaseView.js, ui/components/ChartRenderer.js, ui/components/*, utils/*.
 */
import { el } from '../../utils/dom.js';
import { downloadTextFile } from '../../utils/download.js';
import { formatDateKey, fromDateKey } from '../../utils/dates.js';
import { getLocale, t } from '../../utils/i18n.js';
import { formatPeso } from '../../utils/money.js';
import { ChartRenderer } from '../components/ChartRenderer.js';
import { emptyState } from '../components/EmptyState.js';
import { button, dataTable, panel, segmented, statTile } from '../components/viewHelpers.js';
import { BaseView } from './BaseView.js';

const EXPORT_KINDS = ['products', 'sales', 'customers', 'credit'];

/**
 * Short x-axis label for a bucket key.
 * @param {string} period
 * @param {string} key
 * @returns {string}
 */
function formatBucketLabel(period, key) {
  const locale = getLocale();
  if (period === 'month') {
    return fromDateKey(`${key}-01`).toLocaleDateString(locale, { month: 'short' });
  }
  return fromDateKey(key).toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

/**
 * Compact peso for axis ticks: ₱1.5k instead of ₱1,500.00.
 * @param {number} centavos
 * @returns {string}
 */
function formatCompactPeso(centavos) {
  const pesos = centavos / 100;
  return pesos >= 1000
    ? `₱${(pesos / 1000).toFixed(pesos % 1000 === 0 ? 0 : 1)}k`
    : `₱${Math.round(pesos)}`;
}

export class ReportsView extends BaseView {
  constructor(context) {
    super(context);
    this.period = 'day';
    this.chart = null;
  }

  onUnmount() {
    this.chart?.destroy();
  }

  /** @returns {Node[]} */
  build() {
    this.chart?.destroy();
    const range = this.services.reportService.getPeriodRange(this.period);
    const summary = this.services.reportService.getRangeSummary(range.startKey, range.endKey);
    const series = this.services.reportService
      .getSeries(this.period)
      .map((bucket) => ({ ...bucket, label: formatBucketLabel(this.period, bucket.key) }));
    return [
      this.pageHeader(
        t('reports.title'),
        t('reports.subtitle', {
          from: formatDateKey(range.startKey, getLocale()),
          to: formatDateKey(range.endKey, getLocale()),
        }),
        [
          segmented({
            label: t('reports.period'),
            selected: this.period,
            options: ['day', 'week', 'month'].map((value) => ({
              value,
              label: t(`reports.periods.${value}`),
            })),
            onSelect: (value) => {
              this.period = value;
              this.render();
            },
          }),
        ],
      ),
      this.buildSummaryTiles(summary),
      this.buildChartPanel(series),
      el('div', { className: 'layout-two reports__grid' }, [
        this.buildTopSellers(summary.topSellers),
        this.buildCategoryMeters(summary.byCategory, summary.totalSales),
        this.buildPaymentBreakdown(summary.byPayment, summary.totalSales),
        this.buildSlowMovers(),
      ]),
      this.buildExportPanel(),
    ];
  }

  /**
   * @param {Object} summary
   * @returns {HTMLElement}
   */
  buildSummaryTiles(summary) {
    return el('div', { className: 'stat-grid reports__tiles' }, [
      statTile({ label: t('reports.sales'), value: formatPeso(summary.totalSales), tone: 'red' }),
      statTile({ label: t('reports.grossProfit'), value: formatPeso(summary.profit) }),
      statTile({
        label: t('reports.expenses'),
        value: formatPeso(summary.expenses),
        hint: t('reports.expensesHint'),
      }),
      statTile({
        label: t('reports.netProfit'),
        value: formatPeso(summary.netProfit),
        tone: 'green',
      }),
      statTile({
        label: t('reports.outstanding'),
        value: formatPeso(this.services.creditService.getTotalOutstanding()),
      }),
    ]);
  }

  /**
   * @param {Array<Object>} series
   * @returns {HTMLElement}
   */
  buildChartPanel(series) {
    const canvas = el('canvas', {
      className: 'chart__canvas',
      attrs: { role: 'img', 'aria-label': t('reports.chartLabel') },
    });
    const legendItem = (modifier, text) =>
      el('li', { className: `chart__legend-item chart__legend-item--${modifier}`, text });
    const legend = el('ul', { className: 'chart__legend' }, [
      legendItem('sales', t('reports.sales')),
      legendItem('profit', t('reports.grossProfit')),
      legendItem('expenses', t('reports.expenses')),
    ]);
    // Draw after the canvas is in the page, so it has a size.
    queueMicrotask(() => {
      this.chart = new ChartRenderer(canvas, { formatValue: formatCompactPeso });
      this.chart.setData(series);
    });
    return panel({
      title: t('reports.chartTitle'),
      iconName: 'chart',
      children: [legend, el('div', { className: 'chart' }, [canvas]), this.buildChartTable(series)],
    });
  }

  /**
   * The chart's numbers as a table for screen readers, since a canvas has no text.
   * @param {Array<Object>} series
   * @returns {HTMLElement}
   */
  buildChartTable(series) {
    const headers = [
      t('reports.bucket'),
      t('reports.sales'),
      t('reports.grossProfit'),
      t('reports.expenses'),
    ];
    const rows = series.map((point) => {
      const cells = [
        point.label,
        formatPeso(point.sales),
        formatPeso(point.profit),
        formatPeso(point.expenses),
      ];
      return el(
        'tr',
        {},
        cells.map((text) => el('td', { text })),
      );
    });
    return el('div', { className: 'visually-hidden' }, [
      dataTable(headers, rows, t('reports.chartLabel')),
    ]);
  }

  /**
   * @param {Array<{name:string, quantity:number, total:number}>} topSellers
   * @returns {HTMLElement}
   */
  buildTopSellers(topSellers) {
    const rows = topSellers.map((item, index) =>
      el('li', { className: 'alert-list__item' }, [
        el('span', { text: `${index + 1}. ${item.name}` }),
        el('span', {
          className: 'text-money',
          text: `${item.quantity} · ${formatPeso(item.total)}`,
        }),
      ]),
    );
    return panel({
      title: t('reports.topSellers'),
      iconName: 'heart',
      children: [
        rows.length
          ? el('ol', { className: 'alert-list' }, rows)
          : emptyState(t('reports.noSales'), 'chart'),
      ],
    });
  }

  /**
   * @param {Array<{category:string, total:number}>} byCategory
   * @param {number} totalSales
   * @returns {HTMLElement}
   */
  buildCategoryMeters(byCategory, totalSales) {
    return panel({
      title: t('reports.byCategory'),
      iconName: 'shelf',
      children: [
        byCategory.length
          ? this.buildMeters(
              byCategory.map((row) => ({ label: row.category, value: row.total })),
              totalSales,
            )
          : emptyState(t('reports.noSales'), 'chart'),
      ],
    });
  }

  /**
   * @param {Object<string, number>} byPayment
   * @param {number} totalSales
   * @returns {HTMLElement}
   */
  buildPaymentBreakdown(byPayment, totalSales) {
    const rows = Object.entries(byPayment).map(([type, value]) => ({
      label: t(`payment.${type}`),
      value,
    }));
    return panel({
      title: t('reports.byPayment'),
      iconName: 'wallet',
      children: [
        totalSales ? this.buildMeters(rows, totalSales) : emptyState(t('reports.noSales'), 'chart'),
      ],
    });
  }

  /**
   * Horizontal bars. The bar length is data, not styling, so only that one
   * number is handed to CSS as a custom property (--meter-percent); every
   * actual style rule stays in components.css.
   * @param {Array<{label:string, value:number}>} rows
   * @param {number} total
   * @returns {HTMLElement}
   */
  buildMeters(rows, total) {
    return el(
      'ul',
      { className: 'meter-list' },
      rows.map((row) => {
        const percent = total > 0 ? Math.round((row.value / total) * 100) : 0;
        const fill = el('div', { className: 'meter-list__fill' });
        fill.style.setProperty('--meter-percent', `${percent}%`);
        return el('li', { className: 'meter-list__row' }, [
          el('span', { text: row.label }),
          el(
            'div',
            { className: 'meter-list__bar', attrs: { role: 'img', 'aria-label': `${percent}%` } },
            [fill],
          ),
          el('span', { className: 'text-money text-right', text: formatPeso(row.value) }),
        ]);
      }),
    );
  }

  /** @returns {HTMLElement} */
  buildSlowMovers() {
    const { slowMoverDays } = this.services.settingsService.get();
    const rows = this.services.reportService
      .getSlowMovers(slowMoverDays)
      .slice(0, 8)
      .map(({ product, lastSoldKey }) =>
        el('li', { className: 'alert-list__item' }, [
          el('span', { text: product.name }),
          el('span', {
            className: 'text-small text-muted',
            text: lastSoldKey
              ? t('reports.lastSold', { date: lastSoldKey })
              : t('reports.neverSold'),
          }),
        ]),
      );
    return panel({
      title: t('reports.slowMovers', { days: slowMoverDays }),
      iconName: 'clock',
      children: [
        rows.length
          ? el('ul', { className: 'alert-list' }, rows)
          : emptyState(t('reports.noSlowMovers'), 'check'),
      ],
    });
  }

  /** @returns {HTMLElement} */
  buildExportPanel() {
    const today = this.context.clock.today();
    const buttons = EXPORT_KINDS.map((kind) =>
      button({
        label: t(`reports.export.${kind}`),
        iconName: 'download',
        onClick: () =>
          downloadTextFile(
            `tindahan-${kind}-${today}.csv`,
            this.services.reportService.exportCsv(kind),
            'text/csv',
          ),
      }),
    );
    return panel({
      title: t('reports.exportTitle'),
      iconName: 'download',
      children: [
        el('p', { className: 'text-small text-muted', text: t('reports.exportHelp') }),
        el('div', { className: 'btn-row' }, buttons),
      ],
    });
  }
}
