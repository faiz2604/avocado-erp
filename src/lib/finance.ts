// Read-side aggregation: P&L, Cash Flow, AR/AP aging, inventory valuation, dashboards.
// Everything here recomputes from the ledger tables (never from a cached total) — Section G/H.
import { db } from "./db";
import { agingBucket, inventoryAgeStatus } from "./constants";
import { inventoryAgeDays } from "./inventory";
import { spoilagePct as spoilagePctCalc } from "./costing";

const NON_TRANSFER_TYPES = ["SALE_PAYMENT", "PURCHASE_PAYMENT", "EXPENSE", "CAPITAL_IN", "CAPITAL_OUT", "OTHER_INCOME", "OTHER_EXPENSE", "OPENING_BALANCE"];

export function getPnL(fromIso: string, toIso: string) {
  const rev = db
    .prepare(`SELECT COALESCE(SUM(net_sales),0) as v FROM sales_orders WHERE status='ACTIVE' AND date BETWEEN ? AND ?`)
    .get(fromIso, toIso) as { v: number };
  const cogs = db
    .prepare(`SELECT COALESCE(SUM(total_cogs),0) as v FROM sales_orders WHERE status='ACTIVE' AND date BETWEEN ? AND ?`)
    .get(fromIso, toIso) as { v: number };
  const opex = db
    .prepare(
      `SELECT COALESCE(SUM(e.amount),0) as v FROM expenses e
       JOIN expense_categories c ON c.id = e.category_id
       WHERE c.cost_type = 'OPERATING' AND e.date BETWEEN ? AND ?`
    )
    .get(fromIso, toIso) as { v: number };
  const otherIncome = db
    .prepare(`SELECT COALESCE(SUM(amount),0) as v FROM account_transactions WHERE type='OTHER_INCOME' AND date BETWEEN ? AND ?`)
    .get(fromIso, toIso) as { v: number };
  const otherExpense = db
    .prepare(`SELECT COALESCE(SUM(-amount),0) as v FROM account_transactions WHERE type='OTHER_EXPENSE' AND date BETWEEN ? AND ?`)
    .get(fromIso, toIso) as { v: number };

  const revenue = rev.v;
  const cogsTotal = cogs.v;
  const grossProfit = revenue - cogsTotal;
  const operatingExpense = opex.v;
  const operatingProfit = grossProfit - operatingExpense;
  const netProfit = operatingProfit + otherIncome.v - otherExpense.v;

  return {
    revenue,
    cogs: cogsTotal,
    grossProfit,
    grossMarginPct: revenue ? (grossProfit / revenue) * 100 : 0,
    operatingExpense,
    operatingProfit,
    operatingMarginPct: revenue ? (operatingProfit / revenue) * 100 : 0,
    otherIncome: otherIncome.v,
    otherExpense: otherExpense.v,
    netProfit,
    netMarginPct: revenue ? (netProfit / revenue) * 100 : 0
  };
}

export function getCashFlow(fromIso: string, toIso: string) {
  const openingBalances = db.prepare(`SELECT COALESCE(SUM(opening_balance),0) as v FROM accounts`).get() as { v: number };
  const priorTx = db
    .prepare(`SELECT COALESCE(SUM(amount),0) as v FROM account_transactions WHERE date < ?`)
    .get(fromIso) as { v: number };
  const openingCash = openingBalances.v + priorTx.v;

  const rangeTx = db
    .prepare(`SELECT type, amount FROM account_transactions WHERE date BETWEEN ? AND ?`)
    .all(fromIso, toIso) as { type: string; amount: number }[];

  let customerCollections = 0;
  let otherIncome = 0;
  let capitalIn = 0;
  let supplierPayments = 0;
  let operatingExpenses = 0;
  let otherPayments = 0;
  let capitalOut = 0;
  let netAll = 0;

  for (const tx of rangeTx) {
    netAll += tx.amount;
    switch (tx.type) {
      case "SALE_PAYMENT":
        customerCollections += tx.amount;
        break;
      case "OTHER_INCOME":
        otherIncome += tx.amount;
        break;
      case "CAPITAL_IN":
        capitalIn += tx.amount;
        break;
      case "PURCHASE_PAYMENT":
        supplierPayments += -tx.amount;
        break;
      case "EXPENSE":
        operatingExpenses += -tx.amount;
        break;
      case "OTHER_EXPENSE":
        otherPayments += -tx.amount;
        break;
      case "CAPITAL_OUT":
        capitalOut += -tx.amount;
        break;
      default:
        break; // TRANSFER_IN / TRANSFER_OUT excluded from headline buckets (net to zero business-wide)
    }
  }

  const cashIn = customerCollections + otherIncome + capitalIn;
  const cashOut = supplierPayments + operatingExpenses + otherPayments + capitalOut;
  const closingCash = openingCash + netAll;

  return {
    openingCash,
    customerCollections,
    otherIncome,
    capitalIn,
    cashIn,
    supplierPayments,
    operatingExpenses,
    otherPayments,
    capitalOut,
    cashOut,
    closingCash
  };
}

