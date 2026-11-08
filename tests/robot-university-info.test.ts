import { describe, expect, it } from "vitest";
import { factsFromPage, linkScore, pageFromHtml, pageLevel } from "../robot/university-info.ts";

const TODAY = "2026-11-09";
const html = (title: string, body: string) => `<html lang="en"><head><title>${title}</title></head><body><h1>${title}</h1>${body}</body></html>`;
const fields = (url: string, title: string, body: string, kind?: Parameters<typeof factsFromPage>[2]) =>
  factsFromPage(pageFromHtml(url, html(title, body)), TODAY, kind).map((f) => `${f.field}${f.level ? `:${f.level}` : ""}:${JSON.stringify(f.value)}`);

describe("finding general pages", () => {
  it("scores fee, deadline, English and document links, international pages first", () => {
    expect(linkScore({ url: "https://uni.example/international/tuition-fees", text: "Tuition fees" }, "fees")).toBeGreaterThan(linkScore({ url: "https://uni.example/fees", text: "Fees" }, "fees"));
    expect(linkScore({ url: "https://uni.example/dates/application-deadlines", text: "Application deadlines" }, "deadlines")).toBeGreaterThan(0);
    expect(linkScore({ url: "https://uni.example/apply/english-language-requirements", text: "English language requirements" }, "english")).toBeGreaterThan(0);
    expect(linkScore({ url: "https://uni.example/apply/how-to-apply", text: "How to apply" }, "documents")).toBeGreaterThan(0);
    expect(linkScore({ url: "https://uni.example/news/new-fees-announced", text: "New fees" }, "fees")).toBe(0);
  });

  it("tells undergraduate from postgraduate pages", () => {
    expect(pageLevel("How to apply | Undergraduate study at The University of Manchester")).toBe("bachelor");
    expect(pageLevel("https://masters.au.dk/tuitionfees Tuition fees for Master's")).toBe("master");
    expect(pageLevel("Postgraduate taught fees")).toBe("master");
    expect(pageLevel("Fees for bachelor's and master's programmes")).toBeNull();
  });
});

describe("reading a general page strictly", () => {
  it("keeps a clear tuition sentence (Mannheim)", () => {
    const got = fields(
      "https://www.uni-mannheim.de/en/academics/fees/tuition-fees-for-international-students/",
      "Tuition fees for international students",
      "<p>International students from non-EU countries pay tuition fees of 1,500 euros per semester.</p>",
    );
    expect(got).toContain('tuition:{"amount_per_year":3000,"currency":"EUR","applies_to":"non_eu"}');
  });

  it("drops application fees, per-credit prices and prep school fees as tuition (Aarhus, Abilene, Acibadem)", () => {
    expect(fields("https://masters.au.dk/tuitionfees", "Tuition fees", "<p>Non-EU/EEA/Swiss citizens must pay an application fee of 150 EUR (1.125 DKK) to have your application(s) processed.</p>").filter((f) => f.startsWith("tuition"))).toEqual([]);
    expect(fields("https://acu.edu/admissions-aid/online/tuition-fees/", "Tuition and fees", "<h2>Tuition Overview</h2><p>Undergraduate Degree or Certificate $395/hour</p>").filter((f) => f.startsWith("tuition"))).toEqual([]);
    expect(fields("https://www.acibadem.edu.tr/en/admissions/undergraduate/tuition-fees", "Tuition fees", "<p>Scholarships cover only the tuition fee. Prep School 5.500 USD (Scholarships are not valid)</p>").filter((f) => f.startsWith("tuition"))).toEqual([]);
  });

  it("keeps application deadlines, drops payment dates (Manchester, Aarhus)", () => {
    const manchester = fields(
      "https://www.manchester.ac.uk/study/undergraduate/applying/how-to-apply/",
      "How to apply | Undergraduate study",
      "<p>Most courses start in September 2027.</p><ul><li>For 2027 entry, the closing date for receipt of applications to be given equal consideration is 13 January 2027 at 6pm (GMT).</li></ul>",
    );
    expect(manchester.some((f) => f.startsWith("deadline:bachelor:") && f.includes("2027-01-13"))).toBe(true);
    const aarhus = fields("https://masters.au.dk/tuitionfees", "Tuition fees", "<h2>Payment deadlines</h2><p>Payment deadlines Study start 1 September</p>");
    expect(aarhus.filter((f) => f.startsWith("deadline"))).toEqual([]);
  });

  it("keeps documents only from an application page that lists several", () => {
    const list = "<h2>Documents</h2><ul><li>Copy of your passport</li><li>Transcript of records</li><li>CV</li><li>Motivation letter</li></ul>";
    expect(fields("https://uni.example/apply/how-to-apply", "How to apply", list, "documents").filter((f) => f.startsWith("document")).length).toBeGreaterThanOrEqual(3);
    expect(fields("https://uni.example/tuitionfees", "Tuition fees", "<p>If you hold a British national overseas passport you must pay tuition fee.</p>", "fees").filter((f) => f.startsWith("document"))).toEqual([]);
  });

  it("takes the level from the sentence and drops visa-money and award amounts as tuition", () => {
    const tum = fields("https://www.tum.de/en/studies/fees/tuition-fees", "Tuition fees for international students", "<p>The tuition fees will then be for Bachelor's programs: 2,300 euros per semester.</p>");
    expect(tum.some((f) => f.startsWith("tuition:bachelor:"))).toBe(true);
    expect(fields("https://www.exeter.ac.uk/study/fees", "Tuition fees", "<p>In addition to the cost of tuition fees, when you apply for your visa you will also need evidence of £1,171 per month.</p>").filter((f) => f.startsWith("tuition"))).toEqual([]);
    expect(fields("https://ok.ubc.ca/fees", "Tuition fees", "<p>The International Welcome Award is a $5,000 award applied to first-year tuition.</p>").filter((f) => f.startsWith("tuition"))).toEqual([]);
  });

  it("marks pages listing several IELTS scores as varying", () => {
    const got = fields("https://uni.example/apply/english", "English language requirements", "<p>Band 3: IELTS minimum score 6.5 overall</p><p>Band 5: IELTS minimum score 7.0 overall</p>");
    expect(got.every((f) => !f.startsWith("english") || f.includes('"varies":true'))).toBe(true);
  });

  it("ignores research job and PhD pages", () => {
    expect(fields("https://international.au.dk/research/researcher-positions/howtoapply", "How to apply", "<ul><li>Teaching portfolio</li><li>CV</li><li>Passport</li></ul>", "documents")).toEqual([]);
  });
});
