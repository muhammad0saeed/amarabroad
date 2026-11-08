// Shows what the gap-filler finds on one university's general pages: npm run robot:info-try -- <website>
import { findInfoPages, readUniversityInfo } from "./university-info.ts";

const website = process.argv[2];
if (!website) throw new Error("Usage: npm run robot:info-try -- <website>");
console.log("Pages:", await findInfoPages(website));
const { facts } = await readUniversityInfo(website, new Date().toISOString().slice(0, 10));
for (const f of facts) console.log(`${f.field}${f.level ? ` (${f.level})` : ""}: ${JSON.stringify(f.value)}\n   "${f.quote.slice(0, 160)}"\n   ${f.source_url}`);
