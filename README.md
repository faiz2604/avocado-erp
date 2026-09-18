# Avocado Business ERP & Management Dashboard

A self-contained business management system for an avocado trading business: Purchase →
Inventory → Sales → COGS → Profit → Cash Flow → Receivables → Payables, all in one system. See
`ARCHITECTURE.md` for the full design (ERD, schema, calculation logic, roadmap).

## Quick start

Requirements: Node.js 18+ (Node 20/22 recommended).

```bash
npm install
npm run dev
```

Open http://localhost:3000. Log in with the default admin account:

- **Email:** `admin@avocado.local`
- **Password:** `admin123`

Change this password (or create your own admin user and disable this one) before using the app
for real data — see Settings after logging in.

On first login you'll be sent to a short **Setup Wizard** (business name, start date, and your
first cash/bank accounts with opening balances). After that, add your Products, Suppliers and
Customers from their menus, and you're ready to record Purchases and Sales.

### See it with sample data first (optional)

To explore the app with the worked example from the spec already loaded (a purchase, a sale, a
spoilage record, and some expenses — see `ARCHITECTURE.md` Section 50 for the expected numbers):

```bash
rm -f dev.db dev.db-shm dev.db-wal   # start from a clean database
npm run seed
npm run dev
```

### Verify the accounting logic

```bash
npm run test:scenarios
```

This runs all 15 test scenarios from the spec (cash/credit purchase & sale, partial payments,
spoilage, transfers, expenses, the below-minimum-price warning and override, the negative-inventory
rejection, P&L, cash flow, inventory valuation, and ledger reconciliation) against a throwaway
database and prints PASS/FAIL for every assertion.

## What's implemented (Phase 1–3 + first-cut Phase 4)

- Auth with roles (Admin / Manager / Staff / Viewer)
- Products (variety/grade/min price), Customers, Suppliers — with per-customer and per-supplier
  dashboards
- Purchases (landed cost, batch creation, AP) and Sales (weighted-average COGS, min-price warning
  with override, AR) — both support cash / partial / credit payment in one flow
- Batch inventory with aging status (Fresh/Watch/Aging/Critical) and an alert when stock has sat
  more than 5 days
- Spoilage recording with automatic loss valuation
- Cash & Bank: multiple accounts, transfers (never counted as income/expense), owner capital
  in/out (never counted as revenue/expense)
- Expenses with Direct Cost vs. Operating Expense distinction
- Receivables / Payables with aging buckets (Current / 1-30 / 31-60 / 61-90 / 90+) and a combined
  payment-recording screen
- P&L and Cash Flow statements (period selector: today/week/month/quarter/year/YTD), Inventory
  Valuation report
- Business Dashboard, Owner View (7-question summary), Management Overview (trends + top
  customers/products/suppliers by revenue *and* profit)
- CSV export for Sales, Purchases, Expenses, Inventory Valuation, Inventory Movements,
  Receivables, Payables, P&L, Cash Flow
- Mobile: bottom quick-entry bar (Sale / Purchase / Expense / Payment), responsive cards/tables
- Audit log table + created/updated-by/at columns on every financial record (no UI viewer yet —
  see Roadmap)

### Deferred to the next iteration (see `ARCHITECTURE.md` → Roadmap, Phase 4–5)

