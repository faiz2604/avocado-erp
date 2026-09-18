"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type AccountRow = { name: string; type: string; openingBalance: number };

export default function SetupPage() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("Usaha Alpukat Saya");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [accounts, setAccounts] = useState<AccountRow[]>([{ name: "Kas Tunai", type: "CASH", openingBalance: 0 }]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function updateAccount(i: number, patch: Partial<AccountRow>) {
    setAccounts((prev) => prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessName, startDate, accounts })
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Setup gagal.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-avocado-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl">
        <div className="text-center mb-6">
          <div className="mx-auto h-12 w-12 rounded-full bg-avocado-600 flex items-center justify-center text-white text-xl">🥑</div>
          <h1 className="mt-3 text-xl font-semibold text-slate-900">Setup Awal Bisnis</h1>
          <p className="text-sm text-slate-500">
            Isi informasi dasar untuk memulai. Produk, supplier, customer, dan stok/piutang/hutang awal bisa
            ditambahkan setelah ini lewat menu masing-masing.
          </p>
        </div>
        <form onSubmit={onSubmit} className="card space-y-5">
          {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}

          <div>
            <label className="label">Nama Usaha</label>
            <input className="input" value={businessName} onChange={(e) => setBusinessName(e.target.value)} required />
          </div>
          <div>
            <label className="label">Tanggal Mulai Bisnis</label>
            <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Akun Kas / Bank</label>
              <button
                type="button"
                className="text-xs text-avocado-700 font-medium"
                onClick={() => setAccounts((p) => [...p, { name: "", type: "BANK", openingBalance: 0 }])}
              >
                + Tambah akun
              </button>
            </div>
            <div className="space-y-2">
              {accounts.map((a, i) => (
                <div key={i} className="grid grid-cols-6 gap-2 items-center">
                  <input
                    className="input col-span-3"
                    placeholder="Nama akun (mis. BCA, Kas Tunai)"
                    value={a.name}
                    onChange={(e) => updateAccount(i, { name: e.target.value })}
                    required
                  />
                  <select className="input col-span-1" value={a.type} onChange={(e) => updateAccount(i, { type: e.target.value })}>
                    <option value="CASH">Cash</option>
                    <option value="BANK">Bank</option>
                    <option value="EWALLET">E-Wallet</option>
                    <option value="OTHER">Other</option>
                  </select>
                  <input
                    className="input col-span-2"
                    type="number"
                    placeholder="Saldo awal (Rp)"
                    value={a.openingBalance}
                    onChange={(e) => updateAccount(i, { openingBalance: Number(e.target.value) })}
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Total saldo awal akan otomatis tercatat sebagai Modal Pemilik (Owner Capital), bukan pendapatan.
            </p>
          </div>

          <button className="btn-primary w-full" type="submit" disabled={loading}>
            {loading ? "Menyimpan..." : "Selesaikan Setup"}
          </button>
        </form>
      </div>
    </div>
  );
}
