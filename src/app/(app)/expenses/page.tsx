import Link from "next/link";
import { db, getDb } from "@/lib/db";
import { formatIDR } from "@/lib/constants";
import { isoRange } from "@/lib/periods";
import { getExpenseByCategory } from "@/lib/finance";
import { Kpi } from "@/components/Kpi";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  await getDb();
  const rows = db
    .prepare(
      `SELECT e.*, ec.name as categoryName, ec.cost_type as costType, a.name as accountName FROM expenses e
       JOIN expense_categories ec ON ec.id = e.category_id
       JOIN accounts a ON a.id = e.account_id
       ORDER BY e.date DESC LIMIT 100`
    )
    .all() as any[];
  const month = isoRange("this_month");
  const byCategory = getExpenseByCategory(month.fromIso, month.toIso) as any[];
  const total = byCategory.reduce((s, c) => s + c.total, 0);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Expenses</h1>
        <div className="flex gap-2">
          <a href="/api/export/expenses" className="btn-secondary text-xs">Export CSV</a>
          <Link href="/expenses/new" className="btn-primary">+ Expense Baru</Link>
        </div>
      </div>

      <Kpi label="Total Expense Bulan Ini" value={formatIDR(total)} />

      <div className="card mt-4 overflow-x-auto">
        <table className="table-base">
          <thead><tr><th>Tanggal</th><th>Kategori</th><th>Tipe</th><th>Deskripsi</th><th>Akun</th><th>Jumlah</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.date).toLocaleDateString("id-ID")}</td>
                <td>{r.categoryName}</td>
                <td>{r.costType === "DIRECT" ? <span className="badge bg-slate-100 text-slate-600">Direct</span> : <span className="badge bg-blue-50 text-blue-700">Operating</span>}</td>
                <td>{r.description ?? "-"}</td>
                <td>{r.accountName}</td>
                <td>{formatIDR(r.amount)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="text-center text-slate-400 py-6">Belum ada expense.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
