import "server-only";

// Loads the whole published catalogue from Supabase for lib/data.ts, on the server only.
// Uses the secret key so places the robot created but whose guide isn't written yet (unpublished
// countries and cities) can still give programs their names; only published programs are read.

import type { City, Country, DegreeMapping, ExchangeRate, Field, GlossaryTerm, Program, Scholarship, University } from "@/types";
import { serviceClient } from "./clients";

const PAGE = 1000;
/** Pages of one table read at the same time (one after another took 13 s for 18,000 programs). */
const PARALLEL = 8;

/** Reads every row of a table, 1,000 at a time (Supabase's per-request limit), several pages at once. */
async function all<T>(table: string, columns = "*", filter?: (q: ReturnType<ReturnType<typeof serviceClient>["from"]>["select"]) => unknown): Promise<T[]> {
  const db = serviceClient();
  const key = table === "exchange_rates" ? "currency" : "slug";
  const page = async (n: number): Promise<T[]> => {
    let query = db.from(table).select(columns).order(key).range(n * PAGE, n * PAGE + PAGE - 1);
    if (filter) query = filter(query as never) as typeof query;
    const { data, error } = await query;
    if (error) throw new Error(`Supabase ${table}: ${error.message}`);
    return (data ?? []) as T[];
  };
  const rows: T[] = [];
  for (let first = 0; ; first += PARALLEL) {
    const pages = await Promise.all(Array.from({ length: PARALLEL }, (_, i) => page(first + i)));
    for (const p of pages) rows.push(...p);
    // A page shorter than 1,000 rows was the last one.
    if (pages.some((p) => p.length < PAGE)) return rows;
  }
}

/**
 * Program columns lists, search, compare and the quiz need. The long texts (overview, careers,
 * documents, links) are read only on the program's own page (loadProgramFromSupabase), which keeps
 * the whole list about half the size.
 */
const LIST_COLUMNS = [
  "slug", "title", "university", "degree_level", "field", "language", "language_requirement_en", "language_requirement_bn",
  "duration_months", "ects_credits", "currency", "tuition_per_year", "other_fees_per_year", "application_fee", "intakes",
  "seats_non_eu", "min_gpa_requirement", "accepts_3yr_bachelor", "accepts_moi", "accepts_provisional", "open_to_bd_citizens",
  "english_tests", "related_bachelor_fields", "last_verified", "is_sample", "updated_at", "created_at",
].join(",");
/** What the list leaves out, filled with empty values so every program has the same shape. */
const LIST_DEFAULTS = { seats_total: null, required_documents: [], overview_en: "", career_paths_en: [], official_url: "" };

/** Postgres numeric columns arrive as strings ("6000.00"). */
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const NUMERIC = {
  programs: ["tuition_per_year", "other_fees_per_year", "application_fee"],
  cities: ["cost_rent_shared", "cost_rent_studio", "cost_food", "cost_transport", "cost_phone", "cost_insurance"],
  countries: ["min_wage"],
  exchange_rates: ["bdt_per_unit"],
} as const;
function numbers<T extends Record<string, unknown>>(row: T, columns: readonly string[]): T {
  const out: Record<string, unknown> = { ...row };
  for (const c of columns) out[c] = num(out[c]);
  return out as T;
}

export interface Catalog {
  countries: Country[];
  cities: City[];
  universities: University[];
  programs: Program[];
  scholarships: Scholarship[];
  exchangeRates: ExchangeRate[];
  glossary: GlossaryTerm[];
  fields: Field[];
  degreeMappings: DegreeMapping[];
}

export async function loadCatalogFromSupabase(): Promise<Catalog> {
  const published = (q: { eq: (c: string, v: unknown) => unknown }) => q.eq("published", true);
  const [countries, cities, universities, programs, scholarships, exchangeRates, glossary, fields, degreeMappings] = await Promise.all([
    all<Record<string, unknown>>("countries"),
    all<Record<string, unknown>>("cities"),
    all<Record<string, unknown>>("universities"),
    all<Record<string, unknown>>("programs", LIST_COLUMNS, published as never),
    all<Record<string, unknown>>("scholarships", "*", published as never),
    all<Record<string, unknown>>("exchange_rates", "*", published as never),
    all<Record<string, unknown>>("glossary_terms", "*", published as never),
    all<Record<string, unknown>>("fields", "*", published as never),
    all<Record<string, unknown>>("degree_mappings", "*", published as never),
  ]);

  // Only universities with a published program (or published themselves) appear.
  const withPrograms = new Set(programs.map((p) => p.university as string));
  return {
    // `has_guide`: the place's guide (costs, visa, jobs) is written and published.
    countries: countries.map((c) => ({ ...numbers(c, NUMERIC.countries), has_guide: Boolean(c.published) }) as unknown as Country),
    cities: cities.map((c) => ({ ...numbers(c, NUMERIC.cities), has_guide: Boolean(c.published) }) as unknown as City),
    universities: universities.filter((u) => u.published || withPrograms.has(u.slug as string)) as unknown as University[],
    programs: programs.map((p) => ({ ...LIST_DEFAULTS, ...numbers(p, NUMERIC.programs) })) as unknown as Program[],
    scholarships: scholarships as unknown as Scholarship[],
    exchangeRates: exchangeRates.map((r) => numbers(r, NUMERIC.exchange_rates)) as unknown as ExchangeRate[],
    glossary: glossary as unknown as GlossaryTerm[],
    fields: fields.map(({ field_group, ...f }) => ({ ...f, group: field_group })) as unknown as Field[],
    degreeMappings: degreeMappings as unknown as DegreeMapping[],
  };
}

/** One published program with every column, for its own page. */
export async function loadProgramFromSupabase(slug: string): Promise<Program | undefined> {
  const { data, error } = await serviceClient().from("programs").select("*").eq("slug", slug).eq("published", true).maybeSingle();
  if (error) throw new Error(`Supabase programs: ${error.message}`);
  return data ? (numbers(data as Record<string, unknown>, NUMERIC.programs) as unknown as Program) : undefined;
}
