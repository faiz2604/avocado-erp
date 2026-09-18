import { getPnL } from "@/lib/finance";
import { isoRange, type PeriodKey } from "@/lib/periods";
import { formatIDR } from "@/lib/constants";
import PeriodSelector from "@/components/PeriodSelector";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function PnLPage({ searchParams }: { searchParams: { period?: PeriodKey } }) {
  await getDb();
  const period = searchParams.period ?? "this_month";
  const { fromIso, toIso } = isoRange(period);
  const pnl = getPnL(fromIso, toIso);

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-lg font-semibold text-slate-900">Profit & Loss</h1>
        <a href={`/api/export/pnl?period=${period}`} className="btn-secondary text-xs">Export CSV</a>
      </div>
      <div className="mt-3"><PeriodSelector basePath="/reports/pnl" active={period} /></div>

      <div className="card mt-4 divide-y divide-slate-100">
        <Line label="Revenue (Penjualan)" value={pnl.revenue} />
        <Line label="(-) HPP / COGS" value={-pnl.cogs} />
        <Line label="Gross Profit" value={pnl.grossProfit} bold sub={`${pnl.grossMarginPct.toFixed(1)}% margin`} />
        <Line label="(-) Operating Expense" value={-pnl.operatingExpense} />
        <Line label="Operating Profit" value={pnl.operatingProfit} bold sub={`${pnl.operatingMarginPct.toFixed(1)}% margin`} />
        <Line label="(+) Other Income" value={pnl.otherIncome} />
        <Line label="(-) Other Expense" value={-pnl.otherExpense} />
        <Line label="Net Profit" value={pnl.netProfit} bold big sub={`${pnl.netMarginPct.toFixed(1)}% margin`} />
      </div>
    </div>
  );
}

function Line({ label, value, bold, big, sub }: { label: string; value: number; bold?: boolean; big?: boolean; sub?: string }) {
  const negative = value < 0;
  return (
    <div className="py-2.5 flex items-center justify-between">
      <span className={bold ? "font-semibold text-slate-800" : "text-slate-600"}>{label}</span>
      <div className="text-right">
        <div className={`${bold ? "font-semibold" : ""} ${big ? "text-lg" : ""} ${negative ? "text-red-600" : "text-slate-900"}`}>
          {formatIDR(value)}
        </div>
        {sub && <div className="text-xs text-slate-400">{sub}</div>}
      </div>
    </div>
  );
}
