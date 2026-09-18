// Persists the SQLite database file to Netlify Blobs, so data survives across function
// invocations/cold starts on Netlify (whose function filesystem is otherwise ephemeral and
// read-only outside /tmp). No separate database account is needed — Netlify Blobs is included
// with every Netlify site.
//
// Pattern: on a cold start, download the last-saved copy of the DB file from the blob store into
// /tmp (the one writable path in a Netlify Function) before better-sqlite3 opens it; after every
// write, upload the updated file back to the blob store. Within the same warm container, /tmp
// persists across requests, so this only pays the round-trip cost once per cold start (loads) and
// once per mutation (saves) — see src/lib/db.ts and src/actions/session.ts for where this is
// wired in.
//
// This is a pragmatic fit for a single-operator business, not a substitute for a real database
// under heavy concurrent write load: two writes landing in truly the same instant, on two
// different warm containers, could race (last write wins). See README.md for when to graduate to
// Postgres (Supabase/Neon) instead.
import fs from "fs";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { initializeFreshDatabase } from "./schema-init";

const STORE_NAME = "avocado-erp-db";
const BLOB_KEY = "dev.db";

// `process.env.NETLIFY` is reliably set during the *build* step, but it turns out it is NOT always
// present inside the actual deployed function's runtime environment (this was the wrong assumption
// behind the original build-time fix, and it caused a follow-on bug: with IS_NETLIFY resolving to
// `false` at request time, src/lib/db.ts fell back to its local-dev file path — a path inside the
// function bundle's read-only /var/task directory on Netlify — and better-sqlite3 crashed with
// `SQLITE_CANTOPEN` trying to create a database file there. Netlify's standard (non-Edge) Functions
// run on AWS Lambda under the hood, and Lambda's own bootstrap always sets these two variables
// regardless of anything Netlify itself chooses to set, so they're a much more reliable signal for
// "we are inside a deployed serverless function" than `NETLIFY` alone. (better-sqlite3 is a native
// addon and can't run on Edge Functions at all, so a route that uses the database is guaranteed to
// be a standard Lambda-backed Function, not an Edge Function, whenever this code path is reached.)
export const IS_NETLIFY = !!(
  process.env.NETLIFY ||
  process.env.LAMBDA_TASK_ROOT ||
  process.env.AWS_LAMBDA_FUNCTION_NAME
);

// `next build` runs every route/page module at least once while it decides whether each one CAN
// be statically prerendered. On Netlify, `process.env.NETLIFY` is set during that build step too
// (not just at runtime), and Netlify Blobs isn't reachable yet at that point (it needs a live
// deployed-site context) — so without this guard, the build itself would try to hit Blobs, fail,
// and silently fall back to bootstrapping a brand-new throwaway database on every route touched
// during the build. Every route that actually needs the database also declares
// `export const dynamic = "force-dynamic"`, which should already stop Next.js from executing them
// at build time at all — this is a second, cheaper line of defense in case that ever isn't enough
// (e.g. a future route forgets the export, or a Next.js version changes this behavior).
const IS_BUILD_PHASE = process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD;

// Logged once per cold start (this file's top level only runs once per container) so the runtime
// function logs make it obvious whether the environment was detected correctly — this is exactly
// what was missing when diagnosing the SQLITE_CANTOPEN crash this guard exists to prevent.
if (!IS_BUILD_PHASE) {
  console.log(`[blob-store] IS_NETLIFY=${IS_NETLIFY} (NETLIFY=${process.env.NETLIFY}, LAMBDA_TASK_ROOT=${!!process.env.LAMBDA_TASK_ROOT}, AWS_LAMBDA_FUNCTION_NAME=${!!process.env.AWS_LAMBDA_FUNCTION_NAME})`);
  // Netlify auto-configures @netlify/blobs inside a deployed function via this env var (a
  // base64-encoded JSON blob containing the site ID / token / API URL it needs to talk to the
  // Blobs API). If it's missing, @netlify/blobs can't authenticate at all — this is the next
  // thing to check if reads/writes below keep silently "not finding" previously-saved data.
  console.log(`[blob-store] NETLIFY_BLOBS_CONTEXT present=${!!process.env.NETLIFY_BLOBS_CONTEXT}, SITE_ID=${process.env.SITE_ID ?? "(unset)"}`);
}

async function getBlobStore() {
  const { getStore } = await import("@netlify/blobs");
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

/** Downloads the last-persisted DB into `dbFilePath`. If no blob is found — either because none
 * has ever been saved (the very first request after the first deploy) or, empirically, because
 * Netlify Blobs occasionally doesn't yet reflect a write that happened only seconds earlier even
 * with `consistency: "strong"` — this bootstraps a fresh database into `dbFilePath` so the current
 * request can proceed, but deliberately does NOT save that fresh copy back to Blobs (see the
 * comment above `persistDbToBlob` below for why that matters). */
export async function loadDbFromBlob(dbFilePath: string): Promise<void> {
  if (!IS_NETLIFY || IS_BUILD_PHASE) return;

  // Retry a couple of times before concluding "no blob exists" — this is specifically to ride out
  // the read-after-write delay observed in production: a request would save a completed Setup
  // Wizard successfully, and a request on another container *45 seconds later* would still get an
  // empty read back from `store.get()`, wrongly concluding no database had ever been saved.
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const store = await getBlobStore();
      const existing = await store.get(BLOB_KEY, { type: "arrayBuffer" });
      if (existing) {
        console.log(`[blob-store] Found existing blob (${existing.byteLength} bytes) on attempt ${attempt} — loading it.`);
        fs.writeFileSync(dbFilePath, Buffer.from(existing));
        return;
      }
      console.log(`[blob-store] store.get() returned nothing on attempt ${attempt}/3.`);
    } catch (err) {
      console.error(`[blob-store] Failed to read existing blob on attempt ${attempt}/3:`, err);
    }
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 300));
  }

  // Still nothing after retrying — bootstrap a fresh database so this request can proceed at all,
  // but do NOT persist it back to Blobs here. Auto-saving on "not found" used to be the behavior,
  // and it was actively destructive: when the "not found" was actually just a stale/delayed read
  // (not a real absence of data), that auto-save would overwrite the real, already-saved database
  // with an empty one — this is exactly what caused the Setup Wizard to "lose" a save that had
  // already succeeded. Now, a fresh bootstrap only becomes durable once the user actually does
  // something (finishing the Setup Wizard, or any other action that goes through `persistDb()`),
  // at which point it's a deliberate save, not a guess.
  console.log("[blob-store] Giving up after 3 attempts — bootstrapping a fresh LOCAL database for this request only (not persisting it to Blobs).");
  initializeFreshDatabase(dbFilePath);
}

/** Uploads the current bytes of `dbFilePath` to the blob store. Call this after any write. */
export async function persistDbToBlob(dbFilePath: string): Promise<void> {
  if (!IS_NETLIFY || IS_BUILD_PHASE) return;
  try {
    const bytes = fs.readFileSync(dbFilePath);
    const store = await getBlobStore();
    await store.set(BLOB_KEY, bytes);
    console.log(`[blob-store] Persisted ${bytes.byteLength} bytes to blob store successfully.`);
  } catch (err) {
    // Don't let a failed backup fail the user's request — the write already succeeded against the
    // local /tmp copy for this container. Surface loudly in logs so it's not silently lost.
    console.error("[blob-store] Failed to persist database to blob store:", err);
  }
}
