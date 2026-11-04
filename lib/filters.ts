// Search filters, facets and sorting for /programs. Filter state lives in the URL, so a search
// can be shared, bookmarked, and survives a language switch. Searching runs on the server
// (lib/search.ts), so this scales to thousands of programs: the browser only gets one page.

import type { DegreeLevel, EnglishTest, FieldGroup, ISODate, TeachingLanguage } from "@/types";
import { addDays } from "./dates";
import { nextDeadline, type ProgramSummary } from "./summary";

export const SORT_KEYS = ["relevance", "cost_low", "cost_high", "tuition_low", "deadline"] as const;
export type SortKey = (typeof SORT_KEYS)[number];

/** Budget chips, in lakh taka (total cost of the whole program, living costs included). */
export const BUDGET_PRESETS_LAKH = [30, 40, 60] as const;
/** Tuition chips, in lakh taka per year. */
export const TUITION_PRESETS_LAKH = [5, 10, 20] as const;
/** Highest IELTS band a student can offer; programs asking for this or less match. */
export const IELTS_PRESETS = [5.5, 6, 6.5] as const;
export const DURATIONS = ["1y", "2y", "3y"] as const;
export type Duration = (typeof DURATIONS)[number];
export const UNIVERSITY_TYPES = ["public", "private"] as const;
export const ENGLISH_TESTS: EnglishTest[] = ["ielts", "toefl_ibt", "pte", "duolingo"];
export const PAGE_SIZE = 20;

export interface ProgramFilters {
  q: string;
  countries: string[];
  cities: string[];
  universities: string[];
  universityTypes: ("public" | "private")[];
  level: DegreeLevel | null;
  fieldGroups: FieldGroup[];
  fields: string[];
  languages: TeachingLanguage[];
  intakeMonths: number[];
  durations: Duration[];
  /** Maximum total cost in lakh taka. */
  maxBudgetLakh: number | null;
  /** Maximum tuition per year in lakh taka. */
  maxTuitionLakh: number | null;
  tuitionFree: boolean;
  /** "open": at least one intake still open; "soon": a deadline within 30 days. */
  deadline: "open" | "soon" | null;
  englishTests: EnglishTest[];
  /** The student's IELTS band: programs whose IELTS minimum is at or below it. */
  maxIelts: number | null;
  accepts3yr: boolean;
  moi: boolean;
  provisional: boolean;
  bdOpen: boolean;
  scholarship: boolean;
  seatsPublished: boolean;
  sort: SortKey;
  page: number;
}

export const EMPTY_FILTERS: ProgramFilters = {
  q: "",
  countries: [],
  cities: [],
  universities: [],
  universityTypes: [],
  level: null,
  fieldGroups: [],
  fields: [],
  languages: [],
  intakeMonths: [],
  durations: [],
  maxBudgetLakh: null,
  maxTuitionLakh: null,
  tuitionFree: false,
  deadline: null,
  englishTests: [],
  maxIelts: null,
  accepts3yr: false,
  moi: false,
  provisional: false,
  bdOpen: false,
  scholarship: false,
  seatsPublished: false,
  sort: "relevance",
  page: 1,
};

const LEVELS: DegreeLevel[] = ["bachelor", "master"];
const LANGUAGES: TeachingLanguage[] = ["en", "de", "it", "hu"];
const GROUPS: FieldGroup[] = ["computing", "engineering", "business", "social", "humanities", "health", "life_sciences", "natural_sciences", "design"];
const list = (value: string | null) => (value ? value.split(",").map((v) => v.trim()).filter(Boolean) : []);
const flag = (value: string | null) => value === "1";
const positive = (value: string | null) => {
  const n = Number(value);
  return value !== null && Number.isFinite(n) && n > 0 ? n : null;
};
const oneOf = <T extends string>(values: readonly T[]) => (v: string): v is T => (values as readonly string[]).includes(v);

