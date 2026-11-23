/**
 * @file Product pictures that can be clicked to see them large.
 * Depends on: utils/dom.js, utils/i18n.js, ui/components/Modal.js, ui/components/icons.js.
 *
 * Pictures are stored small (max 200 KB), so the viewer scales them up to
 * fit the window instead of showing them at their tiny natural size.
 */
import { el } from '../../utils/dom.js';
import { t } from '../../utils/i18n.js';
import { openModal } from './Modal.js';
import { icon } from './icons.js';

/**
 * Opens the picture in a dialog. Closes with ✕, Esc or a click outside.
 * @param {Object} options
 * @param {string} options.src - Data URL of the picture.
 * @param {string} options.name - Product name, used as the dialog title and alt text.
 * @param {string} [options.caption] - Extra line under the picture (e.g. the price).
 * @returns {import('./Modal.js').ModalHandle}
 */
export function openImageViewer({ src, name, caption = '' }) {
  const figure = el('figure', { className: 'image-viewer' }, [
    el('img', { className: 'image-viewer__img', attrs: { src, alt: name } }),
    caption ? el('figcaption', { className: 'image-viewer__caption', text: caption }) : null,
  ]);
  return openModal({ title: name, content: figure, isWide: true });
}

/**
 * Wraps a picture in a button with a magnifier badge. Using a real <button>
 * means it also works with the keyboard (Tab + Enter).
 * @param {Object} options
 * @param {HTMLImageElement} options.image
 * @param {string} options.label - Spoken and tooltip text.
 * @param {function(HTMLButtonElement): void} options.onOpen
 * @returns {HTMLButtonElement}
 */
export function zoomButton({ image, label, onOpen }) {
  const zoom = el(
    'button',
    {
      className: 'zoomable',
      attrs: { type: 'button', 'aria-label': label, title: label },
      on: {
        click: (event) => {
          // On the selling shelf the card itself may react to clicks; viewing must not add to the basket.
          event.stopPropagation();
          onOpen(zoom);
        },
      },
    },
    [
      image,
      el('span', { className: 'zoomable__badge', attrs: { 'aria-hidden': 'true' } }, [
        icon('search'),
      ]),
    ],
  );
  return zoom;
}

/**
 * A product thumbnail that opens the large view when clicked.
 * @param {Object} options
 * @param {string} options.src
 * @param {string} options.name
 * @param {string} [options.caption]
 * @param {string} [options.className] - Class for the <img> (keeps each screen's thumbnail size).
 * @returns {HTMLButtonElement}
 */
export function zoomableImage({ src, name, caption = '', className = '' }) {
  return zoomButton({
    image: el('img', { className, attrs: { src, alt: '' } }),
    label: t('images.zoom', { name }),
    onOpen: () => openImageViewer({ src, name, caption }),
  });
}
