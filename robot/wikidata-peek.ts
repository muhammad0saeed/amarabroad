// Prints the universities Wikidata has for a country, without saving: npm run robot:wikidata -- DE 15
import { wikidataUniversities } from "./seed.ts";
const rows = await wikidataUniversities((process.argv[2] ?? "DE").toUpperCase(), Number(process.argv[3] ?? 15));
const seen = new Set<string>();
for (const r of rows) {
  if (seen.has(r.uni!.value)) continue;
  seen.add(r.uni!.value);
  console.log(`${r.name!.value} | ${r.cityEn?.value ?? "?"} / ${r.cityBn?.value ?? "-"} | ${r.website!.value} | ${r.private?.value === "1" ? "private" : "public"} | ${r.links?.value ?? "?"} wikipedias`);
}
console.log(`country: ${rows[0]?.countryEn?.value} / ${rows[0]?.countryBn?.value}, currency ${rows.find((r) => r.currency)?.currency?.value}`);
