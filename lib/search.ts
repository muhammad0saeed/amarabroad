// Program search on the server: filter, rank, count options and cut one page.
// The browser only ever receives one page of results plus the option counts, so this keeps working
// when the catalogue grows to thousands of programs. Today it runs over the JSON files; once the data
// moves to Supabase (Stage 2.3) the same function becomes a SQL query with the same return shape.

import "server-only";
import Fuse from "fuse.js";
import { DATA_SOURCE, dataVersion, listCities, listCountries, listFields, listProgramContexts, listScholarships, listUniversities } from "./data";
import { applyFilters, facetCounts, PAGE_SIZE, type FacetCounts, type ProgramFilters } from "./filters";
import { getRates } from "./server";
import { summarizeProgram, type ProgramSummary } from "./summary";
import type { FieldGroup, Scholarship } from "@/types";

/** Display names for every filter option, in both languages. */
export interface SearchOptions {
  countries: { slug: string; name_en: string; name_bn: string }[];
  cities: { slug: string; name_en: string; name_bn: string; country: string }[];
  universities: { slug: string; name: string; city: string; country: string }[];
  fields: { slug: string; name_en: string; name_bn: string; group: FieldGroup }[];
  fieldGroups: FieldGroup[];
  intakeMonths: number[];
}

/** Where a program's official page matched the search words («marked»). */
export interface PageSnippet {
  text: string;
  url: string;
}

export interface SearchResult {
  /** Program slug → the matching passage on its official page (live data only). */
  snippets: Record<string, PageSnippet>;
  items: ProgramSummary[];
  total: number;
  page: number;
  pageCount: number;
  facets: FacetCounts;
}

function coversProgram(s: Scholarship, p: ProgramSummary) {
  if (!s.levels.includes(p.degree_level)) return false;
  if (s.programs.length) return s.programs.includes(p.slug);
  if (s.universities.length) return s.universities.includes(p.university.slug);
  if (s.countries.length) return s.countries.includes(p.country.slug);
  return true;
}

interface Catalogue {
  programs: ProgramSummary[];
  fuse: Fuse<ProgramSummary>;
  fieldNames: Record<string, string[]>;
  options: SearchOptions;
}
let catalogue: Promise<Catalogue> | null = null;
let builtFor = -1;

/** Every program as a summary, with subject area and scholarship flags filled in. Built once per server process. */
async function loadCatalogue(): Promise<Catalogue> {
  // Rebuilt whenever the underlying data is reloaded (every 10 minutes with live data).
  const version = await dataVersion();
  if (version !== builtFor) {
    builtFor = version;
    catalogue = null;
  }
  catalogue ??= (async (): Promise<Catalogue> => {
    const [rates, contexts, fields, scholarships, countries, cities, universities] = await Promise.all([
      getRates(),
      listProgramContexts(),
      listFields(),
      listScholarships(),
      listCountries(),
      listCities(),
      listUniversities(),
    ]);
    const groupOf = Object.fromEntries(fields.map((f) => [f.slug, f.group]));
    const fieldNames = Object.fromEntries(fields.map((f) => [f.slug, [f.name_en, f.name_bn]]));
    const programs: ProgramSummary[] = contexts.map((ctx) => {
      const s = summarizeProgram(ctx, rates);
      return { ...s, field_group: groupOf[s.field], has_scholarship: scholarships.some((sch) => sch.bd_eligible && coversProgram(sch, s)) };
    });
    const fuse = new Fuse<ProgramSummary>(programs, {
      keys: [
        { name: "title", weight: 3 },
        { name: "university.name", weight: 2 },
        "city.name_en",
        "city.name_bn",
        "country.name_en",
        "country.name_bn",
        { name: "fieldName", getFn: (p) => fieldNames[p.field] ?? [], weight: 2 },
      ],
      threshold: 0.35,
      ignoreLocation: true,
    });
    const cityCountry = Object.fromEntries(cities.map((c) => [c.slug, c.country]));
    const usedFields = new Set(programs.map((p) => p.field));
    const options: SearchOptions = {
      countries: countries.map(({ slug, name_en, name_bn }) => ({ slug, name_en, name_bn })),
      cities: cities.map(({ slug, name_en, name_bn, country }) => ({ slug, name_en, name_bn, country })),
      universities: universities.map((u) => ({ slug: u.slug, name: u.name, city: u.city, country: cityCountry[u.city] ?? "" })),
      fields: fields.filter((f) => usedFields.has(f.slug)).map(({ slug, name_en, name_bn, group }) => ({ slug, name_en, name_bn, group })),
      fieldGroups: [...new Set(fields.filter((f) => usedFields.has(f.slug)).map((f) => f.group))],
      intakeMonths: [...new Set(programs.flatMap((p) => p.intakes.map((i) => i.month)))].sort((a, b) => a - b),
    };
    return { programs, fuse, fieldNames, options };
  })();
  return catalogue;
}

export async function getSearchOptions(): Promise<SearchOptions> {
  return (await loadCatalogue()).options;
}

/** All enriched summaries (for pages that list a subset, like a university's programs). */
export async function getCatalogue(): Promise<ProgramSummary[]> {
  return (await loadCatalogue()).programs;
}

export async function searchPrograms(filters: ProgramFilters, today: string, pageSize = PAGE_SIZE): Promise<SearchResult> {
  const { programs, fuse, fieldNames } = await loadCatalogue();
  // Fuzzy text match first (typos, Bangla names), ranked by score. With live data, programs whose
  // official page contains the words come next, with a snippet showing where. Filters then narrow it down.
  let pool = filters.q ? fuse.search(filters.q).map((r) => r.item) : programs;
  const snippets: Record<string, PageSnippet> = {};
  if (filters.q && DATA_SOURCE === "supabase") {
    const { searchPages } = await import("./supabase/evidence");
    const bySlug = new Map(programs.map((p) => [p.slug, p]));
    const inPool = new Set(pool.map((p) => p.slug));
    for (const hit of await searchPages(filters.q)) {
      const program = bySlug.get(hit.program);
      if (!program) continue;
      snippets[hit.program] ??= { text: hit.snippet, url: hit.url };
      if (!inPool.has(hit.program)) {
        pool = [...pool, program];
        inPool.add(hit.program);
      }
    }
  }
  const options = { today, fieldNames, skipText: Boolean(filters.q) };
  const matched = applyFilters(pool, filters, options);
  const pageCount = Math.max(1, Math.ceil(matched.length / pageSize));
  const page = Math.min(filters.page, pageCount);
  return {
    items: matched.slice((page - 1) * pageSize, page * pageSize),
    total: matched.length,
    page,
    pageCount,
    facets: facetCounts(pool, filters, options),
    snippets,
  };
}
