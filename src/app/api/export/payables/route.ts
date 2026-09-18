import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPayablesAging } from "@/lib/finance";
import { shapePayableRows } from "@/lib/export";
import { csvResponse } from "@/lib/export-response";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  await getDb();
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { items } = getPayablesAging();
  return csvResponse("payables.csv", shapePayableRows(items));
}
