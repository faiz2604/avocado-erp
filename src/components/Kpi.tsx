import clsx from "clsx";

export function Kpi({
  label,
  value,
  sub,
  tone
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "good" | "bad";
}) {
  return (
    <div className="card">
      <div className="kpi-label">{label}</div>
      <div
        className={clsx(
          "kpi-value",
          tone === "good" && "text-avocado-700",
          tone === "bad" && "text-red-600"
        )}
      >
        {value}
      </div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3 mt-8 first:mt-0">
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">{children}</h2>
      {action}
    </div>
  );
}
