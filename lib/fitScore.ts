// Profile Fit Score (0–100): how well a profile matches a program's PUBLISHED requirements.
// It is never a chance of admission. Rules follow BRIEF.md; every weight lives in FIT_CONFIG.
//
// 1. Eligibility gate (pass/fail, with reasons)  2. Score in five parts  3. Improvement tips.
// Merit scholarships reuse the parts with extra weight on what they evaluate.

import type {
  DegreeLevel,
  EnglishTest,
  EvaluatedItem,
  FieldGroup,
  Program,
  ProfileItem,
  Scholarship,
  StudentProfile,
} from "@/types";
import { toFourPoint } from "./grades";

/** The program fields the Fit Score reads (full programs and ProgramSummary both qualify). */
export type FitProgram = Pick<
  Program,
  | "slug"
  | "degree_level"
  | "field"
  | "language"
  | "language_requirement_en"
  | "english_tests"
  | "accepts_moi"
  | "accepts_3yr_bachelor"
  | "open_to_bd_citizens"
  | "related_bachelor_fields"
  | "min_gpa_requirement"
>;

export const FIT_CONFIG = {
  academics: {
    max: 40,
    /** Points for meeting the minimum. */
    base: 20,
    bonusMax: 20,
    /** Full bonus this far above the minimum, on a 4.0 scale. */
    fullBonusAbove: 0.8,
  },
  english: { max: 20, base: 12, perHalfBand: 4, bonusMax: 8, moiOnly: 12 },
  field: { max: 15, exact: 15, close: 10, loose: 5 },
  experience: { max: 15, monthsPerPoint: 2, workMax: 10, research: 5 },
  extras: { max: 10, perItem: 2 },
  bands: [
    { min: 80, band: "strong" },
    { min: 60, band: "good" },
    { min: 40, band: "possible" },
    { min: 0, band: "weak" },
  ],
  /** Merit scholarships multiply the parts they evaluate by this. */
  scholarshipWeight: 1.5,
  /** One change at a time for improvement tips. */
  tips: { englishHalfBands: 1, extraCertificates: 1, extraExperienceMonths: 6, count: 3 },
} as const;

/**
 * Approximate IELTS band for other tests: [minimum score, band], highest first.
 * Used only for the "per 0.5 band above the minimum" bonus; meeting the minimum is always
 * checked against the program's own minimum for the student's own test.
 */
export const IELTS_EQUIVALENTS: Record<Exclude<EnglishTest, "ielts">, readonly (readonly [number, number])[]> = {
  toefl_ibt: [[118, 9], [115, 8.5], [110, 8], [102, 7.5], [94, 7], [79, 6.5], [60, 6], [46, 5.5], [35, 5], [0, 4.5]],
  pte: [[89, 9], [84, 8.5], [79, 8], [76, 7.5], [66, 7], [58, 6.5], [50, 6], [42, 5.5], [36, 5], [0, 4.5]],
  duolingo: [[160, 9], [155, 8.5], [145, 8], [135, 7.5], [125, 7], [110, 6.5], [105, 6], [95, 5.5], [85, 5], [0, 4.5]],
};

// ---------------------------------------------------------------- types

export type Band = (typeof FIT_CONFIG.bands)[number]["band"];
export type FitPartKey = "academics" | "english" | "field" | "experience" | "extras";

export type GateCode =
  | "not_open_to_bd"
  | "needs_bachelor"
  | "three_year_not_accepted"
  | "field_not_related"
  | "english_missing"
  | "english_below_minimum"
  | "english_test_not_accepted"
  | "grade_missing"
  | "grade_below_minimum";

export interface GateReason {
  code: GateCode;
  params?: Record<string, string | number>;
}

export interface FitPart {
  key: FitPartKey;
  points: number;
  max: number;
  /** False when the part can't be judged (English for a program taught in another language). */
  scored: boolean;
}

export type FitNote =
  | { code: "moi_used" }
  | { code: "language_requirement"; requirement: string }
  | { code: "english_not_scored" };

export type FitResult =
  | { eligible: false; reasons: GateReason[]; notes: FitNote[] }
  | { eligible: true; score: number; band: Band; parts: FitPart[]; notes: FitNote[] };

