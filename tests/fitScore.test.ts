import { describe, expect, it } from "vitest";
import scholarshipsJson from "@/data/scholarships.json";
import {
  bandFor,
  computeFit,
  eligibilityGate,
  FIT_CONFIG,
  ieltsEquivalent,
  improvementTips,
  scholarshipFit,
  scoreForBand,
  type FitResult,
} from "@/lib/fitScore";
import type { Scholarship } from "@/types";
import { allPrograms, fitContext, item, profile, program } from "./helpers";

const scholarships = scholarshipsJson as Scholarship[];
const scholarship = (slug: string) => scholarships.find((s) => s.slug === slug)!;

const milanCS = program("sum-msc-computer-science"); // min CGPA 3.0/4, IELTS 6.0, TOEFL 80, 3-year OK, MOI OK
const berlinCS = program("stub-msc-computer-science"); // min 3.2/4 (German 2.3), IELTS 6.5 / TOEFL 88 only, no 3-year, no MOI
const fit = (p = profile(), prog = milanCS) => computeFit(p, prog, fitContext);
const codes = (r: FitResult) => (r.eligible ? [] : r.reasons.map((x) => x.code));
const part = (r: FitResult, key: string) => (r.eligible ? r.parts.find((p) => p.key === key) : undefined);

describe("score parts (BRIEF.md step 2)", () => {
  it("scores the reference profile: 29 + 16 + 25 + 6 + 0 = 76, Good", () => {
    const r = fit();
    expect(r.eligible).toBe(true);
    if (!r.eligible) return;
    expect(r.parts.map((p) => [p.key, p.points, p.max])).toEqual([
      ["academics", 29, 35], // 18 + 17 × 0.5 / 0.8 = 28.6 → 29
      ["english", 16, 20], // IELTS 6.5 vs 6.0: one half band → 12 + 4
      ["field", 25, 25], // exact field
      ["experience", 6, 12], // 12 months → 6
      ["extras", 0, 8],
    ]);
    expect(r.score).toBe(76);
    expect(r.band).toBe("good");
  });

  it("gives academics 18 at the minimum and the full 35 at +0.8 or more", () => {
    expect(part(fit(profile({ cgpa: 3.0 })), "academics")?.points).toBe(18);
    expect(part(fit(profile({ cgpa: 3.8 })), "academics")?.points).toBe(35);
    expect(part(fit(profile({ cgpa: 4.0 })), "academics")?.points).toBe(35);
  });

  it("scores the grade itself when the program states no minimum, so results always count", () => {
    const noMinimum = { ...milanCS, min_gpa_requirement: null };
    const at = (cgpa: number) => part(computeFit(profile({ cgpa }), noMinimum, fitContext), "academics");
    expect(at(3.8)).toMatchObject({ points: 35, scored: true });
    expect(at(2.9)?.points).toBe(18); // (2.9 − 2.0) / 1.8 × 35 = 17.5
    expect(at(3.5)!.points).toBeGreaterThan(at(3.0)!.points);
  });

  it("compares CGPA on other scales after converting to 4.0", () => {
    // 3.8 / 5 = 3.04 / 4 → just above the 3.0 minimum
    const r = fit(profile({ cgpa: 3.8, cgpa_scale: 5 }));
    expect(r.eligible).toBe(true);
    expect(part(r, "academics")?.points).toBe(19);
  });

  it("caps the English bonus at 8 and counts MOI-only as 12", () => {
    expect(part(fit(profile({ english_score: 9 })), "english")?.points).toBe(20);
    expect(part(fit(profile({ english_score: 6.0 })), "english")?.points).toBe(12);
    const moi = fit(profile({ english_test: null, english_score: null, has_moi: true }));
    expect(part(moi, "english")?.points).toBe(FIT_CONFIG.english.moiOnly);
    expect(moi.notes).toContainEqual({ code: "moi_used" });
  });

  it("uses IELTS equivalents for other tests", () => {
    // TOEFL minimum 80 ≈ 6.5, 95 ≈ 7.0 → one half band
    expect(part(fit(profile({ english_test: "toefl_ibt", english_score: 95 })), "english")?.points).toBe(16);
    expect(ieltsEquivalent("toefl_ibt", 94)).toBe(7);
    expect(ieltsEquivalent("duolingo", 110)).toBe(6.5);
    expect(scoreForBand("toefl_ibt", 7)).toBe(94);
    expect(scoreForBand("ielts", 7)).toBe(7);
    expect(scoreForBand("ielts", 9.5)).toBeNull();
  });

  it("scores field relevance 25 same subject, 18 same area, 12 listed in another area", () => {
    expect(part(fit(profile({ field: "cse" })), "field")?.points).toBe(25);
    expect(part(fit(profile({ field: "data-science" })), "field")?.points).toBe(18); // computing, like CSE
    expect(part(fit(profile({ field: "eee" })), "field")?.points).toBe(12); // engineering, listed as related
    // Same area counts even when the program doesn't list the degree (CSE graduate → AI master's).
    const ai = { ...milanCS, field: "ai", related_bachelor_fields: [] };
    expect(part(computeFit(profile({ field: "cse" }), ai, { ...fitContext, fieldGroups: { ...fitContext.fieldGroups, ai: "computing" } }), "field")?.points).toBe(18);
  });

  it("gives 1 point per 2 months of experience (max 8) and +4 for research", () => {
    expect(part(fit(profile({ experience_months: 5 })), "experience")?.points).toBe(2);
    expect(part(fit(profile({ experience_months: 40 })), "experience")?.points).toBe(8);
    expect(part(fit(profile({ experience_months: 40, research: true })), "experience")?.points).toBe(12);
  });

  it("counts only relevant extras, 2 each, max 8", () => {
    const relevant = fit(profile({ certificates: [item("computing"), item("general")], extracurriculars: [item("general", "leadership")] }));
    expect(part(relevant, "extras")?.points).toBe(6);
    expect(part(fit(profile({ certificates: [item("business"), item("health")] })), "extras")?.points).toBe(0);
    expect(part(fit(profile({ certificates: Array(8).fill(item("general")) })), "extras")?.points).toBe(8);
  });

  it("reaches exactly 100 for a profile that maxes every part", () => {
    const best = profile({ cgpa: 4, english_score: 8.5, experience_months: 30, research: true, certificates: Array(5).fill(item("general")) });
    const r = fit(best);
    expect(r.eligible && r.score).toBe(100);
    expect(r.eligible && r.band).toBe("strong");
  });

  it("uses the bands 80+ Strong, 60–79 Good, 40–59 Possible, below 40 Weak", () => {
    expect([100, 80, 79, 60, 59, 40, 39, 0].map(bandFor)).toEqual(["strong", "strong", "good", "good", "possible", "possible", "weak", "weak"]);
  });
});

