// Shows which program pages discovery finds on a university website, without saving.
// Run: npm run robot:discover-try -- <website> [max pages to read]

import { discoverPrograms } from "./discover.ts";

const website = process.argv[2];
if (!website) throw new Error("Usage: npm run robot:discover-try -- <website> [max pages]");
const started = Date.now();
const { programs, method, fetched } = await discoverPrograms(website, { maxPages: Number(process.argv[3] ?? 150), maxMinutes: 15 });
for (const p of programs.slice(0, 15)) console.log(`${(p.level ?? "?").padEnd(8)} ${p.url}${p.title ? `  (${p.title})` : ""}`);
const levels = programs.reduce<Record<string, number>>((acc, p) => ((acc[p.level ?? "unknown"] = (acc[p.level ?? "unknown"] ?? 0) + 1), acc), {});
console.log(`\n${programs.length} program pages ${JSON.stringify(levels)} via ${method}${fetched ? ` (${fetched} pages read)` : ""} in ${((Date.now() - started) / 60000).toFixed(1)} min`);
