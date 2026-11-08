// The cross-checker: compares what a program's own page says with what the university's general pages
// say (two robots reading different pages). Agreement is shown as "confirmed by 2 sources"; a big
// difference is flagged for a person, with both sentences. Only clear cases count: when a general page
// lists several different amounts for the same level, nothing is concluded.

export interface GeneralFact {
  field: string;
  level: "bachelor" | "master" | null;
  value: Record<string, unknown>;
  quote: string;
  source_url: string;
}

export interface CheckedProgram {
  degree_level: "bachelor" | "master";
  tuition_per_year: number | null;
  currency: string | null;
  english_tests: { test: string; min_score: number }[];
}

export interface CrossCheck {
  field: "tuition" | "ielts";
  status: "agree" | "conflict";
  /** The program page's value and the general page's value, as plain numbers. */
  programValue: number;
  generalValue: number;
  currency?: string;
  generalQuote: string;
  generalUrl: string;
}

/** Tuition within 10% agrees; 30% or more apart is a conflict; in between says nothing. */
export const TUITION_AGREE = 0.1;
export const TUITION_CONFLICT = 0.3;

/** General-page facts for the program's level (or for both levels), leaving out pages that list several values. */
function forLevel(facts: GeneralFact[], field: string, level: CheckedProgram["degree_level"]) {
  const usable = facts.filter((f) => f.field === field && !f.value.varies);
  const same = usable.filter((f) => f.level === level);
  return same.length ? same : usable.filter((f) => f.level === null);
}

export function crossCheck(p: CheckedProgram, facts: GeneralFact[]): CrossCheck[] {
  const out: CrossCheck[] = [];

  if (p.tuition_per_year !== null && p.tuition_per_year > 0 && p.currency) {
    const general = forLevel(facts, "tuition", p.degree_level).filter(
      (f) => f.value.currency === p.currency && f.value.applies_to !== "eu" && typeof f.value.amount_per_year === "number",
    );
    const amounts = [...new Set(general.map((f) => f.value.amount_per_year as number))];
    if (amounts.length === 1) {
      const g = amounts[0]!;
      const gap = Math.abs(g - p.tuition_per_year) / Math.max(g, p.tuition_per_year);
      const status = gap <= TUITION_AGREE ? "agree" : gap >= TUITION_CONFLICT ? "conflict" : null;
      if (status) out.push({ field: "tuition", status, programValue: p.tuition_per_year, generalValue: g, currency: p.currency, generalQuote: general[0]!.quote, generalUrl: general[0]!.source_url });
    }
  }

  const ielts = p.english_tests.find((t) => t.test === "ielts")?.min_score;
  if (ielts !== undefined) {
    const general = forLevel(facts, "english", p.degree_level).filter((f) => f.value.test === "ielts" && typeof f.value.min_score === "number");
    const scores = [...new Set(general.map((f) => f.value.min_score as number))];
    if (scores.length === 1) {
      const g = scores[0]!;
      // Programs often ask for more than the university minimum (that's normal); asking for less is odd.
      const status = g === ielts ? "agree" : ielts <= g - 0.5 ? "conflict" : null;
      if (status) out.push({ field: "ielts", status, programValue: ielts, generalValue: g, generalQuote: general[0]!.quote, generalUrl: general[0]!.source_url });
    }
  }
  return out;
}
