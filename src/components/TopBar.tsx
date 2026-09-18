"use client";

import { signOut, useSession } from "next-auth/react";

export default function TopBar() {
  const { data: session } = useSession();
  const user = session?.user as any;
  return (
    <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-slate-200 px-4 md:px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-2 md:hidden">
        <div className="h-8 w-8 rounded-full bg-avocado-600 flex items-center justify-center text-white text-sm">🥑</div>
        <span className="font-semibold text-slate-900">Avocado ERP</span>
      </div>
      <div className="hidden md:block text-sm text-slate-500">
        {new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      </div>
      <div className="flex items-center gap-3">
        {user && (
          <div className="text-right hidden sm:block">
            <div className="text-sm font-medium text-slate-800">{user.name}</div>
            <div className="text-xs text-slate-400">{user.role}</div>
          </div>
        )}
        <button onClick={() => signOut({ callbackUrl: "/login" })} className="btn-secondary text-xs">
          Keluar
        </button>
      </div>
    </header>
  );
}
