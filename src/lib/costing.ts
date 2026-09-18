// Pure financial calculation functions — Section F of ARCHITECTURE.md.
// No I/O here; these are unit-testable and shared by the write path (src/lib/transactions.ts)
// and any report/export that needs to recompute rather than trust a stored number.

export function landedCost(
  purchaseCost: number,
  transport: number,
  loading: number,
  otherDirect: number
): number {
  return purchaseCost + transport + loading + otherDirect;
}

export function effectiveCostPerKg(totalLandedCost: number, quantity: number): number {
  if (quantity <= 0) return 0;
  return Math.round(totalLandedCost / quantity);
}

/** Weighted-average cost per kg after adding a new batch to existing on-hand inventory. */
export function weightedAverageCost(
  existingQty: number,
  existingAvgCost: number,
  newQty: number,
  newCost: number
): number {
  const totalQty = existingQty + newQty;
  if (totalQty <= 0) return 0;
  const totalValue = existingQty * existingAvgCost + newQty * newCost;
  return Math.round(totalValue / totalQty);
}

export function grossSalesAmount(quantity: number, sellingPrice: number): number {
  return Math.round(quantity * sellingPrice);
}

export function netSalesAmount(grossSales: number, discount: number): number {
  return grossSales - discount;
}

export function cogsAmount(quantity: number, unitCost: number): number {
  return Math.round(quantity * unitCost);
}

export function grossProfitAmount(netSales: number, cogs: number): number {
  return netSales - cogs;
}

export function grossMarginPct(grossProfit: number, netSales: number): number {
  if (netSales === 0) return 0;
  return (grossProfit / netSales) * 100;
}

export function contributionMarginPerKg(
  sellingPrice: number,
  landedCostPerKg: number,
  directSellingCostPerKg: number
): number {
  return sellingPrice - landedCostPerKg - directSellingCostPerKg;
}

export function breakEvenQuantity(fixedCost: number, contributionMarginPerKgValue: number): number {
  if (contributionMarginPerKgValue <= 0) return Infinity;
  return fixedCost / contributionMarginPerKgValue;
}

export function breakEvenRevenue(breakEvenQty: number, sellingPrice: number): number {
  if (!isFinite(breakEvenQty)) return Infinity;
  return breakEvenQty * sellingPrice;
}

export function spoilageLossValue(quantity: number, unitCost: number): number {
  return Math.round(quantity * unitCost);
}

export function spoilagePct(totalSpoilageQty: number, totalReceivedQty: number): number {
  if (totalReceivedQty === 0) return 0;
  return (totalSpoilageQty / totalReceivedQty) * 100;
}

export function daysBetween(a: Date, b: Date): number {
  const ms = a.getTime() - b.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}
