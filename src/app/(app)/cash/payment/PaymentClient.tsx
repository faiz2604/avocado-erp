"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordReceivablePaymentAction, recordPayablePaymentAction } from "@/actions/cash";
import { formatIDR } from "@/lib/constants";

type OpenItem = { id: string; code: string; name: string; outstanding: number };

export default function PaymentClient({
  receivables,
  payables,
  accounts
}: {
  receivables: OpenItem[];
  payables: OpenItem[];
  accounts: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"receivable" | "payable">("receivable");
  const list = mode === "receivable" ? receivables : payables;
  const [itemId, setItemId] = useState(list[0]?.id ?? "");
  const [amount, setAmount] = useState(0);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selected = list.find((i) => i.id === itemId);

  function onModeChange(m: "receivable" | "payable") {
    setMode(m);
    const newList = m === "receivable" ? receivables : payables;
    setItemId(newList[0]?.id ?? "");
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result =
        mode === "receivable"
          ? await recordReceivablePaymentAction({ receivableId: itemId, amount, accountId })
          : await recordPayablePaymentAction({ payableId: itemId, amount, accountId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(mode === "receivable" ? "/receivables" : "/payables");
    });
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-4 max-w-lg">
      {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
      <div className="flex gap-2 text-sm">
        <button type="button" onClick={() => onModeChange("receivable")} className={`px-3 py-1.5 rounded-lg border ${mode === "receivable" ? "bg-avocado-600 text-white border-avocado-600" : "border-slate-300"}`}>
          Terima Piutang
        </button>
        <button type="button" onClick={() => onModeChange("payable")} className={`px-3 py-1.5 rounded-lg border ${mode === "payable" ? "bg-avocado-600 text-white border-avocado-600" : "border-slate-300"}`}>
          Bayar Hutang
        </button>
      </div>

      <div>
        <label className="label">{mode === "receivable" ? "Invoice (Customer)" : "Purchase (Supplier)"}</label>
        <select className="input" value={itemId} onChange={(e) => setItemId(e.target.value)}>
          {list.map((i) => (
            <option key={i.id} value={i.id}>{i.code} — {i.name} (outstanding {formatIDR(i.outstanding)})</option>
          ))}
        </select>
        {list.length === 0 && <p className="text-xs text-slate-400 mt-1">Tidak ada outstanding.</p>}
      </div>

      <div>
        <label className="label">Jumlah Dibayar</label>
        <input className="input" type="number" value={amount || ""} max={selected?.outstanding} onChange={(e) => setAmount(Number(e.target.value))} required />
      </div>

      <div>
        <label className="label">Akun Kas/Bank</label>
        <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)} required>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      <button className="btn-primary w-full" type="submit" disabled={pending || !itemId}>
        {pending ? "Menyimpan..." : "Simpan Pembayaran"}
      </button>
    </form>
  );
}
