import { db } from "./db";

function todayStamp(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

export function nextPurchaseCode(): string {
  const stamp = todayStamp();
  const seq = nextSeqLike("purchase_orders", `PO-${stamp}-%`);
  return `PO-${stamp}-${String(seq).padStart(3, "0")}`;
}

export function nextSalesCode(): string {
  const stamp = todayStamp();
  const seq = nextSeqLike("sales_orders", `INV-${stamp}-%`);
  return `INV-${stamp}-${String(seq).padStart(3, "0")}`;
}

export function nextBatchCode(): string {
  const stamp = todayStamp();
  const seq = nextSeqLike("inventory_batches", `AVC-${stamp}-%`);
  return `AVC-${stamp}-${String(seq).padStart(3, "0")}`;
}

function nextSeqLike(table: string, likePattern: string): number {
  const row = db
    .prepare(`SELECT code FROM ${table} WHERE code LIKE ? ORDER BY code DESC LIMIT 1`)
    .get(likePattern) as { code?: string } | undefined;
  if (!row?.code) return 1;
  const parts = row.code.split("-");
  const last = parseInt(parts[parts.length - 1] ?? "0", 10);
  return isNaN(last) ? 1 : last + 1;
}
