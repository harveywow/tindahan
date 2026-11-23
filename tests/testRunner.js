/**
 * @file A tiny test framework (describe / it / expect) written for this
 * project so tests need no external libraries. Works in the browser
 * (tests/index.html) and in Node (tests/run-node.js).
 * Depends on: nothing.
 */

/** @type {Array<{suiteName: string, testName: string, run: Function, isSkipped?: boolean}>} */
const registeredTests = [];
let currentSuiteName = '';

/**
 * Groups related tests.
 * @param {string} suiteName
 * @param {function(): void} defineTests
 */
export function describe(suiteName, defineTests) {
  const previousSuite = currentSuiteName;
  currentSuiteName = previousSuite ? `${previousSuite} › ${suiteName}` : suiteName;
  defineTests();
  currentSuiteName = previousSuite;
}

/**
 * Registers one test. The body may be async.
 * @param {string} testName
 * @param {function(): (void|Promise<void>)} run
 */
export function it(testName, run) {
  registeredTests.push({ suiteName: currentSuiteName, testName, run });
}

/**
 * Registers a test that needs a real DOM (document). In Node it is reported
 * as skipped instead of silently passing.
 * @param {string} testName
 * @param {function(): (void|Promise<void>)} run
 */
export function itInBrowser(testName, run) {
  const isSkipped = typeof globalThis.document === 'undefined';
  registeredTests.push({ suiteName: currentSuiteName, testName, run, isSkipped });
}

/**
 * Deep equality for plain data (objects, arrays, primitives).
 * @param {*} actual
 * @param {*} expected
 * @returns {boolean}
 */
function deepEqual(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

/**
 * @param {Error} error
 * @param {Function} [ErrorClass]
 * @param {string} [messageKey]
 * @returns {string} '' when the error matches, otherwise why not.
 */
function describeMismatch(error, ErrorClass, messageKey) {
  if (ErrorClass && !(error instanceof ErrorClass)) {
    return `expected ${ErrorClass.name} but got ${error?.name}: ${error?.message}`;
  }
  if (messageKey && error.messageKey !== messageKey) {
    return `expected message "${messageKey}" but got "${error.messageKey}"`;
  }
  return '';
}

/**
 * Assertions.
 * @param {*} actual
 * @returns {Object} Matchers.
 */
export function expect(actual) {
  const fail = (message) => {
    throw new Error(message);
  };
  return {
    toBe: (expected) =>
      Object.is(actual, expected) || fail(`expected ${String(expected)} but got ${String(actual)}`),
    toEqual: (expected) =>
      deepEqual(actual, expected) ||
      fail(`expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`),
    toBeTruthy: () => Boolean(actual) || fail(`expected truthy but got ${String(actual)}`),
    toBeFalsy: () => !actual || fail(`expected falsy but got ${String(actual)}`),
    toBeGreaterThan: (limit) => actual > limit || fail(`expected ${actual} > ${limit}`),
    toContain: (item) =>
      actual.includes(item) || fail(`expected ${JSON.stringify(actual)} to contain ${item}`),
    toHaveLength: (length) =>
      actual.length === length || fail(`expected length ${length} but got ${actual.length}`),
    /**
     * @param {Function} [ErrorClass]
     * @param {string} [messageKey] - Expected AppError.messageKey.
     */
    toThrow: (ErrorClass, messageKey) => {
      try {
        actual();
      } catch (error) {
        const mismatch = describeMismatch(error, ErrorClass, messageKey);
        return mismatch ? fail(mismatch) : true;
      }
      return fail('expected function to throw');
    },
    /**
     * For promises: await expect(promise).toReject(ErrorClass, key)
     * @param {Function} [ErrorClass]
     * @param {string} [messageKey]
     */
    toReject: async (ErrorClass, messageKey) => {
      try {
        await actual;
      } catch (error) {
        const mismatch = describeMismatch(error, ErrorClass, messageKey);
        return mismatch ? fail(mismatch) : true;
      }
      return fail('expected promise to reject');
    },
  };
}

/**
 * Runs every registered test in order.
 * @param {function({suiteName:string, testName:string, passed:boolean, skipped?:boolean, error?:Error}): void} report
 * @returns {Promise<{passed:number, failed:number, skipped:number}>}
 */
export async function runAll(report) {
  const totals = { passed: 0, failed: 0, skipped: 0 };
  for (const test of registeredTests) {
    if (test.isSkipped) {
      totals.skipped += 1;
      report({ suiteName: test.suiteName, testName: test.testName, passed: true, skipped: true });
      continue;
    }
    try {
      await test.run();
      totals.passed += 1;
      report({ suiteName: test.suiteName, testName: test.testName, passed: true });
    } catch (error) {
      totals.failed += 1;
      report({ suiteName: test.suiteName, testName: test.testName, passed: false, error });
    }
  }
  return totals;
}