Full Reconciliation view, Monthly Business Review (period-over-period % change highlighting),
Alert Center as a persisted/dismissible list (the dashboard currently computes alerts live, which
covers the same requirement but isn't a separate module yet), automated Business Insights engine,
an Audit Trail UI (the data is captured; there's no diff viewer yet), Import-from-Excel wizard,
break-even calculator UI, multi-warehouse. None of these affect the core money/inventory math —
they're reporting and convenience layers on top of it.

## Deploying to Netlify

Netlify's serverless functions have a **read-only filesystem** (except the ephemeral `/tmp`, which
is wiped on every cold start), so a plain local `dev.db` file can't live there permanently. This
project handles that automatically with **Netlify Blobs** (`src/lib/blob-store.ts` +
`src/lib/db.ts`): on every cold start it downloads the last-saved copy of the database from Netlify
Blobs into `/tmp`, and after every write (every server action, plus `/api/setup`) it uploads the
updated file back. Netlify Blobs is bundled with every Netlify site — **no separate database
account or add-on is needed.**

**Do not use Netlify's "drag and drop a folder" manual deploy for this project.** That path
publishes whatever files are in the folder exactly as-is — it never runs `npm install` or
`npm run build`, so none of the serverless functions (API routes, server actions, the database
layer) get built at all. That mismatch is consistent with the earlier errors. Use one of the two
build-based methods below instead; both run the real build (`netlify.toml` in this project already
points at `npm run build` and the official Next.js Runtime plugin, so neither needs extra
configuration in the UI beyond the environment variables in step 2).

**Method A — connect a Git repo (recommended: auto-deploys on every future push):**

1. Push this project to a new repo on GitHub, GitLab, or Bitbucket.
2. In the Netlify dashboard: **Add new site → Import an existing project**, pick your Git provider,
   and select the repo. Netlify reads `netlify.toml` automatically, so the build command and
   Next.js plugin are already set — just click through to create the site.

**Method B — deploy straight from this folder with the Netlify CLI (no Git needed):**

1. `npm install -g netlify-cli` (once), then `netlify login`.
2. From inside this project folder: `netlify init` (choose "Create & configure a new site", or
   "Link this directory to an existing site" if you already created one in step above).
3. `netlify deploy --build --prod` — this runs the real `npm run build` locally against Netlify's
   build system and publishes the result, functions included.

Either method actually builds the app, which manual drag-and-drop does not.

**After the site exists (either method), before your first deploy finishes successfully:**

1. In the Netlify site's **Site configuration → Environment variables**, set:
   - `NEXTAUTH_SECRET` — a random secret (generate one with `openssl rand -base64 32`). This is
     what was missing/misconfigured in the earlier deploy and caused the
     `/api/auth/error?error=Configuration` 500 error — NextAuth refuses to start without it in
     production.
   - `NEXTAUTH_URL` — your site's actual URL, e.g. `https://your-site-name.netlify.app` (update
     this if you later attach a custom domain).
   - `DATABASE_URL` is **not needed** on Netlify — it's ignored in favor of the `/tmp` + Blobs path
     automatically (see `src/lib/db.ts`).
2. Trigger a deploy if one hasn't already run (Method A: **Deploys → Trigger deploy**; Method B:
   re-run `netlify deploy --build --prod`) so the build picks up the environment variables you just
   set — a deploy that ran before you added them won't have them. The very first request after that
   creates a fresh database (same default admin login as local dev:
   `admin@avocado.local` / `admin123` — **change this password immediately** after first login, or
   create a new admin user and deactivate the default one) and saves it to Blobs; every request
   after that reuses it.

**Why every database/session page and API route has `export const dynamic = "force-dynamic";`:**
during `next build`, Next.js tries to statically pre-render every route it doesn't detect as
inherently dynamic — and on Netlify's build machine, `process.env.NETLIFY` is already set at
*build* time (not just at runtime), while Netlify Blobs is only reachable once the site is actually
deployed and serving requests. Without this export, the build would try to pre-render pages like
`/customers` or `/api/export/expenses`, each attempt would try (and fail) to reach Blobs, and
several parallel build workers falling back to "bootstrap a fresh database" at the same time could
even collide with each other (`UNIQUE constraint failed: users.email`) — this is exactly what
happened on the first Netlify deploy attempt. `force-dynamic` tells Next.js these routes must only
ever run at real request time, when Blobs is actually available — which is what they need anyway,
since every one of them reads live, per-request session/database state. `src/lib/blob-store.ts`
also has a second, independent guard (`NEXT_PHASE === "phase-production-build"`) that makes Blobs
calls a safe no-op if they're ever somehow reached during a build regardless.

**Why the database runs in `journal_mode = DELETE` on Netlify (and WAL locally):** this one is not
cosmetic — getting it wrong silently destroys every write. SQLite's WAL mode puts committed
transactions in a `dev.db-wal` sidecar file and only folds them into the main `dev.db` file at a
checkpoint (normally when the connection closes; this app's connection is deliberately long-lived,
so that never happens). Since only `dev.db` itself is uploaded to Blobs, every write stayed behind
in the sidecar: the blob sat frozen at whatever `initializeFreshDatabase()` had written, at a
constant 307,200 bytes, no matter how many times data was saved — while the single container that
*made* the write kept reading its own WAL and so looked perfectly healthy. The visible symptom was
the Setup Wizard reappearing forever, with some requests reporting `setup_completed=1` and others
the original bootstrap values, depending on which container served them. `DELETE` mode keeps every
commit inside the single file that actually gets uploaded. For the same reason,
`src/lib/blob-store.ts` deletes any `-wal`/`-shm`/`-journal` sidecars before writing a downloaded
database into `/tmp` (a stale sidecar would otherwise be applied on top of the fresh file), and
`persistDb()` runs a `wal_checkpoint(TRUNCATE)` as a safety net for database files created by
older builds. WAL is kept for local development, where the file lives on a real disk and is never
shipped anywhere.

