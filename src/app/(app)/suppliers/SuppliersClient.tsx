"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { createSupplierAction } from "@/actions/master";
import { formatIDR } from "@/lib/constants";

const empty = { name: "", type: "Petani", contactPerson: "", phone: "", location: "", paymentTerms: 0 };

export default function SuppliersClient({ initial }: { initial: any[] }) {
  const [form, setForm] = useState(empty);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createSupplierAction(form);
      if (!result.ok) { setError(result.error); return; }
      setForm(empty);
      setShowForm(false);
      window.location.reload();
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Supplier</h1>
        <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Tutup" : "+ Tambah Supplier"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={onSubmit} className="card mt-4 grid md:grid-cols-3 gap-3">
          {error && <div className="md:col-span-3 rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
          <div>
            <label className="label">Nama</label>
            <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Tipe</label>
            <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="Petani">Petani</option>
              <option value="Pengepul">Pengepul</option>
              <option value="Distributor">Distributor</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="label">Kontak Person</label>
            <input className="input" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
          </div>
          <div>
            <label className="label">Telepon</label>
            <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label className="label">Lokasi</label>
            <input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>
          <div>
            <label className="label">Payment Terms (hari)</label>
            <input className="input" type="number" value={form.paymentTerms} onChange={(e) => setForm({ ...form, paymentTerms: Number(e.target.value) })} />
          </div>
          <div className="md:col-span-3">
            <button className="btn-primary" type="submit" disabled={pending}>{pending ? "Menyimpan..." : "Simpan Supplier"}</button>
          </div>
        </form>
      )}

      <div className="card mt-4 overflow-x-auto">
        <table className="table-base">
          <thead><tr><th>Nama</th><th>Tipe</th><th>Kontak</th><th>Hutang Outstanding</th><th></th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {initial.map((s) => (
              <tr key={s.id}>
                <td className="font-medium">{s.name}</td>
                <td>{s.type}</td>
                <td>{s.phone ?? "-"}</td>
                <td className={s.outstanding > 0 ? "text-amber-600 font-medium" : ""}>{formatIDR(s.outstanding)}</td>
                <td><Link href={`/suppliers/${s.id}`} className="text-avocado-700 text-xs font-medium">Detail</Link></td>
              </tr>
            ))}
            {initial.length === 0 && <tr><td colSpan={5} className="text-center text-slate-400 py-6">Belum ada supplier.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
