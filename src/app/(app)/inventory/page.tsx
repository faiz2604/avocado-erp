import Link from "next/link";
import { getBatchAging, getInventoryValuation } from "@/lib/finance";
import { formatIDR, formatKg } from "@/lib/constants";
import { Kpi } from "@/components/Kpi";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const STATUS_COLOR: Record<string, string> = {
  Fresh: "bg-avocado-100 text-avocado-800",
  Watch: "bg-amber-100 text-amber-800",
  Aging: "bg-orange-100 text-orange-800",
  Critical: "bg-red-100 text-red-700"
};

export default async function InventoryPage() {
  await getDb();
  const { batches, summary } = getBatchAging();
  const valuation = getInventoryValuation();

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Inventory</h1>
        <div className="flex gap-2">
          <a href="/api/export/inventory" className="btn-secondary text-xs">Export Valuation</a>
          <a href="/api/export/movements" className="btn-secondary text-xs">Export Movements</a>
          <Link href="/spoilage/new" className="btn-secondary text-xs">+ Catat Spoilage</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
        <Kpi label="Fresh (0-2 hari)" value={formatKg(summary.Fresh)} />
        <Kpi label="Watch (3-5 hari)" value={formatKg(summary.Watch)} />
        <Kpi label="Aging (6-7 hari)" value={formatKg(summary.Aging)} tone={summary.Aging > 0 ? "bad" : "default"} />
        <Kpi label="Critical (>7 hari)" value={formatKg(summary.Critical)} tone={summary.Critical > 0 ? "bad" : "default"} />
      </div>

      <div className="card mt-4 bg-avocado-50 border-avocado-200 flex justify-between items-center">
        <div>
          <div className="kpi-label">Total Nilai Inventory</div>
          <div className="kpi-value text-avocado-800">{formatIDR(valuation.totalValue)}</div>
        </div>
        <div className="text-right">
          <div className="kpi-label">Total Stok</div>
          <div className="kpi-value">{formatKg(valuation.totalQty)}</div>
        </div>
      </div>

      <div className="card mt-4 overflow-x-auto">
        <table className="table-base">
          <thead><tr><th>Batch</th><th>Produk</th><th>Supplier</th><th>Qty</th><th>Cost/kg</th><th>Nilai</th><th>Umur</th><th>Status</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {batches.map((b) => (
              <tr key={b.id}>
                <td className="text-xs text-slate-400">{b.code}</td>
                <td>{b.productName}{b.variety ? ` — ${b.variety}` : ""}{b.grade ? ` (${b.grade})` : ""}</td>
                <td>{b.supplierName}</td>
                <td>{formatKg(b.qty)}</td>
                <td>{formatIDR(b.cost)}</td>
                <td>{formatIDR(b.value)}</td>
                <td>{b.ageDays} hari</td>
                <td><span className={`badge ${STATUS_COLOR[b.status]}`}>{b.status}</span></td>
              </tr>
            ))}
            {batches.length === 0 && <tr><td colSpan={8} className="text-center text-slate-400 py-6">Belum ada stok.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
