/**
 * @file Runs all tests in the browser and lists the results on tests/index.html.
 * Browser-only tests (DOM / XSS) run here too.
 */
import './allTests.js';
import { runAll } from './testRunner.js';

const resultsList = document.getElementById('test-results');
const summary = document.getElementById('test-summary');

const totals = await runAll(({ suiteName, testName, passed, error }) => {
  const item = document.createElement('li');
  item.className = passed ? 'test-page__pass' : 'test-page__fail';
  item.textContent = `${passed ? '✓' : '✗'} ${suiteName} › ${testName}${passed ? '' : ` — ${error.message}`}`;
  resultsList.append(item);
});

summary.textContent = `${totals.passed} passed, ${totals.failed} failed`;
summary.classList.add(totals.failed > 0 ? 'test-page__fail' : 'test-page__pass');
document.body.dataset.testsDone = 'true';
