# Avocado Business ERP & Management Dashboard — Architecture

Status: Phase 1–3 implemented and tested this pass. Phase 4–5 (Alert Center, automated Insights,
full Audit Trail UI, Import wizard, Reconciliation module, Monthly Review, Break-even) are designed
here but scaffolded/deferred — see Roadmap (I).

---

## A. System Architecture

```
                        ┌─────────────────────────────┐
                        │        Browser (SPA)         │
                        │  Next.js App Router (React)  │
                        │  Tailwind CSS · Recharts     │
                        └───────────────┬───────────────┘
                                        │ HTTPS (same origin)
                        ┌───────────────▼───────────────┐
                        │      Next.js Server Layer      │
                        │  • Route Handlers (/api/*)     │
                        │  • Server Actions              │
                        │  • NextAuth (session/JWT)      │
                        │  • Business Logic (src/lib/*)  │
                        └───────────────┬───────────────┘
                                        │ better-sqlite3 (prepared SQL)
                        ┌───────────────▼───────────────┐
                        │           Database             │
                        │  Dev: SQLite (file, zero setup) │
                        │  Prod: PostgreSQL (Supabase)   │
                        └────────────────────────────────┘
```

**Why this stack (self-contained, deploy-later):**
- The app runs fully locally with `npm install && npm run dev` — no cloud account, no external
  binary downloads, and no setup step needed to start using it today (`better-sqlite3` is a
  synchronous, embedded, file-based database — the whole app is one `dev.db` file).
- Originally scoped for Prisma + Supabase Postgres (per the request); Prisma's engine binaries are
  fetched from `binaries.prisma.sh` at install time, which this sandbox's network policy blocks, so
  this build uses `better-sqlite3` with hand-written, Postgres-portable SQL (`src/db/schema.sql`)
  and a small typed query layer instead — same relational schema, same guarantee that every write
  goes through one atomic transaction, no ORM engine binary dependency. Moving to Supabase Postgres
  later means swapping `src/lib/db.ts`'s driver for `pg`/`postgres.js` and adjusting the handful of
  SQLite-specific syntax bits (`AUTOINCREMENT`, `datetime('now')`) — see `README.md` → "Moving to
  Supabase + Vercel".
- All money values are stored as **integer Rupiah** (no decimals — IDR has no subunit in practice),
  avoiding floating-point rounding bugs in COGS/margin math.
- All business rules (costing, COGS, AR/AP, cash) live in `src/lib/*.ts`, never in the UI layer,
  so the same functions back both the UI and the CSV/Excel export and can be unit-tested directly.

**Layers**
1. **Presentation** — Next.js App Router pages (server components for data-heavy views, small
   client components for interactive forms).
