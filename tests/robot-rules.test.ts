import { describe, expect, it } from "vitest";
import { pageMeta } from "@/robot/clean";
import { amountsIn, datesIn, parseNumber, programTitle, readFacts, resolveYear, subjectOf } from "@/robot/rules";
import { pickProgramPages } from "@/robot/discover";

const TODAY = "2026-11-05";

describe("reading numbers, money and dates", () => {
  it("understands thousands separators and decimals", () => {
    expect(parseNumber("6.000")).toBe(6000);
    expect(parseNumber("6,000")).toBe(6000);
    expect(parseNumber("1.500,50")).toBe(1500.5);
    expect(parseNumber("97.00")).toBe(97);
    expect(parseNumber("6 500")).toBe(6500);
  });

  it("finds amounts with their currency, before or after the number", () => {
    expect(amountsIn("6,000 euros per semester")[0]).toMatchObject({ amount: 6000, currency: "EUR" });
    expect(amountsIn("Fee: €2,500")[0]).toMatchObject({ amount: 2500, currency: "EUR" });
    expect(amountsIn("Tuition: 3 900 000 HUF / year")[0]).toMatchObject({ amount: 3900000, currency: "HUF" });
    expect(amountsIn("97.00 €")[0]).toMatchObject({ amount: 97, currency: "EUR" });
  });

  it("finds dates in many formats", () => {
    const one = (s: string) => datesIn(s).map((d) => [d.day, d.month, d.year]);
    expect(one("Winter semester: 01.02. – 31.05.")).toEqual([[1, 2, null], [31, 5, null]]);
    expect(one("Apply by 15 January 2027")).toEqual([[15, 1, 2027]]);
    expect(one("Deadline: March 1st, 2027")).toEqual([[1, 3, 2027]]);
    expect(one("Bewerbungsschluss: 15. Juli")).toEqual([[15, 7, null]]);
    expect(one("scadenza 2027-04-30")).toEqual([[30, 4, 2027]]);
    expect(one("Határidő: 2027. február 15.")).toEqual([[15, 2, 2027]]);
    expect(one("IELTS 6.5 and 120 ECTS")).toEqual([]);
  });

  it("gives a year-less date the next year it's still ahead", () => {
    expect(resolveYear({ day: 31, month: 5, year: null, index: 0 }, TODAY)).toBe("2027-05-31");
    expect(resolveYear({ day: 30, month: 11, year: null, index: 0 }, TODAY)).toBe("2026-11-30");
  });
});

describe("reading a program page", () => {
  const page = (text: string, html = "<title>Data Science (M.Sc.) | Sample University</title><h1>Data Science</h1>") => ({ url: "https://uni.example/master/data-science", text, meta: pageMeta(html) });

  it("reads a typical English program page", () => {
    const f = readFacts(
      [
        page(`Data Science (M.Sc.)
Duration: 4 semesters
Credits: 120 ECTS
Language of instruction: English
Tuition fees for non-EU students: €1,500 per semester
Semester contribution: 85 € per semester
Application deadline for the winter semester (non-EU applicants): 15 January
Application deadline for the winter semester (EU applicants): 15 July
English: IELTS 6.5 or TOEFL iBT 90
Applicants need a bachelor's degree in computer science, mathematics or statistics with at least 180 ECTS.
Required documents: CV, letter of motivation, transcript of records, passport
You can apply before receiving your degree certificate if you are in your final semester.`),
      ],
      TODAY,
    );
    expect(f.is_program_page).toBe(true);
    expect(f.title).toBe("Data Science (M.Sc.)");
    expect(f.degree_level?.value).toBe("master");
    expect(f.duration_months?.value).toBe(24);
    expect(f.ects_credits?.value).toBe(120);
    expect(f.teaching_language?.value).toBe("en");
    expect(f.tuition).toMatchObject({ amount_per_year: 3000, currency: "EUR", applies_to: "non_eu" });
    expect(f.other_fees_per_year).toMatchObject({ amount: 170 });
    expect(f.intakes).toEqual([expect.objectContaining({ start_month: 10, start_year: 2027, deadline: "2027-01-15", deadline_for: "non_eu" })]);
    expect(f.english_tests.map((t) => [t.test, t.min_score])).toEqual([["ielts", 6.5], ["toefl_ibt", 90]]);
    expect(f.accepts_3yr_bachelor?.value).toBe(true);
    expect(f.accepts_provisional?.value).toBe(true);
    expect(f.required_documents.map((d) => d.key).sort()).toEqual(["cv", "motivation_letter", "passport", "transcript"]);
    expect(f.field_slug).toBe("data-science");
    expect(f.related_bachelor_fields).toEqual(expect.arrayContaining(["cse", "math-physics"]));
  });

  it("reads tuition-free and German-taught programs", () => {
    const f = readFacts([page("Maschinenbau (M.Sc.)\nUnterrichtssprache: Deutsch\nGerman language skills at level C1 (DSH-2) are required.\nThere are no tuition fees.\nRegelstudienzeit: 4 Semester", "<title>Maschinenbau (M.Sc.) - Uni</title>")], TODAY);
    expect(f.tuition).toMatchObject({ amount_per_year: 0 });
    expect(f.teaching_language?.value).toBe("de");
    expect(f.language_requirement?.value).toMatch(/C1|DSH/);
    expect(f.field_slug).toBe("mechanical");
  });

  it("doesn't call a news page a program page", () => {
    const f = readFacts([page("Our master's students won a prize.\nRead more news", "<title>News | Uni</title><h1>News</h1>")], TODAY);
    expect(f.is_program_page).toBe(false);
  });

  it("builds a clean title and maps titles to subjects", () => {
    expect(programTitle(pageMeta("<title>Informatics - Master of Science (M.Sc.) - TUM</title>"))).toBe("Informatics – Master of Science (M.Sc.)");
    expect(subjectOf("MSc Public Health")).toBe("public-health");
    expect(subjectOf("Bachelor in Business Administration")).toBe("business");
    expect(subjectOf("Laurea Magistrale in Ingegneria Civile – Civil Engineering")).toBe("civil");
  });
});

