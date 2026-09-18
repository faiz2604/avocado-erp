import Database from "better-sqlite3";
import path from "path";
import { IS_NETLIFY, loadDbFromBlob, persistDbToBlob } from "./blob-store";

// On Netlify, only /tmp is writable — the deployed app bundle's own directory is read-only.
// Locally, this is just the plain dev.db file next to the project (unchanged from before).
export const DB_PATH = IS_NETLIFY
  ? "/tmp/dev.db"
  : path.resolve(process.cwd(), (process.env.DATABASE_URL || "file:./dev.db").replace(/^file:/, ""));

function openConnection(): Database.Database {
  const conn = new Database(DB_PATH);
  conn.pragma("journal_mode = WAL");
  conn.pragma("foreign_keys = ON");
  return conn;
}

const globalForDb = globalThis as unknown as { __avocadoDb?: Database.Database };

let _db: Database.Database | null = IS_NETLIFY ? null : globalForDb.__avocadoDb ?? openConnection();
let _readyPromise: Promise<void> | null = null;

if (!IS_NETLIFY && process.env.NODE_ENV !== "production") {
  globalForDb.__avocadoDb = _db!;
}

/**
 * Must be awaited once before the first database access in any Netlify request (local dev doesn't
 * need this — the connection is already open by the time this module finishes loading). Downloads
 * the last-saved database from Netlify Blobs into /tmp on the first call in a cold container;
 * every call after that (in the same warm container) resolves immediately. See
 * src/actions/session.ts's `wrap()` and every page/route that reads `db` directly for where this
 * is called from.
 */
export async function getDb(): Promise<Database.Database> {
  if (_db) return _db;
  if (!_readyPromise) {
    _readyPromise = (async () => {
      await loadDbFromBlob(DB_PATH);
      _db = openConnection();
    })();
  }
  await _readyPromise;
  return _db!;
}

/**
 * Call after any mutation (create/update/void/etc.) so the change survives past this request on
 * Netlify. No-ops entirely in local dev. Centralized in src/actions/session.ts's `wrap()` for all
 * server actions; called directly by the few mutating routes that don't go through `wrap()`
 * (e.g. src/app/api/setup/route.ts).
 */
export async function persistDb(): Promise<void> {
  await persistDbToBlob(DB_PATH);
}

/**
 * Synchronous handle to the database. Works immediately in local dev. On Netlify, `await getDb()`
 * must have resolved at least once earlier in the same request (or an earlier request in the same
 * warm container) before this is touched — accessing it too early throws a clear error rather than
 * silently reading/writing the wrong file.
 */
export const db: Database.Database = new Proxy({} as Database.Database, {
  get(_target, prop, _receiver) {
    if (!_db) {
      throw new Error(
        "[db] Database not ready yet. On Netlify, call `await getDb()` before using `db` " +
          "(e.g. at the top of a page/route/action) — see src/lib/db.ts."
      );
    }
    const value = (_db as any)[prop];
    return typeof value === "function" ? value.bind(_db) : value;
  }
});
