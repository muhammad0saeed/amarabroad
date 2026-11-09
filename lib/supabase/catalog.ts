import "server-only";

// Loads the whole published catalogue from Supabase for lib/data.ts, on the server only.
// Uses the secret key so places the robot created but whose guide isn't written yet (unpublished
// countries and cities) can still give programs their names; only published programs are read.

import type { City, Country, DegreeMapping, ExchangeRate, Field, GlossaryTerm, Program, Scholarship, University } from "@/types";
import { serviceClient } from "./clients";

const PAGE = 1000;
/** Pages of one table read at the same time (one after another took 13 s for 18,000 programs). */
const PARALLEL = 8;

// A busy database (the robots writing) sometimes drops or times out a request; try it up to 6 times
// over about 45 seconds before giving up, so a busy moment doesn't fail a deploy or a refresh.
const WAITS = [1, 3, 6, 12, 20];
async function withRetry<T>(label: string, run: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await run();
    } catch (e) {
      if (attempt >= WAITS.length) throw e;
      console.warn(`${e instanceof Error ? e.message : String(e)} (${label}); trying again in ${WAITS[attempt]} s`);
      await new Promise((r) => setTimeout(r, WAITS[attempt]! * 1000));
    }
  }
}

/** Slices of published programs: 900 per slice leaves room for programs published since the bounds were read. */
const SLICE = 900;

/**
 * All published programs, read slice by slice between slugs (supabase/18_catalog_ranges.sql). Unlike
 * reading page 8 with OFFSET 7000, every slice is a short index read, so none hits the database's
 * 8-second limit while the robots keep it busy. Falls back to pages when the function isn't there.
 */
async function allPublishedPrograms<T>(columns: string): Promise<T[]> {
  const db = serviceClient();
  const bounds = await withRetry("program slices", async () => {
    const { data, error } = await db.rpc("catalog_slug_bounds", { p_size: SLICE });
    if (error) throw new Error(`Supabase program slices: ${error.message}`);
    return (data ?? []) as string[];
  }).catch(() => null);
  if (!bounds) return all<T>("programs", columns, ((q: { eq: (c: string, v: unknown) => unknown }) => q.eq("published", true)) as never);
  const slice = (i: number) =>
    withRetry(`programs slice ${i + 1}`, async () => {
      let query = db.from("programs").select(columns).eq("published", true).gte("slug", bounds[i]!).order("slug").limit(PAGE);
      if (i + 1 < bounds.length) query = query.lt("slug", bounds[i + 1]!);
      const { data, error } = await query;
      if (error) throw new Error(`Supabase programs: ${error.message}`);
      return (data ?? []) as T[];
    });
  const rows: T[] = [];
  for (let first = 0; first < bounds.length; first += PARALLEL) {
    const parts = await Promise.all(bounds.slice(first, first + PARALLEL).map((_, k) => slice(first + k)));
    for (const p of parts) rows.push(...p);
  }
  return rows;
}

/** Reads every row of a table, 1,000 at a time (Supabase's per-request limit), several pages at once. */
async function all<T>(table: string, columns = "*", filter?: (q: ReturnType<ReturnType<typeof serviceClient>["from"]>["select"]) => unknown): Promise<T[]> {
  const db = serviceClient();
  const key = table === "exchange_rates" ? "currency" : "slug";
  const once = async (n: number): Promise<T[]> => {
    let query = db.from(table).select(columns).order(key).range(n * PAGE, n * PAGE + PAGE - 1);
    if (filter) query = filter(query as never) as typeof query;
    const { data, error } = await query;
    if (error) throw new Error(`Supabase ${table}: ${error.message}`);
    return (data ?? []) as T[];
  };
  const page = (n: number) => withRetry(`page ${n + 1}`, () => once(n));
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
  countries: ["min_wage", "living_cost_min", "living_cost_max"],
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
    allPublishedPrograms<Record<string, unknown>>(LIST_COLUMNS),
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
