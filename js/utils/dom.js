/**
 * @file Safe DOM building helpers.
 * Depends on: nothing.
 *
 * Why not innerHTML: product and customer names are typed by users. Inserting
 * them as HTML would let a name like <img src=x onerror=...> run script (XSS).
 * el() always sets text through textContent, so user text is never parsed as HTML.
 */

/**
 * @typedef {Object} ElementOptions
 * @property {string} [className]
 * @property {string|number} [text] - Set via textContent (safe for user input).
 * @property {Object<string, (string|number|boolean)>} [attrs] - false/null attributes are skipped.
 * @property {Object<string, string>} [dataset]
 * @property {Object<string, Function>} [on] - Event listeners.
 */

/**
 * Creates an element.
 * @param {string} tagName
 * @param {ElementOptions} [options]
 * @param {Array<Node|string|null|false>} [children] - Strings become text nodes; falsy entries are skipped.
 * @returns {HTMLElement}
 * @example el('button', { className: 'btn', text: 'Bayad', on: { click: pay } })
 */
export function el(tagName, options = {}, children = []) {
  const element = document.createElement(tagName);
  applyOptions(element, options);
  appendChildren(element, children);
  return element;
}

/**
 * @param {HTMLElement} element
 * @param {ElementOptions} options
 */
function applyOptions(element, { className, text, attrs = {}, dataset = {}, on = {} }) {
  if (className) {
    element.className = className;
  }
  if (text !== undefined && text !== null) {
    element.textContent = String(text);
  }
  Object.entries(attrs).forEach(([name, value]) => {
    if (value === true) {
      element.setAttribute(name, '');
    } else if (value !== false && value !== null && value !== undefined) {
      element.setAttribute(name, String(value));
    }
  });
  Object.assign(element.dataset, dataset);
  Object.entries(on).forEach(([eventName, handler]) =>
    element.addEventListener(eventName, handler),
  );
}

/**
 * @param {HTMLElement} element
 * @param {Array<Node|string|null|false>} children
 */
export function appendChildren(element, children) {
  children.forEach((child) => {
    if (child === null || child === undefined || child === false) {
      return;
    }
    element.append(typeof child === 'string' ? document.createTextNode(child) : child);
  });
}

/**
 * Replaces a node's children, skipping null/false entries. Why not the
 * built-in replaceChildren(): it turns null into the text "null", and many
 * builders return null for optional parts.
 * @param {HTMLElement} element
 * @param {...(Node|string|null|false)} children
 */
export function setChildren(element, ...children) {
  element.replaceChildren();
  appendChildren(element, children);
}

/**
 * Removes all children of a node.
 * @param {HTMLElement} element
 */
export function clearElement(element) {
  element.replaceChildren();
}

/**
 * Parses a trusted, hard-coded SVG string written by the developers.
 * Only used for icons in ui/components/icons.js — never for user text.
 * @param {string} svgMarkup
 * @returns {SVGElement}
 */
export function createSvgFromTrustedMarkup(svgMarkup) {
  const template = document.createElement('template');
  template.innerHTML = svgMarkup.trim();
  return template.content.firstElementChild;
}

/**
 * Reads all named fields of a form into a plain object.
 * @param {HTMLFormElement} form
 * @returns {Object<string, string>}
 */
export function readForm(form) {
  const values = {};
  new FormData(form).forEach((value, name) => {
    values[name] = typeof value === 'string' ? value : '';
  });
  form.querySelectorAll('input[type="checkbox"][name]').forEach((checkbox) => {
    values[checkbox.name] = checkbox.checked;
  });
  return values;
}
