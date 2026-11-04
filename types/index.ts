// Data model for Stage 1. One chain: Country → City → University → Program,
// with Scholarships linked to countries, universities or programs.
// Field names follow BRIEF.md; `_en` / `_bn` pairs fall back to English when Bangla is missing.

/** Calendar date, "YYYY-MM-DD". */
export type ISODate = string;
/** ISO 4217 code. Stage 1 data used EUR and HUF; the robot adds whatever a university charges in. */
export type CurrencyCode = string;
export type DegreeLevel = "bachelor" | "master";
/** ISO 639-1 code; Stage 1 data used en/it/de/hu, the robot finds others too. */
export type TeachingLanguage = string;
export type EnglishTest = "ielts" | "toefl_ibt" | "pte" | "duolingo";

/** Carried by every record, so pages can show where a fact came from and how fresh it is. */
export interface Provenance {
  source_url: string;
  last_verified: ISODate;
  /** True for everything in Stage 1: the record is invented. */
  is_sample: boolean;
  /** Where the record came from: "robot" (read from the university's own site), "admin" or "sample". */
  origin?: "sample" | "robot" | "admin";
}

/** A self-hosted photo (see public/photos/CREDITS.md). */
export interface Photo {
  src: string;
  credit: string;
  source_url: string;
}

/** A short text in both languages. */
export interface Bilingual {
  en: string;
  bn?: string;
}

export interface Country extends Provenance {
  slug: string;
  photo?: Photo;
  /** False when the robot created the country but its guide (costs, visa, jobs) isn't written yet. */
  has_guide?: boolean;
  name_en: string;
  name_bn: string;
  currency: CurrencyCode;
  eu_member: boolean;
  overview_en: string;
  overview_bn?: string;
  education_system_en: string;
  education_system_bn?: string;
  post_study_work_en: string;
  post_study_work_bn?: string;
  /** Hours a student may work per week during term; null when the guide isn't written yet. */
  student_work_hours: number | null;
  student_work_note_en: string;
  student_work_note_bn?: string;
  /** Gross hourly minimum wage in local currency; null when the country has no national minimum. */
  min_wage: number | null;
  min_wage_note_en: string;
  min_wage_note_bn?: string;
  visa_info_en: string;
  visa_info_bn?: string;
  visa_info_url: string;
  embassy_url: string;
}

export type LanguageNeed = "essential" | "helpful" | "not_needed";

export interface City extends Provenance {
  slug: string;
  photo?: Photo;
  /** False when the robot created the city but its guide (living costs, jobs) isn't written yet. */
  has_guide?: boolean;
  name_en: string;
  name_bn: string;
  /** Country slug. */
  country: string;
  overview_en: string;
  overview_bn?: string;
  population_students: number | null;
  // Monthly costs in the country's currency; null until the city guide is written.
  cost_rent_shared: number | null;
  cost_rent_studio: number | null;
  cost_food: number | null;
  cost_transport: number | null;
  cost_phone: number | null;
  cost_insurance: number | null;
  local_language_needed_for_jobs: LanguageNeed | null;
  local_language_note_en: string;
  local_language_note_bn?: string;
  common_student_jobs: Bilingual[];
  bd_community_note_en: string;
  bd_community_note_bn?: string;
  job_search_links: { label: string; url: string }[];
}

export interface Ranking {
  source: string;
  /** A single rank or a band such as "401–450". */
  rank: string;
  year: number;
  url: string;
}

export interface University extends Provenance {
  slug: string;
  name: string;
  /** City slug. */
  city: string;
  type: "public" | "private";
  accreditation: string;
  /** Degree recognised across the EU. */
  eu_recognised: boolean;
  ects: boolean;
  ranking: Ranking | null;
  website: string;
  overview_en: string;
  overview_bn?: string;
}

export interface Intake {
  /** Month teaching starts, 1–12. */
  month: number;
  year: number;
  /** Application deadline for non-EU applicants. */
  deadline: ISODate;
}

/**
 * Minimum grade. Master's programs compare the bachelor CGPA; bachelor's programs compare HSC GPA.
 * `value` is on `scale` (4 for CGPA, 5 for HSC GPA); `local_note_en` gives the university's own scale when it differs.
 */
export interface GradeRequirement {
  value: number;
  scale: number;
  local_note_en?: string;
  local_note_bn?: string;
}

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

