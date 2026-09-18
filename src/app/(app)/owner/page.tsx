import { getPnL, getWorkingCapital, getInventoryValuation, getSpoilageSummary, getExpenseByCategory } from "@/lib/finance";
import { isoRange } from "@/lib/periods";
import { formatIDR, formatKg } from "@/lib/constants";
import { Kpi, SectionTitle } from "@/components/Kpi";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function OwnerViewPage() {
  await getDb();
  const periods = [
    { key: "today" as const, label: "Hari Ini" },
    { key: "this_week" as const, label: "Minggu Ini" },
    { key: "this_month" as const, label: "Bulan Ini" },
    { key: "ytd" as const, label: "Year to Date" }
  ];
  const rows = periods.map((p) => {
    const { fromIso, toIso } = isoRange(p.key);
    const pnl = getPnL(fromIso, toIso);
    return { ...p, revenue: pnl.revenue, netProfit: pnl.netProfit };
  });

  const wc = getWorkingCapital();
  const inv = getInventoryValuation();
  const month = isoRange("this_month");
  const spoilage = getSpoilageSummary(month.fromIso, month.toIso);
  const expenseCats = (getExpenseByCategory(month.fromIso, month.toIso) as any[]).slice(0, 3);

  return (
    <div>
      <h1 className="text-lg font-semibold text-slate-900">Owner View</h1>
      <p className="text-sm text-slate-500 mb-4">Ringkasan 7 pertanyaan penting untuk pemilik usaha.</p>

      <SectionTitle>1–2. Berapa Saya Jual & Berapa Saya Untung?</SectionTitle>
      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead><tr><th>Periode</th><th>Sales (Revenue)</th><th>Net Profit</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.key}>
                <td className="font-medium">{r.label}</td>
                <td>{formatIDR(r.revenue)}</td>
                <td className={r.netProfit >= 0 ? "text-avocado-700 font-medium" : "text-red-600 font-medium"}>{formatIDR(r.netProfit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SectionTitle>3–6. Posisi Saat Ini</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="3. Cash Saya" value={formatIDR(wc.cash)} />
        <Kpi label="4. Stok Saya" value={`${formatKg(inv.totalQty)} (${formatIDR(inv.totalValue)})`} />
        <Kpi label="5. Piutang (Uang Ditahan Customer)" value={formatIDR(wc.receivables)} />
        <Kpi label="6. Hutang ke Supplier" value={formatIDR(wc.payables)} />
      </div>

      <SectionTitle>7. Di Mana Saya Kehilangan Uang? (Bulan Ini)</SectionTitle>
      <div className="card divide-y divide-slate-100">
        {spoilage.value > 0 && (
          <div className="py-2 flex justify-between text-sm">
            <span>Spoilage / kerusakan stok ({spoilage.pct.toFixed(1)}% dari stok masuk)</span>
            <span className="text-red-600 font-medium">{formatIDR(spoilage.value)}</span>
          </div>
        )}
        {expenseCats.map((c) => (
          <div key={c.category} className="py-2 flex justify-between text-sm">
            <span>{c.category}</span>
            <span className="text-red-600 font-medium">{formatIDR(c.total)}</span>
          </div>
        ))}
        {spoilage.value === 0 && expenseCats.length === 0 && (
          <div className="py-2 text-sm text-slate-400">Belum ada data biaya bulan ini.</div>
        )}
      </div>
    </div>
  );
}
