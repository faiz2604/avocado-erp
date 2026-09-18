import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, getDb } from "@/lib/db";
import { shapeExpenseRows } from "@/lib/export";
import { csvResponse } from "@/lib/export-response";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  await getDb();
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = db
    .prepare(
      `SELECT e.*, ec.name as categoryName, ec.cost_type as costType, a.name as accountName FROM expenses e
       JOIN expense_categories ec ON ec.id = e.category_id
       JOIN accounts a ON a.id = e.account_id
       ORDER BY e.date DESC`
    )
    .all();
  return csvResponse("expenses.csv", shapeExpenseRows(rows));
}
