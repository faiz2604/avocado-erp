import { getReceivablesAging, getPayablesAging } from "@/lib/finance";
import { listAccounts } from "@/lib/master";
import PaymentClient from "./PaymentClient";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function PaymentPage() {
  await getDb();
  const ar = getReceivablesAging();
  const ap = getPayablesAging();
  const accounts = listAccounts(true) as any[];

  const receivables = ar.items.map((i: any) => ({ id: i.id, code: i.code, name: i.customerName, outstanding: i.outstanding }));
  const payables = ap.items.map((i: any) => ({ id: i.id, code: i.code, name: i.supplierName, outstanding: i.outstanding }));

  return (
    <div>
      <h1 className="text-lg font-semibold text-slate-900 mb-4">Catat Pembayaran</h1>
      {accounts.length === 0 ? (
        <div className="card text-sm text-slate-600">Tambahkan minimal 1 akun kas/bank terlebih dahulu.</div>
      ) : (
        <PaymentClient receivables={receivables} payables={payables} accounts={accounts} />
      )}
    </div>
  );
}
