# Tindahan — Sari-Sari Store Management System

A complete management system for a Filipino sari-sari store, built with **vanilla HTML, CSS and JavaScript (ES modules)**. There are no frameworks, no libraries and no backend. All data is saved in the browser with `localStorage`.

The system follows a real store day:

**Bukas (open) → Tinda (sell) → Listahan (utang) → Sara (close)**

It is designed for someone like *Aling Nena*, who runs a store from the front window of her house, sells shampoo by the sachet, and keeps a notebook of who owes her money.

---

## Screenshots

| Tinda (cashier) | Sukli + receipt |
|---|---|
| ![Tinda](docs/screenshots/tinda.png) | ![Sukli and receipt](docs/screenshots/sukli-receipt.png) |
| **Listahan (utang notebook)** | **Sara (cash count)** |
| ![Listahan](docs/screenshots/listahan.png) | ![Sara](docs/screenshots/sara.png) |
| **Bukas (dashboard)** | **Ulat (reports)** |
| ![Bukas](docs/screenshots/bukas.png) | ![Ulat](docs/screenshots/ulat.png) |

*Screenshots were taken offline, so they show fallback fonts. With internet, the signboard uses the hand-painted Bungee font and the notebook uses Kalam.*

---

## Features

| Screen | What it does |
|---|---|
| **Bukas** | Open the day with the starting cash. Shows today's sales, profit (kita), utang, cash expected in the drawer, low stock, expiring items and overdue suki. |
| **Tinda** | Cashier screen. Products sit on wooden shelves behind the window grille. Sell by **pack or by piece (tingi)**. Pay with cash, GCash or **Ilista (utang)**. Shows exactly which **bills and coins to give as sukli**, then prints a thermal-style receipt. Keyboard: `/` search, `Enter` pay, `Esc` clear. |
| **Paninda** | Products with prices, puhunan (cost), margin, stock shown as *"3 packs + 5 pcs"*, reorder levels, expiry dates and pictures (click a picture to see it large). Includes stock adjustments with a reason, categories, and archive instead of delete. |
| **Listahan** | Suki list and a lined **utang notebook** per customer, with a running balance. Paid lines are struck through by hand (FIFO), with credit limits, owner PIN override, overdue warnings and a ranking of the biggest balances. |
| **Benta** | Sales history with filters, receipt reprint, and **void/refund** (stock is restored and utang reversed). |
| **Pamilihan** | Shopping list for restocking. Suggests quantities from the last 7 days of sales and supports a check-off "received" flow that updates stock and cost. |
| **Gastos** | Cash taken out of the drawer: expenses, owner withdrawals and restock payments. |
| **Sara** | End-of-day **cash count by denomination** compared with the expected cash, giving **TAMA / SOBRA / KULANG**. A note is required when it doesn't match. Prints a daily summary. |
| **Ulat** | Daily, weekly and monthly charts drawn with the Canvas API, top sellers, slow movers, category and payment breakdowns, and CSV exports. |
| **Talaan** | Read-only activity log of every important action. |
| **Ayos** | Store settings, English/Filipino, owner PIN, JSON backup and restore, demo data, and reset. |
| **Tungkol** | About the project and its contributors. |

Every screen ends with the same footer: the store name, today's date with an OPEN/CLOSED badge, quick links, the group members, a backup reminder and a *Back to top* button. It always sits at the bottom of the window, even on short screens.

### Languages

Switch with **EN / FIL** at the top right. Each language is complete on its own, and every menu name matches its page title:

| Filipino | English |
|---|---|
| Bukas | Dashboard |
| Tinda · Supot · Sukli | Sell · Basket · Change |
| Paninda · Puhunan · Tingi | Products · Cost · By the piece |
| Listahan ng Utang · Suki · Utang | Credit Notebook · Customer · Credit |
| Benta | Sales |
| Pamilihan | Restock |
| Gastos | Expenses |
| Sara · TAMA / SOBRA / KULANG | Close Store · EXACT / OVER / SHORT |
| Ulat | Reports |
| Talaan | Activity Log |
| Ayos | Settings |
| Tungkol | About |

`tests/i18n.test.js` fails if a Filipino word slips into the English text or a menu name stops matching its page.

---

## How to run

The app uses ES modules, so it must be opened through a local web server, not by double-clicking `index.html`.

**Option A: VS Code Live Server (easiest)**
1. Open the `tindahan` folder in VS Code.
2. Install the **Live Server** extension.
3. Right-click `index.html` and choose **Open with Live Server**.

**Option B: Node.js**
```bash
npx http-server . -p 5500 -c-1
# then open http://localhost:5500
```

