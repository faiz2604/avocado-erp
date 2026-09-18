import { db, getDb } from "@/lib/db";
import SuppliersClient from "./SuppliersClient";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  await getDb();
  const rows = db
    .prepare(
      `SELECT s.id, s.name, s.type, s.phone,
              COALESCE((SELECT SUM(outstanding) FROM payables WHERE supplier_id = s.id AND status='OPEN'),0) as outstanding
       FROM suppliers s ORDER BY s.name`
    )
    .all() as any[];
  return <SuppliersClient initial={rows} />;
}
