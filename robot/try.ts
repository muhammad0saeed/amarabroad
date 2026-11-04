// Reads one program page and prints what the robot found, what it would hold back, and what it couldn't find.
// Saves nothing, needs no keys. Run: npm run robot:try -- <program page url>

import { planChanges } from "./checks.ts";
import { readProgram } from "./pipeline.ts";

const url = process.argv[2];
if (!url) throw new Error("Usage: npm run robot:try -- <program page url>");
const today = new Date().toISOString().slice(0, 10);
const started = Date.now();
const read = await readProgram(url, today);
if (!read) throw new Error("Couldn't fetch that page (blocked by robots.txt, not HTML, or an error).");

console.log(`\nPages read (${read.pages.length}):`);
for (const p of read.pages) console.log(`  ${p.url}  (${p.text.length} chars)`);
console.log(`\nProgram page: ${read.facts.is_program_page ? "yes" : "no"}   Title: ${read.facts.title}   Subject: ${read.facts.field_slug ?? "?"}`);

const changes = planChanges(null, read.facts, today);
console.log("\nWould publish:");
for (const c of changes.filter((c) => !c.hold)) console.log(`  ${String(c.field).padEnd(24)} ${JSON.stringify(c.newValue)}\n  ${"".padEnd(24)} ← "${c.evidence.slice(0, 110)}"`);
const held = changes.filter((c) => c.hold);
if (held.length) {
  console.log("\nWould hold for review:");
  for (const c of held) console.log(`  ${String(c.field).padEnd(24)} ${JSON.stringify(c.newValue)}  (${c.hold})`);
}
const missing = (["degree_level", "duration_months", "ects_credits", "teaching_language", "tuition", "intakes", "english_tests"] as const).filter((k) => {
  const v = read.facts[k];
  return v === null || (Array.isArray(v) && v.length === 0);
});
if (missing.length) console.log(`\nNot found: ${missing.join(", ")}`);
if (read.dropped.length) {
  console.log("\nThrown out by the safety net:");
  for (const d of read.dropped) console.log(`  ${d.field.padEnd(24)} ${d.reason}`);
}
console.log(`\nDone in ${((Date.now() - started) / 1000).toFixed(0)} s, no AI used.`);
