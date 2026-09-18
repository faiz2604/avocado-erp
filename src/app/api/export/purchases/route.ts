import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, getDb } from "@/lib/db";
import { shapePurchaseRows } from "@/lib/export";
import { csvResponse } from "@/lib/export-response";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  await getDb();
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = db
    .prepare(`SELECT po.*, s.name as supplierName FROM purchase_orders po JOIN suppliers s ON s.id = po.supplier_id ORDER BY po.date DESC`)
    .all();
  return csvResponse("purchases.csv", shapePurchaseRows(rows));
}
