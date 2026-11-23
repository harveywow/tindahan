/**
 * @file Base class for every screen: mounting, re-rendering on data
 * changes, and consistent error handling.
 * Depends on: core/AppError.js, core/EventBus.js, utils/dom.js, utils/i18n.js, ui/components/FormField.js.
 */
import { AppError } from '../../core/AppError.js';
import { EVENTS } from '../../core/EventBus.js';
import { el } from '../../utils/dom.js';
import { t } from '../../utils/i18n.js';
import { showFormError } from '../components/FormField.js';
import { button } from '../components/viewHelpers.js';

export class BaseView {
  /**
   * @param {Object} context - { services, bus, toast, router, basket, clock }
   */
  constructor(context) {
    this.context = context;
    this.services = context.services;
    this.toast = context.toast;
    this.root = null;
    this.unsubscribers = [];
    this.isRenderScheduled = false;
  }

  /**
   * Shows the view inside a container and starts listening for changes.
   * @param {HTMLElement} root
   */
  mount(root) {
    this.root = root;
    [EVENTS.DATA_CHANGED, EVENTS.DAY_CHANGED, EVENTS.SETTINGS_CHANGED].forEach((eventName) => {
      this.unsubscribers.push(this.context.bus.on(eventName, () => this.scheduleRender()));
    });
    this.onMount();
    this.render();
  }

  /** Stops listening. Subclasses clean up timers/observers in onUnmount(). */
  unmount() {
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
    this.unsubscribers = [];
    this.onUnmount();
  }

  /** Hook for subclasses. */
  onMount() {}

  /** Hook for subclasses. */
  onUnmount() {}

  /**
   * One action can emit several events (e.g. open day emits DAY and DATA);
   * batching them into one render per tick avoids redrawing three times.
   */
  scheduleRender() {
    if (this.isRenderScheduled) {
      return;
    }
    this.isRenderScheduled = true;
    queueMicrotask(() => {
      this.isRenderScheduled = false;
      if (this.root) {
        this.render();
      }
    });
  }

  /** Replaces the view's content with a fresh build(). */
  render() {
    // build() may return null for optional sections; those are skipped.
    this.root.replaceChildren(...this.build().filter(Boolean));
  }

  /**
   * @abstract
   * @returns {Node[]}
   */
  build() {
    return [];
  }

  /**
   * Runs a user action and shows its error inline (form) or as a toast.
   * Unexpected errors (bugs) are re-thrown to the global error handler.
   * @param {function(): *} action
   * @param {{form?: HTMLElement, successMessage?: string}} [options]
   * @returns {Promise<*>} The action's result, or undefined when it failed.
   */
  async runAction(action, { form = null, successMessage = '' } = {}) {
    try {
      const result = await action();
      if (successMessage) {
        this.toast.show(successMessage, 'success');
      }
      return result;
    } catch (error) {
      this.showError(error, form);
      return undefined;
    }
  }

  /**
   * @param {Error} error
   * @param {HTMLElement|null} form
   */
  showError(error, form) {
    if (form && showFormError(form, error)) {
      return;
    }
    if (error instanceof AppError) {
      this.toast.show(t(error.messageKey, error.params), 'error');
      return;
    }
    throw error;
  }

  /**
   * Standard page heading.
   * @param {string} title
   * @param {string} subtitle
   * @param {HTMLElement[]} [actions]
   * @returns {HTMLElement}
   */
  pageHeader(title, subtitle, actions = []) {
    return el('header', { className: 'page-header' }, [
      el('div', {}, [
        el('h2', { className: 'page-header__title', text: title }),
        el('p', { className: 'page-header__subtitle', text: subtitle }),
      ]),
      actions.length ? el('div', { className: 'page-header__actions' }, actions) : null,
    ]);
  }

  /**
   * "Show more" for long lists. Views that use it keep this.visibleCount;
   * rendering only one page at a time keeps screens fast with months of data.
   * @param {number} totalCount
   * @param {number} pageSize
   * @returns {HTMLElement|null} Null when everything is already shown.
   */
  showMoreButton(totalCount, pageSize) {
    const remaining = totalCount - this.visibleCount;
    if (remaining <= 0) {
      return null;
    }
    return button({
      label: t('history.showMore', { count: remaining }),
      variant: 'ghost',
      onClick: () => {
        this.visibleCount += pageSize;
        this.render();
      },
    });
  }

  /**
   * @param {string} route
   */
  navigate(route) {
    this.context.router.navigate(route);
  }
}