export interface Program extends Provenance {
  slug: string;
  title: string;
  /** University slug. */
  university: string;
  degree_level: DegreeLevel;
  /** Field slug (see fields.json). */
  field: string;
  /** null when the robot couldn't find it on the official page. */
  language: TeachingLanguage | null;
  /** Language level needed when teaching isn't in English, e.g. "German C1". */
  language_requirement_en?: string;
  language_requirement_bn?: string;
  duration_months: number | null;
  ects_credits: number | null;
  /** Currency of tuition and fees (null when tuition wasn't found). */
  currency: CurrencyCode | null;
  /** 0 = tuition-free; null = not found, which is NOT the same as free. */
  tuition_per_year: number | null;
  /** Semester contributions and similar yearly fees, on top of tuition. */
  other_fees_per_year: number;
  application_fee: number;
  intakes: Intake[];
  seats_total: number | null;
  /** Seats for non-EU applicants; null = "Not published". */
  seats_non_eu: number | null;
  /** null = the official page doesn't state a minimum. */
  min_gpa_requirement: GradeRequirement | null;
  /** Yes / no / null = not stated on the official page (never read null as "no"). */
  accepts_3yr_bachelor: boolean | null;
  accepts_moi: boolean | null;
  /** Provisional certificate accepted (session jam). */
  accepts_provisional: boolean | null;
  open_to_bd_citizens: boolean;
  english_tests: { test: EnglishTest; min_score: number }[];
  required_documents: DocumentKey[];
  /**
   * Field slugs an applicant's previous studies may come from. For master's programs these are
   * bachelor fields; for bachelor's programs they are HSC streams (hsc-science, hsc-business, hsc-humanities).
   */
  related_bachelor_fields: string[];
  overview_en: string;
  overview_bn?: string;
  career_paths_en: string[];
  career_paths_bn?: string[];
  official_url: string;
}

export type ScholarshipType = "merit" | "need" | "mixed";
export type EvaluatedItem = "academics" | "english" | "experience" | "research" | "leadership" | "extracurricular";

export interface ScholarshipCoverage {
  tuition: "full" | "partial" | "none";
  /** Share of tuition covered when partial. */
  tuition_percent?: number;
  stipend: { amount: number; currency: CurrencyCode; per: "month" | "year" } | null;
  summary_en: string;
  summary_bn?: string;
}

export interface Scholarship extends Provenance {
  slug: string;
  name: string;
  provider: string;
  type: ScholarshipType;
  bd_eligible: boolean;
  levels: DegreeLevel[];
  coverage: ScholarshipCoverage;
  deadline: ISODate;
  eligibility_summary_en: string;
  eligibility_summary_bn?: string;
  evaluates: EvaluatedItem[];
  official_url: string;
  /** Where it applies; an empty list means "not limited at this level". */
  countries: string[];
  universities: string[];
  programs: string[];
}

export interface ExchangeRate extends Provenance {
  currency: CurrencyCode;
  bdt_per_unit: number;
  updated_on: ISODate;
}

export interface GlossaryTerm extends Provenance {
  slug: string;
  term: string;
  term_bn?: string;
  explain_en: string;
  explain_bn: string;
}

export type FieldGroup =
  | "computing"
  | "engineering"
  | "business"
  | "social"
  | "humanities"
  | "health"
  | "life_sciences"
  | "natural_sciences"
  | "design";

export type TileColor = "indigo" | "blue" | "green" | "pink" | "amber" | "teal";

/** Study field taxonomy, used by filters and the Fit Score's field relevance. */
export interface Field {
  slug: string;
  name_en: string;
  name_bn: string;
  group: FieldGroup;
  tile: TileColor;
}

/** A Bangladeshi qualification and the field it maps to (match quiz, eligibility gate). */
export interface DegreeMapping {
  slug: string;
  label_en: string;
  label_bn: string;
  kind: "hsc" | "honours" | "pass" | "engineering" | "professional";
  years: number;
  field: string;
}

// ---------------------------------------------------------------------------
// Student profile — stored in localStorage only.

export interface ProfileItem {
  label: string;
  kind: "extracurricular" | "certificate" | "leadership";
  /** Field group it relates to, or "general" (counts for every program). */
  group: FieldGroup | "general";
  /** Traits merit scholarships can weigh (e.g. leadership, research). */
  traits: EvaluatedItem[];
}

export interface StudentProfile {
  /** Degree-mapping slug, e.g. "bsc-cse". */
  degree_type: string;
  degree_years: number;
  university_type: "public" | "private" | "nu";
  cgpa: number | null;
  cgpa_scale: number;
  ssc_gpa: number | null;
  hsc_gpa: number | null;
  /** Field slug. */
  field: string;
  english_test: EnglishTest | null;
  english_score: number | null;
  has_moi: boolean;
  budget_bdt_total: number | null;
  target_countries: string[];
  /** Program fields the student is interested in (match quiz "field and goals"). */
  target_fields: string[];
  experience_months: number;
  research: boolean;
  extracurriculars: ProfileItem[];
  certificates: ProfileItem[];
  skills: string[];
}

/** A program joined with everything above it in the chain. */
export interface ProgramContext {
  program: Program;
  university: University;
  city: City;
  country: Country;
}
