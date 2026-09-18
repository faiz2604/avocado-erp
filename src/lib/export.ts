import * as XLSX from "xlsx";

export function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))];
  return lines.join("\n");
}

export function toXLSXBuffer(sheetName: string, rows: Record<string, unknown>[]): Buffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

// Row shapers — flatten DB rows into export-friendly plain objects with Indonesian headers.

export function shapeSalesRows(rows: any[]) {
  return rows.map((r) => ({
    "No Invoice": r.code,
    Tanggal: r.date,
    Customer: r.customerName,
    "Gross Sales": r.gross_sales,
    Diskon: r.discount,
    "Net Sales": r.net_sales,
    HPP: r.total_cogs,
    "Gross Profit": r.gross_profit,
    "Margin %": Number(r.gross_margin_pct).toFixed(2),
    "Status Bayar": r.payment_status,
    "Sudah Dibayar": r.amount_paid,
    Outstanding: r.outstanding,
    Status: r.status
  }));
}

export function shapePurchaseRows(rows: any[]) {
  return rows.map((r) => ({
    "No Purchase": r.code,
    Tanggal: r.date,
    Supplier: r.supplierName,
    "Purchase Cost": r.total_purchase_cost,
    Transport: r.transport_cost,
    Loading: r.loading_cost,
    "Other Direct Cost": r.other_direct_cost,
    "Total Landed Cost": r.total_landed_cost,
    "Status Bayar": r.payment_status,
    "Sudah Dibayar": r.amount_paid,
    Outstanding: r.outstanding,
    Status: r.status
  }));
}

export function shapeExpenseRows(rows: any[]) {
  return rows.map((r) => ({
    Tanggal: r.date,
    Kategori: r.categoryName,
    "Tipe Biaya": r.costType,
    Deskripsi: r.description,
    Jumlah: r.amount,
    Akun: r.accountName,
    Vendor: r.vendor
  }));
}

export function shapeMovementRows(rows: any[]) {
  return rows.map((r) => ({
    Tanggal: r.date,
    Batch: r.batchCode,
    Produk: r.productName,
    Tipe: r.type,
    Arah: r.direction,
    Qty: r.quantity,
    "Unit Cost": r.unit_cost,
    "Total Value": r.total_value,
    Referensi: `${r.reference_type ?? ""} ${r.reference_id ?? ""}`.trim()
  }));
}

export function shapeInventoryRows(rows: any[]) {
  return rows.map((r) => ({
    Produk: r.name,
    Variety: r.variety,
    Grade: r.grade,
    "Qty (kg)": r.qty,
    "Avg Cost/kg": r.avgCost,
    "Nilai Inventory": r.value
  }));
}

export function shapeReceivableRows(rows: any[]) {
  return rows.map((r) => ({
    Invoice: r.code,
    Customer: r.customerName,
    Jumlah: r.outstanding,
    "Jatuh Tempo": r.dueDate,
    "Hari Terlambat": r.daysOverdue,
    Bucket: r.bucket
  }));
}

export function shapePayableRows(rows: any[]) {
  return rows.map((r) => ({
    "No Purchase": r.code,
    Supplier: r.supplierName,
    Jumlah: r.outstanding,
    "Jatuh Tempo": r.dueDate,
    "Hari Terlambat": r.daysOverdue,
    Bucket: r.bucket
  }));
}
