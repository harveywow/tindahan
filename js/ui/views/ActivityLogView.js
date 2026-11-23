/**
 * @file Talaan: read-only activity log with a category filter.
 * Depends on: ui/views/BaseView.js, ui/components/*, utils/*.
 */
import { el } from '../../utils/dom.js';
import { formatDateTime } from '../../utils/dates.js';
import { getLocale, t } from '../../utils/i18n.js';
import { emptyState } from '../components/EmptyState.js';
import { field } from '../components/FormField.js';
import { BaseView } from './BaseView.js';

const ACTIONS = [
  'sale',
  'void',
  'product',
  'stock',
  'credit',
  'restock',
  'expense',
  'day',
  'settings',
];
const PAGE_SIZE = 100;

export class ActivityLogView extends BaseView {
  constructor(context) {
    super(context);
    this.action = '';
    this.visibleCount = PAGE_SIZE;
  }

  /** @returns {Node[]} */
  build() {
    const entries = this.services.logService.list({ action: this.action });
    const filter = field({
      name: 'action',
      label: t('log.filter'),
      type: 'select',
      value: this.action,
      options: [
        { value: '', label: t('common.all') },
        ...ACTIONS.map((action) => ({ value: action, label: t(`log.actions.${action}`) })),
      ],
    });
    filter.querySelector('select').addEventListener('change', (event) => {
      this.action = event.target.value;
      this.visibleCount = PAGE_SIZE;
      this.render();
    });
    return [
      this.pageHeader(t('log.title'), t('log.subtitle')),
      el('section', { className: 'panel' }, [
        el('div', { className: 'toolbar' }, [filter]),
        this.buildEntries(entries),
      ]),
    ];
  }

  /**
   * @param {import('../../models/LogEntry.js').LogEntry[]} entries
   * @returns {HTMLElement}
   */
  buildEntries(entries) {
    if (entries.length === 0) {
      return emptyState(t('log.empty'), 'clock');
    }
    const items = entries.slice(0, this.visibleCount).map((entry) =>
      el('li', { className: 'log-list__item' }, [
        el('time', {
          className: 'log-list__time',
          text: formatDateTime(entry.createdAt, getLocale()),
          attrs: { datetime: entry.createdAt },
        }),
        el('span', { className: 'badge', text: t(`log.actions.${entry.action}`) }),
        el('span', { text: t(entry.messageKey, entry.params) }),
      ]),
    );
    return el('div', {}, [
      el('ol', { className: 'log-list' }, items),
      this.showMoreButton(entries.length, PAGE_SIZE),
    ]);
  }
}
