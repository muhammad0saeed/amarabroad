// Real (robot-read) programs can miss facts. These tests pin the rule: unknown is never zero, never "free",
// never "under budget", and never a reason to call a student ineligible.

import { beforeAll, describe, expect, it } from "vitest";
import { listExchangeRates, listProgramContexts } from "@/lib/data";
import { programCost } from "@/lib/cost";
import { applyFilters, EMPTY_FILTERS } from "@/lib/filters";
import { computeFit, eligibilityGate } from "@/lib/fitScore";
import { rateTable, type RateTable } from "@/lib/money";
import { lowestTotal, summarizeProgram } from "@/lib/summary";
import type { ProgramContext, StudentProfile } from "@/types";

let rates: RateTable;
let base: ProgramContext;

beforeAll(async () => {
  rates = rateTable(await listExchangeRates());
  base = (await listProgramContexts()).find((c) => c.program.tuition_per_year > 0 && c.program.min_gpa_requirement)!;
});

const withProgram = (patch: Partial<ProgramContext["program"]>): ProgramContext => ({ ...base, program: { ...base.program, ...patch } });
const withCity = (patch: Partial<ProgramContext["city"]>): ProgramContext => ({ ...base, city: { ...base.city, ...patch } });

describe("costs with missing facts", () => {
  it("a complete program has a total and no gaps", () => {
    const c = programCost(base, rates);
    expect(c.gaps).toEqual([]);
    expect(c.bdt.total).toBeGreaterThan(0);
  });

  it("unknown tuition gives no total, and is not 'tuition-free'", () => {
    const ctx = withProgram({ tuition_per_year: null, currency: null });
    const c = programCost(ctx, rates);
    expect(c.bdt.total).toBeNull();
    expect(c.bdt.tuitionPerYear).toBeNull();
    expect(c.gaps).toContain("tuition");
    expect(applyFilters([summarizeProgram(ctx, rates)], { ...EMPTY_FILTERS, tuitionFree: true }, { today: "2026-11-05" })).toEqual([]);
  });

  it("a city without living costs gives no total but keeps tuition", () => {
    const c = programCost(withCity({ cost_food: null }), rates);
    expect(c.bdt.total).toBeNull();
    expect(c.bdt.tuitionPerYear).toBeGreaterThan(0);
    expect(c.gaps).toEqual(["living"]);
  });

  it("a currency without an exchange rate says so instead of throwing", () => {
    const c = programCost(withProgram({ currency: "SEK" }), rates);
    expect(c.gaps).toContain("rate");
    expect(c.bdt.total).toBeNull();
  });
});

describe("search and lists with missing facts", () => {
  it("an unknown cost never counts as under a budget, and sorts last", () => {
    const known = summarizeProgram(base, rates);
    const unknown = { ...summarizeProgram(withProgram({ tuition_per_year: null, currency: null }), rates), slug: "unknown" };
    expect(applyFilters([known, unknown], { ...EMPTY_FILTERS, maxBudgetLakh: 1000 }, { today: "2026-11-05" }).map((p) => p.slug)).toEqual([known.slug]);
    expect(applyFilters([unknown, known], { ...EMPTY_FILTERS, sort: "cost_low" }, { today: "2026-11-05" }).at(-1)?.slug).toBe("unknown");
    expect(applyFilters([unknown, known], { ...EMPTY_FILTERS, sort: "cost_high" }, { today: "2026-11-05" }).at(-1)?.slug).toBe("unknown");
    expect(lowestTotal([unknown, known])).toBe(known.total_bdt);
    expect(lowestTotal([unknown])).toBeNull();
  });
});

describe("Fit Score with missing facts", () => {
  const profile: StudentProfile = {
    degree_type: "bsc-cse", degree_years: 4, university_type: "public", cgpa: 2.1, cgpa_scale: 4, ssc_gpa: null, hsc_gpa: null, field: "cse",
    english_test: "ielts", english_score: 7, has_moi: false, budget_bdt_total: null, target_countries: [], target_fields: [], experience_months: 0,
    research: false, extracurriculars: [], certificates: [], skills: [],
  };

  it("no stated minimum grade: no grade reason, and grades aren't scored", () => {
    const program = { ...base.program, degree_level: "master" as const, min_gpa_requirement: null, related_bachelor_fields: [] };
    expect(eligibilityGate(profile, program).map((r) => r.code)).not.toContain("grade_below_minimum");
    expect(eligibilityGate(profile, program).map((r) => r.code)).not.toContain("grade_missing");
    const fit = computeFit(profile, program, { fieldGroups: {} });
    expect(fit.parts.find((p) => p.key === "academics")?.scored).toBe(false);
  });

  it("no listed qualifying subjects: the subject check can't rule anyone out", () => {
    const program = { ...base.program, degree_level: "master" as const, field: "economics", related_bachelor_fields: [] };
    expect(eligibilityGate(profile, program).map((r) => r.code)).not.toContain("field_not_related");
  });
});
