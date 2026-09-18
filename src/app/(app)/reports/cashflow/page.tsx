import { getCashFlow } from "@/lib/finance";
import { isoRange, type PeriodKey } from "@/lib/periods";
import { formatIDR } from "@/lib/constants";
import PeriodSelector from "@/components/PeriodSelector";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CashFlowPage({ searchParams }: { searchParams: { period?: PeriodKey } }) {
  await getDb();
  const period = searchParams.period ?? "this_month";
  const { fromIso, toIso } = isoRange(period);
  const cf = getCashFlow(fromIso, toIso);

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-lg font-semibold text-slate-900">Cash Flow Statement</h1>
        <a href={`/api/export/cashflow?period=${period}`} className="btn-secondary text-xs">Export CSV</a>
      </div>
      <div className="mt-3"><PeriodSelector basePath="/reports/cashflow" active={period} /></div>

      <div className="card mt-4 divide-y divide-slate-100">
        <Line label="Opening Cash" value={cf.openingCash} bold />
        <div className="py-2 text-xs font-semibold uppercase text-slate-400">Cash In</div>
        <Line label="Customer Collections" value={cf.customerCollections} />
        <Line label="Other Income" value={cf.otherIncome} />
        <Line label="Modal Masuk (Capital In)" value={cf.capitalIn} />
        <Line label="Total Cash In" value={cf.cashIn} bold />
        <div className="py-2 text-xs font-semibold uppercase text-slate-400">Cash Out</div>
        <Line label="Supplier Payments" value={-cf.supplierPayments} />
        <Line label="Operating Expenses" value={-cf.operatingExpenses} />
        <Line label="Other Payments" value={-cf.otherPayments} />
        <Line label="Modal Keluar (Capital Out)" value={-cf.capitalOut} />
        <Line label="Total Cash Out" value={-cf.cashOut} bold />
        <Line label="Closing Cash" value={cf.closingCash} bold big />
      </div>
      <p className="text-xs text-slate-400 mt-2">
        Transfer antar akun tidak dihitung sebagai Cash In/Out (net Rp0 secara bisnis), tetapi tetap memindahkan saldo
        antar akun individual — lihat halaman Cash & Bank.
      </p>
    </div>
  );
}

function Line({ label, value, bold, big }: { label: string; value: number; bold?: boolean; big?: boolean }) {
  const negative = value < 0;
  return (
    <div className="py-2 flex items-center justify-between">
      <span className={bold ? "font-semibold text-slate-800" : "text-slate-600"}>{label}</span>
      <span className={`${bold ? "font-semibold" : ""} ${big ? "text-lg" : ""} ${negative ? "text-red-600" : "text-slate-900"}`}>{formatIDR(value)}</span>
    </div>
  );
}
