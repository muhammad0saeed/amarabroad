import "server-only";

// Loads the whole published catalogue from Supabase for lib/data.ts, on the server only.
// Uses the secret key so places the robot created but whose guide isn't written yet (unpublished
// countries and cities) can still give programs their names; only published programs are read.

import type { City, Country, DegreeMapping, ExchangeRate, Field, GlossaryTerm, Program, Scholarship, University } from "@/types";
import { serviceClient } from "./clients";

const PAGE = 1000;

/** Reads every row of a table, 1,000 at a time (Supabase's per-request limit). */
async function all<T>(table: string, columns = "*", filter?: (q: ReturnType<ReturnType<typeof serviceClient>["from"]>["select"]) => unknown): Promise<T[]> {
  const db = serviceClient();
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    let query = db.from(table).select(columns).order(table === "exchange_rates" ? "currency" : "slug").range(from, from + PAGE - 1);
    if (filter) query = filter(query as never) as typeof query;
    const { data, error } = await query;
    if (error) throw new Error(`Supabase ${table}: ${error.message}`);
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) return rows;
  }
}

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
    all<Record<string, unknown>>("programs", "*", published as never),
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
    programs: programs.map((p) => numbers(p, NUMERIC.programs)) as unknown as Program[],
    scholarships: scholarships as unknown as Scholarship[],
    exchangeRates: exchangeRates.map((r) => numbers(r, NUMERIC.exchange_rates)) as unknown as ExchangeRate[],
    glossary: glossary as unknown as GlossaryTerm[],
    fields: fields.map(({ field_group, ...f }) => ({ ...f, group: field_group })) as unknown as Field[],
    degreeMappings: degreeMappings as unknown as DegreeMapping[],
  };
}
