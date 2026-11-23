# Simulation Guide — test every feature of Tindahan

This guide walks through **every screen, every feature and all 18 edge cases** as one store day, with exact inputs and the results you should see. Use it to:
- test the system before submitting,
- rehearse the live demo and oral defense,
- show the teacher that bad input never crashes the app.

There are three ways to simulate:

| Way | Time | What it shows |
|---|---|---|
| **A. Automated tests** | 1 minute | 132 tests run by themselves, including all 18 edge cases |
| **B. Quick demo** (demo data) | 5 minutes | A store with 30 days of history: reports, credit and closings |
| **C. Full day simulation** (this guide) | 25–30 minutes | Every feature, done by hand from an empty store |

> All amounts below were checked by running this exact script in the browser.
> Use **English** while following it (the button names match). Filipino is tested in step C10.

---

## A. Automated tests (1 minute)

1. Run the site with Live Server.
2. Open `http://127.0.0.1:5500/tests/index.html`.
3. ✅ Expected: **"132 passed, 0 failed"**, with every line green.

Every edge case appears as `[EC1]` … `[EC18]` in the list. The full mapping is in `TEST_PLAN.md`.

---

## B. Quick demo with demo data (5 minutes)

1. **Settings → Load demo data → Load demo data.**
   ✅ Toast: *"Demo data loaded…"*. The store now has 24 products, 6 customers and 30 closed days.
2. **Dashboard:** see *"Running low"* and *"Needs attention"* (Kuya Pedro is overdue, and Itlog and Meat Loaf are expiring). Click **Open the store**.
3. **Credit Notebook:** click **Kuya Pedro**. His notebook has no payments and an **Overdue** stamp. Click **Aling Maria**, whose paid lines are crossed out in red.
4. **Close Store:** scroll to *Past closings*. Most days are **EXACT**, and a few are **SHORT** with a note.
5. **Reports:** switch **Daily / Weekly / Monthly** and look at the chart, top sellers and categories.

When done, reset before part C: **Settings → Reset all data**, type `DELETE`.

---

## C. Full day simulation (from an empty store)

Start from an empty store: **Settings → Reset all data** → type `DELETE`.

### C1. Settings and owner PIN

| # | Do this | Expected result |
|---|---|---|
| 1 | Settings → New PIN `12` → Repeat `12` → **Set PIN** | ❌ *"The PIN must be 4 to 6 digits."* |
| 2 | New PIN `1234`, Repeat `1235` → **Set PIN** | ❌ *"The two PINs do not match."* |
| 3 | New PIN `1234`, Repeat `1234` → **Set PIN** | ✅ *"PIN saved."*, stamp **PIN is ON** |
| 4 | Change the store name to `Tindahan ni Aling Nena` → **Save** | ✅ The signboard at the top updates |
| 5 | Set *Credit is overdue after* to `0` → **Save** | ❌ *"Must be between 1 and 365."* Set it back to `15` |

### C2. Products — add products

Click **Products → Add product** and add these four products:

| Name | Category | Unit name | Cost | Price | Reorder | Starting stock | By piece? | Pcs/pack | Price/pc | Expiry |
|---|---|---|---|---|---|---|---|---|---|---|
| Sardinas | Delata | lata | 20 | 25 | 3 | 10 | – | | | |
| Shampoo Sachet | Sabon | strip | 72 | 84 | 1 | 2 | ✔ | 12 | 7.50 | |
| Kape 3-in-1 | Kape | strip | 80 | 95 | 1 | 1 | ✔ | 10 | 10 | |
| Yelo | Iba pa | supot | 3 | 5 | 5 | 20 | – | | | *3 days from today* |

✅ Stock shows **"2 packs + 0 pcs"** for Shampoo and **"20 supot"** for Yelo. Yelo has an orange **Expires …** stamp. Kape has a red **Running low!** stamp.

Now try to break it (edge cases), still in **Add product**:

