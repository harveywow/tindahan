/**
 * @file Unique id generation.
 * Depends on: nothing.
 */

/**
 * Creates a unique id with a readable prefix (e.g. "prd_3f2a...").
 * Why prefixes: when debugging stored JSON, "sal_" vs "cus_" shows at a
 * glance which collection an id belongs to.
 * @param {string} prefix
 * @returns {string}
 */
export function generateId(prefix) {
  const randomPart = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 16)
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${randomPart}`;
}

/**
 * @param {Date} [date]
 * @returns {string} ISO timestamp, the format every record uses for createdAt.
 */
export function nowIso(date = new Date()) {
  return date.toISOString();
}
