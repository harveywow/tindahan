/**
 * @file Triggers a file download in the browser.
 * Depends on: nothing (browser only).
 */

/**
 * Saves text as a file using a temporary object URL.
 * @param {string} fileName
 * @param {string} content
 * @param {string} [mimeType]
 */
export function downloadTextFile(fileName, content, mimeType = 'text/plain') {
  // The BOM makes Excel open UTF-8 CSV correctly, so "₱" and "ñ" are not garbled.
  const bom = mimeType === 'text/csv' ? '﻿' : '';
  const blob = new Blob([bom + content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Reads a user-selected file as text.
 * @param {File} file
 * @returns {Promise<string>}
 */
export function readFileAsText(file) {
  return file.text();
}

/**
 * Reads a user-selected image as a data URL.
 * @param {File} file
 * @returns {Promise<string>}
 */
export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result)));
    reader.addEventListener('error', () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}
