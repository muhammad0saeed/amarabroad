import { describe, expect, it } from "vitest";
import { englishLevel, readFacts } from "../robot/rules.ts";
import { cleanTitle, titleKey } from "../robot/titles.ts";

describe("program titles", () => {
  it("drops 'Study the', the university name and course codes", () => {
    expect(cleanTitle("Study the Bachelor of Nursing (Preregistration)")).toBe("Bachelor of Nursing (Preregistration)");
    expect(cleanTitle("Master of Teaching (Secondary) : The University of Western Australia")).toBe("Master of Teaching (Secondary)");
    expect(cleanTitle("Bachelor of Software Engineering Honours (VSENH1 – 2027)")).toBe("Bachelor of Software Engineering Honours");
    expect(cleanTitle("Informatics – Master of Science (M.Sc.)")).toBe("Informatics – Master of Science (M.Sc.)");
    expect(cleanTitle("BSc Biology with Professional Placement – Study at Bristol")).toBe("BSc Biology with Professional Placement");
  });

  it("gives a page title and its official-list title the same key", () => {
    expect(titleKey("Bachelor of Early Childhood Education – VU Sydney")).toBe(titleKey("Bachelor of Early Childhood Education"));
    expect(titleKey("Bachelor of Midwifery (WMIDW2 – 2027)")).toBe(titleKey("Bachelor of Midwifery"));
    expect(titleKey("Bachelor of Business (Hons)")).toBe(titleKey("Bachelor of Business (Honours)"));
    expect(titleKey("Bachelor of Arts & Science")).toBe(titleKey("Bachelor of Arts and Science"));
  });

  it("keeps different programs apart", () => {
    expect(titleKey("Master of Data Science")).not.toBe(titleKey("Master of Computer Science"));
    expect(titleKey("Bachelor of Laws")).not.toBe(titleKey("Bachelor of Laws (Honours)"));
  });
});

describe("deadlines near other dates", () => {
  const read = (text: string) =>
    readFacts([{ url: "https://x.edu/p", text, meta: { title: "", h1: "", description: "", lang: "en", jsonLd: [], english: null, canonical: null } }], "2026-11-09").intakes.map((i) => i.deadline);
  it("doesn't take teaching starts, results or an opening date as the deadline", () => {
    expect(read("Term 1 application closing dates With credit: 2 December 2026 Teaching starts: 11 January 2027")).toEqual(["2026-12-02"]);
    expect(read("Application deadline: 15 January 2027 (autumn 2027 start). Applicants are informed of the results by 18 March 2027")).toEqual(["2027-01-15"]);
    expect(read("Application period opens 7 January 2027 for studies starting in autumn")).toEqual([]);
  });
  it("reads deadlines from a linked application page only when the program page has none", () => {
    const pages = [
      { url: "https://x.edu/programs/msc-data", text: "Master of Data Science. Start: winter semester.", meta: { title: "", h1: "", description: "", lang: "en", jsonLd: [], english: null, canonical: null } },
      { url: "https://x.edu/how-to-apply", text: "Application deadlines:\n• For the winter semester: 15 July 2027\n• For the summer semester: 15 January 2027", meta: { title: "", h1: "", description: "", lang: "en", jsonLd: [], english: null, canonical: null } },
    ];
    expect(readFacts(pages, "2026-11-09").intakes.map((i) => i.deadline)).toEqual(["2027-07-15"]);
    const online = [pages[0]!, { ...pages[1]!, url: "https://x.edu/online/how-to-apply" }];
    expect(readFacts(online, "2026-11-09").intakes).toEqual([]);
  });
});

describe("English level (CEFR)", () => {
  it("reads the English entry level when no test score is named", () => {
    expect(englishLevel(["Proof of English language skills at level C1 of the CEFR is required."])?.value).toBe("English C1 (CEFR)");
    expect(englishLevel(["Language requirements: B2 level in English"])?.value).toBe("English B2 (CEFR)");
    expect(englishLevel(["Englischkenntnisse auf Niveau C1 sind nachzuweisen."])?.value).toBe("English C1 (CEFR)");
  });

  it("ignores other languages and what a course teaches", () => {
    expect(englishLevel(["German language skills at level B2 and English B2"])).toBeNull();
    expect(englishLevel(["In this module you will reach C1 level of English."])).toBeNull();
    expect(englishLevel(["Applicants need a bachelor's degree."])).toBeNull();
  });
});