/** URL query → filters. Unknown or malformed values are ignored. */
export function parseFilters(params: URLSearchParams): ProgramFilters {
  const level = params.get("level");
  const sort = params.get("sort");
  const deadline = params.get("deadline");
  const page = Math.floor(Number(params.get("page")));
  return {
    q: (params.get("q") ?? "").trim().slice(0, 100),
    countries: list(params.get("country")),
    cities: list(params.get("city")),
    universities: list(params.get("uni")),
    universityTypes: list(params.get("type")).filter(oneOf(UNIVERSITY_TYPES)),
    level: LEVELS.includes(level as DegreeLevel) ? (level as DegreeLevel) : null,
    fieldGroups: list(params.get("area")).filter(oneOf(GROUPS)),
    fields: list(params.get("field")),
    languages: list(params.get("lang")).filter(oneOf(LANGUAGES)),
    intakeMonths: list(params.get("intake"))
      .map(Number)
      .filter((m) => Number.isInteger(m) && m >= 1 && m <= 12),
    durations: list(params.get("dur")).filter(oneOf(DURATIONS)),
    maxBudgetLakh: positive(params.get("budget")),
    maxTuitionLakh: positive(params.get("tuition")),
    tuitionFree: flag(params.get("free")),
    deadline: deadline === "open" || deadline === "soon" ? deadline : null,
    englishTests: list(params.get("test")).filter(oneOf(ENGLISH_TESTS)),
    maxIelts: positive(params.get("ielts")),
    accepts3yr: flag(params.get("3yr")),
    moi: flag(params.get("moi")),
    provisional: flag(params.get("prov")),
    bdOpen: flag(params.get("bd")),
    scholarship: flag(params.get("sch")),
    seatsPublished: flag(params.get("seats")),
    sort: SORT_KEYS.includes(sort as SortKey) ? (sort as SortKey) : "relevance",
    page: Number.isFinite(page) && page > 1 ? page : 1,
  };
}

/** Filters → URL query, with keys in a fixed order and defaults left out. */
export function serializeFilters(filters: ProgramFilters): string {
  const params = new URLSearchParams();
  const set = (key: string, value: string | number | null | false | undefined) => {
    if (value !== null && value !== false && value !== undefined && value !== "") params.set(key, String(value));
  };
  const join = (values: (string | number)[]) => (values.length ? values.join(",") : null);
  set("q", filters.q);
  set("country", join(filters.countries));
  set("city", join(filters.cities));
  set("uni", join(filters.universities));
  set("type", join(filters.universityTypes));
  set("level", filters.level);
  set("area", join(filters.fieldGroups));
  set("field", join(filters.fields));
  set("lang", join(filters.languages));
  set("intake", join(filters.intakeMonths));
  set("dur", join(filters.durations));
  set("budget", filters.maxBudgetLakh);
  set("tuition", filters.maxTuitionLakh);
  set("free", filters.tuitionFree && "1");
  set("deadline", filters.deadline);
  set("test", join(filters.englishTests));
  set("ielts", filters.maxIelts);
  set("3yr", filters.accepts3yr && "1");
  set("moi", filters.moi && "1");
  set("prov", filters.provisional && "1");
  set("bd", filters.bdOpen && "1");
  set("sch", filters.scholarship && "1");
  set("seats", filters.seatsPublished && "1");
  if (filters.sort !== "relevance") set("sort", filters.sort);
  if (filters.page > 1) set("page", filters.page);
  return params.toString();
}

/** How many filters are set (search text, sort and page don't count). */
export function activeFilterCount(f: ProgramFilters): number {
  return (
    f.countries.length +
    f.cities.length +
    f.universities.length +
    f.universityTypes.length +
    (f.level ? 1 : 0) +
    f.fieldGroups.length +
    f.fields.length +
    f.languages.length +
    f.intakeMonths.length +
    f.durations.length +
    f.englishTests.length +
    [f.maxBudgetLakh, f.maxTuitionLakh, f.maxIelts, f.deadline].filter((v) => v !== null).length +
    [f.tuitionFree, f.accepts3yr, f.moi, f.provisional, f.bdOpen, f.scholarship, f.seatsPublished].filter(Boolean).length
  );
}

