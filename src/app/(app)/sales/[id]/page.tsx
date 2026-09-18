import { db, getDb } from "@/lib/db";
import { formatIDR, formatKg } from "@/lib/constants";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default async function SaleDetailPage({ params }: { params: { id: string } }) {
  await getDb();
  const so = db
    .prepare(`SELECT so.*, c.name as customerName FROM sales_orders so JOIN customers c ON c.id = so.customer_id WHERE so.id = ?`)
    .get(params.id) as any;
  if (!so) notFound();
  const items = db
    .prepare(
      `SELECT si.*, p.name as productName, b.code as batchCode FROM sales_items si
       JOIN products p ON p.id = si.product_id
       JOIN inventory_batches b ON b.id = si.batch_id
       WHERE si.sales_order_id = ?`
    )
    .all(params.id) as any[];
  const payments = db.prepare(`SELECT sp.*, a.name as accountName FROM sales_payments sp JOIN accounts a ON a.id = sp.account_id WHERE sales_order_id = ?`).all(params.id) as any[];

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">{so.code}</h1>
          <p className="text-sm text-slate-500">{so.customerName} · {new Date(so.date).toLocaleDateString("id-ID")}</p>
        </div>
        <StatusBadge status={so.payment_status} />
      </div>

      <div className="card mt-4 overflow-x-auto">
        <table className="table-base">
          <thead><tr><th>Produk</th><th>Batch</th><th>Qty</th><th>Harga Jual</th><th>Diskon</th><th>Net</th><th>HPP</th><th>Gross Profit</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((i) => (
              <tr key={i.id}>
                <td>{i.productName}{i.below_min_price ? <span className="ml-1 text-amber-600" title={i.override_reason}>⚠</span> : null}</td>
                <td className="text-xs text-slate-400">{i.batchCode}</td>
                <td>{formatKg(i.quantity)}</td>
                <td>{formatIDR(i.selling_price)}</td>
                <td>{formatIDR(i.discount)}</td>
                <td>{formatIDR(i.net_amount)}</td>
                <td>{formatIDR(i.cogs)}</td>
                <td className="text-avocado-700 font-medium">{formatIDR(i.gross_profit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mt-4">
        <div className="card space-y-1 text-sm">
          <Row label="Gross Sales" value={formatIDR(so.gross_sales)} />
          <Row label="Diskon" value={formatIDR(so.discount)} />
          <Row label="Net Sales" value={formatIDR(so.net_sales)} bold />
          <Row label="HPP / COGS" value={formatIDR(so.total_cogs)} />
          <Row label="Gross Profit" value={formatIDR(so.gross_profit)} bold />
          <Row label="Gross Margin" value={`${Number(so.gross_margin_pct).toFixed(1)}%`} />
        </div>
        <div className="card space-y-1 text-sm">
          <Row label="Dibayar" value={formatIDR(so.amount_paid)} />
          <Row label="Outstanding" value={formatIDR(so.outstanding)} bold />
          <Row label="Jatuh Tempo" value={so.due_date ? new Date(so.due_date).toLocaleDateString("id-ID") : "-"} />
        </div>
      </div>

      {payments.length > 0 && (
        <div className="card mt-4">
          <div className="label mb-2">Riwayat Pembayaran</div>
          {payments.map((p) => (
            <div key={p.id} className="flex justify-between text-sm py-1 border-b border-slate-50 last:border-0">
              <span>{new Date(p.date).toLocaleDateString("id-ID")} · {p.accountName}</span>
              <span className="font-medium">{formatIDR(p.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={bold ? "font-semibold" : ""}>{value}</span>
    </div>
  );
}
