import Link from "next/link";
import type { PeriodKey } from "@/lib/periods";

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "Hari Ini" },
  { key: "this_week", label: "Minggu Ini" },
  { key: "this_month", label: "Bulan Ini" },
  { key: "last_month", label: "Bulan Lalu" },
  { key: "this_quarter", label: "Kuartal Ini" },
  { key: "this_year", label: "Tahun Ini" },
  { key: "ytd", label: "Year to Date" }
];

export default function PeriodSelector({ basePath, active }: { basePath: string; active: PeriodKey }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PERIODS.map((p) => (
        <Link
          key={p.key}
          href={`${basePath}?period=${p.key}`}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
            active === p.key ? "bg-avocado-600 text-white border-avocado-600" : "border-slate-300 text-slate-600 hover:bg-slate-50"
          }`}
        >
          {p.label}
        </Link>
      ))}
    </div>
  );
}