/** Plain text match on title, university, city, country and field names. */
function matchesText(p: ProgramSummary, q: string, fieldNames: Record<string, string[]>): boolean {
  const haystack = [p.title, p.university.name, p.city.name_en, p.city.name_bn, p.country.name_en, p.country.name_bn, ...(fieldNames[p.field] ?? [])]
    .join(" ")
    .toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

export function durationOf(months: number | null): Duration | undefined {
  return months === null ? undefined : months <= 12 ? "1y" : months <= 24 ? "2y" : "3y";
}

function ieltsMin(p: ProgramSummary): number | null {
  return p.english_tests.find((t) => t.test === "ielts")?.min_score ?? null;
}

export interface ApplyOptions {
  today: ISODate;
  /** Field slug → names in both languages, for text search. */
  fieldNames?: Record<string, string[]>;
  /** Skip the text match (when a fuzzy search already narrowed the list). */
  skipText?: boolean;
}

/** One predicate per filter, so facet counts can leave their own filter out. */
type Facet =
  | "text"
  | "country"
  | "city"
  | "university"
  | "universityType"
  | "level"
  | "fieldGroup"
  | "field"
  | "language"
  | "intake"
  | "duration"
  | "budget"
  | "tuition"
  | "free"
  | "deadline"
  | "englishTest"
  | "ielts"
  | "accepts3yr"
  | "moi"
  | "provisional"
  | "bdOpen"
  | "scholarship"
  | "seats";

function predicates(f: ProgramFilters, o: ApplyOptions): Record<Facet, (p: ProgramSummary) => boolean> {
  const soon = addDays(o.today, 30);
  return {
    text: (p) => o.skipText || !f.q || matchesText(p, f.q, o.fieldNames ?? {}),
    country: (p) => !f.countries.length || f.countries.includes(p.country.slug),
    city: (p) => !f.cities.length || f.cities.includes(p.city.slug),
    university: (p) => !f.universities.length || f.universities.includes(p.university.slug),
    universityType: (p) => !f.universityTypes.length || f.universityTypes.includes(p.university.type),
    level: (p) => !f.level || p.degree_level === f.level,
    fieldGroup: (p) => !f.fieldGroups.length || (p.field_group !== undefined && f.fieldGroups.includes(p.field_group)),
    field: (p) => !f.fields.length || f.fields.includes(p.field),
    language: (p) => !f.languages.length || (p.language !== null && f.languages.includes(p.language)),
    intake: (p) => !f.intakeMonths.length || p.intakes.some((i) => f.intakeMonths.includes(i.month)),
    duration: (p) => {
      const d = durationOf(p.duration_months);
      return !f.durations.length || (d !== undefined && f.durations.includes(d));
    },
    // An unknown cost never counts as "under the budget".
    budget: (p) => f.maxBudgetLakh === null || (p.total_bdt !== null && p.total_bdt <= f.maxBudgetLakh * 1e5),
    tuition: (p) => f.maxTuitionLakh === null || (p.tuition_per_year_bdt !== null && p.tuition_per_year_bdt <= f.maxTuitionLakh * 1e5),
    free: (p) => !f.tuitionFree || p.tuition_per_year === 0,
    deadline: (p) => {
      if (!f.deadline) return true;
      const next = nextDeadline(p.intakes, o.today);
      return f.deadline === "open" ? next !== null : next !== null && next.deadline <= soon;
    },
    englishTest: (p) => !f.englishTests.length || p.english_tests.some((t) => f.englishTests.includes(t.test)),
    ielts: (p) => {
      if (f.maxIelts === null) return true;
      const min = ieltsMin(p);
      return min !== null && min <= f.maxIelts;
    },
    accepts3yr: (p) => !f.accepts3yr || p.accepts_3yr_bachelor,
    moi: (p) => !f.moi || p.accepts_moi,
    provisional: (p) => !f.provisional || p.accepts_provisional,
    bdOpen: (p) => !f.bdOpen || p.open_to_bd_citizens,
    scholarship: (p) => !f.scholarship || Boolean(p.has_scholarship),
    seats: (p) => !f.seatsPublished || p.seats_non_eu !== null,
  };
}

function filterExcept(programs: ProgramSummary[], preds: Record<Facet, (p: ProgramSummary) => boolean>, skip?: Facet) {
  const active = (Object.keys(preds) as Facet[]).filter((k) => k !== skip);
  return programs.filter((p) => active.every((k) => preds[k](p)));
}

export function applyFilters(programs: ProgramSummary[], f: ProgramFilters, options: ApplyOptions): ProgramSummary[] {
  return sortPrograms(filterExcept(programs, predicates(f, options)), f.sort, options.today);
}

export function sortPrograms(programs: ProgramSummary[], sort: SortKey, today: ISODate): ProgramSummary[] {
  const sorted = [...programs];
  const deadlineOf = (p: ProgramSummary) => nextDeadline(p.intakes, today)?.deadline ?? "9999-12-31";
  // Unknown amounts go last whichever way the list is sorted.
  const byAmount = (a: number | null, b: number | null, dir: 1 | -1) => (a === null ? (b === null ? 0 : 1) : b === null ? -1 : (a - b) * dir);
  switch (sort) {
    case "cost_low":
      return sorted.sort((a, b) => byAmount(a.total_bdt, b.total_bdt, 1));
    case "cost_high":
      return sorted.sort((a, b) => byAmount(a.total_bdt, b.total_bdt, -1));
    case "tuition_low":
      return sorted.sort((a, b) => byAmount(a.tuition_per_year_bdt, b.tuition_per_year_bdt, 1));
    case "deadline":
      return sorted.sort((a, b) => (deadlineOf(a) < deadlineOf(b) ? -1 : deadlineOf(a) > deadlineOf(b) ? 1 : 0));
    default:
      return sorted;
  }
}

// ---------------------------------------------------------------- facet counts

/** For each option: how many programs you'd see if you picked it, given every other filter. */
export interface FacetCounts {
  countries: Record<string, number>;
  cities: Record<string, number>;
  universities: Record<string, number>;
  universityTypes: Record<string, number>;
  levels: Record<string, number>;
  fieldGroups: Record<string, number>;
  fields: Record<string, number>;
  languages: Record<string, number>;
  intakeMonths: Record<string, number>;
  durations: Record<string, number>;
  englishTests: Record<string, number>;
  /** Counts for on/off filters if they were switched on. */
  flags: Record<"tuitionFree" | "accepts3yr" | "moi" | "provisional" | "bdOpen" | "scholarship" | "seatsPublished" | "deadlineOpen" | "deadlineSoon", number>;
  budget: Record<string, number>;
  tuition: Record<string, number>;
  ielts: Record<string, number>;
}

function countBy(programs: ProgramSummary[], key: (p: ProgramSummary) => string | string[] | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of programs) {
    const k = key(p);
    for (const v of Array.isArray(k) ? [...new Set(k)] : k === undefined ? [] : [k]) out[v] = (out[v] ?? 0) + 1;
  }
  return out;
}

