"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError("Email atau password salah.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-avocado-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="mx-auto h-12 w-12 rounded-full bg-avocado-600 flex items-center justify-center text-white text-xl font-bold">
            🥑
          </div>
          <h1 className="mt-4 text-xl font-semibold text-slate-900">Avocado ERP</h1>
          <p className="text-sm text-slate-500">Business Management Dashboard</p>
        </div>
        <form onSubmit={onSubmit} className="card space-y-4">
          {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button className="btn-primary w-full" type="submit" disabled={loading}>
            {loading ? "Masuk..." : "Masuk"}
          </button>
          <p className="text-xs text-slate-400 text-center">
            Default admin: admin@avocado.local / admin123 (ganti setelah login pertama)
          </p>
        </form>
      </div>
    </div>
  );
}