**Known limitation, by design:** this is a pragmatic fit for a single-operator or small-team
business, not a substitute for a real transactional database under heavy concurrent load. Because
each write downloads-then-reuploads the whole database file, two writes landing at truly the same
instant on two different warm serverless containers could race, and the later upload would win
(last write wins) — the earlier write's data isn't corrupted, just potentially overwritten if it's
never re-read/re-saved. For a single person or a small office entering transactions one at a time
(which is how this system is meant to be used — see the mobile-first quick-entry flow), this isn't
a practical concern. If the business grows to the point of multiple people entering data
simultaneously all day, migrate to Postgres using the guide below — the SQL logic doesn't change,
only the connection layer does.

**If a *different* error shows up after this fix** (not the `Configuration` error, something new):
the most likely remaining risk is Netlify's Next.js Runtime not bundling `better-sqlite3`'s native
`.node` binary into the deployed function correctly, since it's a native (not pure-JS) dependency —
this hasn't been able to be verified from this sandbox, since it requires actual Netlify
infrastructure to test. If you see a build or runtime error mentioning `better_sqlite3.node`,
`bindings`, or "cannot find module", that's the symptom — let me know and it can be fixed by adding
it to Netlify's `included_files`/external-packages config (or, as a fallback, by moving to the
Postgres path above, which sidesteps the native-binary issue entirely).

## Moving to Supabase (Postgres) + Vercel

This was originally scoped for Next.js + Supabase + Postgres + Vercel. That stack needs a Supabase
project (cloud account) and, at install time, Prisma needed to download its query-engine binaries
from `binaries.prisma.sh` — both of which weren't available while building this in a sandboxed
environment. So this build uses `better-sqlite3` (an embedded, file-based database) with
hand-written SQL (`src/db/schema.sql`) instead, keeping the exact same schema and business-logic
layer (`src/lib/*.ts`) so it's a small, mechanical change to move to Postgres when you're ready to
deploy:

1. Create a Supabase project and grab its Postgres connection string.
2. Swap the database driver in `src/lib/db.ts` from `better-sqlite3` to `pg` (or `postgres.js`),
   and update the handful of call sites that use `db.prepare(...).run/get/all(...)` to that
   driver's query API — the SQL itself barely changes (see the next point).
3. Run `src/db/schema.sql` against the new database. The syntax is already close to Postgres; the
   main adjustments are: drop the SQLite-specific `datetime('now')` defaults in favor of
   Postgres's `now()`, and (optionally) convert the checked-string columns noted in
   `ARCHITECTURE.md` Section C into real Postgres `ENUM` types if you want stricter DB-level
   validation.
4. Set `DATABASE_URL` to the Supabase connection string, `NEXTAUTH_URL` to your deployed URL, and
   a strong `NEXTAUTH_SECRET`.
5. Deploy to Vercel as a standard Next.js app.

Everything in `src/lib/transactions.ts`, `costing.ts`, `inventory.ts`, and `finance.ts` is
database-driver-agnostic SQL logic and does not need to change.

## Project structure

```
src/
  app/            Next.js App Router pages (see ARCHITECTURE.md Section D for the sitemap)
  actions/        Server Actions — the only way pages mutate data (auth + validation + revalidate)
  lib/            Business logic: costing, inventory, transactions (the atomic write path),
                  finance (read-side aggregation/reports), master data CRUD, auth
  components/     Shared UI (Sidebar, Kpi cards, charts, etc.)
  db/schema.sql   The database schema (see ARCHITECTURE.md Section B/C for the ERD)
scripts/
  init-db.ts      Creates the schema + bootstraps the default admin user & expense categories
  seed.ts         Loads the sample scenario from the spec
  test-scenarios.ts  Automated verification of the 15 required test scenarios
```