| # | Do this | Expected result | Edge case |
|---|---|---|---|
| 6 | Name `   ` (spaces only) → Save | ❌ *"This is required."* under the name | EC1 |
| 7 | Name `  sardinas ` (other fields filled) → Save | ❌ *"Sardinas" is already in your products.* | EC7 |
| 8 | Name `Tinapay`, price `12.10` → Save | ❌ *"Must be payable with coins — a multiple of ₱0.25."* | EC2 |
| 9 | Price `-5` or `abc` → Save | ❌ *"Enter an amount like 25 or 12.50."* | EC2 |
| 10 | Price `15`, starting stock `2.5` → Save | ❌ *"Enter a whole number."* | EC3 |
| 11 | Stock `5`, cost `20`, price `15` → Save | ⚠️ Dialog **"Selling at a loss?"** Press **Cancel**, then close the form | EC4 |
| 12 | Pick a picture larger than 200 KB | ❌ *"Picture is too big (max 200 KB)."* | – |

Categories (bottom of Products):

| # | Do this | Expected result | Edge case |
|---|---|---|---|
| 13 | New category `Tinapay` → **Add** | ✅ A *Tinapay* chip appears | – |
| 14 | New category ` delata ` → **Add** | ❌ *Category "delata" already exists.* | EC7 |
| 15 | Click **×** on **Delata** | ❌ *"Delata" is used by 1 product(s) and cannot be removed.* | EC9 |
| 16 | Click **×** on **Tinapay** | ✅ Removed | – |

### C3. Credit Notebook — add customers

**Credit Notebook → Add customer**:

| # | Do this | Expected result | Edge case |
|---|---|---|---|
| 17 | Juan Dela Cruz / Mang Juan / contact `0917` / limit `100` → Save | ❌ *"Use the 11-digit format 09XXXXXXXXX."* | EC1 |
| 18 | Change contact to `09171234567` → Save | ✅ *Mang Juan* appears with ₱0.00 | – |
| 19 | Add Pedro Reyes / Kuya Pedro / (no contact) / limit `50` | ✅ Added | – |
| 20 | Add another customer named `juan  dela cruz` | ❌ *"Juan Dela Cruz" is already a customer.* | EC7 |

### C4. Selling before the store is open

| # | Do this | Expected result | Edge case |
|---|---|---|---|
| 21 | Go to **Sell**, add a Sardinas | ✅ It goes into the basket, but a notice says *"The store is not open yet…"* and **PAY** is disabled | EC10 |
| 22 | Press `Esc` → **Yes** | ✅ Basket emptied | – |

### C5. Dashboard — open the store

| # | Do this | Expected result | Edge case |
|---|---|---|---|
| 23 | **Dashboard** → opening cash `-100` → **Open the store** | ❌ Error under the field | EC2 |
| 24 | Opening cash `500` → **Open the store** | ✅ The sign flips to green **OPEN**. *Cash in drawer* shows **₱500.00** | – |

### C6. Sell — four sales

**Sale 1: cash with change**

| # | Do this | Expected result | Edge case |
|---|---|---|---|
| 25 | **Sell** → Sardinas **+ lata** twice, Shampoo **+ piece** three times | ✅ Total **₱72.50** | – |
| 26 | Cash `50` → **PAY** | ❌ *"Cash is less than the total of ₱72.50."* | EC6 |
| 27 | Cash `100` | ✅ *Change: ₱27.50* with **₱20×1, ₱5×1, ₱1×2, 25¢×2** | – |
| 28 | **PAY** (double-click it quickly) | ✅ Only **one** receipt #000001 is created. The receipt modal shows the change again → **Print** works → **Next customer** | EC18 |

**Sale 2: GCash**

