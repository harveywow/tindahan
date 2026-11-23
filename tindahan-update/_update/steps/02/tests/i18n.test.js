/**
 * @file Tests that keep the two languages complete and consistent.
 */
import { STRINGS } from '../js/i18n/strings.js';
import { describe, expect, it } from './testRunner.js';

/** Menu route → key of the title shown on that screen. */
const ROUTE_TITLE_KEYS = Object.freeze({
  bukas: 'dashboard.title',
  tinda: 'cashier.title',
  paninda: 'inventory.title',
  listahan: 'credit.title',
  benta: 'history.title',
  pamilihan: 'restock.title',
  gastos: 'expenses.title',
  sara: 'closing.title',
  ulat: 'reports.title',
  talaan: 'log.title',
  ayos: 'settings.title',
  tungkol: 'about.title',
});

/**
 * Filipino words that must not appear in the English UI. Demo product names
 * and people's names are data, not UI text, so they are not checked here.
 */
const FILIPINO_WORDS =
  /\b(utang|suki|sukli|tingi|paninda|gastos|benta|listahan|paubos|ubos|bukas|sarado|supot|kaha|palengke|salamat|puhunan|bayad|kita|bibilhin|pahinga|tama|sobra|kulang|burahin|yelo|isara|buksan|ayos|ulat|talaan|tungkol|pamilihan|tinda|nina|ng|ni|po)\b/i;

/**
 * @param {string} language
 * @returns {string[]} Keys whose text breaks the rule.
 */
function findMismatchedTitles(language) {
  const strings = STRINGS[language];
  return Object.entries(ROUTE_TITLE_KEYS)
    .filter(([route, titleKey]) => strings[`nav.${route}`] !== strings[titleKey])
    .map(([route]) => route);
}

describe('translations', () => {
  it('has the same keys in English and Filipino', () => {
    const englishKeys = Object.keys(STRINGS.en).sort();
    expect(Object.keys(STRINGS.fil).sort()).toEqual(englishKeys);
  });

  it('uses no Filipino words in the English UI', () => {
    const leaks = Object.entries(STRINGS.en)
      .filter(([, text]) => FILIPINO_WORDS.test(text))
      .map(([key]) => key);
    expect(leaks).toEqual([]);
  });

  it('gives every menu item the same name as its screen title (English)', () => {
    expect(findMismatchedTitles('en')).toEqual([]);
  });

  it('gives every menu item the same name as its screen title (Filipino)', () => {
    expect(findMismatchedTitles('fil')).toEqual([]);
  });

  it('never leaves a translation empty', () => {
    const blanks = ['en', 'fil'].flatMap((language) =>
      Object.entries(STRINGS[language])
        .filter(([, text]) => text.trim() === '')
        .map(([key]) => `${language}:${key}`),
    );
    expect(blanks).toEqual([]);
  });
});