describe("eligibility gate (BRIEF.md step 1)", () => {
  it("rejects a 3-year bachelor's where the program doesn't accept it", () => {
    const r = fit(profile({ degree_years: 3 }), berlinCS);
    expect(r.eligible).toBe(false);
    expect(codes(r)).toEqual(["three_year_not_accepted"]);
    expect(fit(profile({ degree_years: 3 }), milanCS).eligible).toBe(true);
  });

  it("rejects a field that isn't in related_bachelor_fields", () => {
    expect(codes(fit(profile({ field: "business" })))).toEqual(["field_not_related"]);
  });

  it("needs an English score that meets the minimum, unless MOI is held and accepted", () => {
    expect(codes(fit(profile({ english_test: null, english_score: null })))).toEqual(["english_missing"]);
    expect(codes(fit(profile({ english_score: 5.5 })))).toEqual(["english_below_minimum"]);
    expect(fit(profile({ english_score: 5.5, has_moi: true })).eligible).toBe(true);
    // Berlin doesn't accept MOI
    expect(codes(fit(profile({ english_test: null, english_score: null, has_moi: true }), berlinCS))).toEqual(["english_missing"]);
  });

  it("rejects a test the program doesn't list", () => {
    const r = fit(profile({ english_test: "duolingo", english_score: 150 }), berlinCS);
    expect(codes(r)).toEqual(["english_test_not_accepted"]);
    expect(!r.eligible && r.reasons[0]?.params?.accepted).toBe("ielts,toefl_ibt");
  });

  it("rejects a CGPA below the minimum after converting scales, and a missing CGPA", () => {
    expect(codes(fit(profile({ cgpa: 2.9 })))).toEqual(["grade_below_minimum"]);
    expect(codes(fit(profile({ cgpa: 3.1 }), berlinCS))).toEqual(["grade_below_minimum"]); // German 2.3 ≈ 3.2/4
    expect(codes(fit(profile({ cgpa: 3.9, cgpa_scale: 5 }), berlinCS))).toEqual(["grade_below_minimum"]); // 3.12/4
    expect(codes(fit(profile({ cgpa: null })))).toEqual(["grade_missing"]);
  });

  it("lists every failing reason, not just the first", () => {
    const r = fit(profile({ degree_years: 3, field: "business", english_test: null, english_score: null, cgpa: 2.5 }), berlinCS);
    expect(codes(r)).toEqual(["three_year_not_accepted", "field_not_related", "english_missing", "grade_below_minimum"]);
  });

  it("rejects programs that aren't open to Bangladeshi citizens", () => {
    const closed = program("sumu-ma-english-and-american-studies");
    expect(codes(fit(profile({ field: "english-humanities" }), closed))).toEqual(["not_open_to_bd"]);
  });

  it("asks for a bachelor's degree before a master's", () => {
    expect(codes(fit(profile({ field: "hsc-science", degree_type: "hsc-science", cgpa: null }), milanCS))).toEqual(["needs_bachelor"]);
  });
});

