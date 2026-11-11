// The only module pages read data from. Two sources behind the same functions:
//   NEXT_PUBLIC_DATA_SOURCE=supabase  real data from Supabase (filled by the data robot), server-side, cached 10 min
//   anything else (default)           the Stage 1 sample data in /data (tests, offline work)
// Call these from Server Components; pass results to Client Components as props.

import citiesJson from "@/data/cities.json";
import countriesJson from "@/data/countries.json";
import degreeMappingJson from "@/data/degree-mapping.json";
import exchangeRatesJson from "@/data/exchange-rates.json";
import fieldsJson from "@/data/fields.json";
import glossaryJson from "@/data/glossary.json";
import programsJson from "@/data/programs.json";
import scholarshipsJson from "@/data/scholarships.json";
import universitiesJson from "@/data/universities.json";
import type {
  City,
  Country,
  CurrencyCode,
  DegreeMapping,
  ExchangeRate,
  Field,
  GlossaryTerm,
  Program,
  ProgramContext,
  Scholarship,
  University,
} from "@/types";

import { scholarshipCovers } from "./scholarshipPrograms";
import { DATA_SOURCE } from "./source";
export { DATA_SOURCE };

interface Snapshot {
  countries: Country[];
  cities: City[];
  universities: University[];
  programs: Program[];
  scholarships: Scholarship[];
  exchangeRates: ExchangeRate[];
  glossary: GlossaryTerm[];
  fields: Field[];
  degreeMappings: DegreeMapping[];
  index: {
    country: Map<string, Country>;
    city: Map<string, City>;
    university: Map<string, University>;
    program: Map<string, Program>;
    scholarship: Map<string, Scholarship>;
    field: Map<string, Field>;
    degree: Map<string, DegreeMapping>;
  };
}

const bySlug = <T extends { slug: string }>(rows: T[]) => new Map(rows.map((row) => [row.slug, row]));

function build(raw: Omit<Snapshot, "index">): Snapshot {
  return {
    ...raw,
    index: {
      country: bySlug(raw.countries),
      city: bySlug(raw.cities),
      university: bySlug(raw.universities),
      program: bySlug(raw.programs),
      scholarship: bySlug(raw.scholarships),
      field: bySlug(raw.fields),
      degree: bySlug(raw.degreeMappings),
    },
  };
}

const jsonSnapshot = () =>
  build({
    countries: countriesJson as Country[],
    cities: citiesJson as City[],
    universities: universitiesJson as University[],
    programs: programsJson as unknown as Program[],
    scholarships: scholarshipsJson as Scholarship[],
    exchangeRates: exchangeRatesJson as ExchangeRate[],
    glossary: glossaryJson as GlossaryTerm[],
    fields: fieldsJson as Field[],
    degreeMappings: degreeMappingJson as DegreeMapping[],
  });

// One copy per server process, refreshed every 10 minutes (the robot updates daily; admin edits will
// refresh it on demand). Concurrent requests share the same load.
const TTL_MS = 10 * 60 * 1000;
let cached: { at: number; value: Promise<Snapshot> } | null = null;