export interface FitContext {
  /** Field slug → group, from fields.json. */
  fieldGroups: Record<string, FieldGroup>;
}

// ---------------------------------------------------------------- English

export function ieltsEquivalent(test: EnglishTest, score: number): number {
  if (test === "ielts") return score;
  return IELTS_EQUIVALENTS[test].find(([min]) => score >= min)?.[1] ?? 0;
}

/** Lowest score on `test` that counts as at least `band` IELTS; null when out of range. */
export function scoreForBand(test: EnglishTest, band: number): number | null {
  if (test === "ielts") return band <= 9 ? band : null;
  const rows = [...IELTS_EQUIVALENTS[test]].reverse();
  return rows.find(([, b]) => b >= band - 1e-9)?.[0] ?? null;
}

type EnglishStatus =
  | { status: "met"; test: EnglishTest; score: number; minScore: number }
  | { status: "moi" }
  | { status: "missing" }
  | { status: "below"; test: EnglishTest; score: number; minScore: number }
  | { status: "not_accepted"; test: EnglishTest; accepted: EnglishTest[] }
  | { status: "not_applicable" };

function englishStatus(profile: StudentProfile, program: FitProgram): EnglishStatus {
  if (program.english_tests.length === 0) return { status: "not_applicable" };
  const moi = profile.has_moi && program.accepts_moi;
  const { english_test: test, english_score: score } = profile;
  if (test && score !== null) {
    const requirement = program.english_tests.find((t) => t.test === test);
    if (requirement && score >= requirement.min_score - 1e-9) {
      return { status: "met", test, score, minScore: requirement.min_score };
    }
    if (moi) return { status: "moi" };
    return requirement
      ? { status: "below", test, score, minScore: requirement.min_score }
      : { status: "not_accepted", test, accepted: program.english_tests.map((t) => t.test) };
  }
  return moi ? { status: "moi" } : { status: "missing" };
}

// ---------------------------------------------------------------- grades

const onlyHsc = (profile: StudentProfile) => profile.field.startsWith("hsc-");

/** The profile's relevant grade and the program's minimum, both on a 4.0 scale. */
function gradesOnFourPoint(profile: StudentProfile, program: FitProgram): { yours: number | null; minimum: number } {
  const { value, scale } = program.min_gpa_requirement;
  const yours =
    program.degree_level === "bachelor"
      ? profile.hsc_gpa === null
        ? null
        : toFourPoint(profile.hsc_gpa, 5)
      : profile.cgpa === null || onlyHsc(profile)
        ? null
        : toFourPoint(profile.cgpa, profile.cgpa_scale);
  return { yours, minimum: toFourPoint(value, scale) };
}

// ---------------------------------------------------------------- 1. eligibility gate

export function eligibilityGate(profile: StudentProfile, program: FitProgram): GateReason[] {
  const reasons: GateReason[] = [];
  const master = program.degree_level === "master";

  if (!program.open_to_bd_citizens) reasons.push({ code: "not_open_to_bd" });
  if (master && onlyHsc(profile)) reasons.push({ code: "needs_bachelor" });
  if (master && !onlyHsc(profile) && profile.degree_years === 3 && !program.accepts_3yr_bachelor) {
    reasons.push({ code: "three_year_not_accepted" });
  }

  // Field: master's programs check the bachelor field; bachelor's programs check the HSC stream.
  const fieldListed = profile.field === program.field || program.related_bachelor_fields.includes(profile.field);
  if (master ? !onlyHsc(profile) && !fieldListed : onlyHsc(profile) && !fieldListed) {
    reasons.push({ code: "field_not_related", params: { field: profile.field } });
  }

  const english = englishStatus(profile, program);
  if (english.status === "missing") reasons.push({ code: "english_missing" });
  if (english.status === "below") {
    reasons.push({ code: "english_below_minimum", params: { test: english.test, score: english.score, min: english.minScore } });
  }
  if (english.status === "not_accepted") {
    reasons.push({ code: "english_test_not_accepted", params: { test: english.test, accepted: english.accepted.join(",") } });
  }

  if (!(master && onlyHsc(profile))) {
    const { yours, minimum } = gradesOnFourPoint(profile, program);
    const { value, scale } = program.min_gpa_requirement;
    if (yours === null) reasons.push({ code: "grade_missing", params: { scale } });
    else if (yours < minimum - 1e-9) {
      const shown = program.degree_level === "bachelor" ? profile.hsc_gpa! : profile.cgpa!;
      const shownScale = program.degree_level === "bachelor" ? 5 : profile.cgpa_scale;
      reasons.push({ code: "grade_below_minimum", params: { yours: shown, yoursScale: shownScale, min: value, scale } });
    }
  }
  return reasons;
}

