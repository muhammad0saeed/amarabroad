import { describe, expect, it } from "vitest";
import { buildICS, escapeICS, foldLine, icsFileName } from "@/lib/ics";
import { isFallback, localizeDigits, pick, pickList } from "@/lib/localize";
import { isValid, validateOutcome, validateProblem, validateWrongInfo, type OutcomeForm } from "@/lib/validation";

describe(".ics calendar file", () => {
  const ics = buildICS(
    {
      uid: "scholarship-sample-milan-excellence-scholarship@amarabroad",
      title: "Deadline: Sample Milan Excellence Scholarship",
      description: "Check the official page, then apply; amounts may change.",
      url: "https://example.org/sample/scholarships/sample-milan-excellence-scholarship",
      date: "2026-11-25",
    },
    new Date("2026-11-04T10:15:30.123Z"),
  );
  const lines = ics.split("\r\n");

  it("is a valid all-day event with CRLF line endings", () => {
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "")).not.toMatch(/\n/);
    expect(lines).toContain("DTSTART;VALUE=DATE:20261125");
    expect(lines).toContain("DTEND;VALUE=DATE:20261126");
    expect(lines).toContain("DTSTAMP:20261104T101530Z");
    expect(lines.filter((l) => l === "BEGIN:VALARM")).toHaveLength(2);
    expect(lines).toContain("TRIGGER:-P7D");
    expect(lines).toContain("TRIGGER:-P1D");
  });

  it("escapes text and folds long lines at 75 bytes", () => {
    expect(escapeICS("a, b; c\\d\ne")).toBe("a\\, b\\; c\\\\d\\ne");
    const folded = foldLine("DESCRIPTION:" + "বাংলা ".repeat(30));
    for (const line of folded.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(folded.split("\r\n").slice(1).every((l) => l.startsWith(" "))).toBe(true);
    expect(icsFileName("sample-x")).toBe("sample-x-deadline.ics");
  });
});

describe("form validation", () => {
  it("validates report-wrong-info", () => {
    expect(validateWrongInfo({ topic: "", correction: "short", sourceUrl: "not a url", email: "x@" })).toEqual({
      topic: "required",
      correction: "too_short",
      sourceUrl: "invalid_url",
      email: "invalid_email",
    });
    expect(isValid(validateWrongInfo({ topic: "deadline", correction: "The deadline moved to 15 March.", sourceUrl: "", email: "" }))).toBe(true);
  });

  it("validates report-a-problem", () => {
    expect(validateProblem({ type: "virus", description: "", email: "" })).toEqual({ type: "invalid_choice", description: "required" });
    expect(isValid(validateProblem({ type: "bug", description: "The compare page is blank on my phone.", email: "me@example.com" }))).toBe(true);
  });

  it("validates share-your-result", () => {
    const ok: OutcomeForm = {
      intake: "2027-09",
      result: "admitted",
      cgpa: "3.4",
      cgpaScale: "4",
      degree: "B.Sc. in CSE",
      universityType: "public",
      englishTest: "ielts",
      englishScore: "6.5",
      experienceMonths: "",
      tips: "",
    };
    expect(isValid(validateOutcome(ok))).toBe(true);
    expect(validateOutcome({ ...ok, intake: "Sept 2027", cgpa: "4.5", englishScore: "10" })).toEqual({
      intake: "invalid_choice",
      cgpa: "out_of_range",
      englishScore: "out_of_range",
    });
    expect(isValid(validateOutcome({ ...ok, englishTest: "moi", englishScore: "" }))).toBe(true);
    expect(validateOutcome({ ...ok, cgpaScale: "5", cgpa: "4.5" })).toEqual({});
  });
});

describe("language helpers", () => {
  const country = { overview_en: "English text", overview_bn: "বাংলা লেখা" };
  const englishOnly = { overview_en: "English text" };

  it("picks Bangla when present and falls back to English", () => {
    expect(pick(country, "overview", "bn")).toBe("বাংলা লেখা");
    expect(pick(country, "overview", "en")).toBe("English text");
    expect(pick(englishOnly, "overview", "bn")).toBe("English text");
    expect(isFallback(englishOnly, "overview", "bn")).toBe(true);
    expect(isFallback(country, "overview", "bn")).toBe(false);
    expect(pickList(["a", "b"], ["ক", "খ"], "bn")).toEqual(["ক", "খ"]);
    expect(pickList(["a", "b"], ["ক"], "bn")).toEqual(["a", "b"]);
  });

  it("writes Bangla digits", () => {
    expect(localizeDigits("2027-09-01", "bn")).toBe("২০২৭-০৯-০১");
    expect(localizeDigits("2027", "en")).toBe("2027");
  });
});