**First time?** Go to **Ayos → Load demo data** to fill the store with 30 days of sample sales, suki and utang. Then go to **Bukas** and open the store.

---

## Simulating every feature

Follow **[docs/SIMULATION.md](docs/SIMULATION.md)**: one full store day with exact inputs and the expected results for every screen and all 18 edge cases. Use it to test the system and to rehearse the demo.

## How to run the tests

There are **132 automated tests** written with a tiny test runner we made ourselves (`tests/testRunner.js`), so no libraries are needed.

- **In the browser:** open `http://localhost:5500/tests/index.html`. This runs every test, including the DOM/XSS tests.
- **In the terminal:**
  ```bash
  npm test        # or: node tests/run-node.js
  ```
  Two DOM-only tests are marked "browser only" when run in Node.

Each of the 18 required edge cases is labelled `[EC1]`–`[EC18]` in the test names. The full mapping is in [docs/TEST_PLAN.md](docs/TEST_PLAN.md).

## How to lint and format

```bash
npm install          # installs ESLint and Prettier (dev only)
npm run lint         # ESLint — must show 0 errors, 0 warnings
npm run format:check # Prettier — checks formatting
npm run format       # Prettier — fixes formatting
```

---

## Folder structure

```
tindahan/
├── index.html            App shell (header, nav, main, footer)
├── css/                  variables → base → layout → components → views → print
├── js/
│   ├── main.js           Entry point: routes → views
│   ├── config.js         All constants (denominations, limits, defaults, contributors)
│   ├── app/createApp.js  Builds storage, repositories and services (dependency injection)
│   ├── core/             Storage, Repository, EventBus, Router, Clock, AppError
│   ├── models/           Product, Sale, SaleItem, Customer, CreditEntry, Expense, ...
│   ├── services/         Business logic (no DOM): Inventory, Sales, Credit, Closing, ...
│   ├── ui/               AppShell, views (one per screen) and components
│   ├── i18n/strings.js   Every English and Filipino label
│   └── utils/            money, validators, dates, i18n, dom, csv, ids, debounce
├── tests/                Test runner, 9 test suites, browser + Node runners
└── docs/                 ARCHITECTURE, USER_GUIDE, TEST_PLAN, COMMIT_PLAN
```

The architecture is explained in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Code style

- Language standard: ES2022 modules, `'use strict'` semantics by default.
- **ESLint** (`eslint.config.js`): `eslint:recommended` plus `eqeqeq`, `no-var`, `prefer-const`, `camelcase`, `curly`, `max-lines-per-function: 40`, `complexity: 10`, `max-params: 4`, `semi`, `quotes: single`.
- **Prettier** (`.prettierrc`): 2 spaces, single quotes, semicolons, 100-character lines.
- Names: `camelCase` functions and variables, `PascalCase` classes, `UPPER_SNAKE_CASE` constants, verbs for functions (`calculateChangeBreakdown`), `is/has/can` for booleans.
- CSS: BEM class names (`.shelf__item--out`), every color and font comes from `css/variables.css`, and there are no `!important` rules.
- Every function has JSDoc (`@param`, `@returns`, `@throws`, `@example` where useful). Comments explain **why**, not what.

---

## Git workflow

We use **Conventional Commits** and small, atomic commits. See [docs/COMMIT_PLAN.md](docs/COMMIT_PLAN.md) for the branch strategy and the commit-by-commit plan.

```
main      ← always working, tagged releases
develop   ← integration branch
feature/* ← one branch per feature, merged into develop by pull request
```

Example messages: `feat(credit): block sales that exceed credit limit`, `fix(cashier): clear basket after checkout`, `test(money): prove greedy change is optimal`.

---

## Contributors

- HERNANDEZ, Harvey Daniel T. (Leader)
- BARRIETA, Raychel G.
- LITABAN, Winfred Mikhail S.
- TANTING, Sherreh Mah S.
- TURADO, Jimwel R.

---

## Known limitations

- Data lives in **one browser on one device**. Clearing browser data erases it, so download a backup from **Ayos** regularly.
- `localStorage` holds about 5 MB. Product pictures are limited to 200 KB each for this reason.
- The owner PIN keeps helpers from making casual changes. It is not real security, because anyone with browser developer tools can edit `localStorage`.
- Fonts load from Google Fonts. Offline, the app falls back to system fonts.
- Only one store day can be open at a time. A day left open must be closed before the next one is opened.

## Future work

- Sync between devices (would need a backend).
- Barcode scanning through the camera.
- SMS reminders for overdue utang.
- Supplier list with price history.