export function getCurrentCashPosition() {
  const accounts = db.prepare(`SELECT id, name, type, opening_balance FROM accounts WHERE active = 1`).all() as {
    id: string;
    name: string;
    type: string;
    opening_balance: number;
  }[];
  const sums = db
    .prepare(`SELECT account_id, COALESCE(SUM(amount),0) as v FROM account_transactions GROUP BY account_id`)
    .all() as { account_id: string; v: number }[];
  const sumMap = new Map(sums.map((s) => [s.account_id, s.v]));
  const balances = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    balance: a.opening_balance + (sumMap.get(a.id) ?? 0)
  }));
  const total = balances.reduce((s, b) => s + b.balance, 0);
  return { accounts: balances, total };
}

export function getInventoryValuation() {
  const rows = db
    .prepare(
      `SELECT p.id, p.name, p.variety, p.grade, p.current_qty as qty, p.current_avg_cost as avgCost
       FROM products p WHERE p.current_qty > 0.0001 ORDER BY p.name`
    )
    .all() as { id: string; name: string; variety: string | null; grade: string | null; qty: number; avgCost: number }[];
  const items = rows.map((r) => ({ ...r, value: Math.round(r.qty * r.avgCost) }));
  const totalQty = items.reduce((s, i) => s + i.qty, 0);
  const totalValue = items.reduce((s, i) => s + i.value, 0);
  return { items, totalQty, totalValue };
}

export function getBatchAging() {
  const batches = db
    .prepare(
      `SELECT b.id, b.code, b.product_id as productId, p.name as productName, p.variety, p.grade,
              b.quantity_on_hand as qty, b.effective_cost as cost, b.received_date as receivedDate,
              s.name as supplierName
       FROM inventory_batches b
       JOIN products p ON p.id = b.product_id
       JOIN suppliers s ON s.id = b.supplier_id
       WHERE b.quantity_on_hand > 0.0001
       ORDER BY b.received_date ASC`
    )
    .all() as {
    id: string;
    code: string;
    productId: string;
    productName: string;
    variety: string | null;
    grade: string | null;
    qty: number;
    cost: number;
    receivedDate: string;
    supplierName: string;
  }[];

  const withStatus = batches.map((b) => {
    const days = inventoryAgeDays(b.receivedDate);
    return { ...b, ageDays: days, status: inventoryAgeStatus(days), value: Math.round(b.qty * b.cost) };
  });

  const summary = { Fresh: 0, Watch: 0, Aging: 0, Critical: 0 } as Record<string, number>;
  for (const b of withStatus) summary[b.status] += b.qty;

  return { batches: withStatus, summary };
}

export function getSpoilageSummary(fromIso: string, toIso: string) {
  const spoil = db
    .prepare(`SELECT COALESCE(SUM(quantity),0) as qty, COALESCE(SUM(loss_value),0) as value FROM spoilage_records WHERE date BETWEEN ? AND ?`)
    .get(fromIso, toIso) as { qty: number; value: number };
  const received = db
    .prepare(
      `SELECT COALESCE(SUM(pi.quantity),0) as qty FROM purchase_items pi
       JOIN purchase_orders po ON po.id = pi.purchase_order_id
       WHERE po.status='ACTIVE' AND po.date BETWEEN ? AND ?`
    )
    .get(fromIso, toIso) as { qty: number };
  return {
    quantity: spoil.qty,
    value: spoil.value,
    pct: spoilagePctCalc(spoil.qty, received.qty)
  };
}

