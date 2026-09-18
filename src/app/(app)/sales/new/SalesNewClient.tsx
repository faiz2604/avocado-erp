"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSaleAction } from "@/actions/sales";
import { formatIDR } from "@/lib/constants";

type Option = { id: string; name: string };
type ProductInfo = { id: string; name: string; minSellingPrice: number; qty: number; avgCost: number };
type ItemRow = { productId: string; quantity: number; sellingPrice: number; discount: number; overrideReason: string };

export default function SalesNewClient({
  customers,
  products,
  accounts,
  defaultCustomerId
}: {
  customers: Option[];
  products: ProductInfo[];
  accounts: Option[];
  defaultCustomerId?: string;
}) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState(defaultCustomerId ?? customers[0]?.id ?? "");
  const [items, setItems] = useState<ItemRow[]>([
    { productId: products[0]?.id ?? "", quantity: 0, sellingPrice: products[0]?.minSellingPrice ?? 0, discount: 0, overrideReason: "" }
  ]);
  const [paymentMode, setPaymentMode] = useState<"cash" | "credit" | "partial">("cash");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [paidNow, setPaidNow] = useState(0);
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function productInfo(id: string) {
    return products.find((p) => p.id === id);
  }

  function updateItem(i: number, patch: Partial<ItemRow>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  const grossSales = items.reduce((s, i) => s + i.quantity * i.sellingPrice, 0);
  const totalDiscount = items.reduce((s, i) => s + i.discount, 0);
  const netSales = grossSales - totalDiscount;
  const estCOGS = items.reduce((s, i) => {
    const p = productInfo(i.productId);
    return s + i.quantity * (p?.avgCost ?? 0);
  }, 0);
  const estGrossProfit = netSales - estCOGS;

  function computedPaidNow() {
    if (paymentMode === "cash") return netSales;
    if (paymentMode === "credit") return 0;
    return paidNow;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const paid = computedPaidNow();
    startTransition(async () => {
      const result = await createSaleAction({
        customerId,
        items: items
          .filter((i) => i.productId && i.quantity > 0)
          .map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            sellingPrice: i.sellingPrice,
            discount: i.discount || undefined,
            overrideReason: i.overrideReason || undefined
          })),
        paidNow: paid,
        paymentAccountId: paid > 0 ? accountId : undefined,
        dueDate: paymentMode !== "cash" ? dueDate || undefined : undefined,
        notes: notes || undefined
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/sales/${result.data.id}`);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2 whitespace-pre-wrap">{error}</div>}

      <div className="card">
        <label className="label">Customer</label>
        <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <label className="label mb-0">Item Penjualan</label>
          <button type="button" className="text-xs text-avocado-700 font-medium" onClick={() => setItems((p) => [...p, { productId: products[0]?.id ?? "", quantity: 0, sellingPrice: products[0]?.minSellingPrice ?? 0, discount: 0, overrideReason: "" }])}>
            + Tambah item
          </button>
        </div>
        <div className="space-y-3">
          {items.map((it, i) => {
            const p = productInfo(it.productId);
            const belowMin = p ? it.sellingPrice < p.minSellingPrice && it.sellingPrice > 0 : false;
            const overStock = p ? it.quantity > p.qty : false;
            return (
              <div key={i} className="border border-slate-100 rounded-lg p-2.5">
                <div className="grid grid-cols-12 gap-2 items-center">
                  <select className="input col-span-4" value={it.productId} onChange={(e) => {
                    const np = productInfo(e.target.value);
                    updateItem(i, { productId: e.target.value, sellingPrice: np?.minSellingPrice ?? 0 });
                  }}>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.qty}kg tersedia)</option>)}
                  </select>
                  <input className="input col-span-2" type="number" placeholder="Qty (kg)" value={it.quantity || ""} onChange={(e) => updateItem(i, { quantity: Number(e.target.value) })} />
                  <input className="input col-span-2" type="number" placeholder="Harga jual/kg" value={it.sellingPrice || ""} onChange={(e) => updateItem(i, { sellingPrice: Number(e.target.value) })} />
                  <input className="input col-span-2" type="number" placeholder="Diskon (Rp)" value={it.discount || ""} onChange={(e) => updateItem(i, { discount: Number(e.target.value) })} />
                  {items.length > 1 && (
                    <button type="button" className="col-span-2 text-red-500 text-xs" onClick={() => setItems((p) => p.filter((_, idx) => idx !== i))}>
                      Hapus
                    </button>
                  )}
                </div>
                {overStock && <p className="text-xs text-red-600 mt-1">⚠ Stok tidak cukup (tersedia {p?.qty}kg).</p>}
                {belowMin && (
                  <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-2">
                    <p className="text-xs text-amber-700 font-medium">⚠ LOW MARGIN WARNING: harga di bawah minimum ({formatIDR(p?.minSellingPrice ?? 0)}). Isi alasan override:</p>
                    <input className="input mt-1 text-xs" placeholder="Alasan override" value={it.overrideReason} onChange={(e) => updateItem(i, { overrideReason: e.target.value })} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="card bg-avocado-50 border-avocado-200 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div><div className="text-slate-500">Gross Sales</div><div className="font-semibold">{formatIDR(grossSales)}</div></div>
        <div><div className="text-slate-500">Net Sales</div><div className="font-semibold">{formatIDR(netSales)}</div></div>
        <div><div className="text-slate-500">Est. HPP</div><div className="font-semibold">{formatIDR(estCOGS)}</div></div>
        <div><div className="text-slate-500">Est. Gross Profit</div><div className="font-semibold text-avocado-700">{formatIDR(estGrossProfit)}</div></div>
      </div>

      <div className="card space-y-3">
        <label className="label">Pembayaran</label>
        <div className="flex gap-2 text-sm">
          {(["cash", "partial", "credit"] as const).map((m) => (
            <button type="button" key={m} onClick={() => setPaymentMode(m)} className={`px-3 py-1.5 rounded-lg border ${paymentMode === m ? "bg-avocado-600 text-white border-avocado-600" : "border-slate-300 text-slate-600"}`}>
              {m === "cash" ? "Cash Penuh" : m === "partial" ? "Bayar Sebagian" : "Kredit (Piutang)"}
            </button>
          ))}
        </div>
        {paymentMode !== "credit" && (
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="label">Terima ke Akun</label>
              <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            {paymentMode === "partial" && (
              <div>
                <label className="label">Jumlah Diterima Sekarang</label>
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

      <button className="btn-primary w-full" type="submit" disabled={pending || !customerId}>
        {pending ? "Menyimpan..." : "Simpan Sale"}
      </button>
    </form>
  );
}
