# Test Plan

Every edge case required by the project is handled in code **and** covered by at least one automated test. Test names carry the tag `[ECn]`, so a search for `[EC5]` in `tests/` finds them.

## How to run

- Browser: open `tests/index.html` through the local server (runs all 137 tests, including DOM/XSS).
- Terminal: `npm test` (135 run in Node; 2 DOM tests are marked *browser only*).

## Result

Last run: **137 passed, 0 failed** (browser) · **135 passed, 0 failed, 2 skipped** (Node).

## Edge cases → tests

| # | Edge case | How it is handled | Tests |
|---|---|---|---|
| 1 | Empty / whitespace-only text; names over max length | `requireText` trims and rejects blanks; max 60 characters. | `money › parsePesoToCentavos › rejects empty and whitespace input`<br>`validators › trims text and rejects whitespace-only`<br>`validators › rejects names over the maximum length`<br>`InventoryService › adding products › rejects a blank name`<br>`SalesService.voidSale › requires a reason`<br>`CreditService › validates customer fields`<br>`ExpenseService ›  validates description, amount and type` |
| 2 | Negative, zero, non-numeric, NaN, Infinity, huge numbers | `parsePesoToCentavos` accepts only digits with ≤2 decimals; `requireInteger` checks range; money max ₱100,000. | `money › parsePesoToCentavos › rejects negative, non-numeric, NaN and Infinity`<br>`money › parsePesoToCentavos › rejects absurdly large amounts`<br>`validators › rejects zero money unless allowed`<br>`validators › rejects out-of-range integers`<br>`InventoryService › adding products › rejects a negative price`<br>`DayService › rejects invalid opening cash`<br>`ExpenseService ›  validates description, amount and type`<br>`ClosingService ›  rejects negative or decimal piece counts` |
| 3 | Decimal quantities for whole-unit items | `requireInteger` rejects `1.5`; used for quantities, stock and cash counts. | `validators › rejects decimal quantities for whole items`<br>`InventoryService › adding products › rejects decimal stock`<br>`Basket › rejects decimal quantities and removes lines set to 0`<br>`RestockService › manual items need a whole-number quantity`<br>`ClosingService ›  rejects negative or decimal piece counts` |
| 4 | Selling price lower than cost | `isPricedBelowCost` (pack and tingi) → `priceBelowCost` error → confirm dialog → save with `confirmBelowCost`. | `InventoryService › adding products › warns when price is below cost, and allows it after confirmation`<br>`InventoryService › adding products › also catches tingi prices that lose money when the whole pack is sold per piece` |
| 5 | Selling more than stock, incl. tingi pack↔piece | Basket counts pieces across pack and piece lines; checkout re-checks with fresh data; adjustments can't go below 0. | `InventoryService › stock changes › cannot remove more stock than exists`<br>`Basket › limits a product to its stock across pack and piece lines`<br>`SalesService.checkout › re-checks stock at checkout using fresh data` |
| 6 | Cash less than total; missing GCash reference | `validatePayment` in SalesService; 13-digit GCash reference validator. | `validators › validates 13-digit GCash references`<br>`SalesService.checkout › rejects cash lower than the total`<br>`SalesService.checkout › requires a GCash reference for GCash payments` |
| 7 | Duplicate product/customer names (case/space-insensitive) | `normalizeName` comparison in Inventory, Credit and category services. | `validators › normalizes names for duplicate detection`<br>`InventoryService › adding products › rejects duplicate names regardless of case and spacing`<br>`InventoryService › editing and removing › rejects duplicate categories`<br>`CreditService › rejects duplicate customer names` |
| 8 | Credit limit exceeded; payment > balance; payment of 0 | `assertCanCharge` (PIN override), `recordPayment` checks balance and > 0. | `CreditService › blocks a sale above the credit limit, unless overridden by the owner`<br>`CreditService › rejects a payment larger than the balance, and a payment of 0` |
| 9 | Deleting products with history / customers with balance / categories in use | Products archived; customers blocked while owing (archived if history); categories in use blocked. | `InventoryService › editing and removing › deletes unsold products but ARCHIVES products with sales history`<br>`InventoryService › editing and removing › blocks deleting a category that is still in use`<br>`CreditService › blocks removing a customer with a balance; archives one with history` |
| 10 | Selling before the day is opened / after it is closed | `DayService.assertOpen()` guards sales, payments and expenses. | `SalesService.checkout › cannot sell before the day is opened`<br>`SalesService.checkout › cannot sell after the day is closed`<br>`ExpenseService › needs an open day` |
| 11 | Voiding twice; restocking archived products | `alreadyVoided` and `productArchived` conflicts. | `InventoryService › stock changes › refuses to restock an archived product`<br>`SalesService.voidSale › cannot void the same sale twice` |
| 12 | Corrupted, missing or old-version localStorage data | `Storage.read` falls back and reports keys; `Repository.load` ignores bad shapes; `migrate()` runs version upgrades. | `Storage › returns the fallback for missing data`<br>`Storage › recovers from corrupted JSON and reports which key`<br>`Storage › a repository ignores stored data that is not a list of records`<br>`Storage › runs migrations for old-version data` |
| 13 | localStorage quota exceeded | `StorageQuotaError` with friendly message; Repository rolls back the in-memory change. | `Storage › turns a browser quota error into StorageQuotaError`<br>`Storage › keeps memory and storage in sync when a save fails` |
| 14 | Invalid / malicious backup JSON | `BackupService.validateBackup` checks app signature, version, every record's field types, duplicate ids, unknown sections; nothing is written unless valid. | `BackupService › rejects text that is not JSON`<br>`BackupService › rejects files from other apps, unknown sections and bad records`<br>`BackupService › leaves current data untouched when a restore is rejected` |
| 15 | XSS | `el()` uses `textContent`; icons are the only parsed markup (hard-coded). CSV cells starting with `= + - @` are escaped. | `csv › neutralizes spreadsheet formula injection`<br>`dom › renders user text as text, never as HTML (browser only — run tests/index.html)` |
| 16 | Floating-point money | All money is integer centavos; parsing splits on the decimal point; line costs rounded once per line. | `money › parsePesoToCentavos › avoids floating-point error (1.15 × 100 is 114.999… in floats)`<br>`SalesService.checkout › computes tingi cost per line without fractional centavos` |
| 17 | Date edges: midnight, empty ranges, start > end | Local date keys; sales use the open day's key; `validateDateRange`. | `dates › uses the LOCAL date, so a late-night sale stays on the same day`<br>`dates › rejects a start date after the end date`<br>`dates › treats empty range bounds as unbounded`<br>`SalesService.checkout › a sale after midnight belongs to the still-open store day`<br>`SalesService.voidSale › rejects history filters where start is after end` |
| 18 | Rapid double-clicks on Pay | Button disabled while processing + one-time checkout token rejected by SalesService. | `SalesService.checkout › a double-clicked checkout cannot create two sales` |

