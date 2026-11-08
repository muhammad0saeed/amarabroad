import { describe, expect, it } from "vitest";
import { lastClosing, nextDeadline, readRound, SCHOLARSHIPS } from "../robot/scholarships.ts";

const TODAY = "2026-11-09";
const page = (text: string, url = "https://example.org/apply") => ({ url, text });

describe("scholarship deadlines", () => {
  it("reads the next deadline with its sentence, the closing date of a window", () => {
    expect(nextDeadline("Applications open on 5 August 2026 and close on 4 February 2027.", TODAY)).toEqual({ date: "2027-02-04", quote: "Applications open on 5 August 2026 and close on 4 February 2027." });
    expect(nextDeadline("Deadline: 20 February 2027", TODAY)?.date).toBe("2027-02-20");
  });

  it("reads dates listed under a 'deadlines are:' line, but not other people's deadlines", () => {
    const text = "For 2027/28 entry, the main University funding deadlines are:\n\n• Tuesday 8 December 2026\n• Wednesday 6 January 2027\n\nIf you're a US citizen applying for a Gates Cambridge scholarship, the deadline is Wednesday 14 October 2026.";
    expect(nextDeadline(text, TODAY)).toEqual({ date: "2026-12-08", quote: "For 2027/28 entry, the main University funding deadlines are: Tuesday 8 December 2026" });
    expect(nextDeadline("If you're a US citizen, the deadline is 14 December 2026.", TODAY)).toBeNull();
  });

  it("ignores last year's round, dates without a year, broken digits and other events", () => {
    expect(nextDeadline("The closing date for applications was 16:00 BST on Tuesday 20 October.", TODAY)).toBeNull();
    expect(nextDeadline("The application deadline is 20 October.", TODAY)).toBeNull();
    expect(nextDeadline("8 -2 4 February 2027 : Application portal is open for two weeks.", TODAY)).toBeNull();
    expect(nextDeadline("Interview results announced by 15 March 2027; application deadline passed.", TODAY)).toBeNull();
  });

  it("finds last round's closing date, in the past year", () => {
    expect(lastClosing("The closing date for applications was 16:00 BST on Tuesday 20 October .", TODAY)).toBe("2026-10-20");
    expect(lastClosing("The deadline was 15 December.", TODAY)).toBe("2025-12-15");
    expect(lastClosing("The deadline is 15 December 2026.", TODAY)).toBeNull();
  });
});

describe("where a round stands", () => {
  it("is open with a deadline when a page states one", () => {
    expect(readRound([page("Nothing here"), page("Apply by 24 February 2027.", "https://b.org")], TODAY)).toMatchObject({ status: "open", deadline: "2027-02-24", source_url: "https://b.org" });
  });

  it("is closed when the page says so, with last round's closing date", () => {
    const text = "Applications for the 2027/28 academic year are now closed .\nThe closing date for applications was 16:00 BST on Tuesday 20 October .";
    expect(readRound([page(text)], TODAY)).toMatchObject({ status: "closed", deadline: null, last_deadline: "2026-10-20" });
    expect(readRound([page("Closed for applications")], TODAY).status).toBe("closed");
  });

  it("is open without a date, varies per university, or unknown", () => {
    expect(readRound([page("The application period for the 2027-2028 academic year is currently open.")], TODAY)).toMatchObject({ status: "open", deadline: null });
    expect(readRound([page("The application period for the 2027-2028 academic year is currently open.")], TODAY, true).status).toBe("varies");
    expect(readRound([page("Welcome to our scholarship.")], TODAY).status).toBe("unknown");
    expect(readRound([], TODAY).status).toBe("unknown");
  });
});

describe("the scholarship list", () => {
  it("has a complete entry for every scholarship", () => {
    for (const s of SCHOLARSHIPS) {
      expect(s.url, s.slug).toMatch(/^https:\/\//);
      expect(s.pages.length, s.slug).toBeGreaterThan(0);
      expect(s.coverage.summary_en.length && s.coverage.summary_bn.length && s.eligibility_bn.length && s.cycle_en.length && s.cycle_bn.length, s.slug).toBeTruthy();
    }
  });
});
