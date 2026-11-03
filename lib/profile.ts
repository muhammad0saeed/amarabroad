// The student profile: defaults, the activity chips the quiz offers, and safe import/export.
// It lives in localStorage only; export/import moves it between devices as a JSON file.

import type { EnglishTest, EvaluatedItem, FieldGroup, ProfileItem, StudentProfile } from "@/types";

export const PROFILE_FILE_VERSION = 1;

export function emptyProfile(): StudentProfile {
  return {
    degree_type: "",
    degree_years: 4,
    university_type: "public",
    cgpa: null,
    cgpa_scale: 4,
    ssc_gpa: null,
    hsc_gpa: null,
    field: "",
    english_test: null,
    english_score: null,
    has_moi: false,
    budget_bdt_total: null,
    target_countries: [],
    target_fields: [],
    experience_months: 0,
    research: false,
    extracurriculars: [],
    certificates: [],
    skills: [],
  };
}

/** Chips the quiz offers; each counts as "relevant" for its field group (or everywhere if general). */
export interface ActivityChip {
  id: string;
  kind: ProfileItem["kind"];
  group: FieldGroup | "general";
  traits: EvaluatedItem[];
}

export const ACTIVITY_CHIPS: ActivityChip[] = [
  { id: "debate", kind: "extracurricular", group: "general", traits: ["extracurricular"] },
  { id: "volunteering", kind: "extracurricular", group: "general", traits: ["extracurricular"] },
  { id: "sports", kind: "extracurricular", group: "general", traits: ["extracurricular"] },
  { id: "cultural", kind: "extracurricular", group: "general", traits: ["extracurricular"] },
  { id: "programming_contest", kind: "extracurricular", group: "computing", traits: ["extracurricular"] },
  { id: "robotics_club", kind: "extracurricular", group: "engineering", traits: ["extracurricular"] },
  { id: "case_competition", kind: "extracurricular", group: "business", traits: ["extracurricular"] },
  { id: "health_camp", kind: "extracurricular", group: "health", traits: ["extracurricular"] },
  { id: "club_president", kind: "leadership", group: "general", traits: ["leadership"] },
  { id: "class_representative", kind: "leadership", group: "general", traits: ["leadership"] },
  { id: "event_organiser", kind: "leadership", group: "general", traits: ["leadership"] },
  { id: "cert_programming", kind: "certificate", group: "computing", traits: [] },
  { id: "cert_data", kind: "certificate", group: "computing", traits: [] },
  { id: "cert_cad", kind: "certificate", group: "engineering", traits: [] },
  { id: "cert_marketing", kind: "certificate", group: "business", traits: [] },
  { id: "cert_accounting", kind: "certificate", group: "business", traits: [] },
  { id: "cert_lab", kind: "certificate", group: "life_sciences", traits: [] },
  { id: "cert_first_aid", kind: "certificate", group: "health", traits: [] },
  { id: "cert_language", kind: "certificate", group: "general", traits: [] },
];

export function chipToItem(chip: ActivityChip): ProfileItem {
  return { label: chip.id, kind: chip.kind, group: chip.group, traits: chip.traits };
}

export const ENGLISH_TESTS: EnglishTest[] = ["ielts", "toefl_ibt", "pte", "duolingo"];
export const ENGLISH_SCORE_RANGE: Record<EnglishTest, { min: number; max: number; step: number }> = {
  ielts: { min: 0, max: 9, step: 0.5 },
  toefl_ibt: { min: 0, max: 120, step: 1 },
  pte: { min: 10, max: 90, step: 1 },
  duolingo: { min: 10, max: 160, step: 5 },
};

/** True once the quiz has enough to score programs. */
export function isProfileComplete(p: StudentProfile | null): p is StudentProfile {
  return !!p && p.degree_type !== "" && p.field !== "";
}

// ---------------------------------------------------------------- safe parsing (localStorage and imported files)

const num = (v: unknown, min: number, max: number): number | null =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : null;
const str = (v: unknown, max = 80): string => (typeof v === "string" ? v.slice(0, max) : "");
const strList = (v: unknown, maxItems = 30): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, maxItems).map((x) => x.slice(0, 80)) : [];
const GROUPS = new Set(["general", "computing", "engineering", "business", "social", "humanities", "health", "life_sciences", "natural_sciences", "design"]);
const TRAITS = new Set(["academics", "english", "experience", "research", "leadership", "extracurricular"]);

function items(v: unknown): ProfileItem[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 30).flatMap((raw): ProfileItem[] => {
    if (!raw || typeof raw !== "object") return [];
    const r = raw as Record<string, unknown>;
    const kind = r.kind === "certificate" || r.kind === "leadership" ? r.kind : "extracurricular";
    const group = typeof r.group === "string" && GROUPS.has(r.group) ? (r.group as ProfileItem["group"]) : "general";
    const traits = strList(r.traits).filter((t) => TRAITS.has(t)) as EvaluatedItem[];
    return [{ label: str(r.label), kind, group, traits }];
  });
}

/** Validates anything that claims to be a profile; returns null when it isn't usable. */
export function parseProfile(raw: unknown): StudentProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const test = ENGLISH_TESTS.includes(r.english_test as EnglishTest) ? (r.english_test as EnglishTest) : null;
  const range = test ? ENGLISH_SCORE_RANGE[test] : null;
  const cgpaScale = r.cgpa_scale === 5 ? 5 : 4;
  return {
    degree_type: str(r.degree_type),
    degree_years: num(r.degree_years, 2, 6) ?? 4,
    university_type: r.university_type === "private" || r.university_type === "nu" ? r.university_type : "public",
    cgpa: num(r.cgpa, 0, cgpaScale),
    cgpa_scale: cgpaScale,
    ssc_gpa: num(r.ssc_gpa, 0, 5),
    hsc_gpa: num(r.hsc_gpa, 0, 5),
    field: str(r.field),
    english_test: test,
    english_score: range ? num(r.english_score, range.min, range.max) : null,
    has_moi: r.has_moi === true,
    budget_bdt_total: num(r.budget_bdt_total, 0, 1e10),
    target_countries: strList(r.target_countries),
    target_fields: strList(r.target_fields),
    experience_months: num(r.experience_months, 0, 600) ?? 0,
    research: r.research === true,
    extracurriculars: items(r.extracurriculars),
    certificates: items(r.certificates),
    skills: strList(r.skills, 20),
  };
}

/** Reads an exported file ({ app, version, profile }) or a bare profile object. */
export function parseProfileFile(text: string): StudentProfile | null {
  try {
    const json = JSON.parse(text) as Record<string, unknown>;
    return parseProfile(json && typeof json === "object" && "profile" in json ? json.profile : json);
  } catch {
    return null;
  }
}

export function profileFileContents(profile: StudentProfile, appName: string): string {
  return JSON.stringify({ app: appName, version: PROFILE_FILE_VERSION, exported_on: new Date().toISOString().slice(0, 10), profile }, null, 2);
}
