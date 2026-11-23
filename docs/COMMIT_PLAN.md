# Commit Plan (Git)

The rubric gives full marks for a *clean history with frequent, atomic commits and clear messages*. The code is complete, but **do not upload it as one big commit**. Add it to the repository step by step using the plan below, spread across your working days, with each member committing the parts they worked on from their own computer and GitHub account.

## 1. One-time setup

```bash
git init
git branch -M main
git remote add origin https://github.com/<your-group>/tindahan.git
git checkout -b develop
```

Each member sets their own name so commits show who did what:

```bash
git config user.name "Your Name"
git config user.email "you@example.com"
```

## 2. Branches

```
main       ← only working, tested versions (merge from develop at milestones)
develop    ← integration branch
feature/*  ← one branch per phase/feature, e.g. feature/cashier
```

Flow for each phase:

```bash
git checkout develop && git pull
git checkout -b feature/cashier
# ...add the files of ONE commit...
git add js/services/Basket.js
git commit -m "feat(cashier): add basket with per-piece stock check"
# ...repeat for each commit of the phase...
git push -u origin feature/cashier
# open a Pull Request feature/cashier → develop on GitHub, review, merge
```

## 3. Message format (Conventional Commits)

```
<type>(<scope>): <what changed, imperative, ≤ 72 chars>

<optional body: WHY the change was made>
```

Types: `feat`, `fix`, `refactor`, `style`, `docs`, `test`, `chore`.
Avoid messages like "update", "fixed bugs" or "final".

## 4. Commits, phase by phase

Before each commit, run `npm test` and `npm run lint`.

### Phase 1 — Scaffold (`feature/scaffold`)
1. `chore: add package.json, .gitignore and .editorconfig` — `package.json`, `.gitignore`, `.editorconfig`
2. `chore: configure ESLint and Prettier` — `eslint.config.js`, `.prettierrc`
3. `feat(ui): add index.html shell and favicon` — `index.html`, `assets/favicon.svg`
4. `style: add design tokens and base styles` — `css/variables.css`, `css/base.css`
5. `style: add storefront header, grille nav and footer layout` — `css/layout.css`
6. `docs: add README skeleton with contributors` — `README.md`

### Phase 2 — Core (`feature/core`)
7. `feat(core): add app constants` — `js/config.js`
8. `feat(core): add typed AppError classes` — `js/core/AppError.js`
9. `feat(core): add Storage with quota and corruption handling` — `js/core/Storage.js`, `js/core/MemoryBackend.js`
10. `feat(core): add Map-based Repository with save rollback` — `js/core/Repository.js`
11. `feat(core): add EventBus, Router and injectable Clock` — `js/core/EventBus.js`, `js/core/Router.js`, `js/core/Clock.js`

### Phase 3 — Utilities and test runner (`feature/utils`)
12. `test: add dependency-free test runner` — `tests/testRunner.js`, `tests/run-node.js`, `tests/run-browser.js`, `tests/index.html`, `tests/test-page.css`, `tests/allTests.js`, `tests/helpers.js`
13. `feat(utils): add centavo money helpers and greedy change breakdown` — `js/utils/money.js`
14. `test(money): prove greedy change is optimal up to ₱2,000` — `tests/money.test.js`
15. `feat(utils): add input validators` — `js/utils/validators.js`
16. `feat(utils): add local date-key helpers` — `js/utils/dates.js`
17. `feat(utils): add ids, debounce, CSV with formula escaping, downloads` — `js/utils/ids.js`, `js/utils/debounce.js`, `js/utils/csv.js`, `js/utils/download.js`
18. `feat(i18n): add English/Filipino strings and translator` — `js/i18n/strings.js`, `js/utils/i18n.js`
19. `feat(utils): add XSS-safe DOM builder` — `js/utils/dom.js`
20. `test(utils): cover validators, dates, CSV, i18n and DOM` — `tests/utils.test.js`, `tests/storage.test.js`

### Phase 4 — Paninda (`feature/inventory`)
21. `feat(models): add Product model with tingi pricing` — `js/models/Product.js`
22. `feat(models): add StockAdjustment and LogEntry models` — `js/models/StockAdjustment.js`, `js/models/LogEntry.js`
23. `feat(log): add activity log service` — `js/services/LogService.js`, `js/services/BaseService.js`
24. `feat(settings): add settings service` — `js/services/SettingsService.js`
25. `feat(inventory): add products, categories and stock adjustments` — `js/services/InventoryService.js`
26. `test(inventory): cover duplicates, below-cost, archive and pack size` — `tests/inventory.test.js`
27. `feat(ui): add form fields, modal, toast, dialogs and icons` — `js/ui/components/FormField.js`, `Modal.js`, `Toast.js`, `dialogs.js`, `icons.js`, `viewHelpers.js`, `EmptyState.js`, `format.js`
28. `style: add buttons, stamps, price tags and panels` — `css/components.css`
29. `feat(inventory): add Paninda screen` — `js/ui/views/BaseView.js`, `js/ui/views/InventoryView.js`

