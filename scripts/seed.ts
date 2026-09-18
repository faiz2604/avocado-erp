// Seeds the sample scenario from the spec (Section 50) so you can see the whole system working
// end-to-end immediately after install. Safe to re-run only on a fresh dev.db (it does not check
// for existing data) — run `rm dev.db* && npm run seed` to reset and reseed.
import { db } from "../src/lib/db";
import { createProduct, createSupplier, createCustomer, createAccount, updateSettings } from "../src/lib/master";
import { createPurchase, createSale, recordSpoilage, recordExpense } from "../src/lib/transactions";
import { newId, nowIso } from "../src/lib/id";

function main() {
  console.log("[seed] Seeding sample scenario (spec Section 50)...");

  // Opening cash Rp10,000,000
  const { id: accountId } = createAccount({ name: "Kas Tunai", type: "CASH", openingBalance: 10_000_000 });
  updateSettings({ businessName: "Usaha Alpukat Contoh", setupCompleted: true });

  const { id: supplierId } = createSupplier({ name: "Petani A", type: "Petani" });
  const { id: customerId } = createCustomer({ name: "Customer A", type: "Retail" });
  const { id: productId } = createProduct({
    name: "Alpukat Mentega",
    variety: "Mentega",
    grade: "A",
    standardPurchasePrice: 20000,
    standardSellingPrice: 28000,
    minSellingPrice: 25000
  });

  // Find the DIRECT/OPERATING categories seeded by init-db for the expense entries below.
  const deliveryCat = db.prepare(`SELECT id FROM expense_categories WHERE name LIKE 'Pengiriman%'`).get() as { id: string };
  const packagingCat = db.prepare(`SELECT id FROM expense_categories WHERE name LIKE 'Packaging%'`).get() as { id: string };
  const otherCat = db.prepare(`SELECT id FROM expense_categories WHERE name LIKE 'Lain-lain%'`).get() as { id: string };

  // Purchase: 500kg @ Rp20,000 + Rp500,000 transport (direct cost) -> landed cost Rp10,500,000, effective cost Rp21,000/kg
  const purchase = createPurchase({
    supplierId,
    items: [{ productId, quantity: 500, purchasePrice: 20000 }],
    transportCost: 500_000,
    paidNow: 10_500_000,
    paymentAccountId: accountId,
    notes: "Sample scenario — purchase"
  });
  console.log(`[seed] Purchase ${purchase.code} created (500kg @ Rp20,000, landed cost Rp10,500,000)`);

  // Sale: 300kg @ Rp28,000 -> revenue Rp8,400,000, COGS Rp6,300,000, gross profit Rp2,100,000
  const sale = createSale({
    customerId,
    items: [{ productId, quantity: 300, sellingPrice: 28000 }],
    paidNow: 8_400_000,
    paymentAccountId: accountId,
    notes: "Sample scenario — sale"
  });
  console.log(`[seed] Sale ${sale.code} created (300kg @ Rp28,000, gross profit Rp2,100,000)`);

  // Spoilage: 20kg of the remaining 200kg
  const batch = db.prepare(`SELECT id FROM inventory_batches WHERE product_id = ? ORDER BY received_date ASC LIMIT 1`).get(productId) as { id: string };
  recordSpoilage({ batchId: batch.id, quantity: 20, reason: "OVERRIPE", notes: "Sample scenario — spoilage" });
  console.log("[seed] Spoilage recorded (20kg) — 180kg sellable remains, expected inventory value Rp3,780,000");

  // Additional operating expenses: Transport Rp300,000, Packaging Rp150,000, Other Rp100,000
  recordExpense({ categoryId: deliveryCat.id, amount: 300_000, accountId, description: "Ongkos kirim ke customer" });
  recordExpense({ categoryId: packagingCat.id, amount: 150_000, accountId, description: "Packaging" });
  recordExpense({ categoryId: otherCat.id, amount: 100_000, accountId, description: "Biaya lain-lain" });
  console.log("[seed] Operating expenses recorded (Rp300,000 + Rp150,000 + Rp100,000 = Rp550,000)");

  console.log("\n[seed] Done. Expected results (see ARCHITECTURE.md Section 50 / TEST scenarios):");
  console.log("  Gross Profit    : Rp2,100,000");
  console.log("  Operating Profit: Rp1,550,000 (= Net Profit, no other income/expense)");
  console.log("  Inventory       : 180kg @ Rp21,000 = Rp3,780,000");
  console.log("  Cash (Kas Tunai): Rp10,000,000 - Rp10,500,000 + Rp8,400,000 - Rp550,000 = Rp7,350,000");
  console.log("\nRun `npm run test:scenarios` to verify these numbers programmatically.");
}

main();
