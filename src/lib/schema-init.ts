// Shared schema/bootstrap logic — used by scripts/init-db.ts (local dev / build step) AND by
// src/lib/blob-store.ts (to create the very first database the first time the app cold-starts on
// Netlify with no existing blob yet). Keeping this in one place means "what a brand new database
// looks like" can never drift between the two call sites.
import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { DEFAULT_EXPENSE_CATEGORIES } from "./constants";

export function initializeFreshDatabase(dbFilePath: string): void {
  const db = new Database(dbFilePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  const schemaPath = path.resolve(process.cwd(), "src/db/schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf-8");
  db.exec(schema);

  const existingSettings = db.prepare("SELECT id FROM settings WHERE id = '1'").get();
  if (!existingSettings) {
    db.prepare(
      `INSERT INTO settings (id, business_name, start_date, currency, setup_completed)
       VALUES ('1', 'Avocado Trading', datetime('now'), 'IDR', 0)`
    ).run();
  }

  const adminEmail = "admin@avocado.local";
  const adminExists = db.prepare("SELECT id FROM users WHERE email = ?").get(adminEmail);
  if (!adminExists) {
    db.prepare(
      `INSERT INTO users (id, name, email, password_hash, role, active, created_at)
       VALUES (?, 'Administrator', ?, ?, 'ADMIN', 1, datetime('now'))`
    ).run(randomUUID(), adminEmail, bcrypt.hashSync("admin123", 10));
  }

  const catCount = db.prepare("SELECT COUNT(*) as c FROM expense_categories").get() as { c: number };
  if (catCount.c === 0) {
    const insertCat = db.prepare("INSERT INTO expense_categories (id, name, cost_type, active) VALUES (?, ?, ?, 1)");
    for (const cat of DEFAULT_EXPENSE_CATEGORIES) {
      insertCat.run(randomUUID(), cat.name, cat.costType);
    }
  }

  db.close();
}
