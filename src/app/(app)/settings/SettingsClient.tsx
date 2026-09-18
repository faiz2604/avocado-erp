"use client";

import { useState, useTransition } from "react";
import { createUserAction, createExpenseCategoryAction } from "@/actions/master";

type User = { id: string; name: string; email: string; role: string; active: number };
type Category = { id: string; name: string; cost_type: string };

export default function SettingsClient({ users, categories, isAdmin }: { users: User[]; categories: Category[]; isAdmin: boolean }) {
  const [userForm, setUserForm] = useState({ name: "", email: "", password: "", role: "STAFF" });
  const [catForm, setCatForm] = useState({ name: "", costType: "OPERATING" as "DIRECT" | "OPERATING" });
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submitUser(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    startTransition(async () => {
      const result = await createUserAction(userForm);
      if (!result.ok) { setMsg(result.error); return; }
      window.location.reload();
    });
  }

  function submitCategory(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    startTransition(async () => {
      const result = await createExpenseCategoryAction(catForm);
      if (!result.ok) { setMsg(result.error); return; }
      window.location.reload();
    });
  }

  return (
    <div className="space-y-6">
      {msg && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{msg}</div>}

      {isAdmin && (
        <div className="card">
          <div className="label mb-2">Tambah User</div>
          <form onSubmit={submitUser} className="grid md:grid-cols-5 gap-2 items-end">
            <input className="input" placeholder="Nama" value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} required />
            <input className="input" placeholder="Email" type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} required />
            <input className="input" placeholder="Password" type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} required />
            <select className="input" value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}>
              <option value="ADMIN">Admin</option>
              <option value="MANAGER">Manager</option>
              <option value="STAFF">Staff</option>
              <option value="VIEWER">Viewer</option>
            </select>
            <button className="btn-primary" disabled={pending}>Tambah</button>
          </form>
        </div>
      )}

      <div className="card overflow-x-auto">
        <div className="label mb-2">Users</div>
        <table className="table-base">
          <thead><tr><th>Nama</th><th>Email</th><th>Role</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td>{u.role}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="label mb-2">Tambah Kategori Expense</div>
        <form onSubmit={submitCategory} className="grid md:grid-cols-3 gap-2 items-end">
          <input className="input" placeholder="Nama kategori" value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} required />
          <select className="input" value={catForm.costType} onChange={(e) => setCatForm({ ...catForm, costType: e.target.value as any })}>
            <option value="OPERATING">Operating Expense</option>
            <option value="DIRECT">Direct Cost</option>
          </select>
          <button className="btn-primary" disabled={pending}>Tambah</button>
        </form>
      </div>

      <div className="card overflow-x-auto">
        <div className="label mb-2">Kategori Expense</div>
        <table className="table-base">
          <thead><tr><th>Nama</th><th>Tipe</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {categories.map((c) => <tr key={c.id}><td>{c.name}</td><td>{c.cost_type}</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
