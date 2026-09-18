import Link from "next/link";
import { db, getDb } from "@/lib/db";
import { formatIDR } from "@/lib/constants";
import { StatusBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default async function PurchasesPage() {
  await getDb();
  const rows = db
    .prepare(
      `SELECT po.id, po.code, po.date, s.name as supplierName, po.total_landed_cost, po.payment_status, po.outstanding, po.status
       FROM purchase_orders po JOIN suppliers s ON s.id = po.supplier_id
       ORDER BY po.date DESC LIMIT 100`
    )
    .all() as any[];

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Purchases</h1>
        <div className="flex gap-2">
          <a href="/api/export/purchases" className="btn-secondary text-xs">Export CSV</a>
          <Link href="/purchases/new" className="btn-primary">+ Purchase Baru</Link>
        </div>
      </div>
      <div className="card mt-4 overflow-x-auto">
        <table className="table-base">
          <thead><tr><th>No</th><th>Tanggal</th><th>Supplier</th><th>Landed Cost</th><th>Status</th><th>Outstanding</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id}>
                <td><Link href={`/purchases/${r.id}`} className="text-avocado-700 font-medium">{r.code}</Link></td>
                <td>{new Date(r.date).toLocaleDateString("id-ID")}</td>
                <td>{r.supplierName}</td>
                <td>{formatIDR(r.total_landed_cost)}</td>
                <td><StatusBadge status={r.payment_status} /></td>
                <td>{formatIDR(r.outstanding)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="text-center text-slate-400 py-6">Belum ada pembelian.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
