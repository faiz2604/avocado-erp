import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCashFlow } from "@/lib/finance";
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
  const cf = getCashFlow(fromIso, toIso);
  const rows = [
    { Item: "Opening Cash", Jumlah: cf.openingCash },
    { Item: "Customer Collections", Jumlah: cf.customerCollections },
    { Item: "Other Income", Jumlah: cf.otherIncome },
    { Item: "Capital In", Jumlah: cf.capitalIn },
    { Item: "Total Cash In", Jumlah: cf.cashIn },
    { Item: "Supplier Payments", Jumlah: cf.supplierPayments },
    { Item: "Operating Expenses", Jumlah: cf.operatingExpenses },
    { Item: "Other Payments", Jumlah: cf.otherPayments },
    { Item: "Capital Out", Jumlah: cf.capitalOut },
    { Item: "Total Cash Out", Jumlah: cf.cashOut },
    { Item: "Closing Cash", Jumlah: cf.closingCash }
  ];
  return csvResponse(`cashflow-${period}.csv`, rows);
}
