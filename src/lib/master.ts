// Master data CRUD (products, customers, suppliers, accounts, expense categories, users) plus
// their per-entity dashboards (Sections 13/14: customer & supplier summary panels).
import { db } from "./db";
import { newId, nowIso } from "./id";
import { hashPassword, verifyPassword } from "./auth";

// ---------------------------------------------------------------------------
// PRODUCTS
// ---------------------------------------------------------------------------

export function listProducts(activeOnly = false) {
  const where = activeOnly ? "WHERE active = 1" : "";
  return db.prepare(`SELECT * FROM products ${where} ORDER BY name`).all();
}

export function getProduct(id: string) {
  return db.prepare(`SELECT * FROM products WHERE id = ?`).get(id);
}

export function createProduct(input: {
  name: string;
  variety?: string;
  grade?: string;
  unit?: string;
  standardPurchasePrice?: number;
  standardSellingPrice?: number;
  minSellingPrice?: number;
  targetMarginPct?: number;
}) {
  const id = newId("prod");
  db.prepare(
    `INSERT INTO products (id, name, variety, grade, unit, standard_purchase_price, standard_selling_price, min_selling_price, target_margin_pct, current_qty, current_avg_cost, active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 1, ?)`
  ).run(
    id,
    input.name,
    input.variety ?? null,
    input.grade ?? null,
    input.unit ?? "kg",
    input.standardPurchasePrice ?? 0,
    input.standardSellingPrice ?? 0,
    input.minSellingPrice ?? 0,
    input.targetMarginPct ?? 0,
    nowIso()
  );
  return { id };
}

export function updateProduct(id: string, input: Partial<{
  name: string; variety: string; grade: string; unit: string;
  standardPurchasePrice: number; standardSellingPrice: number; minSellingPrice: number;
  targetMarginPct: number; active: boolean;
}>) {
  const current = getProduct(id) as any;
  if (!current) throw new Error("Produk tidak ditemukan.");
  db.prepare(
    `UPDATE products SET name=?, variety=?, grade=?, unit=?, standard_purchase_price=?, standard_selling_price=?, min_selling_price=?, target_margin_pct=?, active=? WHERE id=?`
  ).run(
    input.name ?? current.name,
    input.variety ?? current.variety,
    input.grade ?? current.grade,
    input.unit ?? current.unit,
    input.standardPurchasePrice ?? current.standard_purchase_price,
    input.standardSellingPrice ?? current.standard_selling_price,
    input.minSellingPrice ?? current.min_selling_price,
    input.targetMarginPct ?? current.target_margin_pct,
    input.active === undefined ? current.active : input.active ? 1 : 0,
    id
  );
}

// ---------------------------------------------------------------------------
// SUPPLIERS
// ---------------------------------------------------------------------------

export function listSuppliers(activeOnly = false) {
  const where = activeOnly ? "WHERE active = 1" : "";
  return db.prepare(`SELECT * FROM suppliers ${where} ORDER BY name`).all();
}

export function getSupplier(id: string) {
  return db.prepare(`SELECT * FROM suppliers WHERE id = ?`).get(id);
}

