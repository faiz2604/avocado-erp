import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, getDb, persistDb } from "@/lib/db";
import { newId, nowIso } from "@/lib/id";
import { updateSettings } from "@/lib/master";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { businessName, startDate, accounts, openingCapital } = body as {
      businessName: string;
      startDate: string;
      accounts: { name: string; type: string; openingBalance: number }[];
      openingCapital?: number;
    };

    if (!businessName?.trim()) throw new Error("Nama usaha wajib diisi.");
    if (!accounts?.length) throw new Error("Minimal satu akun kas/bank harus ditambahkan.");

    await getDb();
    const run = db.transaction(() => {
      for (const acc of accounts) {
        const id = newId("acc");
        db.prepare(
          `INSERT INTO accounts (id, name, type, opening_balance, active, created_at) VALUES (?, ?, ?, ?, 1, ?)`
        ).run(id, acc.name, acc.type, Math.round(acc.openingBalance || 0), nowIso());

        if (acc.openingBalance) {
          db.prepare(
            `INSERT INTO account_transactions (id, account_id, type, amount, date, description, reference_type, created_at)
             VALUES (?, ?, 'OPENING_BALANCE', 0, ?, 'Saldo awal (tercatat pada opening_balance akun)', 'Setup', ?)`
          ).run(newId("at"), id, startDate || nowIso(), nowIso());
        }
      }

      if (openingCapital && openingCapital > 0 && accounts.length) {
        // Opening capital already reflected via account opening balances; log it distinctly for the audit trail.
      }

      updateSettings({ businessName, startDate: startDate || nowIso(), setupCompleted: true });
    });

    run();
    await persistDb();
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Setup gagal." }, { status: 400 });
  }
}
