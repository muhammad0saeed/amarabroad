import { describe, expect, it } from "vitest";
import { isAllowed, parseRobots } from "@/robot/fetch";
import { htmlToText, extractLinks, registrable } from "@/robot/clean";
import { dateInQuote, numberInQuote, numbersIn, planChanges, quoteOnPage, verifyFacts, type ProgramRow } from "@/robot/checks";
import type { ProgramFacts } from "@/robot/facts";

const PAGE = `Standard Duration of Studies
•
4
semesters (fulltime)
Credits
•
120 ECTS
Application Period
Winter semester: 01.02. – 31.05.
Summer semester: 01.10. – 30.11.
Tuition fees for international students: 6.000 € per semester
Required: IELTS Academic 6.5 or TOEFL iBT 88`;

const EMPTY: ProgramFacts = {
  is_program_page: true, title: "M.Sc. Informatics", degree_level: null, duration_months: null, ects_credits: null, teaching_language: null,
  language_requirement: null, tuition: null, other_fees_per_year: null, application_fee: null, intakes: [], english_tests: [], accepts_moi: null,
  accepts_3yr_bachelor: null, accepts_provisional: null, min_grade: null, seats_total: null, seats_non_eu: null, required_documents: [],
  field_slug: null, related_bachelor_fields: [], overview_en: null, career_paths_en: [],
};

describe("quote checks", () => {
  it("finds quotes despite line breaks, bullets and dash styles", () => {
    expect(quoteOnPage("4 semesters (fulltime)", [PAGE])).toBe(true);
    expect(quoteOnPage("Winter semester: 01.02. - 31.05.", [PAGE])).toBe(true);
    expect(quoteOnPage("Winter semester: 01.02. – 30.06.", [PAGE])).toBe(false);
    expect(quoteOnPage("ab", [PAGE])).toBe(false);
  });

  it("reads numbers the way pages write them", () => {
    expect(numbersIn("6.000 € per semester")).toContain(6000);
    expect(numbersIn("€1,500.50 fee")).toContain(1500.5);
    expect(numbersIn("IELTS 6.5")).toContain(6.5);
    expect(numberInQuote(12000, "6.000 € per semester", { perSemester: true })).toBe(true);
    expect(numberInQuote(9000, "6.000 € per semester", { perSemester: true })).toBe(false);
  });

  it("matches dates written as 31.05., 31 May or 2027-05-31", () => {
    expect(dateInQuote("2027-05-31", "Winter semester: 01.02. – 31.05.")).toBe(true);
    expect(dateInQuote("2027-05-31", "Apply by 31 May")).toBe(true);
    expect(dateInQuote("2027-05-31", "Bewerbung bis 31. Mai")).toBe(true);
    expect(dateInQuote("2027-06-30", "Winter semester: 01.02. – 31.05.")).toBe(false);
  });

  it("drops invented facts and keeps verified ones", () => {
    const facts: ProgramFacts = {
      ...EMPTY,
      ects_credits: { value: 120, quote: "120 ECTS" },
      tuition: { amount_per_year: 12000, currency: "EUR", applies_to: "non_eu", quote: "Tuition fees for international students: 6.000 € per semester" },
      intakes: [
        { start_month: 10, start_year: 2027, deadline: "2027-05-31", deadline_for: "all", quote: "Winter semester: 01.02. – 31.05." },
        { start_month: 4, start_year: 2027, deadline: "2027-01-15", deadline_for: "all", quote: "Summer semester: apply by 15 January" },
      ],
      english_tests: [
        { test: "ielts", min_score: 6.5, quote: "IELTS Academic 6.5" },
        { test: "toefl_ibt", min_score: 100, quote: "TOEFL iBT 88" },
      ],
    };
    const { facts: kept, dropped } = verifyFacts(facts, [PAGE]);
    expect(kept.ects_credits?.value).toBe(120);
    expect(kept.tuition?.amount_per_year).toBe(12000);
    expect(kept.intakes.map((i) => i.deadline)).toEqual(["2027-05-31"]);
    expect(kept.english_tests.map((t) => t.test)).toEqual(["ielts"]);
    expect(dropped.map((d) => d.field).sort()).toEqual(["english_tests", "intakes"]);
  });
});