describe("finding program pages", () => {
  it("keeps single-program pages and drops lists, PhDs and modules", () => {
    const urls = [
      "https://u.de/studium/detail/informatics-master-of-science-msc",
      "https://u.de/studium/detail/physics-bachelor-of-science-bsc",
      "https://u.de/studium/detail/geologie-modulstudium-sonstiges",
      "https://u.de/studium/degree-programs",
      "https://u.de/research/phd-program-physics",
      "https://u.de/studium/detail/a-b",
      "https://u.de/studium/detail/c-d",
      "https://u.de/studium/detail/e-f",
    ].map((url) => ({ url, text: "" }));
    expect(pickProgramPages(urls).map((p) => [p.url.split("/").pop(), p.level])).toEqual([
      ["informatics-master-of-science-msc", "master"],
      ["physics-bachelor-of-science-bsc", "bachelor"],
      ["a-b", null],
      ["c-d", null],
      ["e-f", null],
    ]);
  });
});

describe("fixes from the first real run (TU Munich)", () => {
  it("reads a bare 'Standard Duration of Studies: 4' as semesters", () => {
    const f = readFacts([{ url: "https://u.de/x", text: "Standard Duration of Studies\n•\n4\n(fulltime)\nCredits\n120 ECTS", meta: pageMeta("<title>X (M.Sc.) - U</title><h1>X (M.Sc.)</h1>") }], "2026-11-05");
    expect(f.duration_months?.value).toBe(24);
  });

  it("files Electrical Engineering and IT under electrical, Bioinformatics under biotech", () => {
    expect(subjectOf("Electrical Engineering and Information Technology – Bachelor of Science")).toBe("eee");
    expect(subjectOf("Bioinformatics – Bachelor of Science")).toBe("biotechnology");
    expect(subjectOf("Informatics – Master of Science")).toBe("cse");
  });

  it("cleans tracking parameters from official links", async () => {
    const { cleanUrl } = await import("@/robot/clean");
    expect(cleanUrl("https://www.tum.de/en/x?graduation=Bachelor&amp;cHash=cc2e")).toBe("https://www.tum.de/en/x");
    expect(cleanUrl("https://u.edu/index.php?id=4123&utm_source=x")).toBe("https://u.edu/index.php?id=4123");
  });
});

describe("subject from the title, not the degree name", () => {
  it("ignores 'Master of Arts' / 'Master of Science'", () => {
    expect(subjectOf("Responsibility in Science, Engineering and Technology (RESET) – Master of Arts (M.A.)")).toBe("social-sciences");
    expect(subjectOf("English Literature – Master of Arts")).toBe("english-humanities");
    expect(subjectOf("Mathematics – Bachelor of Science (B.Sc.)")).toBe("math-physics");
  });
});
