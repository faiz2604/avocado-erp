export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PAID: "bg-avocado-100 text-avocado-800",
    PARTIAL: "bg-amber-100 text-amber-800",
    UNPAID: "bg-red-100 text-red-700"
  };
  return <span className={`badge ${map[status] ?? "bg-slate-100 text-slate-600"}`}>{status}</span>;
}
