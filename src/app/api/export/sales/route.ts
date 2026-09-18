import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, getDb } from "@/lib/db";
import { shapeSalesRows } from "@/lib/export";
import { csvResponse } from "@/lib/export-response";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  await getDb();
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = db
    .prepare(`SELECT so.*, c.name as customerName FROM sales_orders so JOIN customers c ON c.id = so.customer_id ORDER BY so.date DESC`)
    .all();
  return csvResponse("sales.csv", shapeSalesRows(rows));
}
