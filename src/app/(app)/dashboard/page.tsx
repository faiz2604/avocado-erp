import { Kpi, SectionTitle } from "@/components/Kpi";
import { formatIDR, formatKg } from "@/lib/constants";
import {
  getTodaySnapshot,
  getPnL,
  getWorkingCapital,
  getInventoryValuation,
  getBatchAging,
  getSpoilageSummary,
  getReceivablesAging,
  getPayablesAging,
  getCashFlow
} from "@/lib/finance";
import { isoRange } from "@/lib/periods";
import Link from "next/link";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await getDb();
  const today = getTodaySnapshot();
  const month = isoRange("this_month");
  const pnl = getPnL(month.fromIso, month.toIso);
  const cf = getCashFlow(month.fromIso, month.toIso);
  const wc = getWorkingCapital();
  const inv = getInventoryValuation();
  const aging = getBatchAging();
  const spoilage = getSpoilageSummary(month.fromIso, month.toIso);
  const ar = getReceivablesAging();
  const ap = getPayablesAging();

  const agingAlertKg = aging.summary.Aging + aging.summary.Critical;
  const overdueAR = ar.items.filter((i) => i.daysOverdue > 0);
  const overdueAP = ap.items.filter((i) => i.daysOverdue > 0);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Business Dashboard</h1>
        <div className="flex gap-2 text-xs">
          <Link href="/sales/new" className="btn-primary">+ Sale</Link>
          <Link href="/purchases/new" className="btn-secondary">+ Purchase</Link>
        </div>
      </div>

      <SectionTitle>Hari Ini</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label="Sales" value={formatIDR(today.sales)} />
        <Kpi label="Purchases" value={formatIDR(today.purchases)} />
        <Kpi label="Expenses" value={formatIDR(today.expenses)} />
        <Kpi label="Gross Profit" value={formatIDR(today.grossProfit)} tone={today.grossProfit >= 0 ? "good" : "bad"} />
        <Kpi label="Cash In / Out" value={`${formatIDR(today.cashIn)} / ${formatIDR(today.cashOut)}`} />
      </div>

      <SectionTitle>Bulan Ini</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi label="Revenue" value={formatIDR(pnl.revenue)} />
        <Kpi label="HPP / COGS" value={formatIDR(pnl.cogs)} />
        <Kpi label="Gross Profit" value={formatIDR(pnl.grossProfit)} sub={`${pnl.grossMarginPct.toFixed(1)}% margin`} tone="good" />
        <Kpi label="Operating Expense" value={formatIDR(pnl.operatingExpense)} />
        <Kpi label="Net Profit" value={formatIDR(pnl.netProfit)} sub={`${pnl.netMarginPct.toFixed(1)}% margin`} tone={pnl.netProfit >= 0 ? "good" : "bad"} />
        <Kpi label="Closing Cash" value={formatIDR(cf.closingCash)} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <SectionTitle>Inventory</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <Kpi label="Total Stok" value={formatKg(inv.totalQty)} />
            <Kpi label="Nilai Inventory" value={formatIDR(inv.totalValue)} />
            <Kpi label="Aging Stock (>5 hari)" value={formatKg(agingAlertKg)} tone={agingAlertKg > 0 ? "bad" : "default"} />
            <Kpi label="Spoilage Bulan Ini" value={`${formatKg(spoilage.quantity)} (${spoilage.pct.toFixed(1)}%)`} tone={spoilage.quantity > 0 ? "bad" : "default"} />
          </div>
        </div>
        <div>
          <SectionTitle>Working Capital</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <Kpi label="Cash" value={formatIDR(wc.cash)} />
            <Kpi label="Piutang (+)" value={formatIDR(wc.receivables)} />
            <Kpi label="Inventory (+)" value={formatIDR(wc.inventory)} />
            <Kpi label="Hutang (-)" value={formatIDR(wc.payables)} />
          </div>
          <div className="card mt-3 bg-avocado-50 border-avocado-200">
            <div className="kpi-label">Working Capital</div>
            <div className="kpi-value text-avocado-800">{formatIDR(wc.workingCapital)}</div>
          </div>
        </div>
      </div>

      <SectionTitle>Alert Center</SectionTitle>
      <div className="card divide-y divide-slate-100">
        {agingAlertKg > 0 && (
          <AlertRow severity="warn" text={`${formatKg(agingAlertKg)} inventory has been stored for more than 5 days.`} />
        )}
        {overdueAR.slice(0, 5).map((i) => (
          <AlertRow key={i.id} severity="bad" text={`Invoice ${i.code} (${i.customerName}) overdue ${i.daysOverdue} hari — ${formatIDR(i.outstanding)}`} />
        ))}
        {overdueAP.slice(0, 5).map((i) => (
          <AlertRow key={i.id} severity="bad" text={`Hutang ke ${i.supplierName} (${i.code}) overdue ${i.daysOverdue} hari — ${formatIDR(i.outstanding)}`} />
        ))}
        {agingAlertKg === 0 && overdueAR.length === 0 && overdueAP.length === 0 && (
          <div className="py-3 text-sm text-slate-400">Tidak ada alert saat ini.</div>
        )}
      </div>
    </div>
  );
}

function AlertRow({ severity, text }: { severity: "warn" | "bad"; text: string }) {
  return (
    <div className="py-2.5 flex items-center gap-2 text-sm">
      <span>{severity === "bad" ? "🔴" : "⚠️"}</span>
      <span className="text-slate-700">{text}</span>
    </div>
  );
}
