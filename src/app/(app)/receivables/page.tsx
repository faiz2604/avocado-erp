import Link from "next/link";
import { getReceivablesAging } from "@/lib/finance";
import { formatIDR } from "@/lib/constants";
import { Kpi } from "@/components/Kpi";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const BUCKET_COLOR: Record<string, string> = {
  Current: "bg-slate-100 text-slate-600",
  "1-30": "bg-amber-100 text-amber-800",
  "31-60": "bg-orange-100 text-orange-800",
  "61-90": "bg-red-100 text-red-700",
  "90+": "bg-red-200 text-red-800"
};

export default async function ReceivablesPage() {
  await getDb();
  const { items, buckets, total } = getReceivablesAging();

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Piutang Customer (AR)</h1>
        <div className="flex gap-2">
          <a href="/api/export/receivables" className="btn-secondary text-xs">Export CSV</a>
          <Link href="/cash/payment" className="btn-primary">+ Terima Pembayaran</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
        <Kpi label="Total AR" value={formatIDR(total)} />
        {Object.entries(buckets).map(([b, v]) => (
          <Kpi key={b} label={b === "Current" ? "Belum Jatuh Tempo" : `Overdue ${b} hari`} value={formatIDR(v)} tone={b !== "Current" && v > 0 ? "bad" : "default"} />
        ))}
      </div>

      <div className="card mt-4 overflow-x-auto">
        <table className="table-base">
          <thead><tr><th>Invoice</th><th>Customer</th><th>Outstanding</th><th>Overdue</th><th>Bucket</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((i) => (
              <tr key={i.id}>
                <td><Link href={`/sales/${i.id}`} className="text-avocado-700 font-medium">{i.code}</Link></td>
                <td>{i.customerName}</td>
                <td>{formatIDR(i.outstanding)}</td>
                <td>{i.daysOverdue > 0 ? `${i.daysOverdue} hari` : "-"}</td>
                <td><span className={`badge ${BUCKET_COLOR[i.bucket]}`}>{i.bucket}</span></td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={5} className="text-center text-slate-400 py-6">Tidak ada piutang outstanding.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
