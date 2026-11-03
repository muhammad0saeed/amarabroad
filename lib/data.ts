// The only module that reads /data. Every page and tool goes through these functions,
// so Stage 2 can swap the JSON files for Supabase without touching the UI.
// Functions are async for that reason, even though Stage 1 just imports JSON at build time.
// Call them from Server Components; pass the results to Client Components as props.

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

const countries = countriesJson as Country[];
const cities = citiesJson as City[];
const universities = universitiesJson as University[];
const programs = programsJson as Program[];
const scholarships = scholarshipsJson as Scholarship[];
const exchangeRates = exchangeRatesJson as ExchangeRate[];
const glossary = glossaryJson as GlossaryTerm[];
const fields = fieldsJson as Field[];
const degreeMappings = degreeMappingJson as DegreeMapping[];

const bySlug = <T extends { slug: string }>(rows: T[]) => new Map(rows.map((row) => [row.slug, row]));
const countryIndex = bySlug(countries);
const cityIndex = bySlug(cities);
const universityIndex = bySlug(universities);
const programIndex = bySlug(programs);
const scholarshipIndex = bySlug(scholarships);
const fieldIndex = bySlug(fields);
const degreeIndex = bySlug(degreeMappings);

// ---------------------------------------------------------------- countries and cities

export async function listCountries(): Promise<Country[]> {
  return countries;
}

export async function getCountry(slug: string): Promise<Country | undefined> {
  return countryIndex.get(slug);
}

export async function listCities(filter: { country?: string } = {}): Promise<City[]> {
  return filter.country ? cities.filter((c) => c.country === filter.country) : cities;
}

export async function getCity(slug: string): Promise<City | undefined> {
  return cityIndex.get(slug);
}

// ---------------------------------------------------------------- universities and programs

export async function listUniversities(filter: { city?: string; country?: string } = {}): Promise<University[]> {
  return universities.filter(
    (u) =>
      (!filter.city || u.city === filter.city) &&
      (!filter.country || cityIndex.get(u.city)?.country === filter.country),
  );
}

export async function getUniversity(slug: string): Promise<University | undefined> {
  return universityIndex.get(slug);
}

export async function listPrograms(filter: { university?: string } = {}): Promise<Program[]> {
  return filter.university ? programs.filter((p) => p.university === filter.university) : programs;
}

export async function getProgram(slug: string): Promise<Program | undefined> {
  return programIndex.get(slug);
}

function contextOf(program: Program): ProgramContext {
  const university = universityIndex.get(program.university);
  const city = university && cityIndex.get(university.city);
  const country = city && countryIndex.get(city.country);
  if (!university || !city || !country) throw new Error(`Broken data chain for program ${program.slug}`);
  return { program, university, city, country };
}

/** A program with its university, city and country. */
export async function getProgramContext(slug: string): Promise<ProgramContext | undefined> {
  const program = programIndex.get(slug);
  return program && contextOf(program);
}

/** Every program joined with its chain, for search, compare and match. */
export async function listProgramContexts(): Promise<ProgramContext[]> {
  return programs.map(contextOf);
}

// ---------------------------------------------------------------- scholarships

export async function listScholarships(): Promise<Scholarship[]> {
  return scholarships;
}

export async function getScholarship(slug: string): Promise<Scholarship | undefined> {
  return scholarshipIndex.get(slug);
}

/** Scholarships that apply to one program: linked to it, its university or its country, at its degree level. */
export async function listScholarshipsForProgram(slug: string): Promise<Scholarship[]> {
  const program = programIndex.get(slug);
  if (!program) return [];
  const { university, country } = contextOf(program);
  return scholarships.filter(
    (s) =>
      s.levels.includes(program.degree_level) &&
      (s.programs.includes(program.slug) || s.universities.includes(university.slug) || s.countries.includes(country.slug)),
  );
}

/** Scholarships linked to a university, or to its country, or to one of its programs. */
export async function listScholarshipsForUniversity(slug: string): Promise<Scholarship[]> {
  const university = universityIndex.get(slug);
  if (!university) return [];
  const country = cityIndex.get(university.city)?.country;
  const programSlugs = new Set(programs.filter((p) => p.university === slug).map((p) => p.slug));
  return scholarships.filter(
    (s) =>
      s.universities.includes(slug) ||
      (country !== undefined && s.countries.includes(country)) ||
      s.programs.some((p) => programSlugs.has(p)),
  );
}

/** Scholarships linked to a country or to anything inside it. */
export async function listScholarshipsForCountry(slug: string): Promise<Scholarship[]> {
  const universitySlugs = new Set((await listUniversities({ country: slug })).map((u) => u.slug));
  const programSlugs = new Set(programs.filter((p) => universitySlugs.has(p.university)).map((p) => p.slug));
  return scholarships.filter(
    (s) =>
      s.countries.includes(slug) ||
      s.universities.some((u) => universitySlugs.has(u)) ||
      s.programs.some((p) => programSlugs.has(p)),
  );
}

// ---------------------------------------------------------------- reference data

export async function listExchangeRates(): Promise<ExchangeRate[]> {
  return exchangeRates;
}

export async function getExchangeRate(currency: CurrencyCode): Promise<ExchangeRate> {
  const rate = exchangeRates.find((r) => r.currency === currency);
  if (!rate) throw new Error(`No exchange rate for ${currency}`);
  return rate;
}

export async function listGlossary(): Promise<GlossaryTerm[]> {
  return glossary;
}

export async function listFields(): Promise<Field[]> {
  return fields;
}

export async function getField(slug: string): Promise<Field | undefined> {
  return fieldIndex.get(slug);
}

export async function listDegreeMappings(): Promise<DegreeMapping[]> {
  return degreeMappings;
}

export async function getDegreeMapping(slug: string): Promise<DegreeMapping | undefined> {
  return degreeIndex.get(slug);
}

/** Honest coverage count shown on Home. */
export async function getCoverage() {
  return {
    countries: countries.length,
    universities: universities.length,
    programs: programs.length,
    scholarships: scholarships.length,
    allSample: [countries, cities, universities, programs, scholarships].every((rows) =>
      rows.every((row) => row.is_sample),
    ),
  };
}
