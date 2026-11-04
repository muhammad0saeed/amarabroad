// What the robot reads off a program's pages. Every fact carries `quote`: the words on the page it was
// found in, so the site can show its source and checks.ts can confirm it's really there.

export interface Fact<T> {
  value: T;
  quote: string;
}

export type Level = "bachelor" | "master";
export type Applies = "non_eu" | "all" | "eu";
export type DocumentKey =
  | "passport"
  | "transcript"
  | "degree_certificate"
  | "hsc_certificate"
  | "cv"
  | "motivation_letter"
  | "recommendation_letters"
  | "english_certificate"
  | "moi_letter"
  | "portfolio"
  | "course_descriptions"
  | "work_certificate";

export interface ProgramFacts {
  is_program_page: boolean;
  title: string | null;
  degree_level: Fact<Level> | null;
  duration_months: Fact<number> | null;
  ects_credits: Fact<number> | null;
  teaching_language: Fact<string> | null;
  language_requirement: Fact<string> | null;
  tuition: { amount_per_year: number; currency: string; applies_to: Applies; quote: string } | null;
  other_fees_per_year: { amount: number; currency: string; quote: string } | null;
  application_fee: { amount: number; currency: string; quote: string } | null;
  intakes: { start_month: number; start_year: number; deadline: string | null; deadline_for: Applies; quote: string }[];
  english_tests: { test: "ielts" | "toefl_ibt" | "pte" | "duolingo"; min_score: number; quote: string }[];
  accepts_moi: Fact<boolean> | null;
  accepts_3yr_bachelor: Fact<boolean> | null;
  accepts_provisional: Fact<boolean> | null;
  min_grade: { value: number; scale: number; note: string | null; quote: string } | null;
  seats_total: Fact<number> | null;
  seats_non_eu: Fact<number> | null;
  required_documents: { key: DocumentKey; quote: string }[];
  field_slug: string | null;
  related_bachelor_fields: string[];
  /** The page's own short description (meta description), shown as an excerpt with a link. */
  overview_en: string | null;
  career_paths_en: string[];
}

export const EMPTY_FACTS: ProgramFacts = {
  is_program_page: false,
  title: null,
  degree_level: null,
  duration_months: null,
  ects_credits: null,
  teaching_language: null,
  language_requirement: null,
  tuition: null,
  other_fees_per_year: null,
  application_fee: null,
  intakes: [],
  english_tests: [],
  accepts_moi: null,
  accepts_3yr_bachelor: null,
  accepts_provisional: null,
  min_grade: null,
  seats_total: null,
  seats_non_eu: null,
  required_documents: [],
  field_slug: null,
  related_bachelor_fields: [],
  overview_en: null,
  career_paths_en: [],
};