| # | Do this | Expected result | Edge case |
|---|---|---|---|
| 29 | Kape **+ strip** → **GCash** → reference `12345` → PAY | ❌ *"GCash reference numbers have 13 digits."* | EC6 |
| 30 | Reference `1234567890123` → PAY | ✅ Receipt #000002, ₱95.00. Kape now shows **Out of stock** and its buttons are disabled | EC5 |

**Sale 3: credit up to the limit**

| # | Do this | Expected result |
|---|---|---|
| 31 | Sardinas ×4 → **Credit** → choose *Mang Juan* → PAY | ✅ Receipt #000003, ₱100.00, *"Credit to Mang Juan"* |

**Sale 4: over the credit limit**

| # | Do this | Expected result | Edge case |
|---|---|---|---|
| 32 | Sardinas ×1 → Credit → *Mang Juan* → PAY | ⚠️ *"Mang Juan can only take ₱0.00 more on credit. Allow it this one time?"* | EC8 |
| 33 | **Allow once** → PIN `0000` | ❌ *"Wrong PIN."* | – |
| 34 | PIN `1234` | ✅ Receipt #000004, ₱25.00 | – |

**Stock limits (tingi)**

| # | Do this | Expected result | Edge case |
|---|---|---|---|
| 35 | Look at the shelf | ✅ Sardinas **Stock: 3 lata, Running low!**; Shampoo **1 packs + 9 pcs** | – |
| 36 | Shampoo **+ strip** once | ✅ Added. The **+ strip** button becomes disabled (only 9 pieces left), but **+ piece** still works | EC5 |
| 37 | In the basket, type `5` in the Shampoo quantity box | ❌ *"Not enough Shampoo Sachet — only 21 pc(s) available."* | EC5 |
| 38 | Type `1.5` in a quantity box | ❌ *"Enter a whole number."* | EC3 |
| 39 | Press `/` | ✅ The cursor jumps to the search box. Type `yel`: only Yelo shows | – |
| 40 | **Empty the basket** → Yes | ✅ Basket empty | – |

### C7. Sales — history and void

| # | Do this | Expected result | Edge case |
|---|---|---|---|
| 41 | **Sales** | ✅ 4 sales, total **₱292.50** | – |
| 42 | From `2026-12-01` To `2026-11-01` → Filter | ❌ *"The start date is after the end date."* | EC17 |
| 43 | **All dates** → **View** receipt **#000001** → **Void sale** → PIN `1234` | ✅ Asks for a reason | – |
| 44 | Leave the reason empty → Void | ❌ *"This is required."* | EC1 |
| 45 | Reason `Maling item` → Void | ✅ The row turns grey (voided). Sardinas goes back to **5**, Shampoo to **2 packs** | – |
| 46 | **View** #000001 again | ✅ The receipt shows a big **VOID** stamp and there is **no Void button** (it can't be voided twice) | EC11 |

### C8. Credit Notebook — payments

| # | Do this | Expected result | Edge case |
|---|---|---|---|
| 47 | **Credit Notebook** → *Mang Juan* | ✅ Notebook: +₱100.00, +₱25.00, **Balance ₱125.00** | – |
| 48 | Amount `200` → Save payment | ❌ *"Payment is more than the balance of ₱125.00."* | EC8 |
| 49 | Amount `0` → Save payment | ❌ *"Must be more than zero."* | EC8 |
| 50 | Amount `50`, Cash → Save payment | ✅ Balance **₱75.00** | – |
| 51 | **Delete** Mang Juan → Delete | ❌ *"Juan Dela Cruz still owes ₱75.00. Collect it first."* | EC9 |
| 52 | **Delete** Kuya Pedro (no credit, no history) | ✅ *Customer removed.* | – |

### C9. Expenses, Restock and product changes

