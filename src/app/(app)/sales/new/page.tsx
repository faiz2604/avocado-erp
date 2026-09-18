import { listCustomers, listAccounts } from "@/lib/master";
import { db, getDb } from "@/lib/db";
import SalesNewClient from "./SalesNewClient";

export const dynamic = "force-dynamic";

export default async function NewSalePage({ searchParams }: { searchParams: { customerId?: string } }) {
  await getDb();
  const customers = listCustomers() as any[];
  const accounts = listAccounts(true) as any[];
  const products = db
    .prepare(`SELECT id, name, min_selling_price as minSellingPrice, current_qty as qty, current_avg_cost as avgCost FROM products WHERE active = 1 ORDER BY name`)
    .all() as any[];

  return (
    <div className="max-w-3xl">
      <h1 className="text-lg font-semibold text-slate-900 mb-4">Sale Baru</h1>
      {customers.length === 0 || products.length === 0 || accounts.length === 0 ? (
        <div className="card text-sm text-slate-600">
          Sebelum mencatat penjualan, pastikan Anda sudah punya minimal 1 Customer, 1 Produk dengan stok, dan 1 Akun Kas/Bank.
        </div>
      ) : (
        <SalesNewClient customers={customers} products={products} accounts={accounts} defaultCustomerId={searchParams.customerId} />
      )}
    </div>
  );
}