describe("bachelor's programs", () => {
  const debrecenBsc = program("sud-bsc-computer-science"); // HSC Science, min HSC GPA 3.0/5
  const hscStudent = profile({ degree_type: "hsc-science", degree_years: 2, field: "hsc-science", cgpa: null, hsc_gpa: 4.5, experience_months: 0 });

  it("checks the HSC stream and HSC GPA", () => {
    const r = fit(hscStudent, debrecenBsc);
    expect(r.eligible).toBe(true);
    // HSC 4.5/5 = 3.6/4 vs 2.4/4 → full academics 35; IELTS 6.5 vs 6.0 → 16; listed stream → 25
    expect(r.eligible && r.score).toBe(76);
    expect(codes(fit({ ...hscStudent, field: "hsc-humanities" }, debrecenBsc))).toEqual(["field_not_related"]);
    expect(codes(fit({ ...hscStudent, hsc_gpa: 2.5 }, debrecenBsc))).toEqual(["grade_below_minimum"]);
  });

  it("notes the extra year where HSC alone usually isn't enough (score unchanged)", () => {
    const inGermany = { ...debrecenBsc, country: { slug: "germany" } };
    const ctx = { ...fitContext, hscExtraYear: ["germany"] };
    const r = computeFit(hscStudent, inGermany, ctx);
    expect(r.notes).toContainEqual({ code: "hsc_extra_year" });
    expect(r.eligible && r.score).toBe(76);
    expect(computeFit(hscStudent, { ...debrecenBsc, country: { slug: "hungary" } }, ctx).notes).not.toContainEqual({ code: "hsc_extra_year" });
  });
});

describe("programs not taught in English", () => {
  it("doesn't score English, rescales to 100 and shows the language requirement", () => {
    const german = program("stub-msc-mechanical-engineering-german");
    const r = fit(profile({ field: "mechanical", english_test: null, english_score: null }), german);
    expect(r.eligible).toBe(true);
    if (!r.eligible) return;
    expect(part(r, "english")?.scored).toBe(false);
    expect(r.score).toBe(75); // (29 + 25 + 6 + 0) / 80 = 75
    expect(r.notes).toContainEqual({ code: "language_requirement", requirement: "German at C1 level" });
    expect(r.notes).toContainEqual({ code: "english_not_scored" });
  });
});

