// Measures how many facts the rules find on real program pages: npm run robot:measure -- <website> [how many programs]
// Discovers program pages, reads a sample (English versions when listed), and prints a coverage table. Saves nothing.

import { discoverPrograms } from "./discover.ts";
import type { ProgramFacts } from "./facts.ts";
import { readProgram } from "./pipeline.ts";

const website = process.argv[2];
const sample = Number(process.argv[3] ?? 10);
if (!website) throw new Error("Usage: npm run robot:measure -- <website> [programs]");
const today = new Date().toISOString().slice(0, 10);

const { programs } = await discoverPrograms(website, { maxPages: 150, maxMinutes: 15 });
// Spread the sample over the list instead of taking the first few (often one department).
const step = Math.max(1, Math.floor(programs.length / sample));
const picked = programs.filter((_, i) => i % step === 0).slice(0, sample);

const FIELDS: (keyof ProgramFacts)[] = ["degree_level", "duration_months", "ects_credits", "teaching_language", "tuition", "intakes", "english_tests", "field_slug", "required_documents"];
const found: Record<string, number> = Object.fromEntries(FIELDS.map((f) => [f, 0]));
let read = 0;
let programPages = 0;
for (const p of picked) {
  const r = await readProgram(p.url, today).catch(() => null);
  if (!r) continue;
  read++;
  if (r.facts.is_program_page) programPages++;
  const row = FIELDS.map((f) => {
    const v = r.facts[f];
    const ok = Array.isArray(v) ? v.length > 0 : v !== null;
    if (ok) found[f]!++;
    return ok ? "✓" : "·";
  });
  console.log(`${row.join(" ")}  ${r.facts.title ?? p.url}`);
}
console.log(`\n${FIELDS.map((f) => f.slice(0, 3)).join(" ")}  (column order)`);
console.log(`\nRead ${read} of ${picked.length} sampled pages (${programs.length} found); ${programPages} confirmed as program pages.`);
for (const f of FIELDS) console.log(`  ${f.padEnd(20)} ${read ? Math.round((100 * found[f]!) / read) : 0}%`);