### Phase 5 — Bukas (`feature/open-day`)
30. `feat(models): add DayRecord model` — `js/models/DayRecord.js`
31. `feat(day): open the store day with opening cash` — `js/services/DayService.js`
32. `feat(ui): add app shell with flipping BUKAS/SARADO sign` — `js/ui/AppShell.js`, `js/ui/errorHandler.js`, `js/main.js`, `js/app/createApp.js`
33. `feat(dashboard): add Bukas screen with today's stats and alerts` — `js/ui/views/DashboardView.js`

### Phase 6 — Tinda (`feature/cashier`)
34. `feat(models): add Sale and SaleItem with price snapshots` — `js/models/Sale.js`, `js/models/SaleItem.js`
35. `feat(cashier): add basket with per-piece stock check` — `js/services/Basket.js`
36. `feat(sales): add checkout with payment validation and double-submit guard` — `js/services/SalesService.js`
37. `test(sales): cover stock, cash, GCash, closed day and midnight sales` — `tests/sales.test.js`
38. `feat(cashier): add shelf, supot and sukli preview` — `js/ui/views/CashierView.js`, `js/ui/components/MoneyChips.js`
    *(later: `fix(ui): skip null children so "null" is never shown` — `js/utils/dom.js`, `CashierView.js`, `ClosingView.js`)*
39. `style(cashier): draw window grille, wooden shelves and paper bag` — `css/views.css` (cashier section)

### Phase 7 — Receipts and Benta (`feature/history`)
40. `feat(receipt): add thermal receipt and print support` — `js/ui/components/ReceiptRenderer.js`, `js/ui/components/print.js`, `css/print.css`
41. `feat(sales): void sales, restoring stock and reversing utang` — `js/services/SalesService.js`
42. `feat(history): add Benta screen with filters and void` — `js/ui/views/SalesHistoryView.js`

### Phase 8 — Listahan (`feature/credit`)
43. `feat(models): add Customer and CreditEntry models` — `js/models/Customer.js`, `js/models/CreditEntry.js`
44. `feat(credit): add suki, credit limits and FIFO overdue` — `js/services/CreditService.js`
45. `test(credit): cover limits, payments, removal and overdue` — `tests/credit.test.js`
46. `feat(credit): add utang notebook screen` — `js/ui/views/CreditView.js`
47. `style(credit): draw lined notebook with hand strikethrough` — `css/components.css`, `css/views.css`

### Phase 9 — Pamilihan and Gastos (`feature/restock-expenses`)
48. `feat(models): add RestockItem and Expense models` — `js/models/RestockItem.js`, `js/models/Expense.js`
49. `feat(restock): suggest quantities from last 7 days of sales` — `js/services/RestockService.js`
50. `feat(expenses): record cash taken from the drawer` — `js/services/ExpenseService.js`
51. `feat(ui): add Pamilihan and Gastos screens` — `js/ui/views/RestockView.js`, `js/ui/views/ExpensesView.js`

### Phase 10 — Sara (`feature/closing`)
52. `feat(closing): compute expected cash and close the day` — `js/services/ClosingService.js`
53. `test: cover expenses, restock and closing` — `tests/operations.test.js`
54. `feat(closing): add cash count screen with TAMA/SOBRA/KULANG` — `js/ui/views/ClosingView.js`

### Phase 11 — Ulat (`feature/reports`)
55. `feat(reports): add single-pass series, rankings and CSV export` — `js/services/ReportService.js`
56. `feat(reports): add canvas bar and line chart` — `js/ui/components/ChartRenderer.js`
57. `feat(reports): add Ulat screen` — `js/ui/views/ReportsView.js`

### Phase 12 — Ayos, backup, demo, log, about (`feature/settings`)
58. `feat(auth): add salted SHA-256 owner PIN` — `js/services/AuthService.js`
59. `feat(backup): add schema-validated backup, restore and reset` — `js/services/BackupService.js`
60. `feat(demo): generate 30 days of demo data through real services` — `js/services/DemoDataService.js`, `js/services/demoCatalog.js`
61. `test: cover reports, backup, demo data, PIN and settings` — `tests/data.test.js`
62. `feat(ui): add Ayos, Talaan and Tungkol screens` — `js/ui/views/SettingsView.js`, `js/ui/views/ActivityLogView.js`, `js/ui/views/AboutView.js`

### Phase 13 — Polish (`feature/polish`)
Use this phase for your own improvements after testing on real phones and laptops. Commit each one separately, for example:
- `fix(a11y): …`, `style(mobile): …`, `feat(i18n): …`, `fix(cashier): …`

Fixes found while rechecking (commit them here, one each):
- `fix(settings): keep PIN error visible instead of redrawing on failure` — `js/ui/views/SettingsView.js`
- `fix(modal): ignore the second click of a double-clicked Bayad` — `js/ui/components/Modal.js`
- `fix(cashier): make "Empty the supot" always empty the basket` — `js/ui/views/CashierView.js`
- `style(mobile): two products per shelf row and one-line notebook entries` — `css/views.css`

### Phase 14 — Final (`release/1.0`)
63. `docs: add architecture, user guide, test plan and simulation guide` — `docs/*.md`
64. `docs: complete README` — `README.md`
65. `chore: release v1.0.0` — merge `develop` → `main`, then `git tag v1.0.0`

> **Note:** the code is already finished, so a few early commits import files that are only added in later phases (for example, `tests/helpers.js` uses `createApp.js`). The full app and `npm test` run once Phase 12 is committed. Run them at the end of every phase from then on.
