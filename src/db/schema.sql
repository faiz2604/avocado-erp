-- Avocado Business ERP — SQLite schema (see ARCHITECTURE.md for the ERD/rationale).
-- Written to be as close to Postgres syntax as SQLite allows, so migrating later mostly means:
--   TEXT id -> use gen_random_uuid()/text, INTEGER -> keep, DATETIME strings -> timestamptz,
--   AUTOINCREMENT -> not needed (ids are app-generated cuids), "IF NOT EXISTS" works on both.
-- Money columns = whole IDR (INTEGER). Quantity columns = kilograms (REAL, can be fractional).

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'STAFF',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  opening_balance INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS account_transactions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  date TEXT NOT NULL DEFAULT (datetime('now')),
  description TEXT,
  reference_type TEXT,
  reference_id TEXT,
  transfer_pair_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_acct_tx_account ON account_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_acct_tx_date ON account_transactions(date);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  variety TEXT,
  grade TEXT,
  unit TEXT NOT NULL DEFAULT 'kg',
  standard_purchase_price INTEGER NOT NULL DEFAULT 0,
  standard_selling_price INTEGER NOT NULL DEFAULT 0,
  min_selling_price INTEGER NOT NULL DEFAULT 0,
  target_margin_pct REAL NOT NULL DEFAULT 0,
  -- Moving weighted-average costing state (Section 9): current_avg_cost is recalculated whenever
  -- a purchase adds stock, and stays fixed across sales/spoilage (which only reduce current_qty).
  -- This is the single source of truth for COGS/valuation; inventory_batches below track physical
  -- batches (their own receipt cost + on-hand qty) for aging/traceability, and are always
  -- decremented in the same DB transaction as current_qty, so the two stay reconciled by
  -- construction (Section 42/43).
  current_qty REAL NOT NULL DEFAULT 0,
  current_avg_cost INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'Petani',
  contact_person TEXT,
  phone TEXT,
  location TEXT,
  bank_account TEXT,
  payment_terms INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'Retail',
  phone TEXT,
  address TEXT,
  payment_terms INTEGER NOT NULL DEFAULT 0,
  credit_limit INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Active',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  date TEXT NOT NULL DEFAULT (datetime('now')),
  supplier_id TEXT NOT NULL REFERENCES suppliers(id),
  transport_cost INTEGER NOT NULL DEFAULT 0,
  loading_cost INTEGER NOT NULL DEFAULT 0,
  other_direct_cost INTEGER NOT NULL DEFAULT 0,
  total_purchase_cost INTEGER NOT NULL DEFAULT 0,
  total_landed_cost INTEGER NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'UNPAID',
  amount_paid INTEGER NOT NULL DEFAULT 0,
  outstanding INTEGER NOT NULL DEFAULT 0,
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  notes TEXT,
  created_by_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_date ON purchase_orders(date);

