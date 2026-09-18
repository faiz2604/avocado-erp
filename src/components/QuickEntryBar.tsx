"use client";

import Link from "next/link";

const ACTIONS = [
  { href: "/sales/new", label: "SALE", icon: "💰" },
  { href: "/purchases/new", label: "PURCHASE", icon: "🛒" },
  { href: "/expenses/new", label: "EXPENSE", icon: "🧾" },
  { href: "/cash/payment", label: "PAYMENT", icon: "💳" }
];

export default function QuickEntryBar() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-20 bg-white border-t border-slate-200 md:hidden grid grid-cols-4">
      {ACTIONS.map((a) => (
        <Link key={a.href} href={a.href} className="flex flex-col items-center justify-center py-2.5 text-avocado-800 active:bg-avocado-50">
          <span className="text-lg">{a.icon}</span>
          <span className="text-[10px] font-semibold mt-0.5">{a.label}</span>
        </Link>
      ))}
    </nav>
  );
}