| # | Do this | Expected result | Edge case |
|---|---|---|---|
| 53 | **Expenses** → Store expense, `Yelo para sa palamigan`, `20` → Save | ✅ Listed | – |
| 54 | Owner withdrawal, `Pambili ng ulam`, `50` → Save | ✅ *Total cash out* **₱70.00** | – |
| 55 | Save with an empty description | ❌ *"This is required."* | EC1 |
| 56 | **Restock → Add low-stock items** | ✅ **2× Kape 3-in-1** (suggested from the last 7 days of sales) | – |
| 57 | Press it again | ℹ️ *"Nothing new to add…"* | – |
| 58 | **Received** → packs `2`, cost `82` → Received | ✅ *Already in the store*. In Products, Kape = **2 packs + 0 pcs**, cost **₱82.00** | – |
| 59 | **Products** → ✏️ edit Sardinas, price `26` → Save | 🔒 Asks for the PIN (price change). Enter `1234` → saved | – |
| 60 | 📦 adjust Yelo → Remove 1 supot, reason *Spoiled* → Save | ✅ Yelo **19 supot**. It appears under *Recent stock changes* | – |
| 61 | 📦 adjust Yelo → Remove `50` | ❌ *"Not enough Yelo…"* | EC5 |
| 62 | Edit Shampoo → change pieces per pack to `10` | ❌ *"Pack size can only change when stock is 0…"* | – |
| 63 | 🗑 delete **Sardinas** | ⚠️ It will be **archived** (it has sales) → Delete → shows **Archived** under *Show: Archived* | EC9 |
| 64 | **Restock → Add to list** → open the *Product* dropdown | ✅ Sardinas is **not listed**: archived products can't be restocked or sold (also tested in `[EC11]`) | EC11 |
| 65 | Show: Archived → ↩ **Put back on the shelf** | ✅ Sardinas is active again | – |

### C10. Close Store — closing the store

