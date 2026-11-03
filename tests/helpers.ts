import fields from "@/data/fields.json";
import programs from "@/data/programs.json";
import type { FitContext } from "@/lib/fitScore";
import type { FieldGroup, Program, ProfileItem, StudentProfile } from "@/types";

export const fitContext: FitContext = {
  fieldGroups: Object.fromEntries(fields.map((f) => [f.slug, f.group as FieldGroup])),
};

/** A 4-year CSE graduate, CGPA 3.5/4, IELTS 6.5, 12 months of work, no extras. */
export function profile(overrides: Partial<StudentProfile> = {}): StudentProfile {
  return {
    degree_type: "bsc-cse",
    degree_years: 4,
    university_type: "public",
    cgpa: 3.5,
    cgpa_scale: 4,
    ssc_gpa: 5,
    hsc_gpa: 5,
    field: "cse",
    english_test: "ielts",
    english_score: 6.5,
    has_moi: false,
    budget_bdt_total: null,
    target_countries: [],
    target_fields: [],
    experience_months: 12,
    research: false,
    extracurriculars: [],
    certificates: [],
    skills: [],
    ...overrides,
  };
}

export const item = (group: ProfileItem["group"], kind: ProfileItem["kind"] = "certificate", traits: ProfileItem["traits"] = []): ProfileItem => ({
  label: `${kind} (${group})`,
  kind,
  group,
  traits,
});

export function program(slug: string): Program {
  const found = (programs as Program[]).find((p) => p.slug === slug);
  if (!found) throw new Error(`No sample program ${slug}`);
  return found;
}

export const allPrograms = programs as Program[];
