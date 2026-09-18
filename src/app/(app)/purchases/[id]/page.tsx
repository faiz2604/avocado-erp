import { db, getDb } from "@/lib/db";
import { formatIDR, formatKg } from "@/lib/constants";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default async function PurchaseDetailPage({ params }: { params: { id: string } }) {
  await getDb();
  const po = db
    .prepare(`SELECT po.*, s.name as supplierName FROM purchase_orders po JOIN suppliers s ON s.id = po.supplier_id WHERE po.id = ?`)
    .get(params.id) as any;
  if (!po) notFound();
  const items = db
    .prepare(
      `SELECT pi.*, p.name as productName, b.code as batchCode FROM purchase_items pi
       JOIN products p ON p.id = pi.product_id
       LEFT JOIN inventory_batches b ON b.purchase_item_id = pi.id
       WHERE pi.purchase_order_id = ?`
    )
    .all(params.id) as any[];
  const payments = db.prepare(`SELECT pp.*, a.name as accountName FROM purchase_payments pp JOIN accounts a ON a.id = pp.account_id WHERE purchase_order_id = ?`).all(params.id) as any[];

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">{po.code}</h1>
          <p className="text-sm text-slate-500">{po.supplierName} · {new Date(po.date).toLocaleDateString("id-ID")}</p>
        </div>
        <StatusBadge status={po.payment_status} />
      </div>

      <div className="card mt-4 overflow-x-auto">
        <table className="table-base">
          <thead><tr><th>Produk</th><th>Batch</th><th>Qty</th><th>Harga Beli</th><th>Landed Cost</th><th>Effective Cost/kg</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((i) => (
              <tr key={i.id}>
                <td>{i.productName}</td>
                <td className="text-xs text-slate-400">{i.batchCode}</td>
                <td>{formatKg(i.quantity)}</td>
                <td>{formatIDR(i.purchase_price)}</td>
                <td>{formatIDR(i.allocated_landed_cost)}</td>
                <td>{formatIDR(i.effective_cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mt-4">
        <div className="card space-y-1 text-sm">
          <Row label="Purchase Cost" value={formatIDR(po.total_purchase_cost)} />
          <Row label="Transport" value={formatIDR(po.transport_cost)} />
          <Row label="Loading" value={formatIDR(po.loading_cost)} />
          <Row label="Other Direct Cost" value={formatIDR(po.other_direct_cost)} />
          <Row label="Total Landed Cost" value={formatIDR(po.total_landed_cost)} bold />
        </div>
        <div className="card space-y-1 text-sm">
          <Row label="Dibayar" value={formatIDR(po.amount_paid)} />
          <Row label="Outstanding" value={formatIDR(po.outstanding)} bold />
          <Row label="Jatuh Tempo" value={po.due_date ? new Date(po.due_date).toLocaleDateString("id-ID") : "-"} />
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
