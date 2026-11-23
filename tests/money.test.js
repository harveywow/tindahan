/**
 * @file Tests for utils/money.js — centavos, formatting and change breakdown.
 */
import { DENOMINATIONS } from '../js/config.js';
import { ValidationError } from '../js/core/AppError.js';
import {
  calculateChangeBreakdown,
  calculateMarginPercent,
  formatPeso,
  parsePesoToCentavos,
  sumCashCount,
} from '../js/utils/money.js';
import { describe, expect, it } from './testRunner.js';

/**
 * Slow but certainly-optimal coin counting (dynamic programming), used to
 * prove the greedy algorithm gives the fewest pieces.
 * @param {number} amountInQuarters - Amount in units of 25¢.
 * @returns {number[]} Minimum pieces for every amount up to amountInQuarters.
 */
function minimumPiecesTable(amountInQuarters) {
  const values = DENOMINATIONS.map((denomination) => denomination.value / 25);
  const best = new Array(amountInQuarters + 1).fill(Infinity);
  best[0] = 0;
  for (let amount = 1; amount <= amountInQuarters; amount += 1) {
    values.forEach((value) => {
      if (value <= amount && best[amount - value] + 1 < best[amount]) {
        best[amount] = best[amount - value] + 1;
      }
    });
  }
  return best;
}

describe('money', () => {
  describe('parsePesoToCentavos', () => {
    it('converts peso text to integer centavos', () => {
      expect(parsePesoToCentavos('12.50')).toBe(1250);
      expect(parsePesoToCentavos('₱1,234.5')).toBe(123450);
      expect(parsePesoToCentavos(7)).toBe(700);
    });

    it('[EC16] avoids floating-point error (1.15 × 100 is 114.999… in floats)', () => {
      expect(parsePesoToCentavos('1.15')).toBe(115);
      expect(parsePesoToCentavos('0.29')).toBe(29);
    });

    it('[EC1] rejects empty and whitespace input', () => {
      expect(() => parsePesoToCentavos('   ')).toThrow(ValidationError, 'errors.required');
      expect(() => parsePesoToCentavos(null)).toThrow(ValidationError, 'errors.required');
    });

    it('[EC2] rejects negative, non-numeric, NaN and Infinity', () => {
      ['-5', 'abc', 'NaN', 'Infinity', '1e3', '12.345', '1.2.3'].forEach((badInput) => {
        expect(() => parsePesoToCentavos(badInput)).toThrow(ValidationError, 'errors.invalidMoney');
      });
    });

    it('[EC2] rejects absurdly large amounts', () => {
      expect(() => parsePesoToCentavos('99999999')).toThrow(
        ValidationError,
        'errors.moneyTooLarge',
      );
    });
  });

  describe('formatPeso', () => {
    it('formats with peso sign, thousands separator and two decimals', () => {
      expect(formatPeso(123450)).toBe('₱1,234.50');
      expect(formatPeso(5)).toBe('₱0.05');
      expect(formatPeso(-500)).toBe('-₱5.00');
    });
  });

  describe('calculateChangeBreakdown', () => {
    it('gives the expected bills and coins', () => {
      const { pieces, remainder } = calculateChangeBreakdown(7550);
      expect(pieces.map((piece) => `${piece.count}×${piece.label}`)).toEqual([
        '1×₱50',
        '1×₱20',
        '1×₱5',
        '2×25¢',
      ]);
      expect(remainder).toBe(0);
    });

    it('returns nothing for zero change', () => {
      expect(calculateChangeBreakdown(0).pieces).toHaveLength(0);
    });

    it('reports a remainder for amounts that are not multiples of 25¢', () => {
      expect(calculateChangeBreakdown(110).remainder).toBe(10);
    });

    it('greedy is optimal for every amount up to ₱2,000 (checked against dynamic programming)', () => {
      const maxQuarters = 8000;
      const best = minimumPiecesTable(maxQuarters);
      for (let quarters = 0; quarters <= maxQuarters; quarters += 1) {
        const greedyCount = calculateChangeBreakdown(quarters * 25).pieces.reduce(
          (sum, p) => sum + p.count,
          0,
        );
        if (greedyCount !== best[quarters]) {
          throw new Error(
            `greedy used ${greedyCount} pieces for ${quarters * 25}¢ but ${best[quarters]} is possible`,
          );
        }
      }
    });
  });

  describe('sumCashCount and margins', () => {
    it('totals a drawer count', () => {
      expect(sumCashCount({ 100000: 1, 2000: 3, 25: 4 })).toBe(106100);
    });

    it('ignores blank counts', () => {
      expect(sumCashCount({ 100000: '', 50000: undefined })).toBe(0);
    });

    it('computes margin percent and handles zero price', () => {
      expect(calculateMarginPercent(2500, 2000)).toBe(20);
      expect(calculateMarginPercent(0, 100)).toBe(0);
    });
  });
});
