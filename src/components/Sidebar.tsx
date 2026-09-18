"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const NAV = [
  { section: "Overview", items: [
    { href: "/dashboard", label: "Dashboard", icon: "📊" },
    { href: "/owner", label: "Owner View", icon: "🙋" },
    { href: "/management", label: "Management", icon: "📈" }
  ]},
  { section: "Master Data", items: [
    { href: "/products", label: "Produk", icon: "🥑" },
    { href: "/customers", label: "Customer", icon: "🧑‍🤝‍🧑" },
    { href: "/suppliers", label: "Supplier", icon: "🚜" }
  ]},
  { section: "Transaksi", items: [
    { href: "/purchases", label: "Purchase", icon: "🛒" },
    { href: "/sales", label: "Sales", icon: "💰" },
    { href: "/inventory", label: "Inventory", icon: "📦" },
    { href: "/spoilage", label: "Spoilage", icon: "🗑️" },
    { href: "/expenses", label: "Expenses", icon: "🧾" },
    { href: "/cash", label: "Cash & Bank", icon: "🏦" }
  ]},
  { section: "Keuangan", items: [
    { href: "/receivables", label: "Piutang (AR)", icon: "📥" },
    { href: "/payables", label: "Hutang (AP)", icon: "📤" },
    { href: "/reports/pnl", label: "P&L", icon: "📄" },
    { href: "/reports/cashflow", label: "Cash Flow", icon: "💵" },
    { href: "/reports/inventory-valuation", label: "Inventory Valuation", icon: "🧮" }
  ]},
  { section: "Sistem", items: [{ href: "/settings", label: "Settings", icon: "⚙️" }] }
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex md:flex-col w-64 shrink-0 bg-white border-r border-slate-200 h-screen sticky top-0 overflow-y-auto">
      <div className="px-5 py-5 flex items-center gap-2 border-b border-slate-100">
        <div className="h-9 w-9 rounded-full bg-avocado-600 flex items-center justify-center text-white">🥑</div>
        <div>
          <div className="font-semibold text-slate-900 leading-tight">Avocado ERP</div>
          <div className="text-xs text-slate-400">Business Dashboard</div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-5">
        {NAV.map((section) => (
          <div key={section.section}>
            <div className="px-2 mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {section.section}
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = pathname === item.href || pathname?.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={clsx(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active ? "bg-avocado-50 text-avocado-800" : "text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    <span>{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
