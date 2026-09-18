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
  // On Netlify the entire database travels as a single file (downloaded from Blobs into /tmp
  // before use, uploaded back after every write), so it MUST be self-contained. WAL mode breaks
  // that assumption badly: a committed transaction is written to the `<db>-wal` SIDECAR file and
  // only folded into the main .db file at a checkpoint (normally when the connection closes — and
  // this connection is deliberately long-lived, so that never happens). The main .db file we
  // upload therefore contained NONE of the app's writes.
  //
  // That was the real cause of "the Setup Wizard keeps coming back": the blob stayed frozen at
  // whatever `initializeFreshDatabase()` wrote when it closed its own connection (a constant
  // 307200 bytes in production, never changing no matter how many times setup was completed),
  // while the one container that performed the write kept reading its own WAL and so looked
  // perfectly fine — which is exactly why some requests reported setup_completed=1 and others
  // reported the original bootstrap values.
  //
  // DELETE mode keeps every commit inside the single .db file, so what gets uploaded is what was
  // actually written. WAL's benefit (concurrent readers during a write) is irrelevant here: each
  // serverless container is a single process working on its own private copy in /tmp. Locally,
  // where the file lives on a real disk and is never shipped anywhere, WAL is kept.
  conn.pragma(IS_NETLIFY ? "journal_mode = DELETE" : "journal_mode = WAL");
  conn.pragma("foreign_keys = ON");
  return conn;
}

const globalForDb = globalThis as unknown as { __avocadoDb?: Database.Database };

let _db: Database.Database | null = IS_NETLIFY ? null : globalForDb.__avocadoDb ?? openConnection();
let _readyPromise: Promise<void> | null = null;
let _loadedAt = 0;

if (!IS_NETLIFY && process.env.NODE_ENV !== "production") {
  globalForDb.__avocadoDb = _db!;
}

// On Netlify only: how long a downloaded copy of the database is trusted before the next getDb()
// call re-downloads it from Blobs instead of reusing this container's in-memory copy. Long enough
// to cover the handful of getDb() calls one request makes (the shared layout and the page itself
// both call it, milliseconds apart) without paying the Blobs round-trip twice for no reason, but
// short enough that a warm container catches up on another container's more recent save within a
// couple of seconds.
//
// Why this exists: caching the connection for a warm container's *entire* lifetime (as this used
// to do) caused exactly the bug reported after shipping the SQLITE_CANTOPEN fix — completing the
// Setup Wizard would save correctly (confirmed via the "[blob-store] Persisted ... successfully"
// log), but reloading the page kept showing the wizard again. Netlify/Lambda routes concurrent
// requests across *several* warm containers, each with its own independent in-memory copy of the
// database; one container would finish the wizard and save it, while a sibling container — still
// warm from an earlier cold start, and never told anything changed — kept serving whichever
// request landed on it from its own older copy, without `setup_completed` set. Which container
// handles a given request is effectively random from the user's point of view, which is exactly
// why the wizard seemed to reappear unpredictably instead of consistently.
const RELOAD_INTERVAL_MS = 2000;

/**
 * Must be awaited once before the first database access in any Netlify request (local dev doesn't
 * need this — the connection is already open by the time this module finishes loading). Downloads
 * the last-saved database from Netlify Blobs into /tmp, re-checking for a newer save at most once
 * every `RELOAD_INTERVAL_MS` (see above for why this isn't cached indefinitely). See
 * src/actions/session.ts's `wrap()` and every page/route that reads `db` directly for where this
 * is called from.
 */
export async function getDb(): Promise<Database.Database> {
  if (!IS_NETLIFY) return _db!;

  const isStale = !_db || Date.now() - _loadedAt > RELOAD_INTERVAL_MS;
  if (isStale && !_readyPromise) {
    _readyPromise = (async () => {
      if (_db) {
        try {
          _db.close();
        } catch {
          // Ignore — the old connection is being replaced regardless.
        }
      }
      await loadDbFromBlob(DB_PATH);
      _db = openConnection();
      _loadedAt = Date.now();
      _readyPromise = null;
    })();
  }
  if (_readyPromise) await _readyPromise;
  return _db!;
}

/**
 * Call after any mutation (create/update/void/etc.) so the change survives past this request on
 * Netlify. No-ops entirely in local dev. Centralized in src/actions/session.ts's `wrap()` for all
 * server actions; called directly by the few mutating routes that don't go through `wrap()`
 * (e.g. src/app/api/setup/route.ts).
 */
export async function persistDb(): Promise<void> {
  // Safety net for any container whose database file is still in WAL mode — e.g. one that
  // downloaded a blob created by an older build, since journal mode is a property stored inside
  // the database file itself. This forces anything sitting in the `-wal` sidecar into the main
  // file before we upload that file's bytes. In DELETE mode (see openConnection) there is no WAL
  // and this is a harmless no-op.
  try {
    _db?.pragma("wal_checkpoint(TRUNCATE)");
  } catch {
    // Nothing to checkpoint — fine.
  }
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
