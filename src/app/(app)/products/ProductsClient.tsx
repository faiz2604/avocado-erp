"use client";

import { useState, useTransition } from "react";
import { createProductAction, updateProductAction } from "@/actions/master";
import { formatIDR, formatKg } from "@/lib/constants";

type Product = {
  id: string;
  name: string;
  variety: string | null;
  grade: string | null;
  unit: string;
  standard_purchase_price: number;
  standard_selling_price: number;
  min_selling_price: number;
  current_qty: number;
  current_avg_cost: number;
  active: number;
};

const emptyForm = { name: "", variety: "", grade: "", minSellingPrice: 0, standardSellingPrice: 0, standardPurchasePrice: 0 };

export default function ProductsClient({ initial }: { initial: Product[] }) {
  const [products, setProducts] = useState(initial);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function startEdit(p: Product) {
    setEditingId(p.id);
    setForm({
      name: p.name,
      variety: p.variety ?? "",
      grade: p.grade ?? "",
      minSellingPrice: p.min_selling_price,
      standardSellingPrice: p.standard_selling_price,
      standardPurchasePrice: p.standard_purchase_price
    });
    setShowForm(true);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = editingId
        ? await updateProductAction(editingId, form)
        : await createProductAction(form);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setForm(emptyForm);
      setEditingId(null);
      setShowForm(false);
      window.location.reload();
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Produk</h1>
        <button className="btn-primary" onClick={() => { setShowForm((s) => !s); setEditingId(null); setForm(emptyForm); }}>
          {showForm ? "Tutup" : "+ Tambah Produk"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={onSubmit} className="card mt-4 grid md:grid-cols-3 gap-3">
          {error && <div className="md:col-span-3 rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
          <div>
            <label className="label">Nama Produk</label>
            <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Alpukat Mentega" />
          </div>
          <div>
            <label className="label">Variety</label>
            <input className="input" value={form.variety} onChange={(e) => setForm({ ...form, variety: e.target.value })} placeholder="Mentega / Miki / Hass" />
          </div>
          <div>
            <label className="label">Grade</label>
            <input className="input" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} placeholder="A / B" />
          </div>
          <div>
            <label className="label">Harga Beli Standar</label>
            <input className="input" type="number" value={form.standardPurchasePrice} onChange={(e) => setForm({ ...form, standardPurchasePrice: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">Harga Jual Standar</label>
            <input className="input" type="number" value={form.standardSellingPrice} onChange={(e) => setForm({ ...form, standardSellingPrice: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">Harga Jual Minimum</label>
            <input className="input" type="number" value={form.minSellingPrice} onChange={(e) => setForm({ ...form, minSellingPrice: Number(e.target.value) })} />
          </div>
          <div className="md:col-span-3">
            <button className="btn-primary" type="submit" disabled={pending}>
              {pending ? "Menyimpan..." : editingId ? "Simpan Perubahan" : "Simpan Produk"}
            </button>
          </div>
        </form>
      )}

      <div className="card mt-4 overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Produk</th>
              <th>Variety / Grade</th>
              <th>Stok</th>
              <th>Avg Cost/kg</th>
              <th>Nilai Stok</th>
              <th>Min. Jual</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {products.map((p) => (
              <tr key={p.id}>
                <td className="font-medium">{p.name}</td>
                <td>{[p.variety, p.grade].filter(Boolean).join(" — ") || "-"}</td>
                <td>{formatKg(p.current_qty)}</td>
                <td>{formatIDR(p.current_avg_cost)}</td>
                <td>{formatIDR(Math.round(p.current_qty * p.current_avg_cost))}</td>
                <td>{formatIDR(p.min_selling_price)}</td>
                <td>
                  <button className="text-avocado-700 text-xs font-medium" onClick={() => startEdit(p)}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-slate-400 py-6">
                  Belum ada produk. Tambahkan produk pertama Anda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
