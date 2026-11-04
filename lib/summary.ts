// A slim, serialisable view of a program for cards, search, filters and compare.
// Built on the server from the full data; client components only receive these.

import type { DegreeLevel, EnglishTest, FieldGroup, GradeRequirement, Intake, ISODate, ProgramContext, TeachingLanguage } from "@/types";
import { programCost, type CostGap } from "./cost";
import type { RateTable } from "./money";

export interface ProgramSummary {
  slug: string;
  title: string;
  university: { slug: string; name: string; type: "public" | "private" };
  city: { slug: string; name_en: string; name_bn: string };
  country: { slug: string; name_en: string; name_bn: string };
  degree_level: DegreeLevel;
  field: string;
  language: TeachingLanguage | null;
  language_requirement_en?: string;
  language_requirement_bn?: string;
  duration_months: number | null;
  ects_credits: number | null;
  currency: ProgramContext["program"]["currency"];
  /** 0 = tuition-free; null = not found on the official page. */
  tuition_per_year: number | null;
  tuition_per_year_bdt: number | null;
  /** Whole program in taka, living costs included; null when a part is unknown (see cost_gaps). */
  total_bdt: number | null;
  first_year_bdt: number | null;
  cost_gaps: CostGap[];
  intakes: Intake[];
  seats_non_eu: number | null;
  min_gpa_requirement: GradeRequirement | null;
  english_tests: { test: EnglishTest; min_score: number }[];
  /** null = not stated on the official page. */
  accepts_3yr_bachelor: boolean | null;
  accepts_moi: boolean | null;
  accepts_provisional: boolean | null;
  open_to_bd_citizens: boolean;
  related_bachelor_fields: string[];
  last_verified: ISODate;
  is_sample: boolean;
  /** Subject area of `field` (filled in by the server, which knows the field list). */
  field_group?: FieldGroup;
  /** Whether any listed scholarship covers this program. */
  has_scholarship?: boolean;
}

export function summarizeProgram(ctx: ProgramContext, rates: RateTable): ProgramSummary {
  const { program: p, university: u, city: c, country: k } = ctx;
  const cost = programCost(ctx, rates);
  return {
    slug: p.slug,
    title: p.title,
    university: { slug: u.slug, name: u.name, type: u.type },
    city: { slug: c.slug, name_en: c.name_en, name_bn: c.name_bn },
    country: { slug: k.slug, name_en: k.name_en, name_bn: k.name_bn },
    degree_level: p.degree_level,
    field: p.field,
    language: p.language,
    ...(p.language_requirement_en
      ? { language_requirement_en: p.language_requirement_en, language_requirement_bn: p.language_requirement_bn }
      : {}),
    duration_months: p.duration_months,
    ects_credits: p.ects_credits,
    currency: p.currency,
    tuition_per_year: p.tuition_per_year,
    tuition_per_year_bdt: cost.bdt.tuitionPerYear,
    total_bdt: cost.bdt.total === null ? null : Math.round(cost.bdt.total),
    first_year_bdt: cost.bdt.firstYear === null ? null : Math.round(cost.bdt.firstYear),
    cost_gaps: cost.gaps,
    intakes: p.intakes,
    seats_non_eu: p.seats_non_eu,
    min_gpa_requirement: p.min_gpa_requirement,
    english_tests: p.english_tests,
    accepts_3yr_bachelor: p.accepts_3yr_bachelor,
    accepts_moi: p.accepts_moi,
    accepts_provisional: p.accepts_provisional,
    open_to_bd_citizens: p.open_to_bd_citizens,
    related_bachelor_fields: p.related_bachelor_fields,
    last_verified: p.last_verified,
    is_sample: p.is_sample,
  };
}

/** The next deadline that hasn't passed, or null when every intake is closed. */
export function nextDeadline(intakes: Intake[], today: ISODate): Intake | null {
  return (
    intakes
      .filter((i) => i.deadline >= today)
      .sort((a, b) => (a.deadline < b.deadline ? -1 : a.deadline > b.deadline ? 1 : 0))[0] ?? null
  );
}

/** Lowest known total cost among these programs, or null when none is known ("From ৳ X" on lists). */
export function lowestTotal(programs: Pick<ProgramSummary, "total_bdt">[]): number | null {
  const known = programs.map((p) => p.total_bdt).filter((x): x is number => x !== null);
  return known.length ? Math.min(...known) : null;
}
