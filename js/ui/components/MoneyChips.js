/**
 * @file Shows bills and coins as little drawings (for sukli and cash count).
 * Depends on: config.js, utils/dom.js.
 */
import { DENOMINATIONS } from '../../config.js';
import { el } from '../../utils/dom.js';

const KIND_BY_VALUE = new Map(
  DENOMINATIONS.map((denomination) => [denomination.value, denomination.kind]),
);

/**
 * One bill or coin drawing.
 * @param {{value:number, label:string}} denomination
 * @returns {HTMLElement}
 */
export function moneyPiece(denomination) {
  const kind = KIND_BY_VALUE.get(denomination.value) ?? 'coin';
  return el('span', {
    className: `money-chip__piece money-chip__piece--${kind} money-chip__piece--${denomination.value}`,
    text: denomination.label,
    attrs: { 'aria-hidden': 'true' },
  });
}

/**
 * List of pieces with counts, e.g. [₱50] ×1  (25¢) ×2.
 * @param {Array<{value:number, label:string, count:number}>} pieces
 * @returns {HTMLElement}
 */
export function moneyChips(pieces) {
  return el(
    'ul',
    { className: 'money-chips' },
    pieces.map((piece) =>
      el(
        'li',
        { className: 'money-chip', attrs: { 'aria-label': `${piece.count} × ${piece.label}` } },
        [
          moneyPiece(piece),
          el('span', { className: 'money-chip__count', text: `×${piece.count}` }),
        ],
      ),
    ),
  );
}