2. **API / Server Actions** — every state-changing operation (purchase, sale, spoilage, payment,
   transfer, expense) goes through a single server-side function in `src/lib/transactions.ts` that
   performs the *entire* multi-table write in one Prisma `$transaction`, so inventory, COGS, cash,
   AR/AP can never drift apart (Requirement #42/#43).
3. **Domain logic** — `src/lib/costing.ts`, `src/lib/inventory.ts`, `src/lib/finance.ts`: pure
   functions, no I/O, fully testable.
4. **Data** — Prisma schema (`prisma/schema.prisma`), see ERD below.

---

## B. Database ERD (entity relationships)

```
User ──< AuditLog

Product ──< PurchaseItem
Product ──< SalesItem
Product ──< InventoryBatch

Supplier ──< PurchaseOrder ──< PurchaseItem ──1:1── InventoryBatch (one batch per purchase item)
Supplier ──< PurchaseOrder ──< PurchasePayment
Supplier ──(derived)──< Payable

Customer ──< SalesOrder ──< SalesItem
Customer ──< SalesOrder ──< SalesPayment
Customer ──(derived)──< Receivable

InventoryBatch ──< InventoryMovement
InventoryBatch ──< SpoilageRecord
SalesItem >── InventoryBatch (batch consumed by this sale line)

Account (cash/bank) ──< AccountTransaction
PurchaseOrder ──(payments)──> AccountTransaction
SalesOrder ──(payments)──> AccountTransaction
Expense ──> AccountTransaction
Expense ──> ExpenseCategory

Receivable ──1:1── SalesOrder
Payable ──1:1── PurchaseOrder

Settings (singleton: business profile, currency, opening-balance flags)
```

Full column-level detail is the SQL schema itself (`src/db/schema.sql`) — that file **is**
the authoritative schema (Section C requirement: minimal tables all present, plus the join/derived
tables needed to keep the ledger consistent).

---

## C. Database Schema — table list (see `src/db/schema.sql` for columns)

`User, Account, AccountTransaction, Product, Supplier, Customer, PurchaseOrder, PurchaseItem,
PurchasePayment, SalesOrder, SalesItem, SalesPayment, InventoryBatch, InventoryMovement,
SpoilageRecord, Expense, ExpenseCategory, Receivable, Payable, Settings, AuditLog, Attachment.`

Notes vs. the requested list:
- `product_varieties` / `product_grades` are columns on `Product` (free-text, user-managed) rather
  than separate lookup tables — this matches "don't hard-code the product list, let the user
  add/edit/delete products" while keeping variety/grade editable per product without an extra join
  for the common case. They can be promoted to their own tables later without breaking callers,
  since all reads go through `src/lib/*`, not raw Prisma calls scattered in pages.
- `income` / `income_categories` are modeled as `Account In` transactions with a category flag
  (`OTHER_INCOME`), since "other income" in this business is rare (mostly sales, which already
  has its own flow) — avoids a mostly-empty duplicate table.
- `roles` is an enum on `User` (`ADMIN/MANAGER/STAFF/VIEWER`), not a separate table, since roles
  are fixed by spec, not user-defined.

---

## D. Page / Sitemap Structure

```
/login
/setup                          (first-run wizard — business, accounts, opening balances)
/(app)  — authenticated shell: sidebar (desktop) + bottom nav (mobile)
  /dashboard                    Business Dashboard (Today / This Month / Inventory / Working Capital)
  /owner                        Owner View — 7 questions, Today/Week/Month/YTD
  /management                   Management Overview — trends + top lists + profit contribution
  /products                     list + create/edit drawer
  /customers                    list + [id] detail (dashboard: sales, AR, margin)
  /suppliers                    list + [id] detail (dashboard: purchases, AP, effective cost)
  /purchases                    list + /new + /[id] detail
  /sales                        list + /new + /[id] invoice detail
  /inventory                    batch list with aging status + /movements ledger
  /spoilage                     list + /new
  /expenses                     list + /new
  /cash                         accounts + balances + /transfer + /payment (AR/AP settlement)
  /receivables                  aging buckets, per-customer drill-down
  /payables                     aging buckets, per-supplier drill-down
  /reports/pnl                  Profit & Loss (period selector)
  /reports/cashflow             Cash Flow statement (period selector)
  /reports/inventory-valuation  by product / variety / grade / batch
  /settings                     users & roles, opening balances, expense categories, accounts
```

Quick-entry (mobile bottom bar, all screens): **SALE · PURCHASE · EXPENSE · PAYMENT** → opens a
focused single-screen form, <30s to submit (Requirement #39).

---

## E. User Flow (core transaction)

```
1. Buy stock
   Purchases → New Purchase
     → select Supplier, Product/Variety/Grade, Qty, Price/kg, Transport/Loading/Other
     → system computes Landed Cost & Effective Cost/kg live
     → choose payment: Cash now (full/partial) or Credit
     → SUBMIT
        ⇒ creates PurchaseOrder + PurchaseItem
        ⇒ creates InventoryBatch (qty, effective cost, received date)
        ⇒ creates InventoryMovement (IN, type=PURCHASE)
        ⇒ if partial/credit: creates/updates Payable; if any cash paid: AccountTransaction (OUT) + PurchasePayment

2. Sell stock
   Sales → New Sale
     → select Customer, Product/Variety/Grade (system offers batches oldest-first / shows blended
       weighted-average cost), Qty, Price/kg, Discount
     → live warning if Price/kg < Product.minSellingPrice (override allowed for MANAGER/ADMIN with reason)
     → system computes Revenue, COGS (weighted-average cost/kg at moment of sale), Gross Profit, Margin
     → choose payment: Cash now (full/partial) or Credit
     → SUBMIT
        ⇒ creates SalesOrder + SalesItem(s) referencing InventoryBatch(es) consumed
        ⇒ creates InventoryMovement (OUT, type=SALE) reducing batch qty, recalculates batch/product avg cost
        ⇒ if partial/credit: creates/updates Receivable; if any cash received: AccountTransaction (IN) + SalesPayment

3. Everything recalculates
   Dashboard, P&L, Cash Flow, AR/AP aging, Inventory Valuation, Owner View all read from the same
   ledger tables (Movements, AccountTransactions, Receivables, Payables) — never from cached totals.
```

---

## F. Financial Calculation Logic

```
Landed Cost        = PurchaseCost + Transport + Loading + OtherDirectCost
Effective Cost/kg   = LandedCost / Quantity

Weighted Avg Cost   = (Existing Inventory Value + New Landed Cost)
  (per product)        / (Existing Inventory Qty + New Quantity)
  → recalculated inside the same DB transaction every time a PurchaseItem/Batch is created.

Gross Sales         = Quantity × Selling Price/kg
Net Sales           = Gross Sales − Discount
COGS                = Quantity × Weighted Avg Cost/kg (at time of sale)
Gross Profit        = Net Sales − COGS
Gross Margin %      = Gross Profit / Net Sales × 100

Revenue (period)    = Σ Net Sales
COGS (period)       = Σ COGS of sales in period
Gross Profit         = Revenue − COGS
Operating Expense    = Σ Expenses where costType = OPERATING (excludes DIRECT costs, which are
                        already inside Landed Cost / COGS — Requirement #18 distinction)
Operating Profit     = Gross Profit − Operating Expense
Net Profit           = Operating Profit + Other Income − Other Expense
(Owner capital injections/withdrawals are EXCLUDED from Revenue/Expense — they hit Account +
 a dedicated Capital ledger only — Requirement #37.)

Contribution Margin/kg = Selling Price/kg − Landed Cost/kg − Direct Selling Cost/kg
Break-even Qty          = Fixed Cost / Contribution Margin per kg   (computed in reports/pnl "what-if")

AR aging bucket = today − SalesOrder.dueDate → Current / 1-30 / 31-60 / 61-90 / 90+
AP aging bucket = today − PurchaseOrder.dueDate → same buckets

Cash Flow (NOT derived from profit):
  Opening Cash + Customer Collections + Other Income − Supplier Payments − Operating Expenses
  − Other Payments = Closing Cash
  (Built directly from AccountTransaction rows, tagged by source: SALE_PAYMENT / PURCHASE_PAYMENT /
   EXPENSE / TRANSFER_IN / TRANSFER_OUT / CAPITAL_IN / CAPITAL_OUT / OTHER.
   TRANSFER_IN/OUT pairs net to zero business-wide and are excluded from the Cash In/Out totals
   shown on dashboards, though they still move individual account balances — Requirement #17.)

Working Capital = Cash + Receivables + Inventory Value − Payables
```

---

## G. Inventory Calculation Logic

```
Every stock change MUST create an InventoryMovement row. No direct qty edits.

Stock IN:  PURCHASE, SALES_RETURN, ADJUSTMENT_POSITIVE
Stock OUT: SALE, SPOILAGE, SHRINKAGE, ADJUSTMENT_NEGATIVE

Batch.qtyOnHand = qtyReceived + Σ(IN movements) − Σ(OUT movements)   [never edited directly]

Product-level stock  = Σ Batch.qtyOnHand across all batches of that product
Inventory Value      = Σ (Batch.qtyOnHand × Batch.effectiveCost)

Inventory Age (days) = today − Batch.receivedDate
Status:  0–2d Fresh · 3–5d Watch · 6–7d Aging · >7d Critical
Alert when Aging/Critical stock qty > 0: "<qty> kg inventory has been stored for more than 5 days."

Spoilage Loss Value  = Quantity × Product's current weighted-average cost/kg (at time of spoilage)
  → the specific batch is still selected and its on-hand qty depleted (for traceability and the
    aging dashboard), but the *value* removed uses the same moving-average rate as COGS, not that
    batch's own original receipt cost — otherwise a spoilage on an older/cheaper batch would leave
    the money ledger (Σ IN value − Σ OUT value) out of step with qty × avg cost. This mirrors how
    Section 9 already ties recalculation to purchases only, never to sale/spoilage events.
Spoilage %  (period) = Σ Spoilage Qty / Σ Stock Received Qty × 100

Reconciliation check (run on demand + on every dashboard load):
  Σ Batch.qtyOnHand  ==  qtyReceived total − qtyOUT total (recomputed from Movements)
  If mismatch → flagged in /reports (Phase 4 Reconciliation view) — the write path in
  `src/lib/transactions.ts` is structured so this can only mismatch from a bug, never from user
  input, because qty is never set directly, only ever adjusted by inserting a Movement row inside
  the same DB transaction as its source document.
```

---

## H. Dashboard Wireframe (desktop)

```
┌─ Sidebar ──┐ ┌──────────────────────── Business Dashboard ─────────────────────────┐
│ Dashboard  │ │ TODAY                                                                │
│ Owner View │ │ [Sales Rp]  [Purchases Rp]  [Expenses Rp]  [Profit Rp]  [Cash In/Out]│
│ Management │ │                                                                       │
│ Products   │ │ THIS MONTH                                                           │
│ Customers  │ │ [Revenue][COGS][Gross Profit][OpEx][Net Profit][Gross Margin %]      │
│ Suppliers  │ │ [Cash Flow mini-chart]                                               │
│ Purchases  │ │                                                                       │
│ Sales      │ │ INVENTORY                        WORKING CAPITAL                    │
│ Inventory  │ │ [Stock kg][Value][Aging bars]     [Cash][+Recv][+Inv][−Payable]=[WC] │
│ Spoilage   │ │ [Spoilage kg / value / %]                                            │
│ Expenses   │ │                                                                       │
│ Cash&Bank  │ │ ALERTS (top 5)                                                       │
│ Receivable │ │ ⚠ 120 kg stored >5 days   ⚠ Invoice #S-0041 overdue 12 days          │
│ Payable    │ └───────────────────────────────────────────────────────────────────────┘
│ Reports    │ Mobile: cards stack single-column; bottom bar = SALE · PURCHASE · EXPENSE · PAYMENT
│ Settings   │
└────────────┘
```

---

## I. Development Roadmap

**Phase 1 (this pass):** Auth/roles, Dashboard, Products, Customers, Suppliers, Purchases, Sales,
Cash & Bank, Expenses.
**Phase 2 (this pass):** Batch Inventory, Spoilage, Weighted Average Cost, COGS engine.
**Phase 3 (this pass):** Receivables, Payables (aging), P&L, Cash Flow.
**Phase 4 (next iteration):** Full Reports suite + Excel/CSV export for every module (a first cut
of CSV export ships this pass for the core modules), Reconciliation view, Monthly Business Review
with period-over-period % change highlighting.
**Phase 5 (next iteration):** Alert Center (persisted, dismissible), automated Business Insights
engine, full Audit Trail UI (before/after diff viewer — the underlying `AuditLog` table and
created/updated-by/at columns are already written every transaction this pass), Import-from-Excel
wizard with preview/validate/confirm, customer/supplier deep profitability (delivery & handling
cost allocation), break-even calculator UI, multi-warehouse.

This pass's acceptance bar (per Requirement #56): one purchase → inventory → sale → COGS → gross
profit → cash/receivable → P&L/cash-flow report must flow through correctly. That end-to-end path,
plus spoilage, partial payments, cash transfers, and the 15 test scenarios in Requirement #49, are
what Section "Run test scenarios" in this build verifies before delivery.
