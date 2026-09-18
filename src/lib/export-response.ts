import { NextResponse } from "next/server";
import { toCSV } from "./export";

export function csvResponse(filename: string, rows: Record<string, unknown>[]) {
  const csv = toCSV(rows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}
