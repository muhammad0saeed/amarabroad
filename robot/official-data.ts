// Programs from official government course lists, for universities whose websites block the robot.
// No AI and no scraping: each country publishes a free list of its universities' courses, and these rules
// read it. Every value saved keeps the dataset (and the course's row in it) as its evidence.
//
//   au  CRICOS register (Australian Government, Department of Education): every course open to student-visa
//       holders, with level, length, language and fees. CC BY 2.5 AU. Downloaded from data.gov.au.
//   us  College Scorecard (US Department of Education): every field of study with bachelor's or master's
//       graduates, plus each university's out-of-state tuition. US government data, public domain.
//   uk  Discover Uni dataset (HESA / Office for Students): every UK course with its web address. CC BY 4.0.
//       HESA's download page has a "are you a robot?" check that the robot must not get around, so a person
//       downloads the zip from https://www.hesa.ac.uk/data-and-analysis/discover-uni-dataset and passes it
//       with --file.
//
// Matching: a dataset's provider is our university when the names match or the website's main name matches
// (www.monash.edu.au and www.monash.edu are both "monash").

import { inflateRawSync } from "node:zlib";
import { readFileSync, statSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { EMPTY_FACTS, type Level, type ProgramFacts } from "./facts.ts";
import { subjectOf } from "./rules.ts";

export type OfficialCountry = "au" | "us" | "uk";

/** A university as one dataset names it. */
export interface Provider {
  id: string;
  /** Every name the dataset gives it (legal name, trading names). */
  names: string[];
  website: string | null;
  /** US only: false for branch campuses, which share a website with the main campus. */
  main?: boolean;
  /** How many courses it has in the dataset (set before matching). */
  courses?: number;
}

/** One course from a dataset, with the dataset's own words for each fact (shown on the site as evidence). */
export interface OfficialCourse {
  providerId: string;
  code: string;
  title: string;
  level: Level;
  durationMonths: number | null;
  language: string | null;
  tuition: { perYear: number; currency: string } | null;
  /** The app's subject, when the dataset's own subject code says it (US CIP codes). */
  subject?: string | null;
  /** Extra words that name the subject when the title doesn't (field of education, CIP title). */
  subjectHints: string[];
  /** The university's own page for the course, when the dataset gives one. */
  courseUrl: string | null;
  /** The public page showing this course's row in the dataset. */
  evidenceUrl: string;
  quotes: { level: string; duration?: string; language?: string; tuition?: string };
}

export interface Dataset {
  name: string;
  /** Licence, as the publisher states it. */
  licence: string;
  providers: Provider[];
  courses: OfficialCourse[];
}

// ---------------------------------------------------------------- reading files

/** CSV records (RFC 4180: quoted fields may hold commas, quotes and line breaks). */
export function* csvRows(text: string): Generator<string[]> {
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  const n = text.length;
  while (i < n) {
    const row: string[] = [];
    for (;;) {
      let value = "";
      if (text[i] === '"') {
        i++;
        for (;;) {
          const q = text.indexOf('"', i);
          if (q < 0) {
            value += text.slice(i);
            i = n;
            break;
          }
          value += text.slice(i, q);
          i = q + 1;
          if (text[i] === '"') {
            value += '"';
            i++;
          } else break;
        }
        // Anything between the closing quote and the next separator is kept as written.
        while (i < n && text[i] !== "," && text[i] !== "\n" && text[i] !== "\r") value += text[i++];
      } else {
        let j = i;
        while (j < n && text[j] !== "," && text[j] !== "\n" && text[j] !== "\r") j++;
        value = text.slice(i, j);
        i = j;
      }
      row.push(value);
      if (text[i] === ",") {
        i++;
        continue;
      }
      if (text[i] === "\r") i++;
      if (text[i] === "\n") i++;
      break;
    }
    if (row.length > 1 || row[0] !== "") yield row;
  }
}

/** Rows as objects keyed by the header, keeping only `columns` (big files have thousands of columns). */
export function* csvRecords(text: string, columns?: string[]): Generator<Record<string, string>> {
  const rows = csvRows(text);
  const first = rows.next();
  const header: string[] = first.done ? [] : first.value.map((h: string) => h.trim());
  const wanted = (columns ?? header).map((c: string) => [c, header.indexOf(c)] as const).filter(([, i]) => i >= 0);
  for (const row of rows) {
    const rec: Record<string, string> = {};
    for (const [name, i] of wanted) rec[name] = (row[i] ?? "").trim();
    yield rec;
  }
}

/** The header row of a CSV file. */
export function csvHeader(text: string): string[] {
  const first = csvRows(text).next();
  return first.done ? [] : first.value.map((h: string) => h.trim());
}

/** The files inside a .zip (stored or deflated; enough for the datasets here). */
export function unzip(buf: Buffer): Map<string, () => Buffer> {
  let end = buf.length - 22;
  while (end >= 0 && buf.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < 0) throw new Error("not a zip file");
  const count = buf.readUInt16LE(end + 10);
  let p = buf.readUInt32LE(end + 16);
  const out = new Map<string, () => Buffer>();
  for (let k = 0; k < count; k++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("broken zip directory");
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;
    if (name.endsWith("/") || name.startsWith("__MACOSX/")) continue;
    out.set(name, () => {
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      const data = buf.subarray(start, start + size);
      if (method === 0) return data;
      if (method === 8) return inflateRawSync(data);
      throw new Error(`zip entry ${name} uses an unsupported compression (${method})`);
    });
  }
  return out;
}

/** Finds a file by its name (any folder, any case) in a zip, a folder, or a map of already-read files. */
export function pickFile(files: Map<string, () => Buffer>, wanted: RegExp): string | null {
  for (const [name, read] of files) if (wanted.test(name.split("/").at(-1)!)) return read().toString("utf8");
  return null;
}

/** A zip file or a folder of CSV files, as a name → contents map. */
export function openLocal(path: string): Map<string, () => Buffer> {
  if (statSync(path).isDirectory()) {
    const out = new Map<string, () => Buffer>();
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else out.set(full.replace(/\\/g, "/"), () => readFileSync(full));
      }
    };
    walk(path);
    return out;
  }
  return unzip(readFileSync(path));
}