| # | Do this | Expected result | Edge case |
|---|---|---|---|
| 66 | **Close Store** | ✅ *What should be in the drawer*: 500.00 + 0.00 (sale 1 was voided) + 50.00 − 70.00 = **₱480.00** | – |
| 67 | Count: ₱200 × `2`, ₱50 × `1`, ₱10 × `1` | ✅ *Counted ₱460.00*, red **SHORT** stamp, *Difference ₱20.00* | – |
| 68 | **Close the store** → Yes (no note) | ❌ *"The count does not match. Write a short note…"* | – |
| 69 | Type `-1` or `1.5` in a count box | ❌ *"Enter a whole number."* | EC2 / EC3 |
| 70 | Fix it, then add ₱20 × `1` | ✅ *Counted ₱480.00*, green **EXACT** | – |
| 71 | **Close the store** → Yes | ✅ The day summary appears: Total sales **₱220.00**, Profit **₱40.00**, 3 transactions, Credit collected **₱50.00**, Cash out **₱70.00**, **EXACT**. **Print** works. The top sign flips to red **CLOSED** | – |
| 72 | Go to **Sell**, add an item, try to pay | ❌ PAY disabled, *"…not open yet…"* | EC10 |
| 73 | **Dashboard** | ✅ *"Closed for today"* (the same day can't be reopened) | – |
| 74 | **Sales** → View any of today's sales | ✅ No Void button: *"Only sales from the day that is currently open can be voided."* | – |

### C11. Reports, Activity Log, language and data

| # | Do this | Expected result | Edge case |
|---|---|---|---|
| 75 | **Reports** (Daily) | ✅ Sales **₱220.00**, Gross profit **₱40.00**, Expenses **₱20.00** (withdrawals don't count), Net profit **₱20.00**, Credit outstanding **₱75.00**. Today has a red bar | – |
| 76 | Export → **Sales** | ✅ A CSV downloads and opens in Excel or Google Sheets | EC15 |
| 77 | **Activity Log** | ✅ Every action above is listed with its time. Filter by *Void* to see only the voided sale | – |
| 78 | Click **FIL** at the top | ✅ The whole app switches to Filipino (Tinda, Listahan ng Utang, Sara, BAYAD…), including the footer. Click **EN**: every word is back in English, and each menu name matches its page title | – |
| 79 | **Products → Add product**, name `<b>Test</b>`, price 10, cost 5 → Save | ✅ The name shows **literally** as `<b>Test</b>`, not in bold (XSS-safe) | EC15 |
| 80 | **Settings → Download backup** | ✅ A file `tindahan-backup-YYYY-MM-DD.json` downloads | – |
| 81 | **Restore backup** → pick any other file (e.g. a `.txt` renamed to `.json`) | ❌ *"That file is not a valid Tindahan backup (not JSON)."* Nothing is changed | EC14 |
| 82 | **Reset all data** → PIN `1234` → type `delete` (lowercase) | ❌ *"Please type DELETE exactly."* | – |
| 83 | Type `DELETE` | ✅ Everything is empty | – |
| 84 | **Restore backup** → pick the file from step 80 → confirm | ✅ Everything from today is back | – |

### C12. Browser-storage edge cases (optional, uses DevTools)

These show how the app recovers from damaged or full storage (EC12, EC13). Open DevTools with `F12` → **Application** → **Local Storage** → `http://127.0.0.1:5500`.

| # | Do this | Expected result | Edge case |
|---|---|---|---|
| 85 | Edit the value of `tindahan:products` to `{broken` → reload the page | ✅ No crash. Toast: *"Some saved data was damaged and had to be reset: products."* | EC12 |
| 86 | Restore your backup again (step 84) | ✅ Products are back | – |
| 87 | Add products with large pictures (under 200 KB each) until storage is full | ✅ Toast: *"The browser storage is full…"*. The last product is not half-saved | EC13 |

### C13. Footer and product pictures

| # | Do this | Expected result |
|---|---|---|
| 88 | Visit **Activity Log** and **Settings** on a tall window, then on a phone-sized window | ✅ The footer is always at the very bottom: at the bottom of the window on short pages, right after the content on long pages |
| 89 | Look at the footer | ✅ Store name, today's date with an **OPEN**/**CLOSED** badge, quick links, the five members, a backup reminder and the version. Open or close the store: the badge changes right away |
| 90 | Click **Back to top** in the footer | ✅ The page scrolls back up |
| 91 | **Products → Add product** → choose a picture | ✅ A bigger preview with a 🔍 badge. Click it: the picture opens large on top of the form. Press `Esc`: only the picture closes, the form stays open |
| 92 | Save the product, then click its picture in the list | ✅ The picture opens large with the product name and price. Close it with ✕, `Esc` or a click outside |
| 93 | **Sell** → click the product's picture on the shelf | ✅ The picture opens large, and nothing is added to the basket |

> EC16 (centavos, no float errors) and EC17 (late-night sales stay on the store day) are hard to show by hand. Show them in part A (`[EC16]` and `[EC17]` tests).

---

## Edge case checklist

| EC | Shown in step(s) |
|---|---|
| 1 Empty / too long | 6, 17, 44, 55 |
| 2 Negative, non-numeric, huge | 8, 9, 23, 69 |
| 3 Decimal quantities | 10, 38, 69 |
| 4 Price below cost | 11 |
| 5 Selling more than stock (tingi) | 30, 36, 37, 61 |
| 6 Cash short / missing GCash ref | 26, 29 |
| 7 Duplicate names | 7, 14, 20 |
| 8 Credit limit / overpayment / ₱0 | 32, 48, 49 |
| 9 Delete with history / balance / in use | 15, 51, 63 |
| 10 Before open / after close | 21, 72 |
| 11 Void twice / restock archived | 46, 64 |
| 12 Corrupted storage | 85 |
| 13 Storage full | 87 |
| 14 Invalid backup | 81 |
| 15 XSS / CSV injection | 76, 79 |
| 16 Floating-point money | Part A |
| 17 Date edges | 42, Part A |
| 18 Double-click Pay | 28 |
