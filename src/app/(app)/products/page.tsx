import { listProducts } from "@/lib/master";
import ProductsClient from "./ProductsClient";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  await getDb();
  const products = listProducts() as any[];
  return <ProductsClient initial={products} />;
}
