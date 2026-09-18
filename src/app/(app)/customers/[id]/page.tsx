import { getCustomer, getCustomerDashboard } from "@/lib/master";
import { db, getDb } from "@/lib/db";
import { formatIDR, formatKg } from "@/lib/constants";
import { Kpi } from "@/components/Kpi";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({ params }: { params: { id: string } }) {
  await getDb();
  const customer = getCustomer(params.id) as any;
  if (!customer) notFound();
  const dash = getCustomerDashboard(params.id);
  const orders = db
    .prepare(`SELECT id, code, date, net_sales, gross_profit, payment_status, outstanding FROM sales_orders WHERE customer_id = ? AND status='ACTIVE' ORDER BY date DESC LIMIT 30`)
    .all(params.id) as any[];

  return (
    <div>
      <Link href="/customers" className="text-xs text-slate-400">&larr; Kembali</Link>
      <div className="flex items-center justify-between mt-1">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">{customer.name}</h1>
          <p className="text-sm text-slate-500">{customer.type} · {customer.phone ?? "-"}</p>
        </div>
        <Link href={`/sales/new?customerId=${customer.id}`} className="btn-primary">+ Sale untuk customer ini</Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
        <Kpi label="Total Sales" value={formatIDR(dash.totalSales)} />
        <Kpi label="Total Qty" value={formatKg(dash.totalQuantity)} />
        <Kpi label="Avg Selling Price" value={formatIDR(dash.avgSellingPrice)} />
        <Kpi label="Gross Profit" value={formatIDR(dash.grossProfit)} sub={`${dash.grossMarginPct.toFixed(1)}% margin`} />
        <Kpi label="Piutang Outstanding" value={formatIDR(dash.outstandingReceivable)} tone={dash.outstandingReceivable > 0 ? "bad" : "default"} />
        <Kpi label="Purchase Frequency" value={`${dash.orders}x`} />
        <Kpi label="Last Purchase" value={dash.lastPurchaseDate ? new Date(dash.lastPurchaseDate).toLocaleDateString("id-ID") : "-"} />
      </div>

      <div className="card mt-6 overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr><th>Invoice</th><th>Tanggal</th><th>Net Sales</th><th>Gross Profit</th><th>Status</th><th>Outstanding</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map((o) => (
              <tr key={o.id}>
                <td><Link href={`/sales/${o.id}`} className="text-avocado-700 font-medium">{o.code}</Link></td>
                <td>{new Date(o.date).toLocaleDateString("id-ID")}</td>
                <td>{formatIDR(o.net_sales)}</td>
                <td>{formatIDR(o.gross_profit)}</td>
                <td>{o.payment_status}</td>
                <td>{formatIDR(o.outstanding)}</td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={6} className="text-center text-slate-400 py-6">Belum ada transaksi.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
