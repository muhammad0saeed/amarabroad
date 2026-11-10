// The published catalogue (countries, cities, universities, programs list, scholarships, reference data),
// read from Supabase with any secret-key client. Shared by the site (lib/supabase/catalog.ts) and the robot,
// which packs it into one file every 30 minutes (robot/export-catalog.ts) so the site doesn't have to.
// No "server-only" import here, so plain Node (the robot) can use it too; never import it from browser code.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { City, Country, DegreeMapping, ExchangeRate, Field, GlossaryTerm, Program, Scholarship, University } from "@/types";

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

/**
 * Lanes of the program list by slug, read side by side. The split only balances the work (most slugs
 * start with "bachelor-of-" or "master-of-"); every lane is read to its end, so nothing is ever skipped.
 */
const LANES = ["", "bachelor-of-c", "bachelor-of-i", "bachelor-of-n", "bachelor-of-s", "c", "g", "master-of-a", "master-of-e", "master-of-m", "master-of-s", "n"];

/**
 * All published programs. Each lane is read 1,000 at a time, every request continuing after the last slug
 * it got ("slug > last", a short index read). Reading page 8 with OFFSET 7000 instead made the database walk
 * past 7,000 programs first, which went over its 8-second limit while the robots kept it busy and failed
 * deploys (supabase/18_catalog_ranges.sql adds the index this uses).
 */
async function allPublishedPrograms<T extends Record<string, unknown>>(db: SupabaseClient, columns: string): Promise<T[]> {
  const lane = async (i: number): Promise<T[]> => {
    const end = LANES[i + 1];
    const out: T[] = [];
    let after: string | null = null;
    for (;;) {
      const from = after;
      const part = await withRetry(`programs lane ${i + 1}`, async () => {
        let query = db.from("programs").select(columns).eq("published", true).order("slug").limit(PAGE);
        query = from === null ? query.gte("slug", LANES[i]!) : query.gt("slug", from);
        if (end) query = query.lt("slug", end);
        const { data, error } = await query;
        if (error) throw new Error(`Supabase programs: ${error.message}`);
        return (data ?? []) as unknown as T[];
      });
      out.push(...part);
      if (part.length < PAGE) return out;
      after = part.at(-1)!.slug as string;
    }
  };
  const lanes = await Promise.all(LANES.map((_, i) => lane(i)));
  return lanes.flat();
}

/** Reads every row of a table, 1,000 at a time (Supabase's per-request limit), several pages at once. */
async function all<T>(db: SupabaseClient, table: string, columns = "*", filter?: (q: ReturnType<ReturnType<SupabaseClient["from"]>["select"]>) => unknown): Promise<T[]> {
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
export const LIST_COLUMNS = [
  "slug", "title", "university", "degree_level", "field", "language", "language_requirement_en", "language_requirement_bn",
  "duration_months", "ects_credits", "currency", "tuition_per_year", "other_fees_per_year", "application_fee", "intakes",
  "seats_non_eu", "min_gpa_requirement", "accepts_3yr_bachelor", "accepts_moi", "accepts_provisional", "open_to_bd_citizens",
  "english_tests", "related_bachelor_fields", "last_verified", "is_sample", "updated_at", "created_at",
  // The "Apply at the university" link: kept in the list so a program page still works when the database is busy.
  "official_url",
].join(",");
/** What the list leaves out, filled with empty values so every program has the same shape. */
const LIST_DEFAULTS = { seats_total: null, required_documents: [], overview_en: "", career_paths_en: [] };

/** Postgres numeric columns arrive as strings ("6000.00"). */
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
export const NUMERIC = {
  programs: ["tuition_per_year", "other_fees_per_year", "application_fee"],
  cities: ["cost_rent_shared", "cost_rent_studio", "cost_food", "cost_transport", "cost_phone", "cost_insurance"],
  countries: ["min_wage", "living_cost_min", "living_cost_max"],
  exchange_rates: ["bdt_per_unit"],
} as const;
export function numbers<T extends Record<string, unknown>>(row: T, columns: readonly string[]): T {
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

/** Reads the whole published catalogue with the given (secret-key) client. */
export async function readCatalog(db: SupabaseClient): Promise<Catalog> {
  const published = (q: { eq: (c: string, v: unknown) => unknown }) => q.eq("published", true);
  const [countries, cities, universities, programs, scholarships, exchangeRates, glossary, fields, degreeMappings] = await Promise.all([
    all<Record<string, unknown>>(db, "countries"),
    all<Record<string, unknown>>(db, "cities"),
    all<Record<string, unknown>>(db, "universities"),
    allPublishedPrograms<Record<string, unknown>>(db, LIST_COLUMNS),
    all<Record<string, unknown>>(db, "scholarships", "*", published as never),
    all<Record<string, unknown>>(db, "exchange_rates", "*", published as never),
    all<Record<string, unknown>>(db, "glossary_terms", "*", published as never),
    all<Record<string, unknown>>(db, "fields", "*", published as never),
    all<Record<string, unknown>>(db, "degree_mappings", "*", published as never),
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
