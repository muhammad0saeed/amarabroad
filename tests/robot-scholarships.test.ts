import { describe, expect, it } from "vitest";
import { nextDeadline, SCHOLARSHIPS } from "../robot/scholarships.ts";

const TODAY = "2026-11-09";

describe("scholarship deadlines", () => {
  it("reads the next deadline with its sentence, the closing date of a window", () => {
    expect(nextDeadline("Applications open on 5 August 2026 and close on 4 February 2027.", TODAY)).toEqual({ date: "2027-02-04", quote: "Applications open on 5 August 2026 and close on 4 February 2027." });
    expect(nextDeadline("Deadline: 20 February 2027", TODAY)?.date).toBe("2027-02-20");
  });

  it("ignores last year's round, dates without a year, broken digits and other events", () => {
    expect(nextDeadline("The closing date for applications was 16:00 BST on Tuesday 20 October.", TODAY)).toBeNull();
    expect(nextDeadline("The application deadline is 20 October.", TODAY)).toBeNull();
    expect(nextDeadline("8 -2 4 February 2027 : Application portal is open for two weeks.", TODAY)).toBeNull();
    expect(nextDeadline("Interview results announced by 15 March 2027; application deadline passed.", TODAY)).toBeNull();
  });

  it("has a complete entry for every scholarship", () => {
    for (const s of SCHOLARSHIPS) {
      expect(s.url, s.slug).toMatch(/^https:\/\//);
      expect(s.coverage.summary_en.length && s.coverage.summary_bn.length && s.eligibility_bn.length, s.slug).toBeTruthy();
    }
  });
});