// ---------------------------------------------------------------- 2. score

function isRelevant(item: ProfileItem, group: FieldGroup | undefined): boolean {
  return item.group === "general" || item.group === group;
}

function scoreParts(profile: StudentProfile, program: FitProgram, ctx: FitContext): FitPart[] {
  const C = FIT_CONFIG;
  const programGroup = ctx.fieldGroups[program.field];

  // Academics: 20 for meeting the minimum, + up to 20 scaled by how far above it.
  const { yours, minimum } = gradesOnFourPoint(profile, program);
  const above = Math.max(0, (yours ?? minimum) - minimum);
  const academics = C.academics.base + Math.min(C.academics.bonusMax, (C.academics.bonusMax * above) / C.academics.fullBonusAbove);

  // English: 12 for meeting the minimum, + 4 per 0.5 IELTS band above it (max 8); MOI-only = 12.
  const english = englishStatus(profile, program);
  let englishPoints = 0;
  if (english.status === "met") {
    const steps = Math.floor(
      (ieltsEquivalent(english.test, english.score) - ieltsEquivalent(english.test, english.minScore)) / 0.5 + 1e-9,
    );
    englishPoints = C.english.base + Math.min(C.english.bonusMax, Math.max(0, steps) * C.english.perHalfBand);
  } else if (english.status === "moi") {
    englishPoints = C.english.moiOnly;
  }

  // Field relevance: exact 15, listed and same group 10, listed but another group 5.
  // Bachelor's programs list HSC streams; a listed stream counts as an exact match.
  let field: number = C.field.loose;
  if (program.degree_level === "bachelor") {
    field = program.related_bachelor_fields.includes(profile.field) ? C.field.exact : C.field.loose;
  } else if (profile.field === program.field) {
    field = C.field.exact;
  } else if (program.related_bachelor_fields.includes(profile.field)) {
    field = ctx.fieldGroups[profile.field] === programGroup ? C.field.close : C.field.loose;
  }

  // Experience: 1 point per 2 months of work or internships (max 10), research +5.
  const work = Math.min(C.experience.workMax, Math.floor(Math.max(0, profile.experience_months) / C.experience.monthsPerPoint));
  const experience = work + (profile.research ? C.experience.research : 0);

  // Extras: 2 per relevant extracurricular, certificate or leadership role (max 10).
  const relevant = [...profile.extracurriculars, ...profile.certificates].filter((i) => isRelevant(i, programGroup)).length;
  const extras = Math.min(C.extras.max, relevant * C.extras.perItem);

  return [
    { key: "academics", points: Math.round(academics), max: C.academics.max, scored: true },
    { key: "english", points: englishPoints, max: C.english.max, scored: english.status !== "not_applicable" },
    { key: "field", points: field, max: C.field.max, scored: true },
    { key: "experience", points: experience, max: C.experience.max, scored: true },
    { key: "extras", points: extras, max: C.extras.max, scored: true },
  ];
}

/** Sum of scored parts, rescaled to 100 when a part couldn't be scored. */
function total(parts: FitPart[], weight: (key: FitPartKey) => number = () => 1): number {
  const scored = parts.filter((p) => p.scored);
  const points = scored.reduce((sum, p) => sum + p.points * weight(p.key), 0);
  const max = scored.reduce((sum, p) => sum + p.max * weight(p.key), 0);
  return max === 0 ? 0 : Math.round((points / max) * 100);
}

export function bandFor(score: number): Band {
  return FIT_CONFIG.bands.find((b) => score >= b.min)!.band;
}

