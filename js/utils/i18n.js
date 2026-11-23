/**
 * @file Tiny translation helper (English / Filipino).
 * Depends on: i18n/strings.js.
 *
 * Why one dictionary: every visible label is looked up here, so switching
 * language re-renders the whole app and no screen is left half-translated.
 */
import { STRINGS } from '../i18n/strings.js';

export const LANGUAGES = Object.freeze(['en', 'fil']);

let currentLanguage = 'en';

/**
 * @param {string} language - 'en' or 'fil'; anything else falls back to English.
 */
export function setLanguage(language) {
  currentLanguage = LANGUAGES.includes(language) ? language : 'en';
  if (globalThis.document) {
    globalThis.document.documentElement.lang = currentLanguage === 'fil' ? 'fil' : 'en';
  }
}

/** @returns {string} Active language code. */
export function getLanguage() {
  return currentLanguage;
}

/** @returns {string} Locale for number/date formatting. */
export function getLocale() {
  return currentLanguage === 'fil' ? 'fil-PH' : 'en-PH';
}

/**
 * Translates a key and fills {placeholders}.
 * Missing Filipino text falls back to English, then to the key itself, so a
 * forgotten translation shows something readable instead of "undefined".
 * @param {string} key - Dot-separated key, e.g. "nav.tinda".
 * @param {Object<string, (string|number)>} [params]
 * @returns {string}
 * @example t('errors.tooLong', { max: 60 }) // "Must be 60 characters or fewer."
 */
export function t(key, params = {}) {
  const template = STRINGS[currentLanguage]?.[key] ?? STRINGS.en[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    Object.hasOwn(params, name) ? String(params[name]) : match,
  );
}

/**
 * Lists keys present in English but missing in another language (used by tests).
 * @param {string} language
 * @returns {string[]}
 */
export function findMissingKeys(language) {
  return Object.keys(STRINGS.en).filter((key) => !Object.hasOwn(STRINGS[language] ?? {}, key));
}
