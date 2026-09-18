import { getSupplier, getSupplierDashboard } from "@/lib/master";
import { db, getDb } from "@/lib/db";
import { formatIDR, formatKg } from "@/lib/constants";
import { Kpi } from "@/components/Kpi";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SupplierDetailPage({ params }: { params: { id: string } }) {
  await getDb();
  const supplier = getSupplier(params.id) as any;
  if (!supplier) notFound();
  const dash = getSupplierDashboard(params.id);
  const orders = db
    .prepare(`SELECT id, code, date, total_landed_cost, payment_status, outstanding FROM purchase_orders WHERE supplier_id = ? AND status='ACTIVE' ORDER BY date DESC LIMIT 30`)
    .all(params.id) as any[];

  return (
    <div>
      <Link href="/suppliers" className="text-xs text-slate-400">&larr; Kembali</Link>
      <div className="flex items-center justify-between mt-1">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">{supplier.name}</h1>
          <p className="text-sm text-slate-500">{supplier.type} · {supplier.phone ?? "-"}</p>
        </div>
        <Link href={`/purchases/new?supplierId=${supplier.id}`} className="btn-primary">+ Purchase dari supplier ini</Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
        <Kpi label="Total Purchase" value={formatIDR(dash.totalPurchase)} />
        <Kpi label="Total Qty" value={formatKg(dash.totalQuantity)} />
        <Kpi label="Avg Purchase Price" value={formatIDR(dash.avgPurchasePrice)} />
        <Kpi label="Spoilage Rate" value={`${dash.spoilageRate.toFixed(1)}%`} tone={dash.spoilageRate > 5 ? "bad" : "default"} />
        <Kpi label="Hutang Outstanding" value={formatIDR(dash.outstandingPayable)} tone={dash.outstandingPayable > 0 ? "bad" : "default"} />
        <Kpi label="Purchase Frequency" value={`${dash.orders}x`} />
        <Kpi label="Last Purchase" value={dash.lastPurchaseDate ? new Date(dash.lastPurchaseDate).toLocaleDateString("id-ID") : "-"} />
      </div>

      <div className="card mt-6 overflow-x-auto">
        <table className="table-base">
          <thead><tr><th>No Purchase</th><th>Tanggal</th><th>Landed Cost</th><th>Status</th><th>Outstanding</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map((o) => (
              <tr key={o.id}>
                <td><Link href={`/purchases/${o.id}`} className="text-avocado-700 font-medium">{o.code}</Link></td>
                <td>{new Date(o.date).toLocaleDateString("id-ID")}</td>
                <td>{formatIDR(o.total_landed_cost)}</td>
                <td>{o.payment_status}</td>
                <td>{formatIDR(o.outstanding)}</td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={5} className="text-center text-slate-400 py-6">Belum ada transaksi.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
