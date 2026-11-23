/**
 * @file Tests for validators, dates, CSV, i18n and DOM helpers.
 */
import { ValidationError } from '../js/core/AppError.js';
import { escapeCsvCell, toCsv } from '../js/utils/csv.js';
import {
  addDays,
  daysBetween,
  isValidDateKey,
  isWithinRange,
  toDateKey,
  toWeekKey,
  validateDateRange,
} from '../js/utils/dates.js';
import { el } from '../js/utils/dom.js';
import { findMissingKeys, setLanguage, t } from '../js/utils/i18n.js';
import {
  normalizeName,
  optionalPhMobile,
  requireGcashReference,
  requireInteger,
  requireMoney,
  requireText,
} from '../js/utils/validators.js';
import { describe, expect, it, itInBrowser } from './testRunner.js';

describe('validators', () => {
  it('[EC1] trims text and rejects whitespace-only', () => {
    expect(requireText('  Aling   Nena ', 'name')).toBe('Aling Nena');
    expect(() => requireText('    ', 'name')).toThrow(ValidationError, 'errors.required');
  });

  it('[EC1] rejects names over the maximum length', () => {
    expect(() => requireText('x'.repeat(61), 'name')).toThrow(ValidationError, 'errors.tooLong');
  });

  it('records which field failed so the form can highlight it', () => {
    try {
      requireText('', 'storeName');
    } catch (error) {
      expect(error.field).toBe('storeName');
    }
  });

  it('[EC2] rejects zero money unless allowed', () => {
    expect(() => requireMoney('0', 'price')).toThrow(ValidationError, 'errors.mustBePositive');
    expect(requireMoney('0', 'cost', { allowZero: true })).toBe(0);
  });

  it('requires selling prices to be payable with 25¢ coins', () => {
    expect(() => requireMoney('12.10', 'price', { mustBePayable: true })).toThrow(
      ValidationError,
      'errors.notPayable',
    );
    expect(requireMoney('12.75', 'price', { mustBePayable: true })).toBe(1275);
  });

  it('[EC3] rejects decimal quantities for whole items', () => {
    expect(() => requireInteger('1.5', 'quantity')).toThrow(ValidationError, 'errors.wholeNumber');
    expect(() => requireInteger('abc', 'quantity')).toThrow(ValidationError, 'errors.wholeNumber');
  });

  it('[EC2] rejects out-of-range integers', () => {
    expect(() => requireInteger('-1', 'quantity', { min: 0 })).toThrow(
      ValidationError,
      'errors.outOfRange',
    );
    expect(() => requireInteger('999999', 'quantity')).toThrow(
      ValidationError,
      'errors.outOfRange',
    );
  });

  it('validates PH mobile numbers (optional)', () => {
    expect(optionalPhMobile('0917 123 4567', 'contact')).toBe('09171234567');
    expect(optionalPhMobile('', 'contact')).toBe('');
    expect(() => optionalPhMobile('12345', 'contact')).toThrow(
      ValidationError,
      'errors.invalidMobile',
    );
  });

  it('[EC6] validates 13-digit GCash references', () => {
    expect(requireGcashReference('1234 5678 90123', 'ref')).toBe('1234567890123');
    expect(() => requireGcashReference('', 'ref')).toThrow(ValidationError, 'errors.gcashRequired');
    expect(() => requireGcashReference('12345', 'ref')).toThrow(
      ValidationError,
      'errors.invalidGcash',
    );
  });

  it('[EC7] normalizes names for duplicate detection', () => {
    expect(normalizeName('  Lucky   ME ')).toBe(normalizeName('lucky me'));
  });
});

describe('dates', () => {
  it('[EC17] uses the LOCAL date, so a late-night sale stays on the same day', () => {
    const lateNight = new Date(2026, 10, 22, 23, 30);
    expect(toDateKey(lateNight)).toBe('2026-11-22');
  });

  it('rejects impossible dates', () => {
    expect(isValidDateKey('2026-02-30')).toBe(false);
    expect(isValidDateKey('2026-02-28')).toBe(true);
    expect(isValidDateKey('yesterday')).toBe(false);
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2026-11-01', '2026-11-22')).toBe(21);
  });

  it('[EC17] rejects a start date after the end date', () => {
    expect(() => validateDateRange('2026-11-22', '2026-11-01')).toThrow(
      ValidationError,
      'errors.startAfterEnd',
    );
  });

  it('[EC17] treats empty range bounds as unbounded', () => {
    expect(isWithinRange('2026-01-01', '', '')).toBe(true);
    expect(isWithinRange('2026-01-01', '2026-02-01', '')).toBe(false);
  });

  it('computes Monday-based week keys', () => {
    expect(toWeekKey('2026-11-22')).toBe('2026-11-16'); // Sunday → previous Monday
    expect(toWeekKey('2026-11-16')).toBe('2026-11-16');
  });
});

describe('csv', () => {
  it('escapes commas, quotes and new lines', () => {
    expect(escapeCsvCell('Sardinas, red')).toBe('"Sardinas, red"');
    expect(escapeCsvCell('6" bread')).toBe('"6"" bread"');
  });

  it('[EC15] neutralizes spreadsheet formula injection', () => {
    expect(escapeCsvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(escapeCsvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(escapeCsvCell(-5)).toBe('-5');
  });

  it('builds a header row plus data rows', () => {
    const csv = toCsv(
      [{ name: 'Yelo', price: 5 }],
      [
        { key: 'name', header: 'Product' },
        { key: 'price', header: 'Price' },
      ],
    );
    expect(csv).toBe('Product,Price\r\nYelo,5');
  });
});

describe('i18n', () => {
  it('translates and fills placeholders', () => {
    setLanguage('en');
    expect(t('errors.tooLong', { max: 60 })).toContain('60');
  });

  it('every English key has a Filipino translation', () => {
    expect(findMissingKeys('fil')).toEqual([]);
  });

  it('falls back to the key for unknown text instead of "undefined"', () => {
    expect(t('no.such.key')).toBe('no.such.key');
  });

  it('switches language', () => {
    setLanguage('fil');
    expect(t('nav.tinda')).toBe('Tinda');
    setLanguage('xx');
    expect(t('nav.tinda')).toBe('Sell');
  });
});

describe('dom', () => {
  itInBrowser('[EC15] renders user text as text, never as HTML', () => {
    const maliciousName = '<img src=x onerror="window.hacked=true">';
    const element = el('p', { text: maliciousName });
    expect(element.querySelector('img')).toBe(null);
    expect(element.textContent).toBe(maliciousName);
  });

  itInBrowser('skips false/null attributes and children', () => {
    const element = el('button', { attrs: { disabled: false, title: 'Bayad' } }, [
      null,
      'OK',
      false,
    ]);
    expect(element.hasAttribute('disabled')).toBe(false);
    expect(element.textContent).toBe('OK');
  });
});
