import { db } from "./db";
import { INVENTORY_AGE_THRESHOLDS } from "./constants";

export function inventoryAgeDays(receivedDateIso: string, asOf: Date = new Date()): number {
  const received = new Date(receivedDateIso);
  const ms = asOf.getTime() - received.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

export function inventoryAgeStatus(days: number): "Fresh" | "Watch" | "Aging" | "Critical" {
  if (days <= INVENTORY_AGE_THRESHOLDS.FRESH_MAX) return "Fresh";
  if (days <= INVENTORY_AGE_THRESHOLDS.WATCH_MAX) return "Watch";
  if (days <= INVENTORY_AGE_THRESHOLDS.AGING_MAX) return "Aging";
  return "Critical";
}

export type BatchRow = {
  id: string;
  code: string;
  product_id: string;
  supplier_id: string;
  quantity_received: number;
  quantity_on_hand: number;
  effective_cost: number;
  received_date: string;
};

/**
 * Picks batches oldest-first (FIFO by received_date) for a product and reduces their
 * quantity_on_hand to cover `qty`. Must be called inside a db.transaction(). Returns the list of
 * (batchId, qtyTaken) consumed — callers use this to create one InventoryMovement / SalesItem row
 * per batch touched. Throws if there isn't enough on-hand stock (never allows negative inventory —
 * Requirement: TEST 11 "Attempt negative inventory" must be rejected).
 */
export function depleteBatchesFifo(
  productId: string,
  qty: number
): { batchId: string; qtyTaken: number }[] {
  const batches = db
    .prepare(
      `SELECT id, quantity_on_hand FROM inventory_batches
       WHERE product_id = ? AND quantity_on_hand > 0
       ORDER BY received_date ASC, created_at ASC`
    )
    .all(productId) as { id: string; quantity_on_hand: number }[];

  const totalAvailable = batches.reduce((s, b) => s + b.quantity_on_hand, 0);
  if (qty > totalAvailable + 1e-6) {
    throw new Error(
      `Insufficient stock: requested ${qty}kg but only ${totalAvailable}kg on hand for this product.`
    );
  }

  const taken: { batchId: string; qtyTaken: number }[] = [];
  let remaining = qty;
  const update = db.prepare(`UPDATE inventory_batches SET quantity_on_hand = ? WHERE id = ?`);

  for (const b of batches) {
    if (remaining <= 1e-9) break;
    const take = Math.min(b.quantity_on_hand, remaining);
    update.run(round2(b.quantity_on_hand - take), b.id);
    taken.push({ batchId: b.id, qtyTaken: round2(take) });
    remaining = round2(remaining - take);
  }

  return taken;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function getProductStock(productId: string): { qty: number; avgCost: number; value: number } {
  const row = db
    .prepare(`SELECT current_qty as qty, current_avg_cost as avgCost FROM products WHERE id = ?`)
    .get(productId) as { qty: number; avgCost: number } | undefined;
  if (!row) return { qty: 0, avgCost: 0, value: 0 };
  return { qty: row.qty, avgCost: row.avgCost, value: Math.round(row.qty * row.avgCost) };
}