export function getReceivablesAging(asOf: Date = new Date()) {
  const rows = db
    .prepare(
      `SELECT r.id, r.outstanding, r.due_date as dueDate, c.id as customerId, c.name as customerName, so.code
       FROM receivables r
       JOIN customers c ON c.id = r.customer_id
       JOIN sales_orders so ON so.id = r.sales_order_id
       WHERE r.status = 'OPEN'`
    )
    .all() as { id: string; outstanding: number; dueDate: string | null; customerId: string; customerName: string; code: string }[];

  const buckets: Record<string, number> = { Current: 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
  const items = rows.map((r) => {
    const due = r.dueDate ? new Date(r.dueDate) : new Date();
    const daysOverdue = Math.floor((asOf.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    const bucket = agingBucket(daysOverdue);
    buckets[bucket] += r.outstanding;
    return { ...r, daysOverdue, bucket };
  });
  const total = items.reduce((s, i) => s + i.outstanding, 0);
  return { items, buckets, total };
}

export function getPayablesAging(asOf: Date = new Date()) {
  const rows = db
    .prepare(
      `SELECT p.id, p.outstanding, p.due_date as dueDate, s.id as supplierId, s.name as supplierName, po.code
       FROM payables p
       JOIN suppliers s ON s.id = p.supplier_id
       JOIN purchase_orders po ON po.id = p.purchase_order_id
       WHERE p.status = 'OPEN'`
    )
    .all() as { id: string; outstanding: number; dueDate: string | null; supplierId: string; supplierName: string; code: string }[];

  const buckets: Record<string, number> = { Current: 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
  const items = rows.map((r) => {
    const due = r.dueDate ? new Date(r.dueDate) : new Date();
    const daysOverdue = Math.floor((asOf.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    const bucket = agingBucket(daysOverdue);
    buckets[bucket] += r.outstanding;
    return { ...r, daysOverdue, bucket };
  });
  const total = items.reduce((s, i) => s + i.outstanding, 0);
  return { items, buckets, total };
}

export function getWorkingCapital() {
  const cash = getCurrentCashPosition().total;
  const receivables = getReceivablesAging().total;
  const inventory = getInventoryValuation().totalValue;
  const payables = getPayablesAging().total;
  return { cash, receivables, inventory, payables, workingCapital: cash + receivables + inventory - payables };
}

export function getTopCustomers(fromIso: string, toIso: string, limit = 10) {
  return db
    .prepare(
      `SELECT c.id, c.name, COUNT(so.id) as orders, COALESCE(SUM(so.net_sales),0) as revenue,
              COALESCE(SUM(so.gross_profit),0) as grossProfit
       FROM sales_orders so JOIN customers c ON c.id = so.customer_id
       WHERE so.status='ACTIVE' AND so.date BETWEEN ? AND ?
       GROUP BY c.id ORDER BY revenue DESC LIMIT ?`
    )
    .all(fromIso, toIso, limit);
}

export function getTopSuppliers(fromIso: string, toIso: string, limit = 10) {
  return db
    .prepare(
      `SELECT s.id, s.name, COUNT(po.id) as orders, COALESCE(SUM(po.total_landed_cost),0) as purchases
       FROM purchase_orders po JOIN suppliers s ON s.id = po.supplier_id
       WHERE po.status='ACTIVE' AND po.date BETWEEN ? AND ?
       GROUP BY s.id ORDER BY purchases DESC LIMIT ?`
    )
    .all(fromIso, toIso, limit);
}

export function getTopProducts(fromIso: string, toIso: string, limit = 10) {
  return db
    .prepare(
      `SELECT p.id, p.name, p.variety, p.grade, COALESCE(SUM(si.net_amount),0) as revenue,
              COALESCE(SUM(si.gross_profit),0) as grossProfit, COALESCE(SUM(si.quantity),0) as qty
       FROM sales_items si
       JOIN sales_orders so ON so.id = si.sales_order_id
       JOIN products p ON p.id = si.product_id
       WHERE so.status='ACTIVE' AND so.date BETWEEN ? AND ?
       GROUP BY p.id ORDER BY revenue DESC LIMIT ?`
    )
    .all(fromIso, toIso, limit);
}

export function getExpenseByCategory(fromIso: string, toIso: string) {
  return db
    .prepare(
      `SELECT ec.name as category, ec.cost_type as costType, COALESCE(SUM(e.amount),0) as total
       FROM expenses e JOIN expense_categories ec ON ec.id = e.category_id
       WHERE e.date BETWEEN ? AND ?
       GROUP BY ec.id ORDER BY total DESC`
    )
    .all(fromIso, toIso);
}

export function getTodaySnapshot() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const fromIso = start.toISOString();
  const toIso = end.toISOString();

  const sales = db
    .prepare(`SELECT COALESCE(SUM(net_sales),0) as v FROM sales_orders WHERE status='ACTIVE' AND date BETWEEN ? AND ?`)
    .get(fromIso, toIso) as { v: number };
  const purchases = db
    .prepare(`SELECT COALESCE(SUM(total_landed_cost),0) as v FROM purchase_orders WHERE status='ACTIVE' AND date BETWEEN ? AND ?`)
    .get(fromIso, toIso) as { v: number };
  const expenses = db
    .prepare(`SELECT COALESCE(SUM(amount),0) as v FROM expenses WHERE date BETWEEN ? AND ?`)
    .get(fromIso, toIso) as { v: number };
  const profit = db
    .prepare(`SELECT COALESCE(SUM(gross_profit),0) as v FROM sales_orders WHERE status='ACTIVE' AND date BETWEEN ? AND ?`)
    .get(fromIso, toIso) as { v: number };
  const cf = getCashFlow(fromIso, toIso);

  return {
    sales: sales.v,
    purchases: purchases.v,
    expenses: expenses.v,
    grossProfit: profit.v,
    cashIn: cf.cashIn,
    cashOut: cf.cashOut
  };
}

export function getRevenueTrend(months = 6) {
  const rows = db
    .prepare(
      `SELECT strftime('%Y-%m', date) as month, COALESCE(SUM(net_sales),0) as revenue,
              COALESCE(SUM(gross_profit),0) as grossProfit, COALESCE(SUM(total_cogs),0) as cogs
       FROM sales_orders WHERE status='ACTIVE'
       GROUP BY month ORDER BY month DESC LIMIT ?`
    )
    .all(months) as { month: string; revenue: number; grossProfit: number; cogs: number }[];
  return rows.reverse();
}
