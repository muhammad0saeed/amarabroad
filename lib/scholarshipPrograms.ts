// Which programs a scholarship applies to, and how its page shows them. A country-wide scholarship can cover
// thousands of programs, so the page shows a few per country and links to the full program search.

import type { Country, DegreeLevel, ProgramContext, Scholarship } from "@/types";
import { EMPTY_FILTERS, serializeFilters } from "./filters";

/** How many sample programs the scholarship page lists per country. */
export const APPLIES_SAMPLE_SIZE = 5;

type Coverage = Pick<Scholarship, "levels" | "programs" | "universities" | "countries">;

/** A scholarship applies to a program at one of its levels that is linked to it, its university or its country. */
export function scholarshipCovers(s: Coverage, ctx: Pick<ProgramContext, "program" | "university" | "country">): boolean {
  return (
    s.levels.includes(ctx.program.degree_level) &&
    (s.programs.includes(ctx.program.slug) || s.universities.includes(ctx.university.slug) || s.countries.includes(ctx.country.slug))
  );
}

export interface AppliesGroup {
  country: Country;
  /** Every program it applies to in this country. */
  total: number;
  /** The first few, to show on the page. */
  sample: ProgramContext[];
  /** Program search that lists all of them, or null when no search filter can (a hand-picked program list: then all are in `sample`). */
  searchHref: string | null;
}

/** The programs a scholarship applies to, grouped by country (most programs first), a few shown per country. */
export function scholarshipAppliesGroups(
  s: Coverage & Pick<Scholarship, "bd_eligible">,
  contexts: ProgramContext[],
  sampleSize = APPLIES_SAMPLE_SIZE,
): AppliesGroup[] {
  const byCountry = new Map<string, { country: Country; programs: ProgramContext[] }>();
  for (const ctx of contexts) {
    if (!scholarshipCovers(s, ctx)) continue;
    const group = byCountry.get(ctx.country.slug) ?? { country: ctx.country, programs: [] };
    group.programs.push(ctx);
    byCountry.set(ctx.country.slug, group);
  }

  // One level: filter by it. Both levels: the search shows every level, which is what it covers.
  const level: DegreeLevel | null = s.levels.length === 1 ? s.levels[0]! : null;
  const groups: AppliesGroup[] = [];
  for (const { country, programs } of byCountry.values()) {
    let query: string | null = null;
    if (s.countries.includes(country.slug)) {
      query = serializeFilters({ ...EMPTY_FILTERS, countries: [country.slug], level, scholarship: s.bd_eligible });
    } else {
      // Reached through its universities (and maybe single programs): a university filter, if every program is at one.
      const universities = [...new Set(programs.map((p) => p.university.slug))].filter((u) => s.universities.includes(u));
      const allAtListed = programs.every((p) => s.universities.includes(p.university.slug));
      if (universities.length && allAtListed) {
        query = serializeFilters({ ...EMPTY_FILTERS, universities, level, scholarship: s.bd_eligible });
      }
    }
    groups.push({
      country,
      total: programs.length,
      sample: query ? programs.slice(0, sampleSize) : programs,
      searchHref: query ? `/programs?${query}` : null,
    });
  }
  return groups.sort((a, b) => b.total - a.total || a.country.name_en.localeCompare(b.country.name_en));
}
