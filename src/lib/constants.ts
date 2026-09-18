// App-level "enums" (schema stores these as plain strings — see prisma/schema.prisma header note).

export const ROLES = ["ADMIN", "MANAGER", "STAFF", "VIEWER"] as const;
export type Role = (typeof ROLES)[number];

export const PAYMENT_STATUS = ["UNPAID", "PARTIAL", "PAID"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUS)[number];

export const ORDER_STATUS = ["ACTIVE", "VOID"] as const;

export const ACCOUNT_TYPES = ["CASH", "BANK", "EWALLET", "OTHER"] as const;

export const ACCOUNT_TX_TYPES = [
  "SALE_PAYMENT",
  "PURCHASE_PAYMENT",
  "EXPENSE",
  "TRANSFER_IN",
  "TRANSFER_OUT",
  "CAPITAL_IN",
  "CAPITAL_OUT",
  "OTHER_INCOME",
  "OTHER_EXPENSE",
  "OPENING_BALANCE"
] as const;

export const MOVEMENT_TYPES = [
  "PURCHASE",
  "SALE",
  "SALES_RETURN",
  "SPOILAGE",
  "SHRINKAGE",
  "ADJUSTMENT_POSITIVE",
  "ADJUSTMENT_NEGATIVE"
] as const;

export const SPOILAGE_REASONS = [
  "ROTTEN",
  "OVERRIPE",
  "PHYSICAL_DAMAGE",
  "WEIGHT_SHRINKAGE",
  "LOST",
  "OTHER"
] as const;

export const EXPENSE_COST_TYPES = ["DIRECT", "OPERATING"] as const;

export const CUSTOMER_TYPES = [
  "Retail",
  "Reseller",
  "Restaurant",
  "Cafe",
  "Distributor",
  "Marketplace",
  "Other"
] as const;

export const SUPPLIER_TYPES = ["Petani", "Pengepul", "Distributor", "Other"];

export const DEFAULT_EXPENSE_CATEGORIES: { name: string; costType: "DIRECT" | "OPERATING" }[] = [
  { name: "Transportasi (Direct)", costType: "DIRECT" },
  { name: "Bongkar Muat (Loading)", costType: "DIRECT" },
  { name: "Pengiriman / Delivery", costType: "OPERATING" },
  { name: "Packaging", costType: "OPERATING" },
  { name: "Tenaga Kerja / Labour", costType: "OPERATING" },
  { name: "Sewa Gudang / Warehouse", costType: "OPERATING" },
  { name: "Listrik", costType: "OPERATING" },
  { name: "Air", costType: "OPERATING" },
  { name: "BBM / Fuel", costType: "OPERATING" },
  { name: "Marketing / Advertising", costType: "OPERATING" },
  { name: "Biaya Marketplace", costType: "OPERATING" },
  { name: "Biaya Payment Gateway", costType: "OPERATING" },
  { name: "Peralatan / Equipment", costType: "OPERATING" },
  { name: "Maintenance", costType: "OPERATING" },
  { name: "Telepon", costType: "OPERATING" },
  { name: "Internet", costType: "OPERATING" },
  { name: "Biaya Bank", costType: "OPERATING" },
  { name: "Administrasi", costType: "OPERATING" },
  { name: "Lain-lain", costType: "OPERATING" }
];

export const INVENTORY_AGE_THRESHOLDS = {
  FRESH_MAX: 2,
  WATCH_MAX: 5,
  AGING_MAX: 7
};

export function inventoryAgeStatus(days: number): "Fresh" | "Watch" | "Aging" | "Critical" {
  if (days <= INVENTORY_AGE_THRESHOLDS.FRESH_MAX) return "Fresh";
  if (days <= INVENTORY_AGE_THRESHOLDS.WATCH_MAX) return "Watch";
  if (days <= INVENTORY_AGE_THRESHOLDS.AGING_MAX) return "Aging";
  return "Critical";
}

export function agingBucket(days: number): "Current" | "1-30" | "31-60" | "61-90" | "90+" {
  if (days <= 0) return "Current";
  if (days <= 30) return "1-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

export function formatIDR(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(amount);
}

export function formatKg(qty: number): string {
  return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(qty)} kg`;
}
