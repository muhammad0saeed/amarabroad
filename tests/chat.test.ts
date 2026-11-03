import { beforeAll, describe, expect, it } from "vitest";
import { answerQuestion, copyPrompt, matchIntent, searchOverview } from "@/lib/chat";
import { getProgramContext } from "@/lib/data";
import type { ProgramContext } from "@/types";

let milan: ProgramContext;
let design: ProgramContext;

beforeAll(async () => {
  milan = (await getProgramContext("sum-msc-computer-science"))!;
  design = (await getProgramContext("midt-msc-sustainable-architecture"))!; // private, no ranking
});

describe("matching a question to a data field", () => {
  it.each([
    ["How much is the tuition?", "tuition"],
    ["What's the total cost?", "total_cost"],
    ["Can I apply without IELTS?", "moi"],
    ["Is a 3-year degree accepted?", "three_year"],
    ["When is the deadline?", "deadline"],
    ["When does it start?", "intake"],
    ["What IELTS score do I need?", "english"],
    ["What is the minimum CGPA?", "grade"],
    ["How long is the program?", "duration"],
    ["What is the application fee?", "application_fee"],
    ["Is there a scholarship?", "scholarships"],
    ["Can I work part-time?", "work"],
    ["How many seats for non-EU students?", "seats"],
    ["Which documents do I need?", "documents"],
    ["How much is rent?", "living_cost"],
    ["টিউশন ফি কত?", "tuition"],
    ["আইইএলটিএস লাগবে?", "english"],
    ["কত বছর লাগবে?", "duration"],
    ["স্কলারশিপ আছে?", "scholarships"],
  ])("%s → %s", (question, intent) => {
    expect(matchIntent(question)).toBe(intent);
  });

  it("matches whole words only", () => {
    expect(matchIntent("Where do I send feedback?")).toBeNull();
    expect(matchIntent("hello")).toBeNull();
  });
});

describe("answers", () => {
  it("answers from a data field first", () => {
    expect(answerQuestion("What is the deadline?", milan)).toEqual({ type: "field", intent: "deadline" });
  });

  it("falls back to searching the overview", () => {
    const answer = answerQuestion("Is there an internship?", milan);
    expect(answer.type).toBe("search");
    expect(answer.type === "search" && answer.sentences[0]).toContain("internship");
    expect(searchOverview("Do I write a thesis?", milan)[0]).toContain("thesis");
    expect(searchOverview("থিসিস আছে?", milan)[0]).toContain("থিসিস");
  });

  it("skips fields with no data, then says it doesn't know", () => {
    expect(answerQuestion("What is the ranking?", design)).toEqual({ type: "none" });
    expect(answerQuestion("Is there a swimming pool?", milan)).toEqual({ type: "none" });
    expect(answerQuestion("Any scholarships?", milan, 0)).not.toMatchObject({ type: "field" });
    expect(answerQuestion("Any scholarships?", milan, 2)).toEqual({ type: "field", intent: "scholarships" });
  });
});

describe("copy-to-another-AI prompt", () => {
  it("includes the question, the key facts, the official link and a sample warning", () => {
    const text = copyPrompt("Is there a swimming pool?", milan, "amarAbroad");
    expect(text).toContain("Question: Is there a swimming pool?");
    expect(text).toContain("Program: M.Sc. Computer Science (master's, 24 months, 120 ECTS)");
    expect(text).toContain("University: Sample University of Milan (public), Milan, Italy");
    expect(text).toContain("Tuition: €2,800 per year");
    expect(text).toContain("Sep 2027 intake, deadline 2027-03-31");
    expect(text).toContain("English: IELTS 6, TOEFL iBT 80, PTE Academic 50, Duolingo English Test 105; MOI accepted: yes");
    expect(text).toContain("Official page: https://example.org/sample/programs/sum-msc-computer-science");
    expect(text).toContain("sample data and are invented");
  });
});
