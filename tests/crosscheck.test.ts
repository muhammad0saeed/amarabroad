import { describe, expect, it } from "vitest";
import { crossCheck, type GeneralFact } from "@/lib/crosscheck";

const program = { degree_level: "master" as const, tuition_per_year: 3000, currency: "EUR", english_tests: [{ test: "ielts", min_score: 6.5 }] };
const fact = (field: string, value: Record<string, unknown>, level: GeneralFact["level"] = null): GeneralFact => ({ field, level, value, quote: "q", source_url: "https://uni.example/fees" });

describe("cross-checking two robots' readings", () => {
  it("agrees when tuition is within 10% and IELTS is the same", () => {
    const r = crossCheck(program, [fact("tuition", { amount_per_year: 3000, currency: "EUR", applies_to: "non_eu" }), fact("english", { test: "ielts", min_score: 6.5 })]);
    expect(r.map((c) => `${c.field}:${c.status}`)).toEqual(["tuition:agree", "ielts:agree"]);
  });

  it("flags tuition 30% or more apart and an IELTS minimum below the university's", () => {
    const r = crossCheck({ ...program, english_tests: [{ test: "ielts", min_score: 5.5 }] }, [
      fact("tuition", { amount_per_year: 12000, currency: "EUR", applies_to: "non_eu" }),
      fact("english", { test: "ielts", min_score: 6.5 }),
    ]);
    expect(r.map((c) => `${c.field}:${c.status}`)).toEqual(["tuition:conflict", "ielts:conflict"]);
  });

  it("says nothing in unclear cases", () => {
    // Several amounts on the general page, another currency, EU-only fees, a program asking more IELTS, 20% apart.
    expect(crossCheck(program, [fact("tuition", { amount_per_year: 3000, currency: "EUR" }), fact("tuition", { amount_per_year: 9000, currency: "EUR" })])).toEqual([]);
    expect(crossCheck(program, [fact("tuition", { amount_per_year: 9000, currency: "USD" })])).toEqual([]);
    expect(crossCheck(program, [fact("tuition", { amount_per_year: 9000, currency: "EUR", applies_to: "eu" })])).toEqual([]);
    expect(crossCheck({ ...program, english_tests: [{ test: "ielts", min_score: 7 }] }, [fact("english", { test: "ielts", min_score: 6.5 })])).toEqual([]);
    expect(crossCheck({ ...program, tuition_per_year: 3600 }, [fact("tuition", { amount_per_year: 3000, currency: "EUR" })])).toEqual([]);
    // A page that lists several IELTS scores (by subject) has no single rule.
    expect(crossCheck({ ...program, english_tests: [{ test: "ielts", min_score: 6 }] }, [fact("english", { test: "ielts", min_score: 7, varies: true })])).toEqual([]);
  });

  it("prefers the general page for the program's own level", () => {
    const r = crossCheck(program, [fact("tuition", { amount_per_year: 3000, currency: "EUR" }, "master"), fact("tuition", { amount_per_year: 20000, currency: "EUR" }, "bachelor")]);
    expect(r[0]?.status).toBe("agree");
  });
});
