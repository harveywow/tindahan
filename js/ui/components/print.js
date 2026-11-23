/**
 * @file Prints a single element (receipt, restock list, day summary).
 * Depends on: nothing (browser only).
 *
 * Why copy into #print-root: print.css hides the whole app while printing and
 * shows only this container, so the printout contains just the receipt
 * instead of the navigation and buttons.
 */

/**
 * @param {HTMLElement} element
 */
export function printElement(element) {
  const printRoot = document.getElementById('print-root');
  printRoot.replaceChildren(element.cloneNode(true));
  document.body.classList.add('is-printing');
  const cleanUp = () => {
    document.body.classList.remove('is-printing');
    printRoot.replaceChildren();
    window.removeEventListener('afterprint', cleanUp);
  };
  window.addEventListener('afterprint', cleanUp);
  window.print();
}
