import { getRevenueTrend, getTopCustomers, getTopProducts, getTopSuppliers, getExpenseByCategory } from "@/lib/finance";
import { isoRange } from "@/lib/periods";
import { formatIDR, formatKg } from "@/lib/constants";
import { SectionTitle } from "@/components/Kpi";
import TrendChart from "@/components/TrendChart";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ManagementPage() {
  await getDb();
  const trend = getRevenueTrend(6);
  const month = isoRange("this_month");
  const topCustomers = getTopCustomers(month.fromIso, month.toIso, 5) as any[];
  const topProducts = getTopProducts(month.fromIso, month.toIso, 5) as any[];
  const topSuppliers = getTopSuppliers(month.fromIso, month.toIso, 5) as any[];
  const expenseCats = getExpenseByCategory(month.fromIso, month.toIso) as any[];

  return (
    <div>
      <h1 className="text-lg font-semibold text-slate-900">Management Overview</h1>

      <SectionTitle>Revenue / Gross Profit / HPP Trend (6 Bulan)</SectionTitle>
      <div className="card">
        {trend.length > 0 ? <TrendChart data={trend} /> : <p className="text-sm text-slate-400">Belum ada data penjualan.</p>}
      </div>

      <div className="grid md:grid-cols-3 gap-4 mt-2">
        <div>
          <SectionTitle>Top Customers (Bulan Ini)</SectionTitle>
          <div className="card divide-y divide-slate-100">
            {topCustomers.map((c) => (
              <div key={c.id} className="py-2 text-sm">
                <div className="flex justify-between"><span className="font-medium">{c.name}</span><span>{formatIDR(c.revenue)}</span></div>
                <div className="text-xs text-slate-400">Gross Profit: {formatIDR(c.grossProfit)}</div>
              </div>
            ))}
            {topCustomers.length === 0 && <p className="text-sm text-slate-400 py-2">Belum ada data.</p>}
          </div>
        </div>
        <div>
          <SectionTitle>Top Products by Revenue &amp; Profit</SectionTitle>
          <div className="card divide-y divide-slate-100">
            {topProducts.map((p) => (
              <div key={p.id} className="py-2 text-sm">
                <div className="flex justify-between"><span className="font-medium">{p.name}</span><span>{formatIDR(p.revenue)}</span></div>
                <div className="text-xs text-slate-400">Qty: {formatKg(p.qty)} · Gross Profit: {formatIDR(p.grossProfit)}</div>
              </div>
            ))}
            {topProducts.length === 0 && <p className="text-sm text-slate-400 py-2">Belum ada data. (Produk dengan penjualan tinggi belum tentu paling untung — bandingkan kolom Gross Profit.)</p>}
          </div>
        </div>
        <div>
          <SectionTitle>Top Suppliers by Purchase</SectionTitle>
          <div className="card divide-y divide-slate-100">
            {topSuppliers.map((s) => (
              <div key={s.id} className="py-2 text-sm flex justify-between">
                <span className="font-medium">{s.name}</span><span>{formatIDR(s.purchases)}</span>
              </div>
            ))}
            {topSuppliers.length === 0 && <p className="text-sm text-slate-400 py-2">Belum ada data.</p>}
          </div>
        </div>
      </div>

      <SectionTitle>Expense Categories (Bulan Ini)</SectionTitle>
      <div className="card divide-y divide-slate-100">
        {expenseCats.map((c) => (
          <div key={c.category} className="py-2 flex justify-between text-sm">
            <span>{c.category} <span className="text-xs text-slate-400">({c.costType})</span></span>
            <span className="font-medium">{formatIDR(c.total)}</span>
          </div>
        ))}
        {expenseCats.length === 0 && <p className="text-sm text-slate-400 py-2">Belum ada expense bulan ini.</p>}
      </div>
    </div>
  );
}
