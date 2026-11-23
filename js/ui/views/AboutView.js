/**
 * @file Tungkol: about the project and its contributors.
 * Depends on: config.js, ui/views/BaseView.js, utils/*.
 */
import { CONTRIBUTORS } from '../../config.js';
import { el } from '../../utils/dom.js';
import { t } from '../../utils/i18n.js';
import { panel } from '../components/viewHelpers.js';
import { BaseView } from './BaseView.js';

export class AboutView extends BaseView {
  /** @returns {Node[]} */
  build() {
    const surnames = CONTRIBUTORS.map((name) => name.split(',')[0]);
    const formatSurname = (surname) => surname.charAt(0) + surname.slice(1).toLowerCase();
    return [
      this.pageHeader(t('about.title'), t('about.subtitle')),
      el('section', { className: 'about-sign', attrs: { 'aria-label': t('about.contributors') } }, [
        el('p', { className: 'about-sign__kicker', text: t('about.madeBy') }),
        el('p', { className: 'about-sign__names', text: surnames.map(formatSurname).join(' · ') }),
      ]),
      el('div', { className: 'layout-two' }, [
        panel({
          title: t('about.contributors'),
          iconName: 'heart',
          children: [
            el(
              'ul',
              { className: 'about-list' },
              CONTRIBUTORS.map((name) => el('li', { text: name })),
            ),
          ],
        }),
        panel({
          title: t('about.projectTitle'),
          iconName: 'store',
          modifier: 'cardboard',
          children: [
            el('p', { text: t('about.description') }),
            el('p', { className: 'text-small', text: t('about.tech') }),
          ],
        }),
      ]),
    ];
  }
}