describe("planning changes", () => {
  const OLD: ProgramRow = {
    slug: "x", title: "X", degree_level: "master", field: "cse", related_bachelor_fields: ["cse"], duration_months: 24, ects_credits: 120, language: "en", language_requirement_en: null,
    currency: "EUR", tuition_per_year: 3000, other_fees_per_year: 200, application_fee: 0, intakes: [{ month: 10, year: 2027, deadline: "2027-05-31" }],
    english_tests: [{ test: "ielts", min_score: 6.5 }], accepts_moi: true, accepts_3yr_bachelor: false, accepts_provisional: true,
    min_gpa_requirement: { value: 2.5, scale: 4 }, seats_total: null, seats_non_eu: null, required_documents: [], overview_en: "Existing.", career_paths_en: [],
  };
  const tuition = (amount: number) => ({ ...EMPTY, tuition: { amount_per_year: amount, currency: "EUR", applies_to: "non_eu" as const, quote: "q" } });

  it("applies a normal change and leaves unchanged values alone", () => {
    const changes = planChanges(OLD, { ...tuition(3500), ects_credits: { value: 120, quote: "120 ECTS" } }, "2026-11-05");
    expect(changes).toEqual([{ field: "tuition_per_year", oldValue: 3000, newValue: 3500, evidence: "q", hold: null }]);
  });

  it("holds big jumps, tuition-free flips and eligibility flips", () => {
    expect(planChanges(OLD, tuition(12000), "2026-11-05")[0]?.hold).toMatch(/moved/);
    expect(planChanges(OLD, tuition(0), "2026-11-05")[0]?.hold).toMatch(/tuition-free/);
    expect(planChanges(OLD, { ...EMPTY, accepts_moi: { value: false, quote: "q" } }, "2026-11-05")[0]?.hold).toMatch(/flipped/);
  });

  it("holds deadlines that already passed and odd scores", () => {
    const past = planChanges(OLD, { ...EMPTY, intakes: [{ start_month: 10, start_year: 2026, deadline: "2026-05-31", deadline_for: "all", quote: "q" }] }, "2026-11-05");
    expect(past[0]?.hold).toMatch(/past/);
    expect(planChanges(OLD, { ...EMPTY, english_tests: [{ test: "ielts", min_score: 65, quote: "q" }] }, "2026-11-05")[0]?.hold).toMatch(/looks wrong/);
  });

  it("never wipes a value the page doesn't mention, and doesn't overwrite our summary", () => {
    expect(planChanges(OLD, { ...EMPTY, overview_en: "New summary" }, "2026-11-05")).toEqual([]);
  });

  it("never overwrites a field an admin set by hand, but tells them the page disagrees", () => {
    const locked = { ...OLD, locked_fields: ["tuition_per_year", "currency"] };
    const c = planChanges(locked, tuition(3500), "2026-11-05");
    expect(c).toEqual([{ field: "tuition_per_year", oldValue: 3000, newValue: 3500, evidence: "q", hold: expect.stringMatching(/by hand/) }]);
    // The page agreeing with the admin is no change at all.
    expect(planChanges(locked, tuition(3000), "2026-11-05")).toEqual([]);
    // Unlocked fields still update.
    expect(planChanges(locked, { ...EMPTY, ects_credits: { value: 90, quote: "90 ECTS" } }, "2026-11-05")[0]?.hold).toBeNull();
  });

  it("holds grades on scales the app can't compare yet", () => {
    const c = planChanges(OLD, { ...EMPTY, min_grade: { value: 2.5, scale: 1, note: "German grade 2.5", quote: "q" } }, "2026-11-05");
    expect(c[0]?.hold).toMatch(/converting/);
  });
});

describe("polite fetching and cleaning", () => {
  it("obeys robots.txt (longest rule wins, our own group first)", () => {
    const rules = parseRobots("User-agent: *\nDisallow: /intern/\nAllow: /intern/public\n\nUser-agent: SomeOtherBot\nDisallow: /");
    expect(isAllowed(rules, "/studies/master")).toBe(true);
    expect(isAllowed(rules, "/intern/secret")).toBe(false);
    expect(isAllowed(rules, "/intern/public/page")).toBe(true);
    expect(isAllowed(parseRobots("User-agent: amarAbroadBot\nDisallow: /\n\nUser-agent: *\nAllow: /"), "/x")).toBe(false);
    expect(isAllowed(parseRobots("User-agent: *\nDisallow: /*.pdf$"), "/fees.pdf")).toBe(false);
  });

  it("turns HTML into readable text and keeps same-site links", () => {
    const html = `<html><head><title>T</title><script>var x=1</script></head><body><nav>Menu</nav>
      <div class="cookie-banner">We use cookies</div><h2>Fees</h2><p>Tuition: 6.000&nbsp;&euro; per semester</p>
      <table><tr><td>IELTS</td><td>6.5</td></tr></table>
      <a href="/en/fees#top">Fees page</a><a href="https://admissions.uni.de/x">Apply</a><a href="https://other.org">Other</a></body></html>`;
    const text = htmlToText(html);
    expect(text).toContain("Tuition: 6.000 € per semester");
    expect(text).toContain("IELTS | 6.5");
    expect(text).not.toMatch(/Menu|cookies|var x/);
    expect(extractLinks(html, "https://www.uni.de/en/master").map((l) => l.url)).toEqual(["https://www.uni.de/en/fees", "https://admissions.uni.de/x"]);
    expect(registrable("www.ox.ac.uk")).toBe("ox.ac.uk");
  });
});

describe("comparing with what the database returns", () => {
  it("doesn't log a change when only the key order differs", async () => {
    const { planChanges } = await import("@/robot/checks");
    const old = { slug: "x", title: "X", degree_level: "master", field: "cse", related_bachelor_fields: [], duration_months: 24, ects_credits: 120, language: "en", language_requirement_en: null, currency: "EUR", tuition_per_year: 3000, other_fees_per_year: 0, application_fee: 0,
      intakes: [JSON.parse('{"year":2027,"month":10,"deadline":"2027-05-31"}')], english_tests: [], accepts_moi: false, accepts_3yr_bachelor: false, accepts_provisional: false, min_gpa_requirement: null, seats_total: null, seats_non_eu: null, required_documents: [], overview_en: "x", career_paths_en: [] } as const;
    const facts = { ...(await import("@/robot/facts")).EMPTY_FACTS, intakes: [{ start_month: 10, start_year: 2027, deadline: "2027-05-31", deadline_for: "all" as const, quote: "q" }] };
    expect(planChanges(old as never, facts, "2026-11-05")).toEqual([]);
  });
});
