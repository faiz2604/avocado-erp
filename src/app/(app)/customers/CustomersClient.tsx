"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { createCustomerAction } from "@/actions/master";
import { formatIDR } from "@/lib/constants";
import { CUSTOMER_TYPES } from "@/lib/constants";

type Customer = { id: string; name: string; type: string; phone: string | null; status: string };

const empty = { name: "", type: "Retail", phone: "", address: "", paymentTerms: 0, creditLimit: 0 };

export default function CustomersClient({ initial }: { initial: (Customer & { outstanding: number })[] }) {
  const [form, setForm] = useState(empty);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createCustomerAction(form);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setForm(empty);
      setShowForm(false);
      window.location.reload();
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Customer</h1>
        <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Tutup" : "+ Tambah Customer"}
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
              {CUSTOMER_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Telepon</label>
            <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <label className="label">Alamat</label>
            <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div>
            <label className="label">Credit Limit (Rp)</label>
            <input className="input" type="number" value={form.creditLimit} onChange={(e) => setForm({ ...form, creditLimit: Number(e.target.value) })} />
          </div>
          <div className="md:col-span-3">
            <button className="btn-primary" type="submit" disabled={pending}>
              {pending ? "Menyimpan..." : "Simpan Customer"}
            </button>
          </div>
        </form>
      )}

      <div className="card mt-4 overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Nama</th>
              <th>Tipe</th>
              <th>Telepon</th>
              <th>Piutang Outstanding</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {initial.map((c) => (
              <tr key={c.id}>
                <td className="font-medium">{c.name}</td>
                <td>{c.type}</td>
                <td>{c.phone ?? "-"}</td>
                <td className={c.outstanding > 0 ? "text-amber-600 font-medium" : ""}>{formatIDR(c.outstanding)}</td>
                <td>
                  <Link href={`/customers/${c.id}`} className="text-avocado-700 text-xs font-medium">Detail</Link>
                </td>
              </tr>
            ))}
            {initial.length === 0 && (
              <tr><td colSpan={5} className="text-center text-slate-400 py-6">Belum ada customer.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