Also: a global error handler (`window.onerror` + `unhandledrejection`) shows a friendly message for anything unexpected.

## Other tests

Besides the edge cases, the suites also cover:

- **money**: formatting, change breakdown, and a proof that the greedy algorithm is optimal for every amount up to ₱2,000 (checked against dynamic programming).
- **sales**: stock deduction, change, receipt numbers, voiding, and midnight sales.
- **credit**: running balance, FIFO overdue calculation, and reversal on void.
- **closing**: expected-cash formula, voided sales excluded, and the note required when the count doesn't match.
- **restock**: suggestion formula (fast and slow sellers, tingi rounding) and the receive flow.
- **reports**: daily/weekly/monthly buckets, net profit rules, and CSV.
- **backup**: round trip, rejection leaves data untouched, and the PIN is never exported.
- **demo data**: 30 consistent closed days with no negative stock.
- **auth**: PIN hashing (never stored in plain text), format, and change/remove needing the current PIN.
- **reopening today**: selling continues on the same day, the earlier count is kept and logged, the next closing expects every sale of the day, and only a closed today can be reopened.
- **translations**: same keys in both languages, no Filipino words in the English UI, every menu name matching its page title, and no empty text.

## Full list (Node run)

```
✓ money › parsePesoToCentavos › converts peso text to integer centavos
✓ money › parsePesoToCentavos › [EC16] avoids floating-point error (1.15 × 100 is 114.999… in floats)
✓ money › parsePesoToCentavos › [EC1] rejects empty and whitespace input
✓ money › parsePesoToCentavos › [EC2] rejects negative, non-numeric, NaN and Infinity
✓ money › parsePesoToCentavos › [EC2] rejects absurdly large amounts
✓ money › formatPeso › formats with peso sign, thousands separator and two decimals
✓ money › calculateChangeBreakdown › gives the expected bills and coins
✓ money › calculateChangeBreakdown › returns nothing for zero change
✓ money › calculateChangeBreakdown › reports a remainder for amounts that are not multiples of 25¢
✓ money › calculateChangeBreakdown › greedy is optimal for every amount up to ₱2,000 (checked against dynamic programming)
✓ money › sumCashCount and margins › totals a drawer count
✓ money › sumCashCount and margins › ignores blank counts
✓ money › sumCashCount and margins › computes margin percent and handles zero price
✓ validators › [EC1] trims text and rejects whitespace-only
✓ validators › [EC1] rejects names over the maximum length
✓ validators › records which field failed so the form can highlight it
✓ validators › [EC2] rejects zero money unless allowed
✓ validators › requires selling prices to be payable with 25¢ coins
✓ validators › [EC3] rejects decimal quantities for whole items
✓ validators › [EC2] rejects out-of-range integers
✓ validators › validates PH mobile numbers (optional)
✓ validators › [EC6] validates 13-digit GCash references
✓ validators › [EC7] normalizes names for duplicate detection
✓ dates › [EC17] uses the LOCAL date, so a late-night sale stays on the same day
✓ dates › rejects impossible dates
✓ dates › adds days across month and year boundaries
✓ dates › [EC17] rejects a start date after the end date
✓ dates › [EC17] treats empty range bounds as unbounded
✓ dates › computes Monday-based week keys
✓ csv › escapes commas, quotes and new lines
✓ csv › [EC15] neutralizes spreadsheet formula injection
✓ csv › builds a header row plus data rows
✓ i18n › translates and fills placeholders
✓ i18n › every English key has a Filipino translation
✓ i18n › falls back to the key for unknown text instead of "undefined"
✓ i18n › switches language
- dom › [EC15] renders user text as text, never as HTML (browser only — run tests/index.html)
- dom › skips false/null attributes and children (browser only — run tests/index.html)
✓ Storage › round-trips JSON values under a prefix
✓ Storage › [EC12] returns the fallback for missing data
✓ Storage › [EC12] recovers from corrupted JSON and reports which key
✓ Storage › [EC12] a repository ignores stored data that is not a list of records
✓ Storage › [EC12] runs migrations for old-version data
✓ Storage › [EC13] turns a browser quota error into StorageQuotaError
✓ Storage › [EC13] keeps memory and storage in sync when a save fails
✓ EventBus › delivers events and supports unsubscribing
✓ EventBus › keeps notifying other handlers when one fails
✓ InventoryService › adding products › stores money in centavos and stock in pieces
✓ InventoryService › adding products › [EC1] rejects a blank name
✓ InventoryService › adding products › [EC2] rejects a negative price
✓ InventoryService › adding products › [EC3] rejects decimal stock
✓ InventoryService › adding products › [EC4] warns when price is below cost, and allows it after confirmation
✓ InventoryService › adding products › [EC4] also catches tingi prices that lose money when the whole pack is sold per piece
✓ InventoryService › adding products › [EC7] rejects duplicate names regardless of case and spacing
✓ InventoryService › adding products › rejects categories that do not exist
✓ InventoryService › adding products › rejects images over 200 KB
✓ InventoryService › editing and removing › refuses to change pack size while stock exists
✓ InventoryService › editing and removing › detects when an edit changes a price (PIN needed)
✓ InventoryService › editing and removing › [EC9] deletes unsold products but ARCHIVES products with sales history
✓ InventoryService › editing and removing › [EC9] blocks deleting a category that is still in use
✓ InventoryService › editing and removing › [EC7] rejects duplicate categories
✓ InventoryService › stock changes › adjusts stock with a reason and logs it
✓ InventoryService › stock changes › [EC5] cannot remove more stock than exists
✓ InventoryService › stock changes › receives restocked packs and updates the cost
✓ InventoryService › stock changes › [EC11] refuses to restock an archived product
✓ InventoryService › stock changes › flags low stock and expiring products
✓ Basket › [EC5] limits a product to its stock across pack and piece lines
✓ Basket › [EC3] rejects decimal quantities and removes lines set to 0
✓ Basket › sells non-tingi products by pack even if "piece" is requested
✓ Basket › issues a new checkout token when cleared
✓ SalesService.checkout › completes a cash sale, deducts stock and computes change
✓ SalesService.checkout › [EC16] computes tingi cost per line without fractional centavos
✓ SalesService.checkout › [EC6] rejects cash lower than the total
✓ SalesService.checkout › [EC6] requires a GCash reference for GCash payments
✓ SalesService.checkout › [EC5] re-checks stock at checkout using fresh data
✓ SalesService.checkout › [EC18] a double-clicked checkout cannot create two sales
✓ SalesService.checkout › rejects an empty basket
✓ SalesService.checkout › [EC10] cannot sell before the day is opened
✓ SalesService.checkout › [EC10] cannot sell after the day is closed
✓ SalesService.checkout › [EC17] a sale after midnight belongs to the still-open store day
✓ SalesService.voidSale › restores stock and keeps the voided record
✓ SalesService.voidSale › [EC11] cannot void the same sale twice
✓ SalesService.voidSale › [EC1] requires a reason
✓ SalesService.voidSale › cannot void a sale from a closed day
✓ SalesService.voidSale › [EC17] rejects history filters where start is after end
✓ DayService › opens the day once
✓ DayService › openDay refuses a day that was already closed (reopenToday is separate)
✓ DayService › [EC2] rejects invalid opening cash
✓ DayService.reopenToday › opens a closed today again and lets selling continue
✓ DayService.reopenToday › keeps the earlier count and logs it
✓ DayService.reopenToday › expects every sale of the day at the next closing
✓ DayService.reopenToday › refuses when today is still open or was never opened
✓ DayService.reopenToday › only reopens today, never a past day
✓ CreditService › [EC7] rejects duplicate customer names
✓ CreditService › a credit sale adds to the balance
✓ CreditService › [EC8] blocks a sale above the credit limit, unless overridden by the owner
✓ CreditService › requires choosing a customer for credit sales
✓ CreditService › [EC8] rejects a payment larger than the balance, and a payment of 0
✓ CreditService › payments need an open store day (cash goes into the drawer)
✓ CreditService › voiding a credit sale reverses the utang
✓ CreditService › [EC9] blocks removing a customer with a balance; archives one with history
✓ CreditService › builds a notebook with a running balance
✓ CreditService › marks utang overdue using first-in, first-out payments
✓ CreditService › [EC1] validates customer fields
✓ ExpenseService › records cash taken out and totals it per type
✓ ExpenseService › [EC1][EC2] validates description, amount and type
✓ ExpenseService › [EC10] needs an open day
✓ RestockService › suggests enough packs for a week of sales
✓ RestockService › rounds tingi suggestions up to whole packs
✓ RestockService › generates suggestions once per low product and receives them into stock
✓ RestockService › [EC3] manual items need a whole-number quantity
✓ ClosingService › expects opening + cash sales + cash utang payments − cash out
✓ ClosingService › excludes voided cash sales from expected cash
✓ ClosingService › closes with a matching count and freezes a summary
✓ ClosingService › requires a note when the count is short (kulang)
✓ ClosingService › [EC2][EC3] rejects negative or decimal piece counts
✓ ReportService › builds daily buckets ending today and totals sales and profit
✓ ReportService › counts only operating expenses against profit
✓ ReportService › produces weekly and monthly buckets
✓ ReportService › exports sales to CSV with a header row
✓ BackupService › round-trips all data through a backup file
✓ BackupService › [EC14] rejects text that is not JSON
✓ BackupService › [EC14] rejects files from other apps, unknown sections and bad records
✓ BackupService › [EC14] leaves current data untouched when a restore is rejected
✓ BackupService › never includes the owner PIN in a backup
✓ BackupService › reset deletes everything
✓ DemoDataService › generates 30 closed days of consistent data with today unopened
✓ AuthService › verifies the PIN and never stores it in plain text
✓ AuthService › requires 4–6 digits
✓ AuthService › needs the current PIN to change or remove it
✓ SettingsService and LogService › fills missing settings with defaults and validates updates
✓ SettingsService and LogService › logs important actions, newest first
✓ translations › has the same keys in English and Filipino
✓ translations › uses no Filipino words in the English UI
✓ translations › gives every menu item the same name as its screen title (English)
✓ translations › gives every menu item the same name as its screen title (Filipino)
✓ translations › never leaves a translation empty

135 passed, 0 failed, 2 skipped
```