async function snapshot(): Promise<Snapshot> {
  if (DATA_SOURCE === "json") {
    cached ??= { at: Date.now(), value: Promise.resolve(jsonSnapshot()) };
    return cached.value;
  }
  if (!cached) {
    cached = {
      at: Date.now(),
      value: loadFresh(null).catch((e) => {
        cached = null; // Nothing to fall back on: the next request tries again.
        throw e;
      }),
    };
  } else if (Date.now() - cached.at > TTL_MS && !refreshing) {
    // Older than 10 minutes: keep answering from the current copy while a fresh one loads in the
    // background, so no visitor waits for the reload.
    const previous = cached;
    refreshing = loadFresh(previous)
      .then((value) => {
        cached = { at: Date.now(), value: Promise.resolve(value) };
      })
      .catch(() => {
        // Keep the old copy; try again on a later request.
        previous.at = Date.now() - TTL_MS + 60_000;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return cached.value;
}

let refreshing: Promise<void> | null = null;

async function loadFresh(previous: { value: Promise<Snapshot> } | null): Promise<Snapshot> {
  const { loadCatalogFromSupabase } = await import("./supabase/catalog");
  // The first load has nothing to fall back on; a failed refresh keeps the previous copy.
  return loadCatalogFromSupabase()
    .then(build)
    .catch((e) => (previous ? previous.value : Promise.reject(e)));
}

/** Changes whenever the data is reloaded, so caches built on top of it (search) know to rebuild. */
export async function dataVersion(): Promise<number> {
  await snapshot();
  return cached!.at;
}

/** Drop the cached copy (after an admin edit), so the next request reads fresh data. */
export function invalidateData() {
  cached = null;
}

// ---------------------------------------------------------------- countries and cities

export async function listCountries(): Promise<Country[]> {
  return (await snapshot()).countries;
}

export async function getCountry(slug: string): Promise<Country | undefined> {
  return (await snapshot()).index.country.get(slug);
}

export async function listCities(filter: { country?: string } = {}): Promise<City[]> {
  const { cities } = await snapshot();
  return filter.country ? cities.filter((c) => c.country === filter.country) : cities;
}

export async function getCity(slug: string): Promise<City | undefined> {
  return (await snapshot()).index.city.get(slug);
}

/** Countries and cities with a written guide (sample data: all of them). */
export const hasGuide = (place: { has_guide?: boolean }) => place.has_guide !== false;

// ---------------------------------------------------------------- universities and programs

export async function listUniversities(filter: { city?: string; country?: string } = {}): Promise<University[]> {
  const s = await snapshot();
  return s.universities.filter(
    (u) => (!filter.city || u.city === filter.city) && (!filter.country || s.index.city.get(u.city)?.country === filter.country),
  );
}

export async function getUniversity(slug: string): Promise<University | undefined> {
  return (await snapshot()).index.university.get(slug);
}

export async function listPrograms(filter: { university?: string } = {}): Promise<Program[]> {
  const { programs } = await snapshot();
  return filter.university ? programs.filter((p) => p.university === filter.university) : programs;
}

export async function getProgram(slug: string): Promise<Program | undefined> {
  return (await snapshot()).index.program.get(slug);
}

function contextOf(s: Snapshot, program: Program): ProgramContext | null {
  const university = s.index.university.get(program.university);
  const city = university && s.index.city.get(university.city);
  const country = city && s.index.country.get(city.country);
  return university && city && country ? { program, university, city, country } : null;
}

/** A program with its university, city and country. With live data the program's full row (overview, documents, links) is read fresh. */
export async function getProgramContext(slug: string): Promise<ProgramContext | undefined> {
  const s = await snapshot();
  let program = s.index.program.get(slug);
  if (DATA_SOURCE === "supabase") {
    const { loadProgramFromSupabase } = await import("./supabase/catalog");
    try {
      program = (await loadProgramFromSupabase(slug)) ?? program;
    } catch (e) {
      // Database busy or down: show the program from the catalogue file (every fact the lists use) rather than an error.
      console.warn(`Program ${slug}: live row unavailable (${e instanceof Error ? e.message : String(e)}); using the catalogue copy`);
    }
  }
  return (program && contextOf(s, program)) || undefined;
}

/** Every program joined with its chain, for search, compare and match (a program with a broken chain is skipped). */
export async function listProgramContexts(): Promise<ProgramContext[]> {
  const s = await snapshot();
  return s.programs.map((p) => contextOf(s, p)).filter((c): c is ProgramContext => c !== null);
}

// ---------------------------------------------------------------- scholarships

export async function listScholarships(): Promise<Scholarship[]> {
  return (await snapshot()).scholarships;
}

export async function getScholarship(slug: string): Promise<Scholarship | undefined> {
  return (await snapshot()).index.scholarship.get(slug);
}

/** Scholarships that apply to one program: linked to it, its university or its country, at its degree level. */
export async function listScholarshipsForProgram(slug: string): Promise<Scholarship[]> {
  const s = await snapshot();
  const program = s.index.program.get(slug);
  const ctx = program && contextOf(s, program);
  if (!program || !ctx) return [];
  return s.scholarships.filter((x) => scholarshipCovers(x, ctx));
}

/** Scholarships linked to a university, or to its country, or to one of its programs. */
export async function listScholarshipsForUniversity(slug: string): Promise<Scholarship[]> {
  const s = await snapshot();
  const university = s.index.university.get(slug);
  if (!university) return [];
  const country = s.index.city.get(university.city)?.country;
  const programSlugs = new Set(s.programs.filter((p) => p.university === slug).map((p) => p.slug));
  return s.scholarships.filter(
    (x) => x.universities.includes(slug) || (country !== undefined && x.countries.includes(country)) || x.programs.some((p) => programSlugs.has(p)),
  );
}

/** Scholarships linked to a country or to anything inside it. */
export async function listScholarshipsForCountry(slug: string): Promise<Scholarship[]> {
  const s = await snapshot();
  const universitySlugs = new Set((await listUniversities({ country: slug })).map((u) => u.slug));
  const programSlugs = new Set(s.programs.filter((p) => universitySlugs.has(p.university)).map((p) => p.slug));
  return s.scholarships.filter(
    (x) => x.countries.includes(slug) || x.universities.some((u) => universitySlugs.has(u)) || x.programs.some((p) => programSlugs.has(p)),
  );
}

// ---------------------------------------------------------------- reference data

export async function listExchangeRates(): Promise<ExchangeRate[]> {
  return (await snapshot()).exchangeRates;
}

export async function getExchangeRate(currency: CurrencyCode): Promise<ExchangeRate> {
  const rate = (await snapshot()).exchangeRates.find((r) => r.currency === currency);
  if (!rate) throw new Error(`No exchange rate for ${currency}`);
  return rate;
}

export async function listGlossary(): Promise<GlossaryTerm[]> {
  return (await snapshot()).glossary;
}

export async function listFields(): Promise<Field[]> {
  return (await snapshot()).fields;
}

export async function getField(slug: string): Promise<Field | undefined> {
  return (await snapshot()).index.field.get(slug);
}

export async function listDegreeMappings(): Promise<DegreeMapping[]> {
  return (await snapshot()).degreeMappings;
}

export async function getDegreeMapping(slug: string): Promise<DegreeMapping | undefined> {
  return (await snapshot()).index.degree.get(slug);
}

/** Honest coverage count shown on Home. */
export async function getCoverage() {
  const s = await snapshot();
  return {
    countries: new Set(s.programs.map((p) => s.index.city.get(s.index.university.get(p.university)?.city ?? "")?.country)).size,
    universities: new Set(s.programs.map((p) => p.university)).size,
    programs: s.programs.length,
    scholarships: s.scholarships.length,
    allSample: [s.universities, s.programs].every((rows) => rows.length > 0 && rows.every((row) => row.is_sample)),
    ...freshness(s.programs as unknown as { updated_at?: string; created_at?: string }[]),
  };
}

/** When the robot last checked or changed a program, and how many programs it added this week (live data only). */
export function freshness(rows: { updated_at?: string; created_at?: string }[], now = Date.now()) {
  const lastUpdated = rows.reduce<string | null>((max, r) => (r.updated_at && (!max || r.updated_at > max) ? r.updated_at : max), null);
  const newThisWeek = rows.filter((r) => r.created_at && now - Date.parse(r.created_at) < 7 * 86_400_000).length;
  return { lastUpdated, newThisWeek };
}
