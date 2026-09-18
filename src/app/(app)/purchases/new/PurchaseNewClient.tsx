"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPurchaseAction } from "@/actions/purchase";
import { formatIDR } from "@/lib/constants";

type Option = { id: string; name: string };
type ItemRow = { productId: string; quantity: number; purchasePrice: number };

export default function PurchaseNewClient({
  suppliers,
  products,
  accounts,
  defaultSupplierId
}: {
  suppliers: Option[];
  products: Option[];
  accounts: Option[];
  defaultSupplierId?: string;
}) {
  const router = useRouter();
  const [supplierId, setSupplierId] = useState(defaultSupplierId ?? suppliers[0]?.id ?? "");
  const [items, setItems] = useState<ItemRow[]>([{ productId: products[0]?.id ?? "", quantity: 0, purchasePrice: 0 }]);
  const [transport, setTransport] = useState(0);
  const [loading, setLoading] = useState(0);
  const [other, setOther] = useState(0);
  const [paymentMode, setPaymentMode] = useState<"cash" | "credit" | "partial">("cash");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [paidNow, setPaidNow] = useState(0);
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const totalPurchaseCost = items.reduce((s, i) => s + i.quantity * i.purchasePrice, 0);
  const totalLandedCost = totalPurchaseCost + transport + loading + other;
  const totalQty = items.reduce((s, i) => s + i.quantity, 0);
  const effectiveCostAvg = totalQty > 0 ? Math.round(totalLandedCost / totalQty) : 0;

  function updateItem(i: number, patch: Partial<ItemRow>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  function computedPaidNow() {
    if (paymentMode === "cash") return totalLandedCost;
    if (paymentMode === "credit") return 0;
    return paidNow;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const paid = computedPaidNow();
    startTransition(async () => {
      const result = await createPurchaseAction({
        supplierId,
        items: items.filter((i) => i.productId && i.quantity > 0),
        transportCost: transport,
        loadingCost: loading,
        otherDirectCost: other,
        paidNow: paid,
        paymentAccountId: paid > 0 ? accountId : undefined,
        dueDate: paymentMode !== "cash" ? dueDate || undefined : undefined,
        notes: notes || undefined
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/purchases/${result.data.id}`);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}

      <div className="card grid md:grid-cols-2 gap-3">
        <div>
          <label className="label">Supplier</label>
          <select className="input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} required>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <label className="label mb-0">Item Pembelian</label>
          <button type="button" className="text-xs text-avocado-700 font-medium" onClick={() => setItems((p) => [...p, { productId: products[0]?.id ?? "", quantity: 0, purchasePrice: 0 }])}>
            + Tambah item
          </button>
        </div>
        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <select className="input col-span-5" value={it.productId} onChange={(e) => updateItem(i, { productId: e.target.value })}>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input className="input col-span-3" type="number" placeholder="Qty (kg)" value={it.quantity || ""} onChange={(e) => updateItem(i, { quantity: Number(e.target.value) })} />
              <input className="input col-span-3" type="number" placeholder="Harga/kg" value={it.purchasePrice || ""} onChange={(e) => updateItem(i, { purchasePrice: Number(e.target.value) })} />
              {items.length > 1 && (
                <button type="button" className="col-span-1 text-red-500 text-xs" onClick={() => setItems((p) => p.filter((_, idx) => idx !== i))}>
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card grid md:grid-cols-3 gap-3">
        <div>
          <label className="label">Transport</label>
          <input className="input" type="number" value={transport || ""} onChange={(e) => setTransport(Number(e.target.value))} />
        </div>
        <div>
          <label className="label">Loading</label>
          <input className="input" type="number" value={loading || ""} onChange={(e) => setLoading(Number(e.target.value))} />
        </div>
        <div>
          <label className="label">Other Direct Cost</label>
          <input className="input" type="number" value={other || ""} onChange={(e) => setOther(Number(e.target.value))} />
        </div>
      </div>

      <div className="card bg-avocado-50 border-avocado-200 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div><div className="text-slate-500">Purchase Cost</div><div className="font-semibold">{formatIDR(totalPurchaseCost)}</div></div>
        <div><div className="text-slate-500">Total Landed Cost</div><div className="font-semibold">{formatIDR(totalLandedCost)}</div></div>
        <div><div className="text-slate-500">Total Qty</div><div className="font-semibold">{totalQty} kg</div></div>
        <div><div className="text-slate-500">Effective Cost/kg (avg)</div><div className="font-semibold">{formatIDR(effectiveCostAvg)}</div></div>
      </div>

      <div className="card space-y-3">
        <label className="label">Pembayaran</label>
        <div className="flex gap-2 text-sm">
          {(["cash", "partial", "credit"] as const).map((m) => (
            <button type="button" key={m} onClick={() => setPaymentMode(m)} className={`px-3 py-1.5 rounded-lg border ${paymentMode === m ? "bg-avocado-600 text-white border-avocado-600" : "border-slate-300 text-slate-600"}`}>
              {m === "cash" ? "Cash Penuh" : m === "partial" ? "Bayar Sebagian" : "Kredit (Hutang)"}
            </button>
          ))}
        </div>
        {paymentMode !== "credit" && (
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="label">Akun Kas/Bank</label>
              <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            {paymentMode === "partial" && (
              <div>
                <label className="label">Jumlah Dibayar Sekarang</label>
                <input className="input" type="number" value={paidNow || ""} onChange={(e) => setPaidNow(Number(e.target.value))} />
              </div>
            )}
          </div>
        )}
        {paymentMode !== "cash" && (
          <div>
            <label className="label">Jatuh Tempo</label>
            <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        )}
      </div>

      <div className="card">
        <label className="label">Catatan</label>
        <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <button className="btn-primary w-full" type="submit" disabled={pending || !supplierId}>
        {pending ? "Menyimpan..." : "Simpan Purchase"}
      </button>
    </form>
  );
}
