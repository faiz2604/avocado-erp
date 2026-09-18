// All state-changing operations. Every function here runs inside ONE better-sqlite3
// db.transaction() so inventory, COGS, cash, and AR/AP can never drift apart
// (Requirement #42 "Data Consistency" / #43 "Financial Reconciliation").
import { db } from "./db";
import { newId, nowIso } from "./id";
import { nextPurchaseCode, nextSalesCode, nextBatchCode } from "./codes";
import { depleteBatchesFifo, getProductStock, round2 } from "./inventory";
import {
  landedCost,
  effectiveCostPerKg,
  weightedAverageCost,
  grossSalesAmount,
  netSalesAmount,
  cogsAmount,
  grossProfitAmount,
  grossMarginPct,
  spoilageLossValue
} from "./costing";

function audit(entityType: string, entityId: string, action: string, userId?: string, after?: unknown) {
  db.prepare(
    `INSERT INTO audit_logs (id, entity_type, entity_id, action, after_json, user_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(newId("aud"), entityType, entityId, action, after ? JSON.stringify(after) : null, userId ?? null, nowIso());
}

function paymentStatusFor(total: number, paid: number): "UNPAID" | "PARTIAL" | "PAID" {
  if (paid <= 0) return "UNPAID";
  if (paid >= total) return "PAID";
  return "PARTIAL";
}

// ---------------------------------------------------------------------------
// PURCHASE
// ---------------------------------------------------------------------------

export type CreatePurchaseInput = {
  supplierId: string;
  date?: string;
  items: { productId: string; quantity: number; purchasePrice: number }[];
  transportCost?: number;
  loadingCost?: number;
  otherDirectCost?: number;
  paidNow?: number;
  paymentAccountId?: string;
  dueDate?: string;
  notes?: string;
  userId?: string;
};

export function createPurchase(input: CreatePurchaseInput): { id: string; code: string } {
  if (!input.items?.length) throw new Error("Purchase harus memiliki minimal satu item.");
  for (const it of input.items) {
    if (it.quantity <= 0) throw new Error("Quantity pembelian harus lebih dari 0.");
    if (it.purchasePrice < 0) throw new Error("Harga beli tidak boleh negatif.");
  }
  const transport = input.transportCost ?? 0;
  const loading = input.loadingCost ?? 0;
  const other = input.otherDirectCost ?? 0;
  const totalPurchaseCost = input.items.reduce((s, i) => s + Math.round(i.quantity * i.purchasePrice), 0);
  const totalLandedCost = landedCost(totalPurchaseCost, transport, loading, other);
  const paidNow = Math.max(0, Math.min(input.paidNow ?? 0, totalLandedCost));
  if (paidNow > 0 && !input.paymentAccountId) {
    throw new Error("Pilih akun kas/bank untuk pembayaran.");
  }

  const run = db.transaction(() => {
    const poId = newId("po");
    const code = nextPurchaseCode();
    const date = input.date ?? nowIso();

    db.prepare(
      `INSERT INTO purchase_orders
        (id, code, date, supplier_id, transport_cost, loading_cost, other_direct_cost,
         total_purchase_cost, total_landed_cost, payment_status, amount_paid, outstanding,
         due_date, status, notes, created_by_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'UNPAID', 0, ?, ?, 'ACTIVE', ?, ?, ?, ?)`
    ).run(
      poId,
      code,
      date,
      input.supplierId,
      transport,
      loading,
      other,
      totalPurchaseCost,
      totalLandedCost,
      totalLandedCost,
      input.dueDate ?? null,
      input.notes ?? null,
      input.userId ?? null,
      nowIso(),
      nowIso()
    );

    for (const item of input.items) {
      const itemPurchaseCost = Math.round(item.quantity * item.purchasePrice);
      const share = totalPurchaseCost > 0 ? itemPurchaseCost / totalPurchaseCost : 1 / input.items.length;
      const itemExtra = Math.round((transport + loading + other) * share);
      const itemLanded = itemPurchaseCost + itemExtra;
      const itemEffCost = effectiveCostPerKg(itemLanded, item.quantity);

      const piId = newId("pi");
      db.prepare(
        `INSERT INTO purchase_items (id, purchase_order_id, product_id, quantity, purchase_price, allocated_landed_cost, effective_cost)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(piId, poId, item.productId, item.quantity, item.purchasePrice, itemLanded, itemEffCost);

      const batchId = newId("batch");
      const batchCode = nextBatchCode();
      db.prepare(
        `INSERT INTO inventory_batches
          (id, code, purchase_item_id, product_id, supplier_id, quantity_received, quantity_on_hand, effective_cost, received_date, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(batchId, batchCode, piId, item.productId, input.supplierId, item.quantity, item.quantity, itemEffCost, date, nowIso());

      db.prepare(
        `INSERT INTO inventory_movements
          (id, batch_id, product_id, date, type, direction, quantity, unit_cost, total_value, reference_type, reference_id, notes, created_by_id, created_at)
         VALUES (?, ?, ?, ?, 'PURCHASE', 'IN', ?, ?, ?, 'PurchaseOrder', ?, NULL, ?, ?)`
      ).run(newId("mov"), batchId, item.productId, date, item.quantity, itemEffCost, itemLanded, poId, input.userId ?? null, nowIso());

      const prod = db
        .prepare(`SELECT current_qty as qty, current_avg_cost as avgCost FROM products WHERE id = ?`)
        .get(item.productId) as { qty: number; avgCost: number };
      const newAvg = weightedAverageCost(prod.qty, prod.avgCost, item.quantity, itemEffCost);
      db.prepare(`UPDATE products SET current_qty = ?, current_avg_cost = ? WHERE id = ?`).run(
        round2(prod.qty + item.quantity),
        newAvg,
        item.productId
      );
    }

    if (paidNow > 0) {
      db.prepare(
        `INSERT INTO purchase_payments (id, purchase_order_id, account_id, amount, date, notes, created_by_id, created_at)
         VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`
      ).run(newId("pp"), poId, input.paymentAccountId, paidNow, date, input.userId ?? null, nowIso());

      db.prepare(
        `INSERT INTO account_transactions (id, account_id, type, amount, date, description, reference_type, reference_id, created_at)
         VALUES (?, ?, 'PURCHASE_PAYMENT', ?, ?, ?, 'PurchaseOrder', ?, ?)`
      ).run(newId("at"), input.paymentAccountId, -paidNow, date, `Pembayaran pembelian ${code}`, poId, nowIso());
    }

    const outstanding = totalLandedCost - paidNow;
    const status = paymentStatusFor(totalLandedCost, paidNow);
    db.prepare(`UPDATE purchase_orders SET payment_status = ?, amount_paid = ?, outstanding = ? WHERE id = ?`).run(
      status,
      paidNow,
      outstanding,
      poId
    );

    if (outstanding > 0) {
      db.prepare(
        `INSERT INTO payables (id, purchase_order_id, supplier_id, amount, paid_amount, outstanding, due_date, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'OPEN', ?, ?)`
      ).run(newId("pay"), poId, input.supplierId, totalLandedCost, paidNow, outstanding, input.dueDate ?? null, nowIso(), nowIso());
    }

    audit("PurchaseOrder", poId, "CREATE", input.userId, { code, totalLandedCost, paidNow });
    return { id: poId, code };
  });

  return run();
}

// ---------------------------------------------------------------------------
// SALES
// ---------------------------------------------------------------------------

export type CreateSaleInput = {
  customerId: string;
  date?: string;
  items: {
    productId: string;
    quantity: number;
    sellingPrice: number;
    discount?: number;
    overrideReason?: string;
  }[];
  paidNow?: number;
  paymentAccountId?: string;
  dueDate?: string;
  notes?: string;
  userId?: string;
};

export function createSale(input: CreateSaleInput): { id: string; code: string } {
  if (!input.items?.length) throw new Error("Penjualan harus memiliki minimal satu item.");
  for (const it of input.items) {
    if (it.quantity <= 0) throw new Error("Quantity jual harus lebih dari 0.");
    if (it.sellingPrice < 0) throw new Error("Harga jual tidak boleh negatif.");
  }

  const run = db.transaction(() => {
    const soId = newId("so");
    const code = nextSalesCode();
    const date = input.date ?? nowIso();

    db.prepare(
      `INSERT INTO sales_orders
        (id, code, date, customer_id, discount, gross_sales, net_sales, total_cogs, gross_profit,
         gross_margin_pct, payment_status, amount_paid, outstanding, due_date, status, notes, created_by_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, 0, 0, 0, 0, 0, 'UNPAID', 0, 0, ?, 'ACTIVE', ?, ?, ?, ?)`
    ).run(soId, code, date, input.customerId, input.dueDate ?? null, input.notes ?? null, input.userId ?? null, nowIso(), nowIso());

    let grossSales = 0;
    let totalDiscount = 0;
    let netSales = 0;
    let totalCOGS = 0;
    let grossProfit = 0;

    const productCache = db.prepare(`SELECT id, min_selling_price FROM products WHERE id = ?`);

    for (const item of input.items) {
      const product = productCache.get(item.productId) as { id: string; min_selling_price: number } | undefined;
      if (!product) throw new Error("Produk tidak ditemukan.");
      const belowMin = item.sellingPrice < product.min_selling_price;
      if (belowMin && !item.overrideReason) {
        throw new Error(
          `LOW MARGIN WARNING: Harga jual (${item.sellingPrice}) di bawah harga jual minimum (${product.min_selling_price}). Butuh alasan override.`
        );
      }

      const stock = getProductStock(item.productId);
      if (item.quantity > stock.qty + 1e-6) {
        throw new Error(
          `Stok tidak cukup untuk produk ini: tersedia ${stock.qty}kg, diminta ${item.quantity}kg. Stok tidak boleh negatif.`
        );
      }
      const unitCost = stock.avgCost; // weighted-average cost/kg BEFORE this sale (Section 9)

      const consumed = depleteBatchesFifo(item.productId, item.quantity);
      const discountTotal = item.discount ?? 0;

      for (const c of consumed) {
        const portionShare = c.qtyTaken / item.quantity;
        const gross = grossSalesAmount(c.qtyTaken, item.sellingPrice);
        const discountPortion = Math.round(discountTotal * portionShare);
        const net = netSalesAmount(gross, discountPortion);
        const cogsPortion = cogsAmount(c.qtyTaken, unitCost);
        const gp = grossProfitAmount(net, cogsPortion);

        db.prepare(
          `INSERT INTO sales_items
            (id, sales_order_id, product_id, batch_id, quantity, selling_price, discount, gross_amount, net_amount, unit_cost, cogs, gross_profit, below_min_price, override_reason)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          newId("si"),
          soId,
          item.productId,
          c.batchId,
          c.qtyTaken,
          item.sellingPrice,
          discountPortion,
          gross,
          net,
          unitCost,
          cogsPortion,
          gp,
          belowMin ? 1 : 0,
          item.overrideReason ?? null
        );

        db.prepare(
          `INSERT INTO inventory_movements
            (id, batch_id, product_id, date, type, direction, quantity, unit_cost, total_value, reference_type, reference_id, notes, created_by_id, created_at)
           VALUES (?, ?, ?, ?, 'SALE', 'OUT', ?, ?, ?, 'SalesOrder', ?, NULL, ?, ?)`
        ).run(newId("mov"), c.batchId, item.productId, date, c.qtyTaken, unitCost, cogsPortion, soId, input.userId ?? null, nowIso());

        grossSales += gross;
        totalDiscount += discountPortion;
        netSales += net;
        totalCOGS += cogsPortion;
        grossProfit += gp;
      }

      db.prepare(`UPDATE products SET current_qty = ? WHERE id = ?`).run(round2(stock.qty - item.quantity), item.productId);
    }

    const margin = grossMarginPct(grossProfit, netSales);
    const paidNow = Math.max(0, Math.min(input.paidNow ?? 0, netSales));
    if (paidNow > 0 && !input.paymentAccountId) {
      throw new Error("Pilih akun kas/bank untuk penerimaan pembayaran.");
    }
    const outstanding = netSales - paidNow;
    const status = paymentStatusFor(netSales, paidNow);

    db.prepare(
      `UPDATE sales_orders SET discount = ?, gross_sales = ?, net_sales = ?, total_cogs = ?, gross_profit = ?,
        gross_margin_pct = ?, payment_status = ?, amount_paid = ?, outstanding = ? WHERE id = ?`
    ).run(totalDiscount, grossSales, netSales, totalCOGS, grossProfit, margin, status, paidNow, outstanding, soId);

    if (paidNow > 0) {
      db.prepare(
        `INSERT INTO sales_payments (id, sales_order_id, account_id, amount, date, notes, created_by_id, created_at)
         VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`
      ).run(newId("sp"), soId, input.paymentAccountId, paidNow, date, input.userId ?? null, nowIso());

      db.prepare(
        `INSERT INTO account_transactions (id, account_id, type, amount, date, description, reference_type, reference_id, created_at)
         VALUES (?, ?, 'SALE_PAYMENT', ?, ?, ?, 'SalesOrder', ?, ?)`
      ).run(newId("at"), input.paymentAccountId, paidNow, date, `Penerimaan penjualan ${code}`, soId, nowIso());
    }

    if (outstanding > 0) {
      db.prepare(
        `INSERT INTO receivables (id, sales_order_id, customer_id, amount, paid_amount, outstanding, due_date, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'OPEN', ?, ?)`
      ).run(newId("recv"), soId, input.customerId, netSales, paidNow, outstanding, input.dueDate ?? null, nowIso(), nowIso());
    }

    audit("SalesOrder", soId, "CREATE", input.userId, { code, netSales, grossProfit });
    return { id: soId, code };
  });

  return run();
}