export function computeFit(profile: StudentProfile, program: FitProgram, ctx: FitContext): FitResult {
  const notes: FitNote[] = [];
  if (program.language !== "en" && program.language_requirement_en) {
    notes.push({ code: "language_requirement", requirement: program.language_requirement_en });
  }
  const english = englishStatus(profile, program);
  if (english.status === "moi") notes.push({ code: "moi_used" });
  if (english.status === "not_applicable") notes.push({ code: "english_not_scored" });

  const reasons = eligibilityGate(profile, program);
  if (reasons.length > 0) return { eligible: false, reasons, notes };

  const parts = scoreParts(profile, program, ctx);
  const score = total(parts);
  return { eligible: true, score, band: bandFor(score), parts, notes };
}

// ---------------------------------------------------------------- 3. improvement tips

export type FitTip =
  | { kind: "english"; test: EnglishTest; from: number; to: number; gain: number }
  | { kind: "certificate"; gain: number }
  | { kind: "experience"; fromMonths: number; toMonths: number; gain: number };

/** Recalculates with one change at a time and returns the biggest gains (top 3, gains > 0). */
export function improvementTips(profile: StudentProfile, program: FitProgram, ctx: FitContext): FitTip[] {
  const base = computeFit(profile, program, ctx);
  if (!base.eligible) return [];
  const scoreWith = (changed: StudentProfile) => {
    const r = computeFit(changed, program, ctx);
    return r.eligible ? r.score : base.score;
  };
  const tips: FitTip[] = [];
  const T = FIT_CONFIG.tips;

  if (profile.english_test && profile.english_score !== null) {
    const target = scoreForBand(profile.english_test, ieltsEquivalent(profile.english_test, profile.english_score) + 0.5 * T.englishHalfBands);
    if (target !== null && target > profile.english_score) {
      const gain = scoreWith({ ...profile, english_score: target }) - base.score;
      tips.push({ kind: "english", test: profile.english_test, from: profile.english_score, to: target, gain });
    }
  }

  const extraCertificate: ProfileItem = { label: "", kind: "certificate", group: "general", traits: [] };
  const withCertificate = { ...profile, certificates: [...profile.certificates, ...Array(T.extraCertificates).fill(extraCertificate)] };
  tips.push({ kind: "certificate", gain: scoreWith(withCertificate) - base.score });

  const toMonths = profile.experience_months + T.extraExperienceMonths;
  tips.push({
    kind: "experience",
    fromMonths: profile.experience_months,
    toMonths,
    gain: scoreWith({ ...profile, experience_months: toMonths }) - base.score,
  });

  return tips
    .filter((t) => t.gain > 0)
    .sort((a, b) => b.gain - a.gain)
    .slice(0, T.count);
}

// ---------------------------------------------------------------- scholarships

/** Which score parts each evaluated item belongs to. */
const PART_OF: Record<EvaluatedItem, FitPartKey> = {
  academics: "academics",
  english: "english",
  experience: "experience",
  research: "experience",
  leadership: "extras",
  extracurricular: "extras",
};

export type ScholarshipFit =
  | { kind: "need_based" }
  | { kind: "not_eligible"; reason: "not_open_to_bd" | "level_not_covered" | "program_not_eligible" }
  | { kind: "scored"; score: number; band: Band; /** Mixed: part of the decision is based on need. */ partlyNeedBased: boolean };

/**
 * Merit and mixed scholarships use the program's Fit Score parts, with FIT_CONFIG.scholarshipWeight
 * on the parts that hold the items in `evaluates[]`. Need-based ones are not scored.
 */
export function scholarshipFit(
  profile: StudentProfile,
  scholarship: Scholarship,
  program: FitProgram,
  ctx: FitContext,
): ScholarshipFit {
  if (scholarship.type === "need") return { kind: "need_based" };
  if (!scholarship.bd_eligible) return { kind: "not_eligible", reason: "not_open_to_bd" };
  if (!scholarship.levels.includes(program.degree_level as DegreeLevel)) return { kind: "not_eligible", reason: "level_not_covered" };

  const fit = computeFit(profile, program, ctx);
  if (!fit.eligible) return { kind: "not_eligible", reason: "program_not_eligible" };

  const weighted = new Set(scholarship.evaluates.map((item) => PART_OF[item]));
  const score = total(fit.parts, (key) => (weighted.has(key) ? FIT_CONFIG.scholarshipWeight : 1));
  return { kind: "scored", score, band: bandFor(score), partlyNeedBased: scholarship.type === "mixed" };
}
