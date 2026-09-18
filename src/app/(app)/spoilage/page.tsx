import Link from "next/link";
import { db, getDb } from "@/lib/db";
import { formatIDR, formatKg } from "@/lib/constants";
import { isoRange } from "@/lib/periods";
import { getSpoilageSummary } from "@/lib/finance";
import { Kpi } from "@/components/Kpi";

export const dynamic = "force-dynamic";

export default async function SpoilagePage() {
  await getDb();
  const rows = db
    .prepare(
      `SELECT sr.*, p.name as productName, b.code as batchCode FROM spoilage_records sr
       JOIN products p ON p.id = sr.product_id
       JOIN inventory_batches b ON b.id = sr.batch_id
       ORDER BY sr.date DESC LIMIT 100`
    )
    .all() as any[];
  const month = isoRange("this_month");
  const summary = getSpoilageSummary(month.fromIso, month.toIso);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Spoilage & Shrinkage</h1>
        <Link href="/spoilage/new" className="btn-primary">+ Catat Spoilage</Link>
      </div>

      <div className="grid grid-cols-3 gap-3 mt-4">
        <Kpi label="Spoilage Bulan Ini (kg)" value={formatKg(summary.quantity)} />
        <Kpi label="Nilai Kerugian" value={formatIDR(summary.value)} tone="bad" />
        <Kpi label="Spoilage %" value={`${summary.pct.toFixed(2)}%`} tone={summary.pct > 5 ? "bad" : "default"} />
      </div>

      <div className="card mt-4 overflow-x-auto">
        <table className="table-base">
          <thead><tr><th>Tanggal</th><th>Produk</th><th>Batch</th><th>Qty</th><th>Unit Cost</th><th>Loss Value</th><th>Alasan</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.date).toLocaleDateString("id-ID")}</td>
                <td>{r.productName}</td>
                <td className="text-xs text-slate-400">{r.batchCode}</td>
                <td>{formatKg(r.quantity)}</td>
                <td>{formatIDR(r.unit_cost)}</td>
                <td className="text-red-600">{formatIDR(r.loss_value)}</td>
                <td>{r.reason}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="text-center text-slate-400 py-6">Belum ada catatan spoilage.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
