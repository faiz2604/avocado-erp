import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, getDb } from "@/lib/db";
import { shapeMovementRows } from "@/lib/export";
import { csvResponse } from "@/lib/export-response";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  await getDb();
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = db
    .prepare(
      `SELECT im.*, p.name as productName, b.code as batchCode FROM inventory_movements im
       JOIN products p ON p.id = im.product_id
       JOIN inventory_batches b ON b.id = im.batch_id
       ORDER BY im.date DESC`
    )
    .all();
  return csvResponse("inventory-movements.csv", shapeMovementRows(rows));
}
