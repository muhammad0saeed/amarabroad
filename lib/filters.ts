// Search filters and sorting for /programs. Filter state lives in the URL, so a filtered
// search can be shared, bookmarked, and survives a language switch.

import type { DegreeLevel, ISODate, TeachingLanguage } from "@/types";
import { nextDeadline, type ProgramSummary } from "./summary";

export const SORT_KEYS = ["relevance", "cost_low", "cost_high", "tuition_low", "deadline"] as const;
export type SortKey = (typeof SORT_KEYS)[number];

/** Budget chips, in lakh taka (total cost of the whole program, living costs included). */
export const BUDGET_PRESETS_LAKH = [30, 40, 60] as const;

export interface ProgramFilters {
  q: string;
  countries: string[];
  cities: string[];
  level: DegreeLevel | null;
  fields: string[];
  languages: TeachingLanguage[];
  intakeMonths: number[];
  /** Maximum total cost in lakh taka. */
  maxBudgetLakh: number | null;
  tuitionFree: boolean;
  accepts3yr: boolean;
  moi: boolean;
  provisional: boolean;
  bdOpen: boolean;
  sort: SortKey;
}

export const EMPTY_FILTERS: ProgramFilters = {
  q: "",
  countries: [],
  cities: [],
  level: null,
  fields: [],
  languages: [],
  intakeMonths: [],
  maxBudgetLakh: null,
  tuitionFree: false,
  accepts3yr: false,
  moi: false,
  provisional: false,
  bdOpen: false,
  sort: "relevance",
};

const LEVELS: DegreeLevel[] = ["bachelor", "master"];
const LANGUAGES: TeachingLanguage[] = ["en", "de", "it", "hu"];
const list = (value: string | null) => (value ? value.split(",").map((v) => v.trim()).filter(Boolean) : []);
const flag = (value: string | null) => value === "1";

/** URL query → filters. Unknown or malformed values are ignored. */
export function parseFilters(params: URLSearchParams): ProgramFilters {
  const level = params.get("level");
  const sort = params.get("sort");
  const budget = Number(params.get("budget"));
  return {
    q: (params.get("q") ?? "").trim(),
    countries: list(params.get("country")),
    cities: list(params.get("city")),
    level: LEVELS.includes(level as DegreeLevel) ? (level as DegreeLevel) : null,
    fields: list(params.get("field")),
    languages: list(params.get("lang")).filter((l): l is TeachingLanguage => LANGUAGES.includes(l as TeachingLanguage)),
    intakeMonths: list(params.get("intake"))
      .map(Number)
      .filter((m) => Number.isInteger(m) && m >= 1 && m <= 12),
    maxBudgetLakh: Number.isFinite(budget) && budget > 0 ? budget : null,
    tuitionFree: flag(params.get("free")),
    accepts3yr: flag(params.get("3yr")),
    moi: flag(params.get("moi")),
    provisional: flag(params.get("prov")),
    bdOpen: flag(params.get("bd")),
    sort: SORT_KEYS.includes(sort as SortKey) ? (sort as SortKey) : "relevance",
  };
}

/** Filters → URL query, with keys in a fixed order and defaults left out. */
export function serializeFilters(filters: ProgramFilters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.countries.length) params.set("country", filters.countries.join(","));
  if (filters.cities.length) params.set("city", filters.cities.join(","));
  if (filters.level) params.set("level", filters.level);
  if (filters.fields.length) params.set("field", filters.fields.join(","));
  if (filters.languages.length) params.set("lang", filters.languages.join(","));
  if (filters.intakeMonths.length) params.set("intake", filters.intakeMonths.join(","));
  if (filters.maxBudgetLakh !== null) params.set("budget", String(filters.maxBudgetLakh));
  if (filters.tuitionFree) params.set("free", "1");
  if (filters.accepts3yr) params.set("3yr", "1");
  if (filters.moi) params.set("moi", "1");
  if (filters.provisional) params.set("prov", "1");
  if (filters.bdOpen) params.set("bd", "1");
  if (filters.sort !== "relevance") params.set("sort", filters.sort);
  return params.toString();
}

/** How many filters are set (the search text and sort don't count). */
export function activeFilterCount(f: ProgramFilters): number {
  return (
    f.countries.length +
    f.cities.length +
    (f.level ? 1 : 0) +
    f.fields.length +
    f.languages.length +
    f.intakeMonths.length +
    (f.maxBudgetLakh !== null ? 1 : 0) +
    [f.tuitionFree, f.accepts3yr, f.moi, f.provisional, f.bdOpen].filter(Boolean).length
  );
}

/** Plain text match on title, university, city, country and field; Fuse.js fuzzy search runs on top in the page. */
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

export interface ApplyOptions {
  today: ISODate;
  /** Field slug → names in both languages, for text search. */
  fieldNames?: Record<string, string[]>;
  /** Skip the text match (when the page already ran a fuzzy search). */
  skipText?: boolean;
}

export function applyFilters(programs: ProgramSummary[], f: ProgramFilters, options: ApplyOptions): ProgramSummary[] {
  const results = programs.filter(
    (p) =>
      (options.skipText || !f.q || matchesText(p, f.q, options.fieldNames ?? {})) &&
      (!f.countries.length || f.countries.includes(p.country.slug)) &&
      (!f.cities.length || f.cities.includes(p.city.slug)) &&
      (!f.level || p.degree_level === f.level) &&
      (!f.fields.length || f.fields.includes(p.field)) &&
      (!f.languages.length || f.languages.includes(p.language)) &&
      (!f.intakeMonths.length || p.intakes.some((i) => f.intakeMonths.includes(i.month))) &&
      (f.maxBudgetLakh === null || p.total_bdt <= f.maxBudgetLakh * 1e5) &&
      (!f.tuitionFree || p.tuition_per_year === 0) &&
      (!f.accepts3yr || p.accepts_3yr_bachelor) &&
      (!f.moi || p.accepts_moi) &&
      (!f.provisional || p.accepts_provisional) &&
      (!f.bdOpen || p.open_to_bd_citizens),
  );
  return sortPrograms(results, f.sort, options.today);
}

export function sortPrograms(programs: ProgramSummary[], sort: SortKey, today: ISODate): ProgramSummary[] {
  const sorted = [...programs];
  const deadlineOf = (p: ProgramSummary) => nextDeadline(p.intakes, today)?.deadline ?? "9999-12-31";
  switch (sort) {
    case "cost_low":
      return sorted.sort((a, b) => a.total_bdt - b.total_bdt);
    case "cost_high":
      return sorted.sort((a, b) => b.total_bdt - a.total_bdt);
    case "tuition_low":
      return sorted.sort((a, b) => a.tuition_per_year_bdt - b.tuition_per_year_bdt);
    case "deadline":
      return sorted.sort((a, b) => (deadlineOf(a) < deadlineOf(b) ? -1 : deadlineOf(a) > deadlineOf(b) ? 1 : 0));
    default:
      return sorted;
  }
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
