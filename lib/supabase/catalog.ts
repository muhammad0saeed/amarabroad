import "server-only";

// Loads the whole published catalogue from Supabase for lib/data.ts, on the server only.
// Uses the secret key so places the robot created but whose guide isn't written yet (unpublished
// countries and cities) can still give programs their names; only published programs are read.

import type { Program } from "@/types";
import { serviceClient } from "./clients";
import { NUMERIC, numbers, readCatalog, type Catalog } from "./catalog-core";

export type { Catalog };

/**
 * The packed catalogue the robot publishes every 30 minutes (robot/export-catalog.ts, .github/workflows/catalog.yml).
 * One ~3 MB download from GitHub's CDN instead of ~40 database requests per server copy: the database is then read
 * once per half hour by the robot, never by visitors, so busy robots can't slow pages down or fail deploys.
 */
const CATALOG_URL = process.env.CATALOG_URL ?? "https://github.com/muhammad0saeed/amarabroad/releases/download/catalog/catalog.json.gz";
/** Older than this (the robot stopped publishing), read the database instead. */
const CATALOG_MAX_AGE_MS = 3 * 60 * 60 * 1000;

export async function loadCatalogFile(): Promise<Catalog | null> {
  try {
    // No `cache` option: the default fetch isn't stored by Next and keeps pages static.
    const res = await fetch(CATALOG_URL, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    const { gunzipSync } = await import("node:zlib");
    // Gzip files start with 1f 8b; if a CDN already unpacked it, read it as is.
    const text = (bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes).toString("utf8");
    const packed = JSON.parse(text) as { exportedAt: string; catalog: Catalog };
    if (!packed.catalog?.programs || Date.now() - Date.parse(packed.exportedAt) > CATALOG_MAX_AGE_MS) {
      console.warn(`Catalogue file from ${packed.exportedAt} is too old or empty; reading the database instead`);
      return null;
    }
    return packed.catalog;
  } catch (e) {
    console.warn(`Catalogue file unavailable (${e instanceof Error ? e.message : String(e)}); reading the database instead`);
    return null;
  }
}

/**
 * The robot's packed file first. Without it, the database: during a build, many worker processes render pages
 * at once and each would load the whole catalogue (15 workers x 12 lanes of requests swamped the small database
 * and timed out), so the first worker loads it and saves it to a file; the others wait for that file and read it.
 */
export async function loadCatalogFromSupabase(): Promise<Catalog> {
  const published = await loadCatalogFile();
  if (published) return published;
  if (process.env.NEXT_PHASE !== "phase-production-build") return loadCatalogNow();
  const { mkdir, open, readFile, rename, rm, stat, writeFile } = await import("node:fs/promises");
  const dir = `${process.cwd()}/.next/cache`;
  // One file per build: the workers share their parent build process (or the Vercel deployment); the build
  // cache restored from an earlier deploy never feeds old data into a new one.
  const file = `${dir}/amar-catalog-${process.env.VERCEL_DEPLOYMENT_ID ?? process.ppid}.json`;
  const lock = `${file}.lock`;
  const fresh = async () => ((await stat(file).catch(() => null))?.mtimeMs ?? 0) > Date.now() - 15 * 60_000;
  const read = async () => JSON.parse(await readFile(file, "utf8")) as Catalog;
  await mkdir(dir, { recursive: true });
  if (await fresh()) return read();
  const mine = await open(lock, "wx").then((h) => h.close().then(() => true)).catch(() => false);
  if (mine) {
    try {
      const catalog = await loadCatalogNow();
      await writeFile(`${file}.tmp`, JSON.stringify(catalog));
      await rename(`${file}.tmp`, file);
      // Earlier builds' copies (kept in the build cache) aren't needed any more.
      const { readdir } = await import("node:fs/promises");
      for (const old of await readdir(dir).catch(() => [] as string[])) {
        if (old.startsWith("amar-catalog-") && `${dir}/${old}` !== file && !old.endsWith(".lock")) await rm(`${dir}/${old}`, { force: true });
      }
      return catalog;
    } finally {
      await rm(lock, { force: true });
    }
  }
  // Another worker is loading it: wait up to 3 minutes for the file (or load ourselves if it gave up).
  for (let waited = 0; waited < 180_000; waited += 1000) {
    await new Promise((r) => setTimeout(r, 1000));
    if (await fresh()) return read();
    if (!(await stat(lock).catch(() => null))) break;
  }
  return loadCatalogNow();
}

const loadCatalogNow = () => readCatalog(serviceClient());

/** One published program with every column, for its own page. */
export async function loadProgramFromSupabase(slug: string): Promise<Program | undefined> {
  const { data, error } = await serviceClient().from("programs").select("*").eq("slug", slug).eq("published", true).maybeSingle();
  if (error) throw new Error(`Supabase programs: ${error.message}`);
  return data ? (numbers(data as Record<string, unknown>, NUMERIC.programs) as unknown as Program) : undefined;
}
