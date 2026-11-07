import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  cipSubject,
  courseFacts,
  everyRow,
  csvRecords,
  csvRows,
  fromDataset,
  hostKey,
  isBlocked,
  matchProviders,
  nameKey,
  parseCricos,
  parseDiscoverUni,
  parseScorecard,
  pickFile,
  ukLevel,
  uniqueCourses,
  unzip,
  type Provider,
} from "@/robot/official-data";
import { planChanges } from "@/robot/checks";

describe("reading CSV files", () => {
  it("handles quotes, commas and line breaks inside fields, and a byte-order mark", () => {
    const text = '﻿a,b,c\r\n1,"$13,300.00","say ""hi""\nthere"\r\n2,,x\n';
    expect([...csvRows(text)]).toEqual([
      ["a", "b", "c"],
      ["1", "$13,300.00", 'say "hi"\nthere'],
      ["2", "", "x"],
    ]);
  });

  it("keeps only the columns asked for", () => {
    expect([...csvRecords("A,B,C\n1,2,3\n", ["C", "A", "Missing"])]).toEqual([{ C: "3", A: "1" }]);
  });
});

/** A minimal zip (one deflated file), the way the publishers pack theirs. */
function zipOf(name: string, content: string): Buffer {
  const data = Buffer.from(content);
  const packed = deflateRawSync(data);
  const n = Buffer.from(name);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(packed.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(n.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(packed.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(n.length, 28);
  central.writeUInt32LE(0, 42);
  const dirStart = 30 + n.length + packed.length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(46 + n.length, 12);
  end.writeUInt32LE(dirStart, 16);
  return Buffer.concat([local, n, packed, central, n, end]);
}

describe("opening zip files", () => {
  it("finds a file by name in any folder", () => {
    const files = unzip(zipOf("2026/KISCOURSE.csv", "TITLE\nHistory\n"));
    expect(pickFile(files, /^kiscourse\.csv$/i)).toBe("TITLE\nHistory\n");
    expect(pickFile(files, /^institution\.csv$/i)).toBeNull();
  });
});

describe("matching dataset providers to our universities", () => {
  it("reduces a website to the name that identifies it", () => {
    expect(hostKey("https://www.monash.edu.au/")).toBe("monash");
    expect(hostKey("www.monash.edu")).toBe("monash");
    expect(hostKey("web.mit.edu")).toBe("mit");
    expect(hostKey("http://www.ox.ac.uk")).toBe("ox");
    expect(hostKey("https://international.cit.edu.au/")).toBe("cit");
    expect(hostKey("")).toBeNull();
  });

  it("compares names loosely", () => {
    expect(nameKey("The University of Melbourne (UniMelb)")).toBe(nameKey("University of Melbourne"));
    expect(nameKey("King's College London")).toBe("kings college london");
    expect(nameKey("University of Hawaiʻi at Mānoa")).toBe("university of hawaii at manoa");
    expect(nameKey("Texas A&M University")).toBe("texas a and m university");
  });

  const p = (id: string, names: string[], website: string | null, extra: Partial<Provider> = {}): Provider => ({ id, names, website, courses: 10, ...extra });
  const u = (slug: string, name: string, website: string) => ({ slug, name, website });

  it("matches by name and by website, including a different domain ending", () => {
    const { matches } = matchProviders(
      [p("00008C", ["Monash University (Monash)", "Monash University"], "www.monash.edu.au"), p("00116K", ["The University of Melbourne (UniMelb)"], "http://www.unimelb.edu.au/")],
      [u("monash-university", "Monash University", "https://www.monash.edu"), u("the-university-of-melbourne", "The University of Melbourne", "https://www.unimelb.edu.au")],
    );
    expect(matches.map((m) => [m.university.slug, m.provider.id, m.by])).toEqual([
      ["monash-university", "00008C", "name and website"],
      ["the-university-of-melbourne", "00116K", "name and website"],
    ]);
  });

  it("gives a provider to one university only: UNSW keeps its courses, UNSW Canberra doesn't get a copy", () => {
    const { matches, ambiguous } = matchProviders(
      [p("00098G", ["The University of New South Wales (UNSW)", "UNSW Sydney"], "www.unsw.edu.au")],
      [u("unsw-sydney", "UNSW Sydney", "https://www.unsw.edu.au"), u("unsw-canberra", "UNSW Canberra", "https://www.unsw.edu.au/canberra")],
    );
    expect(matches.map((m) => m.university.slug)).toEqual(["unsw-sydney"]);
    expect(ambiguous).toEqual([]);
  });

  it("leaves out equally good claims instead of guessing", () => {
    const { matches, ambiguous } = matchProviders([p("1", ["Shared College"], "shared.edu")], [u("a", "Alpha Institute", "https://shared.edu"), u("b", "Beta Institute", "https://www.shared.edu")]);
    expect(matches).toEqual([]);
    expect(ambiguous.length).toBe(2);
  });

  it("prefers the main campus, then the provider whose name starts with ours", () => {
    const { matches } = matchProviders(
      [
        p("190150", ["Columbia University in the City of New York"], "www.columbia.edu", { main: true }),
        p("196468", ["Teachers College at Columbia University"], "www.tc.columbia.edu", { main: true }),
        p("170976", ["University of Michigan-Ann Arbor", "University of Michigan"], "umich.edu/", { main: true }),
        p("171146", ["University of Michigan-Flint", "University of Michigan"], "www.umflint.edu/", { main: false }),
      ],
      [u("columbia-university", "Columbia University", "https://www.columbia.edu"), u("university-of-michigan", "University of Michigan", "https://umich.edu")],
    );
    expect(matches.map((m) => [m.university.slug, m.provider.id])).toEqual([
      ["columbia-university", "190150"],
      ["university-of-michigan", "170976"],
    ]);
  });

  it("chooses the provider with more courses when one university is registered twice under the same name", () => {
    const { matches } = matchProviders([p("A", ["Victoria University"], "vu.edu.au", { courses: 3 }), p("B", ["Victoria University"], "vu.edu.au", { courses: 90 })], [u("victoria-university", "Victoria University", "https://www.vu.edu.au")]);
    expect(matches.map((m) => m.provider.id)).toEqual(["B"]);
  });
});

describe("Australia: CRICOS register", () => {
  const head =
    "CRICOS Provider Code,Institution Name,CRICOS Course Code,Course Name,VET National Code,Dual Qualification,Field of Education 1 Broad Field,Field of Education 1 Narrow Field,Field of Education 1 Detailed Field,Field of Education 2 Broad Field,Field of Education 2 Narrow Field,Field of Education 2 Detailed Field,Course Level,Foundation Studies,Work Component,Work Component Hours/Week,Work Component Weeks,Work Component Total Hours,Course Language,Duration (Weeks),Tuition Fee,Non Tuition Fee,Estimated Total Course Cost,Expired";
  const row = (code: string, name: string, level: string, weeks: number, fee: string, expired = "No", narrow = "0919 - Economics and Econometrics", broad = "09 - Society and Culture") =>
    `00008C,Monash University (Monash),${code},${name},,No,${broad},${narrow},${narrow},,,,${level},No,No,,,,English,${weeks},"${fee}",$0.00,"${fee}",${expired}`;
  const courses = [
    head,
    row("001447E", "Bachelor of Economics", "Bachelor Degree", 156, "$188,278.00"),
    row("001461G", "Master of Business Administration", "Masters Degree (Coursework)", 104, "$128,009.00"),
    row("009999A", "Bachelor of Arts (Honours)", "Bachelor Honours Degree", 52, "$50,000.00"),
    row("008888B", "Doctor of Philosophy", "Doctoral Degree", 208, "$200,000.00"),
    row("007777C", "Bachelor of Old Things", "Bachelor Degree", 156, "$1.00", "Yes"),
    row("006666D", "Bachelor of Science", "Bachelor Degree", 156, "$150,000.00", "No", "0100 - Natural and Physical Sciences", "01 - Natural and Physical Sciences"),
  ].join("\n");
  const institutions = "CRICOS Provider Code,Trading Name,Institution Name,Institution Type,Institution Capacity,Website\n00008C,Monash University,Monash University (Monash),Government,\"40,350\",www.monash.edu.au\n";
  const data = parseCricos(courses, institutions);

  it("keeps bachelor's and master's courses that are open now, not one-year honours, doctorates or expired ones", () => {
    expect(data.courses.map((c) => c.code)).toEqual(["001447E", "001461G", "006666D"]);
    expect(data.providers[0]!.names).toEqual(["Monash University (Monash)", "Monash University"]);
  });

  it("turns the whole-course fee into a yearly one and says so in the evidence", () => {
    const c = data.courses[0]!;
    expect(c.durationMonths).toBe(36);
    expect(c.tuition).toEqual({ perYear: 62759, currency: "AUD" });
    expect(c.quotes.tuition).toBe('CRICOS course 001447E "Bachelor of Economics": Tuition Fee $188,278.00 for the whole course (156 weeks), about A$62,759 a year');
    expect(c.evidenceUrl).toBe("https://data.gov.au/data/dataset/cricos");
  });

  it("becomes facts the usual checks accept for a new program, each quoting the dataset", () => {
    const changes = planChanges(null, courseFacts(data.courses[0]!), "2026-11-08", new Set(["economics", "business"]));
    expect(Object.fromEntries(changes.map((c) => [c.field, c.newValue]))).toEqual({ degree_level: "bachelor", field: "economics", duration_months: 36, language: "en", currency: "AUD", tuition_per_year: 62759 });
    expect(changes.every((c) => c.hold === null)).toBe(true);
    expect(changes.find((c) => c.field === "language")!.evidence).toContain("CRICOS course 001447E");
  });

  it("leaves the subject empty when neither the title nor the field names one (the program then stays hidden)", () => {
    expect(courseFacts(data.courses[2]!).field_slug).toBeNull();
    expect(courseFacts(data.courses[1]!).field_slug).toBe("business");
  });
});

describe("United States: College Scorecard", () => {
  const fields = [
    "UNITID,OPEID6,INSTNM,CONTROL,MAIN,CIPCODE,CIPDESC,CREDLEV,CREDDESC,IPEDSCOUNT1,IPEDSCOUNT2",
    '162928,002077,Johns Hopkins University,"Private, nonprofit",1,1107,Computer Science.,3,Bachelor\'s Degree,120,110',
    '162928,002077,Johns Hopkins University,"Private, nonprofit",1,1107,Computer Science.,5,Master\'s Degree,80,NA',
    '162928,002077,Johns Hopkins University,"Private, nonprofit",1,0301,Natural Resources Conservation and Research.,5,Master\'s Degree,0,0',
    '162928,002077,Johns Hopkins University,"Private, nonprofit",1,5122,Public Health.,8,Graduate/Professional Certificate,4,4',
    '999999,000001,Johns Hopkins University-Branch,"Private, nonprofit",0,1107,Computer Science.,3,Bachelor\'s Degree,9,9',
  ].join("\n");
  const institutions = "UNITID,OPEID,OPEID6,INSTNM,CITY,STABBR,ZIP,ACCREDAGENCY,INSTURL,NPCURL,MAIN,TUITIONFEE_OUT\n162928,00207700,002077,Johns Hopkins University,Baltimore,MD,21218,x,www.jhu.edu/,,1,67170\n";
  const data = parseScorecard(fields, institutions);

  it("keeps main-campus bachelor's and master's subjects that had graduates", () => {
    expect(data.courses.map((c) => c.title)).toEqual(["Computer Science – Bachelor's degree", "Computer Science – Master's degree"]);
  });

  it("uses out-of-state tuition for bachelor's programs only, and links the university's Scorecard page", () => {
    expect(data.courses[0]!.tuition).toEqual({ perYear: 67170, currency: "USD" });
    expect(data.courses[1]!.tuition).toBeNull();
    expect(data.courses[0]!.evidenceUrl).toBe("https://collegescorecard.ed.gov/school/?162928");
    expect(data.courses[0]!.subject).toBe("cse");
  });

  it("maps official subject codes to the app's subjects", () => {
    expect(cipSubject("1101")).toBe("cse");
    expect(cipSubject("1410")).toBe("eee");
    expect(cipSubject("5208")).toBe("finance");
    expect(cipSubject("5201")).toBe("business");
    expect(cipSubject("4506")).toBe("economics");
    expect(cipSubject("3070")).toBe("data-science");
    expect(cipSubject("3101")).toBeNull();
  });
});

describe("United Kingdom: Discover Uni", () => {
  const kiscourse = [
    "PUBUKPRN,UKPRN,KISCOURSEID,KISMODE,TITLE,KISAIMCODE,CRSEURL,DISTANCE",
    "10007774,10007774,H1N1,1,Computer Science,021,https://www.ox.ac.uk/admissions/undergraduate/courses/course-listing/computer-science,0",
    "10007774,10007774,ENG4,1,Engineering Science,051,https://www.ox.ac.uk/engineering,0",
    "10007774,10007774,PT1,2,History,001,https://www.ox.ac.uk/history-pt,0",
    "10007774,10007774,DL1,1,Law,001,https://www.ox.ac.uk/law-online,1",
    "10007774,10007774,FND,1,Foundation Year,099,https://www.ox.ac.uk/foundation,0",
  ].join("\n");
  const institution = "PUBUKPRN,UKPRN,LEGAL_NAME,FIRST_TRADING_NAME,PROVURL\n10007774,10007774,The Chancellor Masters and Scholars of the University of Oxford,University of Oxford,https://www.ox.ac.uk\n";
  const kisaim = "KISAIMCODE,KISAIMLABEL\n021,BSc (Hons)\n051,MEng\n001,BA (Hons)\n099,Foundation Year\n";
  const data = parseDiscoverUni({ kiscourse, institution, kisaim });

  it("keeps full-time campus degrees with the university's own course page", () => {
    expect(data.courses.map((c) => [c.title, c.level])).toEqual([
      ["BSc (Hons) Computer Science", "bachelor"],
      ["MEng Engineering Science", "bachelor"],
    ]);
    expect(data.courses[0]!.courseUrl).toBe("https://www.ox.ac.uk/admissions/undergraduate/courses/course-listing/computer-science");
    expect(data.courses[0]!.evidenceUrl).toBe("https://discoveruni.gov.uk/course-details/10007774/H1N1/FullTime/");
    expect(data.providers[0]!.names).toContain("University of Oxford");
  });

  it("says clearly which columns are missing when the file's layout changes", () => {
    expect(() => parseDiscoverUni({ kiscourse: "UKPRN,TITLE\n1,x\n", institution, kisaim })).toThrow(/missing columns for id, url, aim/);
  });

  it("reads degree levels from UK award names", () => {
    expect(ukLevel("BA (Hons)")).toBe("bachelor");
    expect(ukLevel("LLB")).toBe("bachelor");
    expect(ukLevel("MEng")).toBe("bachelor"); // integrated master's: entered straight after school
    expect(ukLevel("MSc")).toBe("master");
    expect(ukLevel("MA")).toBe("master");
    expect(ukLevel("Foundation Degree")).toBeNull();
  });
});

describe("importing", () => {
  it("reads every row, not just the database's first 1,000 (missing rows meant duplicate programs)", async () => {
    const table = Array.from({ length: 2345 }, (_, i) => ({ id: i }));
    const asked: [number, number][] = [];
    const rows = await everyRow<{ id: number }>(async (from, to) => {
      asked.push([from, to]);
      return { data: table.slice(from, Math.min(to + 1, from + 1000)), error: null };
    }, "test");
    expect(rows.length).toBe(2345);
    expect(asked).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it("counts a university as blocking the robot only when its own pages give nothing", () => {
    const failed = { discovered_at: "2026-10-11T18:08:00Z", program_pages_found: null };
    expect(isBlocked(failed, { checked: 0, failing: 0 }, 0)).toBe(true);
    expect(isBlocked(failed, { checked: 0, failing: 0 }, 3)).toBe(false);
    const found = { discovered_at: "2026-11-07T18:08:00Z", program_pages_found: 300 };
    expect(isBlocked(found, { checked: 40, failing: 38 }, 0)).toBe(true);
    expect(isBlocked(found, { checked: 40, failing: 10 }, 0)).toBe(false);
    expect(isBlocked({ discovered_at: null, program_pages_found: null }, { checked: 0, failing: 0 }, 0)).toBe(false);
  });

  it("knows which programs came from a dataset", () => {
    expect(fromDataset("https://collegescorecard.ed.gov/school/?162928")).toBe(true);
    expect(fromDataset("https://data.gov.au/data/dataset/cricos")).toBe(true);
    expect(fromDataset("https://www.monash.edu/study/courses/economics")).toBe(false);
    expect(fromDataset("")).toBe(false);
  });

  it("makes one program per title and level at a university", () => {
    const c = { providerId: "1", code: "a", title: "Bachelor of Arts", level: "bachelor" as const, durationMonths: 36, language: null, tuition: null, subjectHints: [], courseUrl: null, evidenceUrl: "", quotes: { level: "" } };
    expect(uniqueCourses([c, { ...c, code: "b", title: "BACHELOR OF ARTS" }, { ...c, code: "c", level: "master" }]).map((x) => x.code)).toEqual(["a", "c"]);
  });
});