export function facetCounts(programs: ProgramSummary[], f: ProgramFilters, options: ApplyOptions): FacetCounts {
  const preds = predicates(f, options);
  const without = (facet: Facet) => filterExcept(programs, preds, facet);
  const ifOn = (facet: Facet, test: (p: ProgramSummary) => boolean) => without(facet).filter(test).length;
  const thresholds = (facet: Facet, presets: readonly number[], value: (p: ProgramSummary) => number | null) => {
    const pool = without(facet);
    return Object.fromEntries(presets.map((n) => [String(n), pool.filter((p) => { const v = value(p); return v !== null && v <= n; }).length]));
  };
  const soon = addDays(options.today, 30);
  return {
    countries: countBy(without("country"), (p) => p.country.slug),
    cities: countBy(without("city"), (p) => p.city.slug),
    universities: countBy(without("university"), (p) => p.university.slug),
    universityTypes: countBy(without("universityType"), (p) => p.university.type),
    levels: countBy(without("level"), (p) => p.degree_level),
    fieldGroups: countBy(without("fieldGroup"), (p) => p.field_group),
    fields: countBy(without("field"), (p) => p.field),
    languages: countBy(without("language"), (p) => p.language ?? undefined),
    intakeMonths: countBy(without("intake"), (p) => p.intakes.map((i) => String(i.month))),
    durations: countBy(without("duration"), (p) => durationOf(p.duration_months)),
    englishTests: countBy(without("englishTest"), (p) => p.english_tests.map((t) => t.test)),
    flags: {
      tuitionFree: ifOn("free", (p) => p.tuition_per_year === 0),
      accepts3yr: ifOn("accepts3yr", (p) => p.accepts_3yr_bachelor),
      moi: ifOn("moi", (p) => p.accepts_moi),
      provisional: ifOn("provisional", (p) => p.accepts_provisional),
      bdOpen: ifOn("bdOpen", (p) => p.open_to_bd_citizens),
      scholarship: ifOn("scholarship", (p) => Boolean(p.has_scholarship)),
      seatsPublished: ifOn("seats", (p) => p.seats_non_eu !== null),
      deadlineOpen: ifOn("deadline", (p) => nextDeadline(p.intakes, options.today) !== null),
      deadlineSoon: ifOn("deadline", (p) => {
        const next = nextDeadline(p.intakes, options.today);
        return next !== null && next.deadline <= soon;
      }),
    },
    budget: thresholds("budget", BUDGET_PRESETS_LAKH, (p) => (p.total_bdt === null ? null : p.total_bdt / 1e5)),
    tuition: thresholds("tuition", TUITION_PRESETS_LAKH, (p) => (p.tuition_per_year_bdt === null ? null : p.tuition_per_year_bdt / 1e5)),
    ielts: thresholds("ielts", IELTS_PRESETS, ieltsMin),
  };
}

// ---------------------------------------------------------------- compare

export const COMPARE_MIN = 2;
export const COMPARE_MAX = 4;

/** "?ids=a,b,c" → up to 4 unique program slugs. */
export function parseCompareIds(params: URLSearchParams): string[] {
  return [...new Set(list(params.get("ids")))].slice(0, COMPARE_MAX);
}

export function compareQuery(slugs: string[]): string {
  return new URLSearchParams({ ids: [...new Set(slugs)].slice(0, COMPARE_MAX).join(",") }).toString();
}