// ---------------------------------------------------------------------------
// SPOILAGE
// ---------------------------------------------------------------------------

export type RecordSpoilageInput = {
  date?: string;
  batchId: string;
  quantity: number;
  reason: string;
  notes?: string;
  attachmentUrl?: string;
  userId?: string;
};

export function recordSpoilage(input: RecordSpoilageInput): { id: string } {
  if (input.quantity <= 0) throw new Error("Quantity spoilage harus lebih dari 0.");

  const run = db.transaction(() => {
    const batch = db
      .prepare(`SELECT id, product_id, quantity_on_hand FROM inventory_batches WHERE id = ?`)
      .get(input.batchId) as { id: string; product_id: string; quantity_on_hand: number } | undefined;
    if (!batch) throw new Error("Batch tidak ditemukan.");
    if (input.quantity > batch.quantity_on_hand + 1e-6) {
      throw new Error(`Quantity spoilage (${input.quantity}kg) melebihi stok batch ini (${batch.quantity_on_hand}kg).`);
    }

    const stock = getProductStock(batch.product_id);
    const unitCost = stock.avgCost;
    const lossValue = spoilageLossValue(input.quantity, unitCost);
    const date = input.date ?? nowIso();

    db.prepare(`UPDATE inventory_batches SET quantity_on_hand = ? WHERE id = ?`).run(
      round2(batch.quantity_on_hand - input.quantity),
      batch.id
    );

    const spoilId = newId("spoil");
    db.prepare(
      `INSERT INTO spoilage_records (id, date, batch_id, product_id, quantity, unit_cost, loss_value, reason, notes, attachment_url, recorded_by_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      spoilId,
      date,
      batch.id,
      batch.product_id,
      input.quantity,
      unitCost,
      lossValue,
      input.reason,
      input.notes ?? null,
      input.attachmentUrl ?? null,
      input.userId ?? null,
      nowIso()
    );

    db.prepare(
      `INSERT INTO inventory_movements
        (id, batch_id, product_id, date, type, direction, quantity, unit_cost, total_value, reference_type, reference_id, notes, created_by_id, created_at)
       VALUES (?, ?, ?, ?, 'SPOILAGE', 'OUT', ?, ?, ?, 'SpoilageRecord', ?, ?, ?, ?)`
    ).run(newId("mov"), batch.id, batch.product_id, date, input.quantity, unitCost, lossValue, spoilId, input.reason, input.userId ?? null, nowIso());

    db.prepare(`UPDATE products SET current_qty = ? WHERE id = ?`).run(round2(stock.qty - input.quantity), batch.product_id);

    audit("SpoilageRecord", spoilId, "CREATE", input.userId, { quantity: input.quantity, lossValue });
    return { id: spoilId };
  });

  return run();
}

// ---------------------------------------------------------------------------
// CASH & BANK
// ---------------------------------------------------------------------------

export function transferFunds(input: {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date?: string;
  notes?: string;
  userId?: string;
}) {
  if (input.amount <= 0) throw new Error("Jumlah transfer harus lebih dari 0.");
  if (input.fromAccountId === input.toAccountId) throw new Error("Akun asal dan tujuan tidak boleh sama.");

  const run = db.transaction(() => {
    const date = input.date ?? nowIso();
    const pairId = newId("xfer");
    db.prepare(
      `INSERT INTO account_transactions (id, account_id, type, amount, date, description, reference_type, reference_id, transfer_pair_id, created_at)
       VALUES (?, ?, 'TRANSFER_OUT', ?, ?, ?, 'Transfer', ?, ?, ?)`
    ).run(newId("at"), input.fromAccountId, -input.amount, date, input.notes ?? "Transfer antar akun", pairId, pairId, nowIso());
    db.prepare(
      `INSERT INTO account_transactions (id, account_id, type, amount, date, description, reference_type, reference_id, transfer_pair_id, created_at)
       VALUES (?, ?, 'TRANSFER_IN', ?, ?, ?, 'Transfer', ?, ?, ?)`
    ).run(newId("at"), input.toAccountId, input.amount, date, input.notes ?? "Transfer antar akun", pairId, pairId, nowIso());
    audit("Transfer", pairId, "CREATE", input.userId, input);
    return { id: pairId };
  });

  return run();
}

export function recordCapital(input: {
  accountId: string;
  amount: number; // positive = injection, negative = withdrawal
  date?: string;
  notes?: string;
  userId?: string;
}) {
  if (input.amount === 0) throw new Error("Jumlah modal tidak boleh 0.");
  const run = db.transaction(() => {
    const date = input.date ?? nowIso();
    const id = newId("at");
    db.prepare(
      `INSERT INTO account_transactions (id, account_id, type, amount, date, description, reference_type, reference_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'Capital', ?, ?)`
    ).run(id, input.accountId, input.amount > 0 ? "CAPITAL_IN" : "CAPITAL_OUT", input.amount, date, input.notes ?? "Modal pemilik", id, nowIso());
    audit("Capital", id, "CREATE", input.userId, input);
    return { id };
  });
  return run();
}

export function recordExpense(input: {
  date?: string;
  categoryId: string;
  description?: string;
  amount: number;
  accountId: string;
  vendor?: string;
  notes?: string;
  attachmentUrl?: string;
  userId?: string;
}) {
  if (input.amount <= 0) throw new Error("Jumlah expense harus lebih dari 0.");
  const run = db.transaction(() => {
    const date = input.date ?? nowIso();
    const expId = newId("exp");
    db.prepare(
      `INSERT INTO expenses (id, date, category_id, description, amount, account_id, vendor, notes, attachment_url, created_by_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      expId,
      date,
      input.categoryId,
      input.description ?? null,
      input.amount,
      input.accountId,
      input.vendor ?? null,
      input.notes ?? null,
      input.attachmentUrl ?? null,
      input.userId ?? null,
      nowIso()
    );

    db.prepare(
      `INSERT INTO account_transactions (id, account_id, type, amount, date, description, reference_type, reference_id, created_at)
       VALUES (?, ?, 'EXPENSE', ?, ?, ?, 'Expense', ?, ?)`
    ).run(newId("at"), input.accountId, -input.amount, date, input.description ?? "Expense", expId, nowIso());

    audit("Expense", expId, "CREATE", input.userId, input);
    return { id: expId };
  });
  return run();
}

export function recordReceivablePayment(input: {
  receivableId: string;
  amount: number;
  accountId: string;
  date?: string;
  notes?: string;
  userId?: string;
}) {
  if (input.amount <= 0) throw new Error("Jumlah pembayaran harus lebih dari 0.");
  const run = db.transaction(() => {
    const recv = db.prepare(`SELECT * FROM receivables WHERE id = ?`).get(input.receivableId) as any;
    if (!recv) throw new Error("Piutang tidak ditemukan.");
    if (input.amount > recv.outstanding + 1e-6) throw new Error("Jumlah pembayaran melebihi sisa piutang.");

    const date = input.date ?? nowIso();
    const newPaid = recv.paid_amount + input.amount;
    const newOutstanding = recv.amount - newPaid;
    db.prepare(`UPDATE receivables SET paid_amount = ?, outstanding = ?, status = ?, updated_at = ? WHERE id = ?`).run(
      newPaid,
      newOutstanding,
      newOutstanding <= 0 ? "PAID" : "OPEN",
      nowIso(),
      recv.id
    );

    const so = db.prepare(`SELECT * FROM sales_orders WHERE id = ?`).get(recv.sales_order_id) as any;
    const soNewPaid = so.amount_paid + input.amount;
    const soNewOutstanding = so.net_sales - soNewPaid;
    db.prepare(`UPDATE sales_orders SET amount_paid = ?, outstanding = ?, payment_status = ? WHERE id = ?`).run(
      soNewPaid,
      soNewOutstanding,
      paymentStatusFor(so.net_sales, soNewPaid),
      so.id
    );

    db.prepare(
      `INSERT INTO sales_payments (id, sales_order_id, account_id, amount, date, notes, created_by_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(newId("sp"), so.id, input.accountId, input.amount, date, input.notes ?? null, input.userId ?? null, nowIso());

    db.prepare(
      `INSERT INTO account_transactions (id, account_id, type, amount, date, description, reference_type, reference_id, created_at)
       VALUES (?, ?, 'SALE_PAYMENT', ?, ?, ?, 'SalesOrder', ?, ?)`
    ).run(newId("at"), input.accountId, input.amount, date, `Pembayaran piutang ${so.code}`, so.id, nowIso());

    audit("Receivable", recv.id, "UPDATE", input.userId, { amount: input.amount });
    return { id: recv.id };
  });
  return run();
}

export function recordPayablePayment(input: {
  payableId: string;
  amount: number;
  accountId: string;
  date?: string;
  notes?: string;
  userId?: string;
}) {
  if (input.amount <= 0) throw new Error("Jumlah pembayaran harus lebih dari 0.");
  const run = db.transaction(() => {
    const pay = db.prepare(`SELECT * FROM payables WHERE id = ?`).get(input.payableId) as any;
    if (!pay) throw new Error("Hutang tidak ditemukan.");
    if (input.amount > pay.outstanding + 1e-6) throw new Error("Jumlah pembayaran melebihi sisa hutang.");

    const date = input.date ?? nowIso();
    const newPaid = pay.paid_amount + input.amount;
    const newOutstanding = pay.amount - newPaid;
    db.prepare(`UPDATE payables SET paid_amount = ?, outstanding = ?, status = ?, updated_at = ? WHERE id = ?`).run(
      newPaid,
      newOutstanding,
      newOutstanding <= 0 ? "PAID" : "OPEN",
      nowIso(),
      pay.id
    );

    const po = db.prepare(`SELECT * FROM purchase_orders WHERE id = ?`).get(pay.purchase_order_id) as any;
    const poNewPaid = po.amount_paid + input.amount;
    const poNewOutstanding = po.total_landed_cost - poNewPaid;
    db.prepare(`UPDATE purchase_orders SET amount_paid = ?, outstanding = ?, payment_status = ? WHERE id = ?`).run(
      poNewPaid,
      poNewOutstanding,
      paymentStatusFor(po.total_landed_cost, poNewPaid),
      po.id
    );

    db.prepare(
      `INSERT INTO purchase_payments (id, purchase_order_id, account_id, amount, date, notes, created_by_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(newId("pp"), po.id, input.accountId, input.amount, date, input.notes ?? null, input.userId ?? null, nowIso());

    db.prepare(
      `INSERT INTO account_transactions (id, account_id, type, amount, date, description, reference_type, reference_id, created_at)
       VALUES (?, ?, 'PURCHASE_PAYMENT', ?, ?, ?, 'PurchaseOrder', ?, ?)`
    ).run(newId("at"), input.accountId, -input.amount, date, `Pembayaran hutang ${po.code}`, po.id, nowIso());

    audit("Payable", pay.id, "UPDATE", input.userId, { amount: input.amount });
    return { id: pay.id };
  });
  return run();
}
