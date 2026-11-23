/**
 * @file Minimal publish/subscribe channel.
 * Depends on: nothing.
 *
 * Why: when a sale is made, the header sign, dashboard and inventory all need
 * to refresh. Services emit one event instead of knowing about every view,
 * which keeps the business layer free of UI code.
 */

export class EventBus {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this.handlersByEvent = new Map();
  }

  /**
   * Subscribes to an event.
   * @param {string} eventName
   * @param {function(*): void} handler
   * @returns {function(): void} Call to unsubscribe (views do this when they unmount).
   */
  on(eventName, handler) {
    if (!this.handlersByEvent.has(eventName)) {
      this.handlersByEvent.set(eventName, new Set());
    }
    this.handlersByEvent.get(eventName).add(handler);
    return () => this.handlersByEvent.get(eventName)?.delete(handler);
  }

  /**
   * Notifies every subscriber. A failing handler is logged but does not stop the others.
   * @param {string} eventName
   * @param {*} [payload]
   */
  emit(eventName, payload) {
    this.handlersByEvent.get(eventName)?.forEach((handler) => {
      try {
        handler(payload);
      } catch (error) {
        console.error(`Handler for "${eventName}" failed`, error);
      }
    });
  }
}

/** Event names used across the app, collected so typos become import errors. */
export const EVENTS = Object.freeze({
  DATA_CHANGED: 'data:changed',
  DAY_CHANGED: 'day:changed',
  SETTINGS_CHANGED: 'settings:changed',
  LANGUAGE_CHANGED: 'language:changed',
});
