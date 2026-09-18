import { db, getDb } from "@/lib/db";
import CustomersClient from "./CustomersClient";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  await getDb();
  const rows = db
    .prepare(
      `SELECT c.id, c.name, c.type, c.phone, c.status,
              COALESCE((SELECT SUM(outstanding) FROM receivables WHERE customer_id = c.id AND status='OPEN'),0) as outstanding
       FROM customers c ORDER BY c.name`
    )
    .all() as any[];
  return <CustomersClient initial={rows} />;
}
