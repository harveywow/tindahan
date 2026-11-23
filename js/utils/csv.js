/**
 * @file CSV generation for report exports.
 * Depends on: nothing.
 */

const FORMULA_TRIGGERS = ['=', '+', '-', '@'];

/**
 * Escapes one cell.
 * Why the apostrophe: spreadsheet apps execute cells starting with "=" as
 * formulas, so a customer named "=HYPERLINK(...)" could run code when the
 * owner opens the export (CSV injection). Prefixing "'" makes it plain text.
 * Negative numbers are numbers, not text, so they are left alone.
 * @param {*} value
 * @returns {string}
 */
export function escapeCsvCell(value) {
  if (value === null || value === undefined) {
    return '';
  }
  let text = String(value);
  const isNumber = typeof value === 'number';
  if (!isNumber && FORMULA_TRIGGERS.includes(text.charAt(0))) {
    text = `'${text}`;
  }
  if (/[",\n\r]/.test(text)) {
    text = `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/**
 * Builds CSV text from rows.
 * @param {Object[]} rows
 * @param {Array<{key: string, header: string}>} columns
 * @returns {string} CSV with CRLF line endings (what Excel expects).
 */
export function toCsv(rows, columns) {
  const headerLine = columns.map((column) => escapeCsvCell(column.header)).join(',');
  const bodyLines = rows.map((row) =>
    columns.map((column) => escapeCsvCell(row[column.key])).join(','),
  );
  return [headerLine, ...bodyLines].join('\r\n');
}
