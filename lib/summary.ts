// A slim, serialisable view of a program for cards, search, filters and compare.
// Built on the server from the full data; client components only receive these.

import type { DegreeLevel, EnglishTest, GradeRequirement, Intake, ISODate, ProgramContext, TeachingLanguage } from "@/types";
import { programCost } from "./cost";
import type { RateTable } from "./money";

export interface ProgramSummary {
  slug: string;
  title: string;
  university: { slug: string; name: string; type: "public" | "private" };
  city: { slug: string; name_en: string; name_bn: string };
  country: { slug: string; name_en: string; name_bn: string };
  degree_level: DegreeLevel;
  field: string;
  language: TeachingLanguage;
  language_requirement_en?: string;
  language_requirement_bn?: string;
  duration_months: number;
  ects_credits: number;
  currency: ProgramContext["program"]["currency"];
  tuition_per_year: number;
  tuition_per_year_bdt: number;
  total_bdt: number;
  first_year_bdt: number;
  intakes: Intake[];
  seats_non_eu: number | null;
  min_gpa_requirement: GradeRequirement;
  english_tests: { test: EnglishTest; min_score: number }[];
  accepts_3yr_bachelor: boolean;
  accepts_moi: boolean;
  accepts_provisional: boolean;
  open_to_bd_citizens: boolean;
  related_bachelor_fields: string[];
  last_verified: ISODate;
  is_sample: boolean;
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
    total_bdt: Math.round(cost.bdt.total),
    first_year_bdt: Math.round(cost.bdt.firstYear),
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
