import { getInventoryValuation } from "@/lib/finance";
import { formatIDR, formatKg } from "@/lib/constants";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function InventoryValuationPage() {
  await getDb();
  const { items, totalQty, totalValue } = getInventoryValuation();

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Inventory Valuation</h1>
        <a href="/api/export/inventory" className="btn-secondary text-xs">Export CSV</a>
      </div>

      <div className="card mt-4 overflow-x-auto">
        <table className="table-base">
          <thead><tr><th>Produk</th><th>Variety</th><th>Grade</th><th>Qty</th><th>Avg Cost/kg</th><th>Nilai</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((i) => (
              <tr key={i.id}>
                <td className="font-medium">{i.name}</td>
                <td>{i.variety ?? "-"}</td>
                <td>{i.grade ?? "-"}</td>
                <td>{formatKg(i.qty)}</td>
                <td>{formatIDR(i.avgCost)}</td>
                <td>{formatIDR(i.value)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold border-t border-slate-200">
              <td colSpan={3}>Total</td>
              <td>{formatKg(totalQty)}</td>
              <td></td>
              <td>{formatIDR(totalValue)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
