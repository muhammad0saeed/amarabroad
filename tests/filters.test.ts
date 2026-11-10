import { beforeAll, describe, expect, it } from "vitest";
import { listExchangeRates, listProgramContexts } from "@/lib/data";
import {
  activeFilterCount,
  applyFilters,
  compareQuery,
  facetCounts,
  EMPTY_FILTERS,
  parseCompareIds,
  parseFilters,
  serializeFilters,
  type ProgramFilters,
} from "@/lib/filters";
import { rateTable } from "@/lib/money";
import { nextDeadline, summarizeProgram, type ProgramSummary } from "@/lib/summary";

const TODAY = "2026-11-04";
let all: ProgramSummary[];
const run = (f: Partial<ProgramFilters>) => applyFilters(all, { ...EMPTY_FILTERS, ...f }, { today: TODAY });

beforeAll(async () => {
  const rates = rateTable(await listExchangeRates());
  all = (await listProgramContexts()).map((ctx) => summarizeProgram(ctx, rates));
});

describe("URL filter state", () => {
  it("round-trips through the URL", () => {
    const filters: ProgramFilters = {
      ...EMPTY_FILTERS,
      q: "computer",
      countries: ["italy", "hungary"],
      level: "master",
      maxBudgetLakh: 40,
      accepts3yr: true,
      moi: true,
      intakeMonths: [9],
      sort: "cost_low",
    };
    const query = serializeFilters(filters);
    expect(query).toBe("q=computer&country=italy%2Chungary&level=master&intake=9&budget=40&3yr=1&moi=1&sort=cost_low");
    expect(parseFilters(new URLSearchParams(query))).toEqual(filters);
  });

  it("leaves defaults out and ignores bad values", () => {
    expect(serializeFilters(EMPTY_FILTERS)).toBe("");
    expect(parseFilters(new URLSearchParams("level=phd&sort=random&budget=-5&intake=13,0,2&lang=fr,de"))).toEqual({
      ...EMPTY_FILTERS,
      intakeMonths: [2],
      languages: ["de"],
    });
  });

  it("counts active filters", () => {
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0);
    expect(activeFilterCount({ ...EMPTY_FILTERS, q: "x", countries: ["italy"], moi: true, maxBudgetLakh: 30 })).toBe(3);
  });
});

describe("filtering", () => {
  it("combines country + budget + accepts 3-year + MOI", () => {
    const results = run({ countries: ["italy", "hungary"], maxBudgetLakh: 40, accepts3yr: true, moi: true });
    expect(results.length).toBeGreaterThan(0);
    for (const p of results) {
      expect(["italy", "hungary"]).toContain(p.country.slug);
      expect(p.total_bdt).toBeLessThanOrEqual(40e5);
      expect(p.accepts_3yr_bachelor && p.accepts_moi).toBe(true);
    }
    // Everything that qualifies is included
    const expected = all.filter(
      (p) => ["italy", "hungary"].includes(p.country.slug) && p.total_bdt! <= 40e5 && p.accepts_3yr_bachelor && p.accepts_moi,
    );
    expect(results.map((p) => p.slug).sort()).toEqual(expected.map((p) => p.slug).sort());
    expect(results.map((p) => p.slug)).not.toContain("stub-msc-computer-science");
  });

  it("finds tuition-free programs only in Germany's public universities", () => {
    const free = run({ tuitionFree: true });
    expect(free.length).toBeGreaterThan(0);
    expect(new Set(free.map((p) => p.country.slug))).toEqual(new Set(["germany"]));
    expect(free.every((p) => p.university.type === "public")).toBe(true);
  });

  it("filters by level, field, language, intake month, provisional and BD eligibility", () => {
    expect(run({ level: "bachelor" }).every((p) => p.degree_level === "bachelor")).toBe(true);
    expect(run({ fields: ["cse"] }).every((p) => p.field === "cse")).toBe(true);
    expect(run({ languages: ["de"] }).map((p) => p.slug)).toEqual(["stub-msc-mechanical-engineering-german"]);
    expect(run({ intakeMonths: [2] }).every((p) => p.intakes.some((i) => i.month === 2))).toBe(true);
    expect(run({ provisional: true }).every((p) => p.accepts_provisional)).toBe(true);
    expect(run({ bdOpen: true }).map((p) => p.slug)).not.toContain("sumu-ma-english-and-american-studies");
  });

  it("matches search words against titles, universities, cities and fields", () => {
    expect(run({ q: "berlin data" }).map((p) => p.slug)).toEqual(["stub-msc-data-science"]);
    expect(run({ q: "বুদাপেস্ট" }).every((p) => p.city.slug === "budapest")).toBe(true);
    expect(applyFilters(all, { ...EMPTY_FILTERS, q: "computer science" }, { today: TODAY, fieldNames: { cse: ["Computer Science & Engineering"] } }).length).toBeGreaterThan(3);
  });

  it("returns everything with no filters", () => {
    expect(run({})).toHaveLength(42);
  });
});

