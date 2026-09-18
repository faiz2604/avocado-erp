"use client";

import { useState, useTransition } from "react";
import { transferFundsAction, recordCapitalAction } from "@/actions/cash";
import { createAccountAction } from "@/actions/master";
import { formatIDR } from "@/lib/constants";

type AccountBalance = { id: string; name: string; type: string; balance: number };

export default function CashClient({ accounts }: { accounts: AccountBalance[] }) {
  const [tab, setTab] = useState<"transfer" | "capital" | "account">("transfer");
  const [from, setFrom] = useState(accounts[0]?.id ?? "");
  const [to, setTo] = useState(accounts[1]?.id ?? accounts[0]?.id ?? "");
  const [amount, setAmount] = useState(0);
  const [capitalAccount, setCapitalAccount] = useState(accounts[0]?.id ?? "");
  const [capitalAmount, setCapitalAmount] = useState(0);
  const [capitalDirection, setCapitalDirection] = useState<"in" | "out">("in");
  const [newAccName, setNewAccName] = useState("");
  const [newAccType, setNewAccType] = useState("BANK");
  const [newAccBalance, setNewAccBalance] = useState(0);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function doTransfer(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    startTransition(async () => {
      const result = await transferFundsAction({ fromAccountId: from, toAccountId: to, amount });
      setMsg(result.ok ? { type: "ok", text: "Transfer berhasil." } : { type: "err", text: result.error });
      if (result.ok) window.location.reload();
    });
  }

  function doCapital(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    startTransition(async () => {
      const signedAmount = capitalDirection === "in" ? capitalAmount : -capitalAmount;
      const result = await recordCapitalAction({ accountId: capitalAccount, amount: signedAmount });
      setMsg(result.ok ? { type: "ok", text: "Modal tercatat." } : { type: "err", text: result.error });
      if (result.ok) window.location.reload();
    });
  }

  function doNewAccount(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    startTransition(async () => {
      const result = await createAccountAction({ name: newAccName, type: newAccType, openingBalance: newAccBalance });
      setMsg(result.ok ? { type: "ok", text: "Akun ditambahkan." } : { type: "err", text: result.error });
      if (result.ok) window.location.reload();
    });
  }

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {accounts.map((a) => (
          <div key={a.id} className="card">
            <div className="kpi-label">{a.name} <span className="text-slate-300">· {a.type}</span></div>
            <div className="kpi-value">{formatIDR(a.balance)}</div>
          </div>
        ))}
      </div>

      <div className="card mt-6">
        <div className="flex gap-2 text-sm mb-4">
          {(["transfer", "capital", "account"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-lg border ${tab === t ? "bg-avocado-600 text-white border-avocado-600" : "border-slate-300 text-slate-600"}`}>
              {t === "transfer" ? "Transfer Antar Akun" : t === "capital" ? "Modal Pemilik" : "Tambah Akun"}
            </button>
          ))}
        </div>

        {msg && <div className={`rounded-lg text-sm px-3 py-2 mb-3 ${msg.type === "ok" ? "bg-avocado-50 text-avocado-800" : "bg-red-50 text-red-700"}`}>{msg.text}</div>}

        {tab === "transfer" && (
          <form onSubmit={doTransfer} className="grid md:grid-cols-4 gap-3 items-end">
            <div>
              <label className="label">Dari</label>
              <select className="input" value={from} onChange={(e) => setFrom(e.target.value)}>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Ke</label>
              <select className="input" value={to} onChange={(e) => setTo(e.target.value)}>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Jumlah</label>
              <input className="input" type="number" value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))} />
            </div>
            <button className="btn-primary" disabled={pending}>Transfer</button>
          </form>
        )}

        {tab === "capital" && (
          <form onSubmit={doCapital} className="grid md:grid-cols-4 gap-3 items-end">
            <div>
              <label className="label">Akun</label>
              <select className="input" value={capitalAccount} onChange={(e) => setCapitalAccount(e.target.value)}>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Arah</label>
              <select className="input" value={capitalDirection} onChange={(e) => setCapitalDirection(e.target.value as any)}>
                <option value="in">Setor Modal (In)</option>
                <option value="out">Tarik Modal (Out)</option>
              </select>
            </div>
            <div>
              <label className="label">Jumlah</label>
              <input className="input" type="number" value={capitalAmount || ""} onChange={(e) => setCapitalAmount(Number(e.target.value))} />
            </div>
            <button className="btn-primary" disabled={pending}>Simpan</button>
          </form>
        )}

        {tab === "account" && (
          <form onSubmit={doNewAccount} className="grid md:grid-cols-4 gap-3 items-end">
            <div>
              <label className="label">Nama Akun</label>
              <input className="input" value={newAccName} onChange={(e) => setNewAccName(e.target.value)} required />
            </div>
            <div>
              <label className="label">Tipe</label>
              <select className="input" value={newAccType} onChange={(e) => setNewAccType(e.target.value)}>
                <option value="CASH">Cash</option>
                <option value="BANK">Bank</option>
                <option value="EWALLET">E-Wallet</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="label">Saldo Awal</label>
              <input className="input" type="number" value={newAccBalance || ""} onChange={(e) => setNewAccBalance(Number(e.target.value))} />
            </div>
            <button className="btn-primary" disabled={pending}>Tambah</button>
          </form>
        )}
      </div>
    </div>
  );
}
