"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordExpenseAction } from "@/actions/cash";

type Option = { id: string; name: string; cost_type?: string };

export default function ExpenseNewClient({ categories, accounts }: { categories: Option[]; accounts: Option[] }) {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [amount, setAmount] = useState(0);
  const [description, setDescription] = useState("");
  const [vendor, setVendor] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await recordExpenseAction({ categoryId, amount, description: description || undefined, vendor: vendor || undefined, accountId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/expenses");
    });
  }

  const selectedCat = categories.find((c) => c.id === categoryId);

  return (
    <form onSubmit={onSubmit} className="card space-y-4 max-w-lg">
      {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
      <div>
        <label className="label">Kategori</label>
        <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {selectedCat?.cost_type && (
          <p className="text-xs text-slate-400 mt-1">
            Tipe: {selectedCat.cost_type === "DIRECT" ? "Direct Cost (masuk Landed Cost)" : "Operating Expense"}
          </p>
        )}
      </div>
      <div>
        <label className="label">Jumlah (Rp)</label>
        <input className="input" type="number" value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))} required />
      </div>
      <div>
        <label className="label">Deskripsi</label>
        <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div>
        <label className="label">Vendor</label>
        <input className="input" value={vendor} onChange={(e) => setVendor(e.target.value)} />
      </div>
      <div>
        <label className="label">Dibayar dari Akun</label>
        <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)} required>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>
      <button className="btn-primary w-full" type="submit" disabled={pending}>
        {pending ? "Menyimpan..." : "Simpan Expense"}
      </button>
    </form>
  );
}
