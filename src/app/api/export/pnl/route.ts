import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPnL } from "@/lib/finance";
import { isoRange, type PeriodKey } from "@/lib/periods";
import { csvResponse } from "@/lib/export-response";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await getDb();
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const period = (searchParams.get("period") as PeriodKey) || "this_month";
  const { fromIso, toIso } = isoRange(period);
  const pnl = getPnL(fromIso, toIso);
  const rows = [
    { Item: "Revenue", Jumlah: pnl.revenue },
    { Item: "HPP / COGS", Jumlah: pnl.cogs },
    { Item: "Gross Profit", Jumlah: pnl.grossProfit },
    { Item: "Gross Margin %", Jumlah: pnl.grossMarginPct.toFixed(2) },
    { Item: "Operating Expense", Jumlah: pnl.operatingExpense },
    { Item: "Operating Profit", Jumlah: pnl.operatingProfit },
    { Item: "Other Income", Jumlah: pnl.otherIncome },
    { Item: "Other Expense", Jumlah: pnl.otherExpense },
    { Item: "Net Profit", Jumlah: pnl.netProfit },
    { Item: "Net Margin %", Jumlah: pnl.netMarginPct.toFixed(2) }
  ];
  return csvResponse(`pnl-${period}.csv`, rows);
}
