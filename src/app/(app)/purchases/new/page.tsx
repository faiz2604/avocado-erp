import { listSuppliers, listProducts, listAccounts } from "@/lib/master";
import PurchaseNewClient from "./PurchaseNewClient";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function NewPurchasePage({ searchParams }: { searchParams: { supplierId?: string } }) {
  await getDb();
  const suppliers = listSuppliers(true) as any[];
  const products = listProducts(true) as any[];
  const accounts = listAccounts(true) as any[];

  return (
    <div className="max-w-3xl">
      <h1 className="text-lg font-semibold text-slate-900 mb-4">Purchase Baru</h1>
      {suppliers.length === 0 || products.length === 0 || accounts.length === 0 ? (
        <div className="card text-sm text-slate-600">
          Sebelum mencatat pembelian, pastikan Anda sudah punya minimal 1 Supplier, 1 Produk, dan 1 Akun Kas/Bank.
        </div>
      ) : (
        <PurchaseNewClient suppliers={suppliers} products={products} accounts={accounts} defaultSupplierId={searchParams.supplierId} />
      )}
    </div>
  );
}
