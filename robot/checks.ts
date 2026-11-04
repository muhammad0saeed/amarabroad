// The robot's safety net. Two steps:
// 1. verifyFacts: every fact's quote must really be on the fetched pages, and the value must be visible in
//    that quote (numbers, dates, scores). Facts that fail are dropped, never published.
// 2. planChanges: compares what's left with what we have. Values that are plausible are applied;
//    surprising ones (fee tripled, level changed, deadline already passed…) are held for a person to look at.

import type { ProgramFacts } from "./facts.ts";

// ---------------------------------------------------------------- quote checking

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTHS_DE = ["jan", "feb", "mär", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "dez"];

/** Lowercase, same dashes/quotes everywhere, bullets and table bars removed, whitespace squeezed out. */
export function normalize(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[‐-―−]/g, "-")
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[•|#*]/g, " ")
    .replace(/\s+/g, "");
}

export function quoteOnPage(quote: string, pages: string[]): boolean {
  const q = normalize(quote);
  if (q.length < 3) return false;
  return pages.some((p) => normalize(p).includes(q));
}

/** Every number written in a text, with thousands separators understood ("6,000", "6.000", "6 000" → 6000). */
export function numbersIn(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/\d{1,3}(?:[ .,’' ]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?/g)) {
    const raw = m[0];
    const grouped = raw.match(/^\d{1,3}(?:([ .,’' ])\d{3})+(?:([.,])(\d+))?$/);
    if (grouped && grouped[1] !== grouped[2]) {
      out.push(Number(raw.replace(/[ .,’' ](?=\d{3}\b)/g, "").replace(",", ".")));
      // "6.000" could also be six-point-zero; keep both readings.
      if (/^\d{1,3}[.,]\d{3}$/.test(raw)) out.push(Number(raw.replace(",", ".")));
    } else {
      out.push(Number(raw.replace(",", ".")));
    }
  }
  return out;
}

const near = (a: number, b: number) => Math.abs(a - b) < 0.005 * Math.max(1, Math.abs(b));

export function numberInQuote(value: number, quote: string, { perSemester = false } = {}): boolean {
  const found = numbersIn(quote);
  return found.some((n) => near(n, value) || (perSemester && near(n * 2, value)));
}

/** A YYYY-MM-DD date is "in" a quote when its day and its month (number or name) both appear. */
export function dateInQuote(iso: string, quote: string): boolean {
  const [, m, d] = iso.split("-").map(Number) as [number, number, number];
  const q = quote.toLowerCase();
  // Plain digit runs: "13.10.2025" → 13, 10, 2025 (thousands-separator parsing would misread dates).
  const nums = (q.match(/\d+/g) ?? []).map(Number);
  const hasDay = nums.includes(d);
  const hasMonth = nums.includes(m) || q.includes(MONTHS[m - 1]!) || q.includes(MONTHS_DE[m - 1]!);
  return hasDay && hasMonth;
}

export interface Dropped {
  field: string;
  reason: string;
}

/** Keeps only facts whose quote is on the page and shows the value. Returns the cleaned facts and what was dropped. */
export function verifyFacts(facts: ProgramFacts, pageTexts: string[]): { facts: ProgramFacts; dropped: Dropped[] } {
  const dropped: Dropped[] = [];
  const onPage = (field: string, quote: string) => {
    if (quoteOnPage(quote, pageTexts)) return true;
    dropped.push({ field, reason: `quote not found on the page: "${quote.slice(0, 80)}"` });
    return false;
  };
  const shows = (field: string, ok: boolean, quote: string) => {
    if (ok) return true;
    dropped.push({ field, reason: `value not visible in the quote: "${quote.slice(0, 80)}"` });
    return false;
  };
  const f: ProgramFacts = structuredClone(facts);

  const simple = ["degree_level", "teaching_language", "language_requirement", "accepts_moi", "accepts_3yr_bachelor", "accepts_provisional"] as const;
  for (const key of simple) if (f[key] && !onPage(key, f[key]!.quote)) f[key] = null;
  // Duration may be written in semesters or years, so only the quote is checked.
  if (f.duration_months && !onPage("duration_months", f.duration_months.quote)) f.duration_months = null;
  for (const key of ["ects_credits", "seats_total", "seats_non_eu"] as const) {
    const v = f[key];
    if (v && !(onPage(key, v.quote) && shows(key, numberInQuote(v.value, v.quote), v.quote))) f[key] = null;
  }
  if (f.tuition && !(onPage("tuition", f.tuition.quote) && shows("tuition", f.tuition.amount_per_year === 0 || numberInQuote(f.tuition.amount_per_year, f.tuition.quote, { perSemester: true }), f.tuition.quote))) f.tuition = null;
  for (const key of ["other_fees_per_year", "application_fee"] as const) {
    const v = f[key];
    if (v && !(onPage(key, v.quote) && shows(key, v.amount === 0 || numberInQuote(v.amount, v.quote, { perSemester: key === "other_fees_per_year" }), v.quote))) f[key] = null;
  }
  f.intakes = f.intakes.filter((i) => onPage("intakes", i.quote) && (i.deadline === null || shows("intakes", dateInQuote(i.deadline, i.quote), i.quote)));
  f.english_tests = f.english_tests.filter((t) => onPage("english_tests", t.quote) && shows("english_tests", numberInQuote(t.min_score, t.quote), t.quote));
  if (f.min_grade && !(onPage("min_grade", f.min_grade.quote) && shows("min_grade", numberInQuote(f.min_grade.value, f.min_grade.quote), f.min_grade.quote))) f.min_grade = null;
  f.required_documents = f.required_documents.filter((d) => onPage("required_documents", d.quote));
  return { facts: f, dropped };
}

// ---------------------------------------------------------------- planning changes

/** The program columns the robot maintains (same names as the programs table). */
export interface ProgramRow {
  slug: string;
  title: string;
  degree_level: "bachelor" | "master";
  field: string | null;
  related_bachelor_fields: string[];
  duration_months: number | null;
  ects_credits: number | null;
  language: string | null;
  language_requirement_en: string | null;
  currency: string | null;
  tuition_per_year: number | null;
  other_fees_per_year: number;
  application_fee: number;
  intakes: { month: number; year: number; deadline: string }[];
  english_tests: { test: string; min_score: number }[];
  accepts_moi: boolean | null;
  accepts_3yr_bachelor: boolean | null;
  accepts_provisional: boolean | null;
  min_gpa_requirement: { value: number; scale: number; local_note_en?: string } | null;
  seats_total: number | null;
  seats_non_eu: number | null;
  required_documents: string[];
  overview_en: string;
  career_paths_en: string[];
}

export interface PlannedChange {
  field: keyof ProgramRow;
  oldValue: unknown;
  newValue: unknown;
  evidence: string;
  /** null = apply; otherwise why it's held for review. */
  hold: string | null;
}

const RANGES: Record<string, [number, number]> = { ielts: [4, 9], toefl_ibt: [30, 120], pte: [30, 90], duolingo: [60, 160] };
/** JSON with object keys sorted: the database returns {"year","month","deadline"} in its own key order. */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stable((value as Record<string, unknown>)[k])}`).join(",")}}`;
  return JSON.stringify(value ?? null);
}
const same = (a: unknown, b: unknown) => stable(a) === stable(b);
const daysBetween = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86_400_000;

/**
 * What to change on `old` (null for a brand-new program) given verified facts.
 * A fact the pages don't mention never wipes a value we already have.
 */
export function planChanges(old: ProgramRow | null, f: ProgramFacts, today: string, validFields?: Set<string>): PlannedChange[] {
  const changes: PlannedChange[] = [];
  const propose = (field: keyof ProgramRow, value: unknown, evidence: string, hold: string | null = null) => {
    const before = old ? old[field] : null;
    if (!same(before, value)) changes.push({ field, oldValue: before, newValue: value, evidence, hold });
  };
  const isNew = old === null;

  if (f.degree_level) propose("degree_level", f.degree_level.value, f.degree_level.quote, !isNew && old.degree_level !== f.degree_level.value ? "degree level changed" : null);

  // Subject: the robot's judgement, not a quote. Set it for new programs; a different opinion later is held.
  const known = (slug: string) => !validFields || validFields.has(slug);
  if (f.field_slug && known(f.field_slug)) propose("field", f.field_slug, "(subject chosen by the robot)", !isNew && old.field && old.field !== f.field_slug ? `subject changed to ${f.field_slug}` : null);
  const related = [...new Set(f.related_bachelor_fields.filter(known))].sort();
  if (related.length && (isNew || !old.related_bachelor_fields.length)) propose("related_bachelor_fields", related, "(previous studies named on the page)");

  if (f.duration_months) {
    const v = Math.round(f.duration_months.value);
    propose("duration_months", v, f.duration_months.quote, v < 6 || v > 72 ? `unusual length: ${v} months` : null);
  }
  if (f.ects_credits) {
    const v = f.ects_credits.value;
    propose("ects_credits", v, f.ects_credits.quote, v < 30 || v > 360 ? `unusual credits: ${v}` : null);
  }
  if (f.teaching_language) {
    const v = f.teaching_language.value.toLowerCase().slice(0, 2);
    propose("language", v, f.teaching_language.quote, !isNew && old.language && old.language !== v ? "teaching language changed" : null);
  }
  if (f.language_requirement) propose("language_requirement_en", f.language_requirement.value, f.language_requirement.quote);

  if (f.tuition && f.tuition.applies_to !== "eu") {
    const v = Math.round(f.tuition.amount_per_year);
    const cur = f.tuition.currency.toUpperCase();
    const prev = old?.tuition_per_year ?? null;
    let hold: string | null = null;
    if (!isNew && old.currency && old.currency !== cur) hold = `currency changed from ${old.currency} to ${cur}`;
    else if (prev !== null && (prev === 0) !== (v === 0)) hold = v === 0 ? "now says tuition-free" : "no longer tuition-free";
    else if (prev !== null && prev > 0 && (v > prev * 2 || v < prev / 2)) hold = `tuition moved from ${prev} to ${v}`;
    propose("currency", cur, f.tuition.quote, hold);
    propose("tuition_per_year", v, f.tuition.quote, hold);
  }
  if (f.other_fees_per_year) propose("other_fees_per_year", Math.round(f.other_fees_per_year.amount), f.other_fees_per_year.quote);
  if (f.application_fee) propose("application_fee", Math.round(f.application_fee.amount), f.application_fee.quote);

  const intakes = f.intakes
    .filter((i) => i.deadline !== null)
    .map((i) => ({ month: i.start_month, year: i.start_year, deadline: i.deadline!, quote: i.quote }))
    .sort((a, b) => (a.deadline < b.deadline ? -1 : 1));
  if (intakes.length) {
    const bad = intakes.find((i) => i.month < 1 || i.month > 12 || daysBetween(today, i.deadline) < -7 || daysBetween(today, i.deadline) > 760);
    const value = intakes.map(({ month, year, deadline }) => ({ month, year, deadline }));
    propose("intakes", value, intakes.map((i) => i.quote).join(" / "), bad ? `deadline ${bad.deadline} is in the past or too far ahead` : null);
  }

  if (f.english_tests.length) {
    const tests = [...new Map(f.english_tests.map((t) => [t.test, { test: t.test, min_score: t.min_score }])).values()].sort((a, b) => a.test.localeCompare(b.test));
    const odd = tests.find((t) => t.min_score < RANGES[t.test]![0] || t.min_score > RANGES[t.test]![1]);
    propose("english_tests", tests, f.english_tests.map((t) => t.quote).join(" / "), odd ? `${odd.test} score ${odd.min_score} looks wrong` : null);
  }

  for (const key of ["accepts_moi", "accepts_3yr_bachelor", "accepts_provisional"] as const) {
    const v = f[key];
    // A "yes" that becomes "no" (or the reverse) changes who can apply: worth a second look.
    // (Going from "not stated" to an answer is new information, not a flip.)
    if (v) propose(key, v.value, v.quote, !isNew && old[key] !== null && old[key] !== v.value ? `${key} flipped to ${v.value}` : null);
  }

  if (f.min_grade) {
    const { value, scale, note, quote } = f.min_grade;
    // The app compares grades on 4- or 5-point scales (Bangladeshi CGPA/GPA). Other scales need converting by a person.
    const usable = (scale === 4 || scale === 5) && value > 0 && value <= scale;
    propose("min_gpa_requirement", { value, scale, ...(note ? { local_note_en: note } : {}) }, quote, usable ? null : `grade on a ${scale}-point scale needs converting`);
  }
  if (f.seats_total) propose("seats_total", f.seats_total.value, f.seats_total.quote);
  if (f.seats_non_eu) propose("seats_non_eu", f.seats_non_eu.value, f.seats_non_eu.quote);
  if (f.required_documents.length) {
    const docs = [...new Set(f.required_documents.map((d) => d.key))].sort();
    propose("required_documents", docs, f.required_documents.map((d) => d.quote).join(" / "));
  }
  // Summaries are written by the model, not quoted: only filled in when we have nothing yet.
  if (f.overview_en && (isNew || !old.overview_en)) propose("overview_en", f.overview_en, "(summary written by the robot)");
  if (f.career_paths_en.length && (isNew || !old.career_paths_en.length)) propose("career_paths_en", f.career_paths_en, "(listed on the page)");
  return changes;
}
