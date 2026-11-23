/**
 * @file Runs all tests in Node: `npm test` (or `node tests/run-node.js`).
 * Exits with code 1 when any test fails, so it can be used in CI.
 */
import './allTests.js';
import { runAll } from './testRunner.js';

const totals = await runAll(({ suiteName, testName, passed, skipped, error }) => {
  const mark = skipped ? '-' : passed ? '✓' : '✗';
  const suffix = skipped ? ' (browser only — run tests/index.html)' : '';
  console.log(`${mark} ${suiteName} › ${testName}${suffix}`);
  if (!passed) {
    console.log(`    ${error.message}`);
  }
});

console.log(`\n${totals.passed} passed, ${totals.failed} failed, ${totals.skipped} skipped`);
process.exitCode = totals.failed > 0 ? 1 : 0;
