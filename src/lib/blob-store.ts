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

export const IS_NETLIFY = !!process.env.NETLIFY;

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

async function getBlobStore() {
  const { getStore } = await import("@netlify/blobs");
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

/** Downloads the last-persisted DB into `dbFilePath`, or creates a brand-new database there (and
 * immediately persists it) if no blob has ever been saved yet — e.g. the very first request after
 * the first deploy. */
export async function loadDbFromBlob(dbFilePath: string): Promise<void> {
  if (!IS_NETLIFY || IS_BUILD_PHASE) return;
  try {
    const store = await getBlobStore();
    const existing = await store.get(BLOB_KEY, { type: "arrayBuffer" });
    if (existing) {
      fs.writeFileSync(dbFilePath, Buffer.from(existing));
      return;
    }
  } catch (err) {
    console.error("[blob-store] Failed to read existing blob, starting a fresh database:", err);
  }

  // No blob yet (or reading it failed) — bootstrap a fresh database and save it right away so the
  // next cold start (and this one, after this request) has something real to load.
  initializeFreshDatabase(dbFilePath);
  await persistDbToBlob(dbFilePath);
}

/** Uploads the current bytes of `dbFilePath` to the blob store. Call this after any write. */
export async function persistDbToBlob(dbFilePath: string): Promise<void> {
  if (!IS_NETLIFY || IS_BUILD_PHASE) return;
  try {
    const bytes = fs.readFileSync(dbFilePath);
    const store = await getBlobStore();
    await store.set(BLOB_KEY, bytes);
  } catch (err) {
    // Don't let a failed backup fail the user's request — the write already succeeded against the
    // local /tmp copy for this container. Surface loudly in logs so it's not silently lost.
    console.error("[blob-store] Failed to persist database to blob store:", err);
  }
}
