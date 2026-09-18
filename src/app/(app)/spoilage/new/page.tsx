import { db, getDb } from "@/lib/db";
import SpoilageNewClient from "./SpoilageNewClient";

export const dynamic = "force-dynamic";

export default async function NewSpoilagePage() {
  await getDb();
  const batches = db
    .prepare(
      `SELECT b.id, b.code, p.name as productName, b.quantity_on_hand as qty FROM inventory_batches b
       JOIN products p ON p.id = b.product_id
       WHERE b.quantity_on_hand > 0.0001 ORDER BY b.received_date ASC`
    )
    .all() as any[];

  return (
    <div>
      <h1 className="text-lg font-semibold text-slate-900 mb-4">Catat Spoilage</h1>
      {batches.length === 0 ? (
        <div className="card text-sm text-slate-600">Tidak ada batch dengan stok tersedia.</div>
      ) : (
        <SpoilageNewClient batches={batches} />
      )}
    </div>
  );
}
