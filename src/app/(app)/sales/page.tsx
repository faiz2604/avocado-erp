import Link from "next/link";
import { db, getDb } from "@/lib/db";
import { formatIDR } from "@/lib/constants";
import { StatusBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default async function SalesPage() {
  await getDb();
  const rows = db
    .prepare(
      `SELECT so.id, so.code, so.date, c.name as customerName, so.net_sales, so.gross_profit, so.payment_status, so.outstanding
       FROM sales_orders so JOIN customers c ON c.id = so.customer_id
       ORDER BY so.date DESC LIMIT 100`
    )
    .all() as any[];

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Sales</h1>
        <div className="flex gap-2">
          <a href="/api/export/sales" className="btn-secondary text-xs">Export CSV</a>
          <Link href="/sales/new" className="btn-primary">+ Sale Baru</Link>
        </div>
      </div>
      <div className="card mt-4 overflow-x-auto">
        <table className="table-base">
          <thead><tr><th>Invoice</th><th>Tanggal</th><th>Customer</th><th>Net Sales</th><th>Gross Profit</th><th>Status</th><th>Outstanding</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id}>
                <td><Link href={`/sales/${r.id}`} className="text-avocado-700 font-medium">{r.code}</Link></td>
                <td>{new Date(r.date).toLocaleDateString("id-ID")}</td>
                <td>{r.customerName}</td>
                <td>{formatIDR(r.net_sales)}</td>
                <td>{formatIDR(r.gross_profit)}</td>
                <td><StatusBadge status={r.payment_status} /></td>
                <td>{formatIDR(r.outstanding)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="text-center text-slate-400 py-6">Belum ada penjualan.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
