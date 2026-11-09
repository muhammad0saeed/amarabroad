// Packs the published catalogue into one gzip file for the website (every 30 minutes, .github/workflows/catalog.yml).
// The site downloads this single file from GitHub's CDN instead of reading ~25,000 programs from the database
// itself, so visitors never wait on a database the robots are busy with.

import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { readCatalog } from "../lib/supabase/catalog-core.ts";
import { db } from "./db.ts";

export async function exportCatalog(out: string) {
  const started = Date.now();
  const catalog = await readCatalog(db());
  const json = JSON.stringify({ exportedAt: new Date().toISOString(), catalog });
  const packed = gzipSync(json, { level: 9 });
  writeFileSync(out, packed);
  const mb = (n: number) => `${(n / 1_048_576).toFixed(1)} MB`;
  console.log(
    `Packed ${catalog.programs.length} programs, ${catalog.universities.length} universities, ${catalog.cities.length} cities: ` +
      `${mb(json.length)} → ${mb(packed.length)} in ${Math.round((Date.now() - started) / 1000)} s → ${out}`,
  );
}