export function createSupplier(input: {
  name: string; type?: string; contactPerson?: string; phone?: string; location?: string;
  bankAccount?: string; paymentTerms?: number; notes?: string;
}) {
  const id = newId("sup");
  db.prepare(
    `INSERT INTO suppliers (id, name, type, contact_person, phone, location, bank_account, payment_terms, notes, active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
  ).run(id, input.name, input.type ?? "Petani", input.contactPerson ?? null, input.phone ?? null, input.location ?? null, input.bankAccount ?? null, input.paymentTerms ?? 0, input.notes ?? null, nowIso());
  return { id };
}

export function updateSupplier(id: string, input: Partial<{
  name: string; type: string; contactPerson: string; phone: string; location: string;
  bankAccount: string; paymentTerms: number; notes: string; active: boolean;
}>) {
  const current = getSupplier(id) as any;
  if (!current) throw new Error("Supplier tidak ditemukan.");
  db.prepare(
    `UPDATE suppliers SET name=?, type=?, contact_person=?, phone=?, location=?, bank_account=?, payment_terms=?, notes=?, active=? WHERE id=?`
  ).run(
    input.name ?? current.name,
    input.type ?? current.type,
    input.contactPerson ?? current.contact_person,
    input.phone ?? current.phone,
    input.location ?? current.location,
    input.bankAccount ?? current.bank_account,
    input.paymentTerms ?? current.payment_terms,
    input.notes ?? current.notes,
    input.active === undefined ? current.active : input.active ? 1 : 0,
    id
  );
}

export function getSupplierDashboard(id: string) {
  const totals = db
    .prepare(
      `SELECT COUNT(*) as orders, COALESCE(SUM(total_landed_cost),0) as totalPurchase,
              COALESCE(AVG(total_landed_cost / NULLIF((SELECT SUM(pi.quantity) FROM purchase_items pi WHERE pi.purchase_order_id = purchase_orders.id),0)),0) as avgEffectiveCost
       FROM purchase_orders WHERE supplier_id = ? AND status='ACTIVE'`
    )
    .get(id) as any;
  const qty = db
    .prepare(
      `SELECT COALESCE(SUM(pi.quantity),0) as v FROM purchase_items pi
       JOIN purchase_orders po ON po.id = pi.purchase_order_id
       WHERE po.supplier_id = ? AND po.status='ACTIVE'`
    )
    .get(id) as { v: number };
  const spoiled = db
    .prepare(
      `SELECT COALESCE(SUM(sr.quantity),0) as v FROM spoilage_records sr
       JOIN inventory_batches b ON b.id = sr.batch_id
       WHERE b.supplier_id = ?`
    )
    .get(id) as { v: number };
  const outstanding = db
    .prepare(`SELECT COALESCE(SUM(outstanding),0) as v FROM payables WHERE supplier_id = ? AND status='OPEN'`)
    .get(id) as { v: number };
  const lastPurchase = db
    .prepare(`SELECT date FROM purchase_orders WHERE supplier_id = ? AND status='ACTIVE' ORDER BY date DESC LIMIT 1`)
    .get(id) as { date: string } | undefined;

  return {
    orders: totals?.orders ?? 0,
    totalPurchase: totals?.totalPurchase ?? 0,
    totalQuantity: qty.v,
    avgPurchasePrice: qty.v ? Math.round(totals.totalPurchase / qty.v) : 0,
    spoilageQty: spoiled.v,
    spoilageRate: qty.v ? (spoiled.v / qty.v) * 100 : 0,
    outstandingPayable: outstanding.v,
    lastPurchaseDate: lastPurchase?.date ?? null
  };
}

// ---------------------------------------------------------------------------
// CUSTOMERS
// ---------------------------------------------------------------------------

export function listCustomers() {
  return db.prepare(`SELECT * FROM customers ORDER BY name`).all();
}

export function getCustomer(id: string) {
  return db.prepare(`SELECT * FROM customers WHERE id = ?`).get(id);
}

export function createCustomer(input: {
  name: string; type?: string; phone?: string; address?: string; paymentTerms?: number; creditLimit?: number; notes?: string;
}) {
  const id = newId("cust");
  db.prepare(
    `INSERT INTO customers (id, name, type, phone, address, payment_terms, credit_limit, status, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?)`
  ).run(id, input.name, input.type ?? "Retail", input.phone ?? null, input.address ?? null, input.paymentTerms ?? 0, input.creditLimit ?? 0, input.notes ?? null, nowIso());
  return { id };
}

export function updateCustomer(id: string, input: Partial<{
  name: string; type: string; phone: string; address: string; paymentTerms: number; creditLimit: number; status: string; notes: string;
}>) {
  const current = getCustomer(id) as any;
  if (!current) throw new Error("Customer tidak ditemukan.");
  db.prepare(
    `UPDATE customers SET name=?, type=?, phone=?, address=?, payment_terms=?, credit_limit=?, status=?, notes=? WHERE id=?`
  ).run(
    input.name ?? current.name,
    input.type ?? current.type,
    input.phone ?? current.phone,
    input.address ?? current.address,
    input.paymentTerms ?? current.payment_terms,
    input.creditLimit ?? current.credit_limit,
    input.status ?? current.status,
    input.notes ?? current.notes,
    id
  );
}

export function getCustomerDashboard(id: string) {
  const totals = db
    .prepare(
      `SELECT COUNT(*) as orders, COALESCE(SUM(net_sales),0) as totalSales, COALESCE(SUM(gross_profit),0) as grossProfit
       FROM sales_orders WHERE customer_id = ? AND status='ACTIVE'`
    )
    .get(id) as any;
  const qty = db
    .prepare(
      `SELECT COALESCE(SUM(si.quantity),0) as v FROM sales_items si
       JOIN sales_orders so ON so.id = si.sales_order_id
       WHERE so.customer_id = ? AND so.status='ACTIVE'`
    )
    .get(id) as { v: number };
  const outstanding = db
    .prepare(`SELECT COALESCE(SUM(outstanding),0) as v FROM receivables WHERE customer_id = ? AND status='OPEN'`)
    .get(id) as { v: number };
  const lastPurchase = db
    .prepare(`SELECT date FROM sales_orders WHERE customer_id = ? AND status='ACTIVE' ORDER BY date DESC LIMIT 1`)
    .get(id) as { date: string } | undefined;

  return {
    orders: totals?.orders ?? 0,
    totalSales: totals?.totalSales ?? 0,
    totalQuantity: qty.v,
    avgSellingPrice: qty.v ? Math.round(totals.totalSales / qty.v) : 0,
    grossProfit: totals?.grossProfit ?? 0,
    grossMarginPct: totals?.totalSales ? (totals.grossProfit / totals.totalSales) * 100 : 0,
    outstandingReceivable: outstanding.v,
    lastPurchaseDate: lastPurchase?.date ?? null
  };
}

// ---------------------------------------------------------------------------
// ACCOUNTS (cash/bank)
// ---------------------------------------------------------------------------

export function listAccounts(activeOnly = false) {
  const where = activeOnly ? "WHERE active = 1" : "";
  return db.prepare(`SELECT * FROM accounts ${where} ORDER BY name`).all();
}

export function createAccount(input: { name: string; type: string; openingBalance?: number }) {
  const id = newId("acc");
  db.prepare(`INSERT INTO accounts (id, name, type, opening_balance, active, created_at) VALUES (?, ?, ?, ?, 1, ?)`).run(
    id,
    input.name,
    input.type,
    input.openingBalance ?? 0,
    nowIso()
  );
  return { id };
}

// ---------------------------------------------------------------------------
// EXPENSE CATEGORIES
// ---------------------------------------------------------------------------

export function listExpenseCategories(activeOnly = false) {
  const where = activeOnly ? "WHERE active = 1" : "";
  return db.prepare(`SELECT * FROM expense_categories ${where} ORDER BY name`).all();
}

export function createExpenseCategory(input: { name: string; costType: "DIRECT" | "OPERATING" }) {
  const id = newId("ecat");
  db.prepare(`INSERT INTO expense_categories (id, name, cost_type, active) VALUES (?, ?, ?, 1)`).run(id, input.name, input.costType);
  return { id };
}

// ---------------------------------------------------------------------------
// USERS
// ---------------------------------------------------------------------------

export function listUsers() {
  return db.prepare(`SELECT id, name, email, role, active, created_at FROM users ORDER BY name`).all();
}

export function createUser(input: { name: string; email: string; password: string; role: string }) {
  const id = newId("user");
  db.prepare(`INSERT INTO users (id, name, email, password_hash, role, active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)`).run(
    id,
    input.name,
    input.email,
    hashPassword(input.password),
    input.role,
    nowIso()
  );
  return { id };
}

/** Lets a logged-in user change their own name/email/password. Requires the correct current
 * password (defense against a left-open session being used to hijack the account). Changing the
 * email means the NEXT login must use the new address — the current session keeps working until
 * it's next refreshed/re-logged-in, since sessions are JWT-based and don't re-read the DB. */
export function updateOwnProfile(
  userId: string,
  input: { name: string; email: string; currentPassword: string; newPassword?: string }
) {
  const user = db.prepare(`SELECT password_hash FROM users WHERE id = ?`).get(userId) as
    | { password_hash: string }
    | undefined;
  if (!user) throw new Error("User tidak ditemukan.");
  if (!verifyPassword(input.currentPassword, user.password_hash)) {
    throw new Error("Password saat ini salah.");
  }

  const newHash = input.newPassword ? hashPassword(input.newPassword) : user.password_hash;
  try {
    db.prepare(`UPDATE users SET name = ?, email = ?, password_hash = ? WHERE id = ?`).run(
      input.name,
      input.email,
      newHash,
      userId
    );
  } catch (err: any) {
    if (String(err?.message ?? "").includes("UNIQUE")) {
      throw new Error("Email tersebut sudah dipakai user lain.");
    }
    throw err;
  }
}

/** Admin-only: activate/deactivate another user's account (e.g. disabling the default admin
 * account after creating a personal one). Guarding against self-deactivation happens in the
 * server action, not here, so this stays a plain data operation. */
export function setUserActive(userId: string, active: boolean) {
  db.prepare(`UPDATE users SET active = ? WHERE id = ?`).run(active ? 1 : 0, userId);
}

// ---------------------------------------------------------------------------
// SETTINGS
// ---------------------------------------------------------------------------

export function getSettings() {
  return db.prepare(`SELECT * FROM settings WHERE id = '1'`).get() as any;
}

export function updateSettings(input: Partial<{ businessName: string; startDate: string; currency: string; setupCompleted: boolean }>) {
  const current = getSettings();
  db.prepare(`UPDATE settings SET business_name=?, start_date=?, currency=?, setup_completed=?, updated_at=? WHERE id='1'`).run(
    input.businessName ?? current.business_name,
    input.startDate ?? current.start_date,
    input.currency ?? current.currency,
    input.setupCompleted === undefined ? current.setup_completed : input.setupCompleted ? 1 : 0,
    nowIso()
  );
}
