import Link from "next/link";
import { getCurrentCashPosition } from "@/lib/finance";
import CashClient from "./CashClient";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CashPage() {
  await getDb();
  const { accounts } = getCurrentCashPosition();
  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Cash & Bank</h1>
        <Link href="/cash/payment" className="btn-primary">+ Catat Pembayaran</Link>
      </div>
      <div className="mt-4">
        {accounts.length === 0 ? (
          <div className="card text-sm text-slate-600">Belum ada akun kas/bank. Tambahkan lewat tab &quot;Tambah Akun&quot; di bawah.</div>
        ) : null}
        <CashClient accounts={accounts} />
      </div>
    </div>
  );
}
