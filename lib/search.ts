// Program search on the server: filter, rank, count options and cut one page.
// The browser only ever receives one page of results plus the option counts, so this keeps working
// when the catalogue grows to tens of thousands of programs. Text search uses a word index built once
// per data reload (lib/textIndex.ts), so a search answers in milliseconds.

import "server-only";
import { dataVersion, listCities, listCountries, listFields, listProgramContexts, listScholarships, listUniversities } from "./data";
import { applyFilters, facetCounts, PAGE_SIZE, type FacetCounts, type ProgramFilters } from "./filters";
import { getRates } from "./server";
import { summarizeProgram, type ProgramSummary } from "./summary";
import { TextIndex } from "./textIndex";
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

export interface SearchResult {
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
  index: TextIndex;
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
    const index = new TextIndex(
      programs.map((p) => ({
        parts: [
          { text: p.title, weight: 3 },
          { text: p.university.name, weight: 2 },
          { text: (fieldNames[p.field] ?? []).join(" "), weight: 2 },
          { text: `${p.city.name_en} ${p.city.name_bn} ${p.country.name_en} ${p.country.name_bn}`, weight: 1 },
        ],
      })),
    );
    const cityCountry = Object.fromEntries(cities.map((c) => [c.slug, c.country]));
    const usedFields = new Set(programs.map((p) => p.field));
    // Only places and universities that have programs become filter options (thousands otherwise).
    const usedCountries = new Set(programs.map((p) => p.country.slug));
    const usedCities = new Set(programs.map((p) => p.city.slug));
    const usedUniversities = new Set(programs.map((p) => p.university.slug));
    const options: SearchOptions = {
      countries: countries.filter((c) => usedCountries.has(c.slug)).map(({ slug, name_en, name_bn }) => ({ slug, name_en, name_bn })),
      cities: cities.filter((c) => usedCities.has(c.slug)).map(({ slug, name_en, name_bn, country }) => ({ slug, name_en, name_bn, country })),
      universities: universities.filter((u) => usedUniversities.has(u.slug)).map((u) => ({ slug: u.slug, name: u.name, city: u.city, country: cityCountry[u.city] ?? "" })),
      fields: fields.filter((f) => usedFields.has(f.slug)).map(({ slug, name_en, name_bn, group }) => ({ slug, name_en, name_bn, group })),
      fieldGroups: [...new Set(fields.filter((f) => usedFields.has(f.slug)).map((f) => f.group))],
      intakeMonths: [...new Set(programs.flatMap((p) => p.intakes.map((i) => i.month)))].sort((a, b) => a - b),
    };
    return { programs, index, fieldNames, options };
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
  const { programs, index, fieldNames } = await loadCatalogue();
  // Word match first (typos, Bangla names), ranked by where the words were found. Filters then narrow it down.
  const pool = filters.q ? index.search(filters.q).map((i) => programs[i]!) : programs;
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
  };
}