describe("every sample program", () => {
  it("gives a score from 0 to 100 or reasons, never both", () => {
    const people = [profile(), profile({ degree_years: 3, has_moi: true }), profile({ field: "hsc-science", cgpa: null, hsc_gpa: 4.2 })];
    for (const prog of allPrograms) {
      for (const p of people) {
        const r = computeFit(p, prog, fitContext);
        if (r.eligible) {
          expect(r.score, prog.slug).toBeGreaterThanOrEqual(0);
          expect(r.score, prog.slug).toBeLessThanOrEqual(100);
        } else {
          expect(r.reasons.length, prog.slug).toBeGreaterThan(0);
        }
      }
    }
  });

  it("agrees between the gate and computeFit", () => {
    for (const prog of allPrograms) {
      expect(computeFit(profile(), prog, fitContext).eligible, prog.slug).toBe(eligibilityGate(profile(), prog).length === 0);
    }
  });
});

describe("improvement tips (BRIEF.md step 3)", () => {
  it("shows IELTS 6.5 → 7.0 as +4 points, then a certificate +2 and experience +2", () => {
    expect(improvementTips(profile(), milanCS, fitContext)).toEqual([
      { kind: "english", test: "ielts", from: 6.5, to: 7, gain: 4 },
      { kind: "certificate", gain: 2 },
      { kind: "experience", fromMonths: 12, toMonths: 18, gain: 2 },
    ]);
  });

  it("drops changes that add nothing", () => {
    const maxed = profile({ english_score: 9, experience_months: 30, certificates: Array(5).fill(item("general")) });
    expect(improvementTips(maxed, milanCS, fitContext)).toEqual([]);
  });

  it("converts the English tip to the student's own test", () => {
    const tips = improvementTips(profile({ english_test: "toefl_ibt", english_score: 85 }), milanCS, fitContext);
    expect(tips[0]).toMatchObject({ kind: "english", test: "toefl_ibt", from: 85, to: 94, gain: 4 });
  });

  it("gives no tips when the profile isn't eligible", () => {
    expect(improvementTips(profile({ field: "business" }), milanCS, fitContext)).toEqual([]);
  });
});

describe("scholarships", () => {
  it("doesn't score need-based scholarships", () => {
    expect(scholarshipFit(profile(), scholarship("sample-italy-regional-study-grant"), milanCS, fitContext)).toEqual({ kind: "need_based" });
  });

  it("weights the evaluated parts ×1.5 for merit scholarships", () => {
    // Milan Excellence evaluates academics and English:
    // (29×1.5 + 16×1.5 + 25 + 6 + 0) / (35×1.5 + 20×1.5 + 25 + 12 + 8) = 98.5 / 127.5 = 77.3 → 77
    const r = scholarshipFit(profile(), scholarship("sample-milan-excellence-scholarship"), milanCS, fitContext);
    expect(r).toEqual({ kind: "scored", score: 77, band: "good", partlyNeedBased: false });
  });

  it("explains when a scholarship can't apply", () => {
    const munichMba = program("mibs-mba-general-management");
    expect(scholarshipFit(profile(), scholarship("sample-munich-leadership-award"), munichMba, fitContext)).toEqual({
      kind: "not_eligible",
      reason: "not_open_to_bd",
    });
    const bachelor = program("sum-bsc-international-economics");
    expect(scholarshipFit(profile(), scholarship("sample-milan-excellence-scholarship"), bachelor, fitContext)).toEqual({
      kind: "not_eligible",
      reason: "level_not_covered",
    });
    expect(scholarshipFit(profile({ field: "business" }), scholarship("sample-milan-excellence-scholarship"), milanCS, fitContext)).toEqual({
      kind: "not_eligible",
      reason: "program_not_eligible",
    });
  });

  it("flags mixed scholarships as partly need-based", () => {
    const budapest = program("subp-msc-computer-science-engineering");
    const r = scholarshipFit(profile(), scholarship("sample-hungary-government-scholarship"), budapest, fitContext);
    expect(r.kind === "scored" && r.partlyNeedBased).toBe(true);
  });
});