describe("sorting", () => {
  it("sorts by total cost", () => {
    const low = run({ sort: "cost_low" }).map((p) => p.total_bdt);
    expect(low).toEqual([...low].sort((a, b) => a! - b!));
    expect(run({ sort: "cost_high" })[0]?.total_bdt).toBe(Math.max(...low.map(Number)));
  });

  it("sorts by next open deadline, closed intakes last", () => {
    const sorted = run({ sort: "deadline" });
    const deadlines = sorted.map((p) => nextDeadline(p.intakes, TODAY)?.deadline ?? "closed");
    expect(deadlines[0]).toBe("2026-11-30");
    expect(deadlines.filter((d) => d !== "closed")).toEqual(deadlines.filter((d) => d !== "closed").sort());
  });

  it("skips passed deadlines when finding the next one", () => {
    const dataScience = all.find((p) => p.slug === "sum-msc-data-science-and-economics")!;
    expect(nextDeadline(dataScience.intakes, TODAY)?.deadline).toBe("2027-02-28"); // the 2026-10-15 one has passed
    expect(nextDeadline(dataScience.intakes, "2027-03-01")).toBeNull();
  });
});

describe("compare links", () => {
  it("keeps up to 4 unique programs", () => {
    expect(parseCompareIds(new URLSearchParams("ids=a,b,a,c,d,e"))).toEqual(["a", "b", "c", "d"]);
    expect(compareQuery(["a", "b", "b"])).toBe("ids=a%2Cb");
    expect(parseCompareIds(new URLSearchParams(compareQuery(["x", "y"])))).toEqual(["x", "y"]);
  });
});

describe("new filters", () => {
  it("round-trips the new keys through the URL", () => {
    const filters: ProgramFilters = {
      ...EMPTY_FILTERS,
      universities: ["sample-university-of-milan"],
      universityTypes: ["public"],
      fieldGroups: ["computing"],
      durations: ["2y"],
      maxTuitionLakh: 10,
      deadline: "open",
      englishTests: ["ielts"],
      maxIelts: 6.5,
      scholarship: true,
      seatsPublished: true,
      page: 3,
    };
    expect(parseFilters(new URLSearchParams(serializeFilters(filters)))).toEqual(filters);
    expect(parseFilters(new URLSearchParams("type=state&area=magic&dur=9y&deadline=never&page=-2"))).toEqual(EMPTY_FILTERS);
  });

  it("filters by university, type, tuition, duration, deadline and IELTS", () => {
    expect(run({ universities: ["sample-university-of-milan"] }).every((p) => p.university.slug === "sample-university-of-milan")).toBe(true);
    expect(run({ universityTypes: ["private"] }).every((p) => p.university.type === "private")).toBe(true);
    expect(run({ maxTuitionLakh: 5 }).every((p) => p.tuition_per_year_bdt! <= 5e5)).toBe(true);
    expect(run({ durations: ["1y"] }).every((p) => p.duration_months! <= 12)).toBe(true);
    expect(run({ deadline: "open" }).every((p) => nextDeadline(p.intakes, TODAY) !== null)).toBe(true);
    const ielts = run({ maxIelts: 6 });
    expect(ielts.length).toBeGreaterThan(0);
    expect(ielts.every((p) => (p.english_tests.find((t) => t.test === "ielts")?.min_score ?? 99) <= 6)).toBe(true);
  });

  it("counts each option with every other filter applied", () => {
    const f = { ...EMPTY_FILTERS, countries: ["italy"], level: "master" as const };
    const counts = facetCounts(all, f, { today: TODAY });
    // Country counts ignore the country filter itself, so other countries still show what they'd add
    expect(counts.countries.germany).toBe(all.filter((p) => p.country.slug === "germany" && p.degree_level === "master").length);
    expect(counts.levels.bachelor).toBe(all.filter((p) => p.country.slug === "italy" && p.degree_level === "bachelor").length);
    expect(counts.flags.moi).toBe(run(f).filter((p) => p.accepts_moi).length);
    expect(counts.budget["40"]).toBe(run(f).filter((p) => p.total_bdt! <= 40e5).length);
  });
});

describe("when the next round is expected", () => {
  it("moves the latest passed deadline on to next year, and says nothing while an intake is open", async () => {
    const { expectedNextRound } = await import("@/lib/summary");
    const today = "2026-11-10";
    expect(expectedNextRound([{ month: 10, year: 2026, deadline: "2026-07-15" }, { month: 4, year: 2026, deadline: "2026-01-15" }], today)).toEqual({ month: 7, year: 2027 });
    expect(expectedNextRound([{ month: 10, year: 2025, deadline: "2025-03-01" }], today)).toEqual({ month: 3, year: 2027 });
    expect(expectedNextRound([{ month: 9, year: 2027, deadline: "2027-01-15" }], today)).toBeNull();
    expect(expectedNextRound([], today)).toBeNull();
  });
});
