// Runs the 15 test scenarios from the spec (Section 49) plus the Section 50 worked example
// end-to-end, against a throwaway DB (see the "test:scenarios" npm script — it points
// DATABASE_URL at ./test.db so this never touches your real dev.db). Exits non-zero on any
// failed assertion so it can be used as a CI gate later.
import { db } from "../src/lib/db";
import { createProduct, createSupplier, createCustomer, createAccount } from "../src/lib/master";
import { createPurchase, createSale, recordSpoilage, transferFunds, recordExpense, recordReceivablePayment, recordPayablePayment } from "../src/lib/transactions";
import { getPnL, getCashFlow, getInventoryValuation, getWorkingCapital } from "../src/lib/finance";
import { isoRange } from "../src/lib/periods";

let pass = 0;
let fail = 0;

function assert(name: string, condition: boolean, detail?: string) {
  if (condition) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function approx(a: number, b: number, tol = 1) {
  return Math.abs(a - b) <= tol;
}

function main() {
  console.log("=== Avocado ERP — Test Scenarios (spec Section 49/50) ===\n");

  const { id: cashAccount } = createAccount({ name: "Kas Tunai", type: "CASH", openingBalance: 10_000_000 });
  const { id: bankAccount } = createAccount({ name: "Bank BCA", type: "BANK", openingBalance: 0 });
  const { id: supplierId } = createSupplier({ name: "Petani A" });
  const { id: customerId } = createCustomer({ name: "Customer A" });
  const { id: productId } = createProduct({
    name: "Alpukat Mentega",
    variety: "Mentega",
    grade: "A",
    standardPurchasePrice: 20000,
    standardSellingPrice: 28000,
    minSellingPrice: 25000
  });
  const deliveryCat = db.prepare(`SELECT id FROM expense_categories WHERE name LIKE 'Pengiriman%'`).get() as { id: string };

  // TEST 1: Purchase 100kg cash.
  console.log("TEST 1: Purchase 100kg cash");
  const p1 = createPurchase({ supplierId, items: [{ productId, quantity: 100, purchasePrice: 20000 }], paidNow: 2_000_000, paymentAccountId: cashAccount });
  const p1row = db.prepare(`SELECT * FROM purchase_orders WHERE id = ?`).get(p1.id) as any;
  assert("landed cost = 2,000,000", p1row.total_landed_cost === 2_000_000);
  assert("payment status PAID", p1row.payment_status === "PAID");
  assert("outstanding = 0", p1row.outstanding === 0);

  // TEST 2: Purchase 100kg credit.
  console.log("\nTEST 2: Purchase 100kg credit");
  const p2 = createPurchase({ supplierId, items: [{ productId, quantity: 100, purchasePrice: 22000 }], dueDate: new Date(Date.now() + 7 * 86400000).toISOString() });
  const p2row = db.prepare(`SELECT * FROM purchase_orders WHERE id = ?`).get(p2.id) as any;
  const payable2 = db.prepare(`SELECT * FROM payables WHERE purchase_order_id = ?`).get(p2.id) as any;
  assert("payment status UNPAID", p2row.payment_status === "UNPAID");
  assert("payable created for full amount", payable2 && payable2.outstanding === 2_200_000);

  // TEST 3: Sell 50kg cash.
  console.log("\nTEST 3: Sell 50kg cash");
  const stockBefore3 = db.prepare(`SELECT current_qty as q, current_avg_cost as c FROM products WHERE id = ?`).get(productId) as any;
  const s3 = createSale({ customerId, items: [{ productId, quantity: 50, sellingPrice: 28000 }], paidNow: 1_400_000, paymentAccountId: cashAccount });
  const s3row = db.prepare(`SELECT * FROM sales_orders WHERE id = ?`).get(s3.id) as any;
  assert("net sales = 1,400,000", s3row.net_sales === 1_400_000);
  assert("cogs = qty * avg cost before sale", s3row.total_cogs === Math.round(50 * stockBefore3.c), `expected ${Math.round(50 * stockBefore3.c)}, got ${s3row.total_cogs}`);
  assert("gross profit = net sales - cogs", s3row.gross_profit === s3row.net_sales - s3row.total_cogs);
  assert("payment status PAID", s3row.payment_status === "PAID");

  // TEST 4: Sell 30kg credit.
  console.log("\nTEST 4: Sell 30kg credit");
  const s4 = createSale({ customerId, items: [{ productId, quantity: 30, sellingPrice: 28000 }], dueDate: new Date(Date.now() + 14 * 86400000).toISOString() });
  const s4row = db.prepare(`SELECT * FROM sales_orders WHERE id = ?`).get(s4.id) as any;
  const recv4 = db.prepare(`SELECT * FROM receivables WHERE sales_order_id = ?`).get(s4.id) as any;
  assert("payment status UNPAID", s4row.payment_status === "UNPAID");
  assert("receivable created", recv4 && recv4.outstanding === s4row.net_sales);

  // TEST 5: Receive partial customer payment.
  console.log("\nTEST 5: Receive partial customer payment");
  const partial = Math.round(recv4.outstanding / 2);
  recordReceivablePayment({ receivableId: recv4.id, amount: partial, accountId: cashAccount });
  const recv4After = db.prepare(`SELECT * FROM receivables WHERE id = ?`).get(recv4.id) as any;
  assert("receivable partially paid", recv4After.paid_amount === partial && recv4After.status === "OPEN");

  // TEST 6: Pay supplier partially.
  console.log("\nTEST 6: Pay supplier partially");
  const payable2Partial = Math.round(payable2.outstanding / 2);
  recordPayablePayment({ payableId: payable2.id, amount: payable2Partial, accountId: cashAccount });
  const payable2After = db.prepare(`SELECT * FROM payables WHERE id = ?`).get(payable2.id) as any;
  assert("payable partially paid", payable2After.paid_amount === payable2Partial && payable2After.status === "OPEN");

  // TEST 7: Record 10kg spoilage.
  console.log("\nTEST 7: Record 10kg spoilage");
  const batch = db.prepare(`SELECT id, quantity_on_hand FROM inventory_batches WHERE product_id = ? AND quantity_on_hand >= 10 ORDER BY received_date ASC LIMIT 1`).get(productId) as any;
  const stockBefore7 = db.prepare(`SELECT current_avg_cost as c FROM products WHERE id = ?`).get(productId) as any;
  const spoil = recordSpoilage({ batchId: batch.id, quantity: 10, reason: "ROTTEN" });
  const spoilRow = db.prepare(`SELECT * FROM spoilage_records WHERE id = ?`).get(spoil.id) as any;
  assert("loss value = 10 * avg cost", spoilRow.loss_value === Math.round(10 * stockBefore7.c));

  // TEST 8: Transfer money between two bank accounts.
  console.log("\nTEST 8: Transfer between accounts");
  const cashBalBefore = accountBalance(cashAccount);
  const bankBalBefore = accountBalance(bankAccount);
  transferFunds({ fromAccountId: cashAccount, toAccountId: bankAccount, amount: 500_000 });
  assert("source account -500,000", accountBalance(cashAccount) === cashBalBefore - 500_000);
  assert("dest account +500,000", accountBalance(bankAccount) === bankBalBefore + 500_000);
  assert("total business cash unchanged", accountBalance(cashAccount) + accountBalance(bankAccount) === cashBalBefore + bankBalBefore);

  // TEST 9: Record operating expense.
  console.log("\nTEST 9: Record operating expense");
  const cashBalBefore9 = accountBalance(cashAccount);
  recordExpense({ categoryId: deliveryCat.id, amount: 100_000, accountId: cashAccount, description: "Test expense" });
  assert("account debited by expense amount", accountBalance(cashAccount) === cashBalBefore9 - 100_000);

  // TEST 10: Change selling price below minimum.
  console.log("\nTEST 10: Selling price below minimum");
  let blocked = false;
  try {
    createSale({ customerId, items: [{ productId, quantity: 1, sellingPrice: 20000 }], paidNow: 20000, paymentAccountId: cashAccount });
  } catch {
    blocked = true;
  }
  assert("rejected without override reason", blocked);
  const s10 = createSale({ customerId, items: [{ productId, quantity: 1, sellingPrice: 20000, overrideReason: "Clearance stok" }], paidNow: 20000, paymentAccountId: cashAccount });
  const s10item = db.prepare(`SELECT * FROM sales_items WHERE sales_order_id = ?`).get(s10.id) as any;
  assert("accepted with override, flagged below_min_price", s10item.below_min_price === 1 && s10item.override_reason === "Clearance stok");

  // TEST 11: Attempt negative inventory.
  console.log("\nTEST 11: Attempt negative inventory");
  const currentStock = db.prepare(`SELECT current_qty as q FROM products WHERE id = ?`).get(productId) as any;
  let negBlocked = false;
  try {
    createSale({ customerId, items: [{ productId, quantity: currentStock.q + 1000, sellingPrice: 28000 }], paidNow: 0 });
  } catch {
    negBlocked = true;
  }
  assert("oversell rejected, inventory never goes negative", negBlocked);

  // TEST 12: Generate monthly P&L.
  console.log("\nTEST 12: Monthly P&L");
  const month = isoRange("this_month");
  const pnl = getPnL(month.fromIso, month.toIso);
  assert("gross profit = revenue - cogs", approx(pnl.grossProfit, pnl.revenue - pnl.cogs));
  assert("net profit = gross profit - opex + other income - other expense", approx(pnl.netProfit, pnl.grossProfit - pnl.operatingExpense + pnl.otherIncome - pnl.otherExpense));

  // TEST 13: Generate cash flow.
  console.log("\nTEST 13: Cash flow");
  const cf = getCashFlow(month.fromIso, month.toIso);
  assert("closing cash = opening + in - out", approx(cf.closingCash, cf.openingCash + cf.cashIn - cf.cashOut));

  // TEST 14: Generate inventory valuation.
  console.log("\nTEST 14: Inventory valuation");
  const val = getInventoryValuation();
  const productRow = db.prepare(`SELECT current_qty as q, current_avg_cost as c FROM products WHERE id = ?`).get(productId) as any;
  const item = val.items.find((i) => i.id === productId);
  assert("valuation matches product moving-average ledger", !!item && approx(item.value, Math.round(productRow.q * productRow.c)));

  // TEST 15: Reconcile inventory (batch ledger vs product ledger).
  console.log("\nTEST 15: Reconcile inventory");
  const batchSum = db.prepare(`SELECT COALESCE(SUM(quantity_on_hand),0) as q FROM inventory_batches WHERE product_id = ?`).get(productId) as any;
  const prodQty = db.prepare(`SELECT current_qty as q FROM products WHERE id = ?`).get(productId) as any;
  assert("sum(batch qty on hand) == product.current_qty", approx(batchSum.q, prodQty.q, 0.01), `batches=${batchSum.q} product=${prodQty.q}`);

  const wc = getWorkingCapital();
  assert("working capital = cash + AR + inventory - AP", approx(wc.workingCapital, wc.cash + wc.receivables + wc.inventory - wc.payables));

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  if (fail > 0) process.exit(1);
}

function accountBalance(accountId: string): number {
  const acc = db.prepare(`SELECT opening_balance as ob FROM accounts WHERE id = ?`).get(accountId) as any;
  const sum = db.prepare(`SELECT COALESCE(SUM(amount),0) as v FROM account_transactions WHERE account_id = ?`).get(accountId) as any;
  return acc.ob + sum.v;
}

main();