CREATE TABLE IF NOT EXISTS purchase_items (
  id TEXT PRIMARY KEY,
  purchase_order_id TEXT NOT NULL REFERENCES purchase_orders(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  quantity REAL NOT NULL,
  purchase_price INTEGER NOT NULL,
  allocated_landed_cost INTEGER NOT NULL,
  effective_cost INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pi_po ON purchase_items(purchase_order_id);

CREATE TABLE IF NOT EXISTS purchase_payments (
  id TEXT PRIMARY KEY,
  purchase_order_id TEXT NOT NULL REFERENCES purchase_orders(id),
  account_id TEXT NOT NULL REFERENCES accounts(id),
  amount INTEGER NOT NULL,
  date TEXT NOT NULL DEFAULT (datetime('now')),
  notes TEXT,
  created_by_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS inventory_batches (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  purchase_item_id TEXT NOT NULL UNIQUE REFERENCES purchase_items(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  supplier_id TEXT NOT NULL REFERENCES suppliers(id),
  quantity_received REAL NOT NULL,
  quantity_on_hand REAL NOT NULL,
  effective_cost INTEGER NOT NULL,
  received_date TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_batch_product ON inventory_batches(product_id);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES inventory_batches(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  date TEXT NOT NULL DEFAULT (datetime('now')),
  type TEXT NOT NULL,
  direction TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit_cost INTEGER NOT NULL,
  total_value INTEGER NOT NULL,
  reference_type TEXT,
  reference_id TEXT,
  notes TEXT,
  created_by_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_mov_batch ON inventory_movements(batch_id);
CREATE INDEX IF NOT EXISTS idx_mov_product ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_mov_date ON inventory_movements(date);

CREATE TABLE IF NOT EXISTS spoilage_records (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL DEFAULT (datetime('now')),
  batch_id TEXT NOT NULL REFERENCES inventory_batches(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  quantity REAL NOT NULL,
  unit_cost INTEGER NOT NULL,
  loss_value INTEGER NOT NULL,
  reason TEXT NOT NULL,
  notes TEXT,
  attachment_url TEXT,
  recorded_by_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sales_orders (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  date TEXT NOT NULL DEFAULT (datetime('now')),
  customer_id TEXT NOT NULL REFERENCES customers(id),
  discount INTEGER NOT NULL DEFAULT 0,
  gross_sales INTEGER NOT NULL DEFAULT 0,
  net_sales INTEGER NOT NULL DEFAULT 0,
  total_cogs INTEGER NOT NULL DEFAULT 0,
  gross_profit INTEGER NOT NULL DEFAULT 0,
  gross_margin_pct REAL NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'UNPAID',
  amount_paid INTEGER NOT NULL DEFAULT 0,
  outstanding INTEGER NOT NULL DEFAULT 0,
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  notes TEXT,
  created_by_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_so_customer ON sales_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_so_date ON sales_orders(date);

CREATE TABLE IF NOT EXISTS sales_items (
  id TEXT PRIMARY KEY,
  sales_order_id TEXT NOT NULL REFERENCES sales_orders(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  batch_id TEXT NOT NULL REFERENCES inventory_batches(id),
  quantity REAL NOT NULL,
  selling_price INTEGER NOT NULL,
  discount INTEGER NOT NULL DEFAULT 0,
  gross_amount INTEGER NOT NULL,
  net_amount INTEGER NOT NULL,
  unit_cost INTEGER NOT NULL,
  cogs INTEGER NOT NULL,
  gross_profit INTEGER NOT NULL,
  below_min_price INTEGER NOT NULL DEFAULT 0,
  override_reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_si_so ON sales_items(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_si_batch ON sales_items(batch_id);

CREATE TABLE IF NOT EXISTS sales_payments (
  id TEXT PRIMARY KEY,
  sales_order_id TEXT NOT NULL REFERENCES sales_orders(id),
  account_id TEXT NOT NULL REFERENCES accounts(id),
  amount INTEGER NOT NULL,
  date TEXT NOT NULL DEFAULT (datetime('now')),
  notes TEXT,
  created_by_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS expense_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  cost_type TEXT NOT NULL DEFAULT 'OPERATING',
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL DEFAULT (datetime('now')),
  category_id TEXT NOT NULL REFERENCES expense_categories(id),
  description TEXT,
  amount INTEGER NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  vendor TEXT,
  notes TEXT,
  attachment_url TEXT,
  created_by_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_exp_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_exp_category ON expenses(category_id);

CREATE TABLE IF NOT EXISTS receivables (
  id TEXT PRIMARY KEY,
  sales_order_id TEXT NOT NULL UNIQUE REFERENCES sales_orders(id),
  customer_id TEXT NOT NULL REFERENCES customers(id),
  amount INTEGER NOT NULL,
  paid_amount INTEGER NOT NULL DEFAULT 0,
  outstanding INTEGER NOT NULL,
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_recv_customer ON receivables(customer_id);

CREATE TABLE IF NOT EXISTS payables (
  id TEXT PRIMARY KEY,
  purchase_order_id TEXT NOT NULL UNIQUE REFERENCES purchase_orders(id),
  supplier_id TEXT NOT NULL REFERENCES suppliers(id),
  amount INTEGER NOT NULL,
  paid_amount INTEGER NOT NULL DEFAULT 0,
  outstanding INTEGER NOT NULL,
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pay_supplier ON payables(supplier_id);

CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY DEFAULT '1',
  business_name TEXT NOT NULL DEFAULT 'Avocado Trading',
  start_date TEXT NOT NULL DEFAULT (datetime('now')),
  currency TEXT NOT NULL DEFAULT 'IDR',
  setup_completed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  user_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  url TEXT NOT NULL,
  filename TEXT NOT NULL,
  uploaded_by_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