// ---------------------------------------------------------------- matching providers to our universities

/** Generic parts of a web address that say nothing about which university it is. */
const GENERIC_LABELS = new Set(["www", "www1", "www2", "web", "home", "edu", "ac", "com", "org", "net", "gov", "co", "au", "uk", "ca", "us", "info", "int", "international"]);

/** "https://www.monash.edu.au/" → "monash"; "web.mit.edu" → "mit"; "www.ox.ac.uk" → "ox". */
export function hostKey(website: string | null | undefined): string | null {
  if (!website?.trim()) return null;
  let host: string;
  try {
    host = new URL(/^https?:\/\//i.test(website.trim()) ? website.trim() : `https://${website.trim()}`).hostname.toLowerCase();
  } catch {
    return null;
  }
  const labels = host.split(".").filter((l) => l && !GENERIC_LABELS.has(l));
  return labels.at(-1) ?? null;
}

/** Names compared loosely: "The University of Melbourne (UniMelb)" = "University of Melbourne", "King's" = "Kings". */
export function nameKey(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/&/g, " and ")
    .replace(/['’`ʻ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/^\s*the\s+/, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface OurUniversity {
  slug: string;
  name: string;
  website: string;
}

export interface Match {
  university: OurUniversity;
  provider: Provider;
  /** "name and website", "name" or "website": how sure the match is. */
  by: string;
}

/**
 * Pairs our universities with dataset providers. A provider counts when its name or its website's main name
 * matches; when several do, the one matching both wins, then a main campus. Still a tie: no match (a wrong
 * university's programs would be worse than none).
 */
export function matchProviders(providers: Provider[], universities: OurUniversity[]): { matches: Match[]; ambiguous: string[] } {
  const byName = new Map<string, Provider[]>();
  const byHost = new Map<string, Provider[]>();
  const add = (map: Map<string, Provider[]>, key: string | null, p: Provider) => {
    if (!key) return;
    const list = map.get(key) ?? [];
    if (!list.includes(p)) list.push(p);
    map.set(key, list);
  };
  for (const p of providers) {
    for (const n of p.names) add(byName, nameKey(n), p);
    add(byHost, hostKey(p.website), p);
  }
  const found: Match[] = [];
  const ambiguous: string[] = [];
  for (const u of universities) {
    const named = byName.get(nameKey(u.name)) ?? [];
    const hosted = byHost.get(hostKey(u.website) ?? "") ?? [];
    let candidates = named.filter((p) => hosted.includes(p));
    let by = "name and website";
    if (!candidates.length) [candidates, by] = named.length ? [named, "name"] : [hosted, "website"];
    if (candidates.length > 1) {
      const main = candidates.filter((p) => p.main !== false);
      if (main.length) candidates = main;
    }
    // Sharing a website: "Columbia University in the City of New York", not "Teachers College at Columbia University".
    if (candidates.length > 1 && by === "website") {
      const ours = nameKey(u.name);
      const starts = candidates.filter((p) => p.names.some((n) => nameKey(n).startsWith(ours)));
      if (starts.length) candidates = starts;
    }
    // Same name twice (one university registered under two codes): the one with more courses.
    if (candidates.length > 1 && by !== "website" && candidates.every((p) => p.courses !== undefined)) {
      const most = Math.max(...candidates.map((p) => p.courses!));
      const top = candidates.filter((p) => p.courses === most);
      if (top.length === 1) candidates = top;
    }
    if (candidates.length === 1) found.push({ university: u, provider: candidates[0]!, by });
    else if (candidates.length > 1) ambiguous.push(`${u.slug}: ${candidates.slice(0, 3).map((c) => c.names[0]).join(" / ")}${candidates.length > 3 ? ` and ${candidates.length - 3} more` : ""}`);
  }
  // One provider belongs to one university: when several claim it (UNSW and "UNSW Canberra" share a
  // website), the strongest match keeps it; equally strong claims all lose it.
  const strength = (m: Match) => (m.by === "name and website" ? 3 : m.by === "name" ? 2 : 1);
  const matches = found.filter((m) => {
    const rivals = found.filter((o) => o.provider === m.provider && o !== m);
    const lost = rivals.some((o) => strength(o) >= strength(m));
    if (lost && rivals.every((o) => strength(o) <= strength(m))) ambiguous.push(`${m.university.slug}: shares ${m.provider.names[0]} with ${rivals.map((o) => o.university.slug).join(", ")}`);
    return !lost;
  });
  return { matches, ambiguous };
}

// ---------------------------------------------------------------- Australia: CRICOS

export const CRICOS_PAGE = "https://data.gov.au/data/dataset/cricos";
const CRICOS_LEVELS: Record<string, Level> = {
  "Bachelor Degree": "bachelor",
  "Bachelor Honours Degree": "bachelor",
  "Masters Degree (Coursework)": "master",
  "Masters Degree (Extended)": "master",
  "Masters Degree (Research)": "master",
};

/** "$188,278.00" → 188278. */
export function money(raw: string | undefined): number | null {
  const m = (raw ?? "").replace(/[$,\s]/g, "").match(/^\d+(\.\d+)?$/);
  return m ? Number(m[0]) : null;
}

/** "001447E" with "Monash University (Monash)" → our tidy reading of one CRICOS row. */
export function parseCricos(coursesCsv: string, institutionsCsv: string): Dataset {
  const providers: Provider[] = [];
  for (const r of csvRecords(institutionsCsv)) {
    const id = r["CRICOS Provider Code"];
    if (!id) continue;
    const names = [r["Institution Name"] ?? "", ...(r["Trading Name"] ?? "").split(";")].map((s) => s.trim()).filter(Boolean);
    providers.push({ id, names, website: r["Website"] || null });
  }
  const courses: OfficialCourse[] = [];
  for (const r of csvRecords(coursesCsv)) {
    const level = CRICOS_LEVELS[r["Course Level"] ?? ""];
    if (!level || r["Expired"] === "Yes") continue;
    const code = r["CRICOS Course Code"]!;
    const weeks = Number(r["Duration (Weeks)"]);
    // A one-year honours course follows a bachelor's degree: it isn't a way in after school.
    if (r["Course Level"] === "Bachelor Honours Degree" && weeks <= 52) continue;
    const title = (r["Course Name"] ?? "").trim();
    if (!title) continue;
    const tag = `CRICOS course ${code}`;
    const fee = money(r["Tuition Fee"]);
    const years = weeks / 52;
    const tuition = fee && fee > 0 && years >= 1 ? { perYear: Math.round(fee / years), currency: "AUD" } : null;
    courses.push({
      providerId: r["CRICOS Provider Code"]!,
      code,
      title,
      level,
      durationMonths: weeks > 0 ? Math.round((weeks / 52) * 12) : null,
      language: r["Course Language"] || null,
      tuition,
      subjectHints: [r["Field of Education 1 Detailed Field"], r["Field of Education 1 Narrow Field"], r["Field of Education 1 Broad Field"]].map((s) => (s ?? "").replace(/^\d+\s*-\s*/, "")).filter(Boolean),
      courseUrl: null,
      evidenceUrl: CRICOS_PAGE,
      quotes: {
        level: `${tag} "${title}": Course Level "${r["Course Level"]}"`,
        ...(weeks > 0 ? { duration: `${tag} "${title}": Duration ${weeks} weeks` } : {}),
        ...(r["Course Language"] ? { language: `${tag} "${title}": Course Language "${r["Course Language"]}"` } : {}),
        ...(tuition ? { tuition: `${tag} "${title}": Tuition Fee ${r["Tuition Fee"]} for the whole course (${weeks} weeks), about A$${tuition.perYear.toLocaleString("en-US")} a year` } : {}),
      },
    });
  }
  return { name: "CRICOS register (Australian Government, Department of Education)", licence: "Creative Commons Attribution 2.5 Australia", providers, courses };
}

// ---------------------------------------------------------------- United States: College Scorecard

export const SCORECARD_DATA_PAGE = "https://collegescorecard.ed.gov/data/";
const SCORECARD_LEVELS: Record<string, Level> = { "3": "bachelor", "5": "master" };

/** US subject codes (CIP, 4 digits, most specific first) → the app's subject list. */
const CIP_SUBJECTS: [RegExp, string][] = [
  [/^(3070|3071|3039)/, "data-science"],
  [/^1410/, "eee"],
  [/^(1405|2612|2611)/, "biotechnology"],
  [/^(11|1409)/, "cse"],
  [/^(1408|1414|1433)/, "civil"],
  [/^(1419|1402|1435|1436|1442|1418|1427|1425|1420)/, "mechanical"],
  [/^1407/, "chemistry"],
  [/^04/, "architecture"],
  [/^(5122|5132)/, "public-health"],
  [/^5120/, "pharmacy"],
  [/^51/, "medicine"],
  [/^(5203|5208)/, "finance"],
  [/^(4506|5206)/, "economics"],
  [/^52/, "business"],
  [/^26/, "microbiology"],
  [/^(01|03)/, "agriculture"],
  [/^4005/, "chemistry"],
  [/^(4004|4006)/, "earth-sciences"],
  [/^(27|4008|4002)/, "math-physics"],
  [/^(09|13|19|22|42|43|44|45)/, "social-sciences"],
  [/^(05|16|23|24|38|39|50|54)/, "english-humanities"],
];

export function cipSubject(cip: string): string | null {
  return CIP_SUBJECTS.find(([re]) => re.test(cip))?.[1] ?? null;
}

const count = (raw: string | undefined) => {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Field-of-study rows (one per university, 4-digit CIP subject and degree level) → programs. Only subjects
 * with graduates in the last two years count; branch campuses are left out. Out-of-state tuition (what a
 * student from abroad pays at a public university) applies to bachelor's programs only.
 */
export function parseScorecard(fieldsCsv: string, institutionsCsv: string): Dataset {
  const providers: Provider[] = [];
  const tuitionOut = new Map<string, number>();
  for (const r of csvRecords(institutionsCsv, ["UNITID", "INSTNM", "INSTURL", "MAIN", "TUITIONFEE_OUT"])) {
    if (!r.UNITID) continue;
    const name = r.INSTNM ?? "";
    // "University of Michigan-Ann Arbor" is also known as "University of Michigan".
    const names = [name, name.split(/\s*-\s*/)[0]!].filter((n, i, a) => n && a.indexOf(n) === i);
    providers.push({ id: r.UNITID, names, website: r.INSTURL || null, main: r.MAIN === "1" });
    const t = Number(r.TUITIONFEE_OUT);
    if (Number.isFinite(t) && t > 0) tuitionOut.set(r.UNITID, t);
  }
  const courses: OfficialCourse[] = [];
  for (const r of csvRecords(fieldsCsv, ["UNITID", "INSTNM", "MAIN", "CIPCODE", "CIPDESC", "CREDLEV", "CREDDESC", "IPEDSCOUNT1", "IPEDSCOUNT2"])) {
    const level = SCORECARD_LEVELS[r.CREDLEV ?? ""];
    if (!level || r.MAIN === "0") continue;
    if (count(r.IPEDSCOUNT1) + count(r.IPEDSCOUNT2) <= 0) continue;
    const subject = (r.CIPDESC ?? "").replace(/\.\s*$/, "").trim();
    if (!subject) continue;
    const degree = level === "bachelor" ? "Bachelor's degree" : "Master's degree";
    const id = r.UNITID!;
    const tag = `College Scorecard, ${r.INSTNM}`;
    const t = level === "bachelor" ? tuitionOut.get(id) : undefined;
    courses.push({
      providerId: id,
      code: `${r.CIPCODE}-${r.CREDLEV}`,
      title: `${subject} – ${degree}`,
      level,
      durationMonths: null,
      language: null,
      tuition: t ? { perYear: Math.round(t), currency: "USD" } : null,
      subject: cipSubject(r.CIPCODE ?? ""),
      subjectHints: [subject],
      courseUrl: null,
      evidenceUrl: `https://collegescorecard.ed.gov/school/?${id}`,
      quotes: {
        level: `${tag}: field of study "${subject}" (CIP ${r.CIPCODE}), credential "${r.CREDDESC}"`,
        ...(t ? { tuition: `${tag}: out-of-state tuition and fees $${Math.round(t).toLocaleString("en-US")} a year (undergraduate, full-time)` } : {}),
      },
    });
  }
  return { name: "College Scorecard (US Department of Education)", licence: "US government data (public domain)", providers, courses };
}

// ---------------------------------------------------------------- United Kingdom: Discover Uni

export const DISCOVER_UNI_PAGE = "https://www.hesa.ac.uk/data-and-analysis/discover-uni-dataset";

/** Degree level from a UK award name ("BSc (Hons)", "MEng", "MSc"…). Integrated masters (MEng, MChem) start after school, like a bachelor's. */
export function ukLevel(aim: string): Level | null {
  const a = aim.trim();
  if (/^(B[A-Z][A-Za-z]*|LLB|BA|BSc|BEng|BMus|BEd|MB\s?ChB|MBBS|BM\s?BS|BDS|BVSc|BVetMed)\b|bachelor/i.test(a)) return "bachelor";
  if (/^(MEng|MChem|MPhys|MMath|MSci|MPharm|MComp|MGeol|MBiol|MArts|MEarthSci|MESci|MNatSci|MOptom|MNurs|MBiochem|MInf|MStat|MMORSE|MMathPhys|MPhysPhil)\b|integrated master/i.test(a)) return "bachelor";
  if (/^(MSc|MA|MRes|MBA|LLM|MPhil|MEd|MFA|MMus|MLitt|MPH|MArch|MClinRes|MSt)\b|master/i.test(a)) return "master";
  return null;
}

const column = (header: string[], ...names: string[]) => names.find((n) => header.includes(n)) ?? null;

/**
 * Discover Uni's KISCOURSE, INSTITUTION and KISAIM files → programs. Full-time (or full- and part-time)
 * bachelor's and master's courses taught on campus, each with the university's own course page.
 */
export function parseDiscoverUni(files: { kiscourse: string; institution: string; kisaim: string | null }): Dataset {
  const ch = csvHeader(files.kiscourse);
  const need = { ukprn: column(ch, "PUBUKPRN", "UKPRN"), id: column(ch, "KISCOURSEID"), title: column(ch, "TITLE"), url: column(ch, "CRSEURL"), aim: column(ch, "KISAIMCODE") };
  const missing = Object.entries(need).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) throw new Error(`KISCOURSE file is missing columns for ${missing.join(", ")}. Its columns: ${ch.join(", ")}`);
  const mode = column(ch, "KISMODE");
  const distance = column(ch, "DISTANCE");
  const length = column(ch, "LENGTH", "CRSELENGTH");

  const ih = csvHeader(files.institution);
  const instId = column(ih, "PUBUKPRN", "UKPRN");
  if (!instId) throw new Error(`INSTITUTION file has no UKPRN column. Its columns: ${ih.join(", ")}`);
  const nameCols = ["LEGAL_NAME", "FIRST_TRADING_NAME", "OTHER_NAMES", "INSTNAME", "PROVNAME"].filter((c) => ih.includes(c));
  const urlCol = column(ih, "PROVURL", "INSTURL", "URL");
  const providers: Provider[] = [];
  for (const r of csvRecords(files.institution)) {
    const names = nameCols.flatMap((c) => (r[c] ?? "").split(/[;|]/)).map((s) => s.trim()).filter(Boolean);
    if (r[instId]) providers.push({ id: r[instId]!, names, website: urlCol ? r[urlCol] || null : null });
  }

  const aims = new Map<string, string>();
  if (files.kisaim) for (const r of csvRecords(files.kisaim)) if (r.KISAIMCODE) aims.set(r.KISAIMCODE, r.KISAIMLABEL ?? "");

  const courses: OfficialCourse[] = [];
  for (const r of csvRecords(files.kiscourse)) {
    if (mode && r[mode] === "2") continue; // part-time only: no student visa
    if (distance && r[distance] && r[distance] !== "0") continue; // distance learning
    const aim = aims.get(r[need.aim!]!) ?? r[need.aim!]!;
    const level = ukLevel(aim);
    const title = r[need.title!]?.trim();
    const ukprn = r[need.ukprn!]!;
    const id = r[need.id!]!;
    if (!level || !title || !ukprn || !id) continue;
    const full = aim && !title.toLowerCase().startsWith(aim.toLowerCase()) ? `${aim} ${title}` : title;
    const url = r[need.url!]?.trim();
    const years = length ? Number(r[length]) : NaN;
    const modeWord = mode && r[mode] === "2" ? "PartTime" : "FullTime";
    const tag = `Discover Uni course ${id}`;
    courses.push({
      providerId: ukprn,
      code: id,
      title: full,
      level,
      durationMonths: years > 0 && years <= 7 ? Math.round(years * 12) : null,
      language: null,
      tuition: null,
      subjectHints: [],
      courseUrl: url && /^https?:\/\//i.test(url) ? url : null,
      evidenceUrl: `https://discoveruni.gov.uk/course-details/${ukprn}/${encodeURIComponent(id)}/${modeWord}/`,
      quotes: {
        level: `${tag} "${title}": award "${aim}"`,
        ...(years > 0 && years <= 7 ? { duration: `${tag} "${title}": length ${years} years` } : {}),
      },
    });
  }
  return { name: "Discover Uni dataset (HESA / Office for Students)", licence: "Creative Commons Attribution 4.0 International", providers, courses };
}

// ---------------------------------------------------------------- facts for the robot's usual checks

/** One course as the robot's usual facts, each quoting the dataset, so checks.ts planChanges can judge them. */
export function courseFacts(c: OfficialCourse): ProgramFacts {
  const f: ProgramFacts = { ...EMPTY_FACTS, intakes: [], english_tests: [], required_documents: [], related_bachelor_fields: [], career_paths_en: [] };
  f.is_program_page = true;
  f.title = c.title;
  f.degree_level = { value: c.level, quote: c.quotes.level };
  if (c.durationMonths && c.quotes.duration) f.duration_months = { value: c.durationMonths, quote: c.quotes.duration };
  if (c.language && c.quotes.language) f.teaching_language = { value: c.language, quote: c.quotes.language };
  if (c.tuition && c.quotes.tuition) f.tuition = { amount_per_year: c.tuition.perYear, currency: c.tuition.currency, applies_to: "non_eu", quote: c.quotes.tuition };
  f.field_slug = c.subject ?? subjectOf(c.title) ?? c.subjectHints.map((h) => subjectOf(h)).find(Boolean) ?? null;
  return f;
}

/** One program per title and level at each university (CRICOS lists some courses once per campus). */
export function uniqueCourses(courses: OfficialCourse[]): OfficialCourse[] {
  const seen = new Set<string>();
  return courses.filter((c) => {
    const key = `${c.providerId}|${c.level}|${c.title.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const DATASET_HOSTS = ["data.gov.au", "collegescorecard.ed.gov", "discoveruni.gov.uk"];

/** True when a program's facts came from an official dataset (so the importer may update it). */
export function fromDataset(sourceUrl: string | null | undefined): boolean {
  try {
    return DATASET_HOSTS.includes(new URL(sourceUrl ?? "").hostname);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- downloading

const COUNTRY_SLUG: Record<OfficialCountry, string> = { au: "australia", us: "united-states", uk: "united-kingdom" };

async function download(url: string, userAgent: string): Promise<Buffer> {
  const res = await fetch(url, { headers: { "User-Agent": userAgent }, signal: AbortSignal.timeout(10 * 60_000) });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Reads a country's dataset: from `file` (a zip or a folder) when given, otherwise from the publisher.
 * The UK has no automatic download (see the top of this file).
 */
export async function loadDataset(country: OfficialCountry, file: string | undefined, userAgent: string, log: (...p: unknown[]) => void): Promise<Dataset> {
  const need = (text: string | null, what: string) => {
    if (text === null) throw new Error(`${what} not found${file ? ` in ${file}` : ""}`);
    return text;
  };
  if (country === "uk") {
    if (!file) throw new Error(`The UK list must be downloaded by a person (HESA's page checks for robots). Download the zip from ${DISCOVER_UNI_PAGE}, then run: npm run robot -- official uk --file <the zip>`);
    const files = openLocal(file);
    return parseDiscoverUni({ kiscourse: need(pickFile(files, /^kiscourse\.csv$/i), "KISCOURSE.csv"), institution: need(pickFile(files, /^institution\.csv$/i), "INSTITUTION.csv"), kisaim: pickFile(files, /^kisaim\.csv$/i) });
  }
  if (country === "au") {
    let files: Map<string, () => Buffer>;
    if (file) files = openLocal(file);
    else {
      const res = await fetch("https://data.gov.au/data/api/3/action/package_show?id=cricos", { headers: { "User-Agent": userAgent } });
      const meta = (await res.json()) as { result: { resources: { name: string; url: string }[] } };
      const url = (name: string) => need(meta.result.resources.find((r) => r.name.toLowerCase() === name.toLowerCase())?.url ?? null, name);
      files = new Map();
      for (const name of ["CRICOS Courses.csv", "CRICOS Institutions.csv"]) {
        log(`Downloading ${name}`);
        const buf = await download(url(name), userAgent);
        files.set(name, () => buf);
      }
    }
    return parseCricos(need(pickFile(files, /courses\.csv$/i), "CRICOS Courses.csv"), need(pickFile(files, /institutions?\.csv$/i), "CRICOS Institutions.csv"));
  }
  let files: Map<string, () => Buffer>;
  if (file) files = openLocal(file);
  else {
    const page = await (await fetch(SCORECARD_DATA_PAGE, { headers: { "User-Agent": userAgent } })).text();
    files = new Map();
    for (const kind of ["Field-of-Study", "Institution"]) {
      const url = need(page.match(new RegExp(`https://[^"']+/Most-Recent-Cohorts-${kind}[^"']*\\.zip`))?.[0] ?? null, `the ${kind} download link on ${SCORECARD_DATA_PAGE}`);
      log(`Downloading ${url}`);
      for (const [name, read] of unzip(await download(url, userAgent))) files.set(name, read);
    }
  }
  return parseScorecard(need(pickFile(files, /field-of-study.*\.csv$/i), "the Field-of-Study CSV"), need(pickFile(files, /cohorts-institution.*\.csv$/i), "the Institution CSV"));
}

// ---------------------------------------------------------------- saving

export interface ImportOptions {
  file?: string;
  /** Only this university. */
  university?: string;
  /** Every matched university, not only the ones blocking the robot. */
  all?: boolean;
  /** Match and count, write nothing. */
  dry?: boolean;
  parallel?: number;
  log: (...p: unknown[]) => void;
}

interface UniRow extends OurUniversity {
  discovered_at: string | null;
  program_pages_found: number | null;
}

/**
 * A university "blocks the robot" when its search failed (website refused or didn't answer), or when the
 * robot found program pages but most of them refuse to be read and none became a program.
 */
export function isBlocked(u: { discovered_at: string | null; program_pages_found: number | null }, pages: { checked: number; failing: number }, programsFromPages: number): boolean {
  if (programsFromPages > 0) return false;
  if (u.discovered_at && u.program_pages_found === null) return true;
  return pages.checked >= 5 && pages.failing / pages.checked >= 0.8;
}

function chunks<T>(list: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));
}

/** The database answers at most 1,000 rows at a time: read page by page, or rows go unseen (and programs get duplicated). */
export async function everyRow<T>(page: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>, what: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) throw new Error(`${what}: ${error.message}`);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}

export async function importOfficial(country: OfficialCountry, opts: ImportOptions) {
  const store = await import("./db.ts");
  const { planChanges } = await import("./checks.ts");
  const { slugify } = await import("./seed.ts");
  const { pool } = await import("./pool.ts");
  const { USER_AGENT } = await import("./fetch.ts");
  const log = opts.log;
  const today = new Date().toISOString().slice(0, 10);

  const data = await loadDataset(country, opts.file, USER_AGENT, log);
  log(`${data.name}: ${data.providers.length} providers, ${data.courses.length} bachelor's and master's courses (licence: ${data.licence})`);

  const rows = await everyRow<UniRow>(
    (a, b) =>
      store
        .db()
        .from("universities")
        .select("slug, name, website, discovered_at, program_pages_found, cities!inner(country)")
        .eq("cities.country", COUNTRY_SLUG[country])
        .order("slug")
        .range(a, b),
    "universities",
  );
  const ours = rows.filter((u) => !opts.university || u.slug === opts.university);
  const byProvider = new Map<string, OfficialCourse[]>();
  for (const c of uniqueCourses(data.courses)) byProvider.set(c.providerId, [...(byProvider.get(c.providerId) ?? []), c]);
  // Only providers that teach bachelor's or master's courses (schools and colleges share names and websites).
  const teaching = data.providers.filter((p) => byProvider.has(p.id)).map((p) => ({ ...p, courses: byProvider.get(p.id)!.length }));
  const { matches, ambiguous } = matchProviders(teaching, ours);
  log(`Matched ${matches.length} of our ${ours.length} universities${ambiguous.length ? `; unsure, left out: ${ambiguous.join("; ")}` : ""}`);

  // What we already have for them: programs (by title) and how their program pages fare.
  const slugs = matches.map((m) => m.university.slug);
  const programs = new Map<string, { slug: string; title: string; source_url: string }[]>();
  const pages = new Map<string, { checked: number; failing: number }>();
  for (const part of chunks(slugs, 50)) {
    const ps = await everyRow<{ slug: string; title: string; university: string; source_url: string }>(
      (a, b) => store.db().from("programs").select("slug, title, university, source_url").in("university", part).order("slug").range(a, b),
      "programs",
    );
    for (const p of ps) programs.set(p.university, [...(programs.get(p.university) ?? []), p]);
    const ss = await everyRow<{ university: string; consecutive_errors: number }>(
      (a, b) => store.db().from("sources").select("university, consecutive_errors").eq("kind", "program_page").in("university", part).not("last_checked_at", "is", null).order("id").range(a, b),
      "sources",
    );
    for (const s of ss) {
      const p = pages.get(s.university) ?? { checked: 0, failing: 0 };
      p.checked++;
      if (s.consecutive_errors > 0) p.failing++;
      pages.set(s.university, p);
    }
  }

  const targets = matches.filter((m) => {
    const fromPages = (programs.get(m.university.slug) ?? []).filter((p) => !fromDataset(p.source_url)).length;
    return opts.all || opts.university || isBlocked(m.university as UniRow, pages.get(m.university.slug) ?? { checked: 0, failing: 0 }, fromPages);
  });
  log(`${targets.length} of them ${opts.all || opts.university ? "selected" : "block the robot"}: ${targets.map((t) => `${t.university.slug} (${byProvider.get(t.provider.id)?.length ?? 0})`).join(", ") || "none"}`);
  if (opts.dry) {
    for (const m of matches) log(`  ${m.university.slug} ← ${m.provider.names[0]} [${m.by}], ${byProvider.get(m.provider.id)?.length ?? 0} courses`);
    return { matched: matches.length, targets: targets.length, created: 0, updated: 0, published: 0, sources: 0, universities: 0 };
  }

  const mb = await store.databaseMB();
  const full = mb !== null && mb >= store.DATABASE_BRAKE_MB;
  if (full) log(`Database is ${mb} MB (brake at ${store.DATABASE_BRAKE_MB} MB): updating programs from earlier imports only.`);
  const validFields = new Set((await store.fieldList()).map((f) => f.split(":")[0]!));
  const stats = { created: 0, updated: 0, published: 0, sources: 0 };
  const touched = new Set<string>();
  const targetSet = new Set(targets.map((t) => t.university.slug));

  const work: { m: Match; c: OfficialCourse }[] = [];
  for (const m of matches) for (const c of byProvider.get(m.provider.id) ?? []) work.push({ m, c });
  await pool(work, opts.parallel ?? 8, Infinity, async ({ m, c }) => {
    const uni = m.university;
    try {
      let slug: string | null = null;
      if (targetSet.has(uni.slug)) {
        const same = (programs.get(uni.slug) ?? []).find((p) => p.title.toLowerCase() === c.title.toLowerCase());
        // The robot (or a person) already has this program from the university's own page: that wins.
        if (same && !fromDataset(same.source_url)) return;
        const existing = same ? await store.loadProgram(same.slug) : null;
        if (existing || !full) {
          if (existing) slug = existing.slug;
          else {
            const base = slugify(`${c.title} ${uni.name}`);
            for (let i = 1; !slug; i++) {
              const candidate = i === 1 ? base : `${base}-${i}`;
              if (!(await store.slugTaken(candidate))) slug = candidate;
            }
          }
          const save = (s: string) =>
            store.applyProgram({
              slug: s,
              isNew: !existing,
              create: existing ? undefined : { title: c.title, university: uni.slug, degree_level: c.level, official_url: c.courseUrl ?? uni.website },
              changes: planChanges(existing, courseFacts(c), today, validFields),
              extraction: null,
              sourceUrl: c.evidenceUrl,
              officialUrl: c.courseUrl ?? uni.website,
              today,
            });
          let result;
          try {
            result = await save(slug);
          } catch (e) {
            // Two long titles cut to the same address, saved at the same moment: take the next free one.
            if (existing || !String(e).includes("programs_pkey")) throw e;
            slug = `${slug}-${c.code.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
            result = await save(slug);
          }
          if (existing) stats.updated++;
          else {
            stats.created++;
            touched.add(uni.slug);
          }
          if (result.published) stats.published++;
        }
      }
      // The university's own course page: the daily check reads it whenever the website lets it.
      if (c.courseUrl && !full) {
        await store.addSource({ url: c.courseUrl, kind: "program_page", university: uni.slug, entity_slug: slug, status: "discovered" });
        stats.sources++;
      }
    } catch (e) {
      log(`  ${uni.slug} "${c.title}": ${e instanceof Error ? e.message : String(e)}`);
    }
  });
  log(`Done: ${stats.created} programs added at ${touched.size} universities, ${stats.updated} updated, ${stats.published} published, ${stats.sources} course pages for the daily check.`);
  return { matched: matches.length, targets: targets.length, ...stats, universities: touched.size };
}
