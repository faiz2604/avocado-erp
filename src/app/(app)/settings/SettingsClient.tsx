"use client";

import { useState, useTransition } from "react";
import { signOut } from "next-auth/react";
import { createUserAction, createExpenseCategoryAction, updateOwnProfileAction, setUserActiveAction } from "@/actions/master";

type User = { id: string; name: string; email: string; role: string; active: number };
type Category = { id: string; name: string; cost_type: string };
type CurrentUser = { id: string; name: string; email: string };

export default function SettingsClient({
  users,
  categories,
  isAdmin,
  currentUser
}: {
  users: User[];
  categories: Category[];
  isAdmin: boolean;
  currentUser: CurrentUser;
}) {
  const [userForm, setUserForm] = useState({ name: "", email: "", password: "", role: "STAFF" });
  const [catForm, setCatForm] = useState({ name: "", costType: "OPERATING" as "DIRECT" | "OPERATING" });
  const [profileForm, setProfileForm] = useState({
    name: currentUser.name ?? "",
    email: currentUser.email ?? "",
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: ""
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [pending, startTransition] = useTransition();
  const [profilePending, startProfileTransition] = useTransition();

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

  function submitProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileMsg(null);
    setProfileSuccess(false);
    if (profileForm.newPassword && profileForm.newPassword !== profileForm.confirmNewPassword) {
      setProfileMsg("Konfirmasi password baru tidak cocok.");
      return;
    }
    startProfileTransition(async () => {
      const result = await updateOwnProfileAction({
        name: profileForm.name,
        email: profileForm.email,
        currentPassword: profileForm.currentPassword,
        newPassword: profileForm.newPassword || undefined
      });
      if (!result.ok) { setProfileMsg(result.error); return; }
      setProfileSuccess(true);
      setProfileForm({ ...profileForm, currentPassword: "", newPassword: "", confirmNewPassword: "" });
    });
  }

  function toggleUserActive(userId: string, active: number) {
    startTransition(async () => {
      const result = await setUserActiveAction(userId, active === 0);
      if (!result.ok) { setMsg(result.error); return; }
      window.location.reload();
    });
  }

  return (
    <div className="space-y-6">
      {msg && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{msg}</div>}

      <div className="card">
        <div className="label mb-2">Profil Saya</div>
        <form onSubmit={submitProfile} className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500">Nama</label>
            <input
              className="input"
              value={profileForm.name}
              onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Email (dipakai untuk login)</label>
            <input
              className="input"
              type="email"
              value={profileForm.email}
              onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Password Baru (kosongkan jika tidak diganti)</label>
            <input
              className="input"
              type="password"
              value={profileForm.newPassword}
              onChange={(e) => setProfileForm({ ...profileForm, newPassword: e.target.value })}
              minLength={6}
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Konfirmasi Password Baru</label>
            <input
              className="input"
              type="password"
              value={profileForm.confirmNewPassword}
              onChange={(e) => setProfileForm({ ...profileForm, confirmNewPassword: e.target.value })}
              minLength={6}
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-slate-500">Password Saat Ini (wajib diisi untuk konfirmasi)</label>
            <input
              className="input"
              type="password"
              value={profileForm.currentPassword}
              onChange={(e) => setProfileForm({ ...profileForm, currentPassword: e.target.value })}
              required
            />
          </div>
          {profileMsg && <div className="md:col-span-2 text-red-700 text-sm">{profileMsg}</div>}
          {profileSuccess && (
            <div className="md:col-span-2 rounded-lg bg-green-50 text-green-700 text-sm px-3 py-2 flex items-center justify-between gap-2">
              <span>
                Profil berhasil diperbarui. Silakan keluar lalu masuk lagi memakai email/password baru Anda.
              </span>
              <button
                type="button"
                className="btn-secondary text-xs whitespace-nowrap"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                Keluar sekarang
              </button>
            </div>
          )}
          <div className="md:col-span-2">
            <button className="btn-primary" disabled={profilePending}>Simpan Perubahan</button>
          </div>
        </form>
      </div>

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
          <thead><tr><th>Nama</th><th>Email</th><th>Role</th><th>Status</th>{isAdmin && <th></th>}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}{u.id === currentUser.id && <span className="text-xs text-slate-400"> (Anda)</span>}</td>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td>{u.active ? <span className="text-green-700">Aktif</span> : <span className="text-slate-400">Nonaktif</span>}</td>
                {isAdmin && (
                  <td>
                    {u.id !== currentUser.id && (
                      <button
                        type="button"
                        className="btn-secondary text-xs"
                        disabled={pending}
                        onClick={() => toggleUserActive(u.id, u.active)}
                      >
                        {u.active ? "Nonaktifkan" : "Aktifkan"}
                      </button>
                    )}
                  </td>
                )}
              </tr>
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
