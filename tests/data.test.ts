// Checks the sample data against BRIEF.md's seed data rules: counts, fictional names,
// is_sample everywhere, no real links, references that resolve, and every planted edge case.
import { describe, expect, it } from "vitest";
import cities from "@/data/cities.json";
import countries from "@/data/countries.json";
import degreeMappings from "@/data/degree-mapping.json";
import exchangeRates from "@/data/exchange-rates.json";
import fields from "@/data/fields.json";
import glossary from "@/data/glossary.json";
import programsJson from "@/data/programs.json";
import scholarships from "@/data/scholarships.json";
import universities from "@/data/universities.json";
import {
  getCoverage,
  getProgramContext,
  listProgramContexts,
  listScholarshipsForCountry,
  listScholarshipsForProgram,
  listScholarshipsForUniversity,
} from "@/lib/data";
import type { Program } from "@/types";

const programs = programsJson as Program[];

/** The day the sample data was written; "past deadline" edge cases are relative to it. */
const SEED_DATE = "2026-11-04";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const records = { countries, cities, universities, programs, scholarships, exchangeRates, glossary } as const;
const sluggable = { countries, cities, universities, programs, scholarships, glossary, fields, degreeMappings } as const;
const slugs = (rows: { slug: string }[]) => new Set(rows.map((r) => r.slug));
const fieldSlugs = slugs(fields);

function allStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(allStrings);
  if (value && typeof value === "object") return Object.values(value).flatMap(allStrings);
  return [];
}

describe("seed data rules", () => {
  it("has 3 countries (Italy, Germany, Hungary), 2 cities each, 2 universities per city, 3–4 programs per university, 6 scholarships", () => {
    expect(countries.map((c) => c.slug).sort()).toEqual(["germany", "hungary", "italy"]);
    for (const country of countries) expect(cities.filter((c) => c.country === country.slug)).toHaveLength(2);
    for (const city of cities) expect(universities.filter((u) => u.city === city.slug)).toHaveLength(2);
    for (const uni of universities) {
      const count = programs.filter((p) => p.university === uni.slug).length;
      expect(count, uni.slug).toBeGreaterThanOrEqual(3);
      expect(count, uni.slug).toBeLessThanOrEqual(4);
    }
    expect(scholarships).toHaveLength(6);
  });

  it("marks every record as sample, with a source link and a last-verified date", () => {
    for (const [file, rows] of Object.entries(records)) {
      for (const row of rows) {
        const label = `${file}: ${JSON.stringify(row).slice(0, 60)}`;
        expect(row.is_sample, label).toBe(true);
        expect(row.source_url, label).toMatch(/^https:\/\/example\.org\/sample\//);
        expect(row.last_verified, label).toMatch(ISO_DATE);
        expect(row.last_verified <= SEED_DATE, label).toBe(true);
      }
    }
  });

  it("uses fictional university and scholarship names", () => {
    for (const u of universities) expect(u.name).toMatch(/^Sample /);
    for (const s of scholarships) expect(s.name).toMatch(/^Sample /);
  });

  it("links only to example.org placeholders, never a real site (photo credits aside)", () => {
    for (const [file, rows] of Object.entries(records)) {
      // Photo credits point at the stock photo's page; they're not facts about a university.
      const withoutPhotos = (rows as Record<string, unknown>[]).map((row) => ({ ...row, photo: undefined }));
      for (const text of allStrings(withoutPhotos)) {
        for (const url of text.match(/https?:\/\/[^\s"]+/g) ?? []) {
          expect(url, file).toMatch(/^https:\/\/example\.org\/sample\//);
        }
      }
      for (const row of rows as { photo?: { source_url: string } }[]) {
        if (row.photo) expect(row.photo.source_url).toMatch(/^https:\/\/www\.pexels\.com\/photo\//);
      }
    }
  });

  it("has unique, URL-safe slugs", () => {
    for (const [file, rows] of Object.entries(sluggable)) {
      const list = rows.map((r) => r.slug);
      expect(new Set(list).size, file).toBe(list.length);
      for (const slug of list) expect(slug, file).toMatch(SLUG);
    }
  });
});

describe("references", () => {
  it("resolves every link in the Country → City → University → Program chain", () => {
    const countrySlugs = slugs(countries);
    const citySlugs = slugs(cities);
    const uniSlugs = slugs(universities);
    for (const c of cities) expect(countrySlugs.has(c.country), c.slug).toBe(true);
    for (const u of universities) expect(citySlugs.has(u.city), u.slug).toBe(true);
    for (const p of programs) expect(uniSlugs.has(p.university), p.slug).toBe(true);
  });

  it("links scholarships only to things that exist", () => {
    const programSlugs = slugs(programs);
    for (const s of scholarships) {
      for (const c of s.countries) expect(slugs(countries).has(c), s.slug).toBe(true);
      for (const u of s.universities) expect(slugs(universities).has(u), s.slug).toBe(true);
      for (const p of s.programs) expect(programSlugs.has(p), s.slug).toBe(true);
      expect(s.countries.length + s.universities.length + s.programs.length, s.slug).toBeGreaterThan(0);
    }
  });

  it("uses known fields for programs and degree mappings", () => {
    for (const p of programs) {
      expect(fieldSlugs.has(p.field), p.slug).toBe(true);
      for (const f of p.related_bachelor_fields) expect(fieldSlugs.has(f), `${p.slug} → ${f}`).toBe(true);
    }
    for (const d of degreeMappings) expect(fieldSlugs.has(d.field), d.slug).toBe(true);
  });

  it("has an exchange rate for every currency in use", () => {
    const rates = new Set(exchangeRates.map((r) => r.currency));
    for (const c of countries) expect(rates.has(c.currency), c.slug).toBe(true);
    for (const p of programs) expect(rates.has(p.currency!), p.slug).toBe(true);
  });
});

describe("program values", () => {
  const RANGES = { ielts: [4, 9], toefl_ibt: [40, 120], pte: [30, 90], duolingo: [60, 160] } as const;

  it("has plausible numbers", () => {
    for (const p of programs) {
      expect(p.duration_months, p.slug).toBeGreaterThanOrEqual(12);
      expect(p.tuition_per_year, p.slug).toBeGreaterThanOrEqual(0);
      expect(p.ects_credits! / (p.duration_months! / 12), p.slug).toBeCloseTo(60, 0);
      if (p.seats_non_eu !== null && p.seats_total !== null) expect(p.seats_non_eu, p.slug).toBeLessThanOrEqual(p.seats_total);
      for (const t of p.english_tests) {
        const [min, max] = RANGES[t.test];
        expect(t.min_score, `${p.slug} ${t.test}`).toBeGreaterThanOrEqual(min);
        expect(t.min_score, `${p.slug} ${t.test}`).toBeLessThanOrEqual(max);
      }
    }
  });

  it("states grade minimums on the right scale (CGPA /4 for master's, HSC GPA /5 for bachelor's)", () => {
    for (const p of programs) {
      const { value, scale } = p.min_gpa_requirement!;
      expect(scale, p.slug).toBe(p.degree_level === "master" ? 4 : 5);
      expect(value, p.slug).toBeGreaterThan(0);
      expect(value, p.slug).toBeLessThanOrEqual(scale);
    }
  });

  it("asks bachelor's applicants for an HSC stream, and master's applicants for a bachelor field", () => {
    for (const p of programs) {
      const hsc = p.related_bachelor_fields.filter((f) => f.startsWith("hsc-"));
      expect(hsc.length, p.slug).toBe(p.degree_level === "bachelor" ? p.related_bachelor_fields.length : 0);
    }
  });

  it("has valid intakes whose deadline comes before teaching starts", () => {
    for (const p of programs) {
      expect(p.intakes.length, p.slug).toBeGreaterThan(0);
      for (const i of p.intakes) {
        expect(i.month).toBeGreaterThanOrEqual(1);
        expect(i.month).toBeLessThanOrEqual(12);
        expect(i.deadline, p.slug).toMatch(ISO_DATE);
        const start = `${i.year}-${String(i.month).padStart(2, "0")}-01`;
        expect(i.deadline < start, `${p.slug} ${i.deadline}`).toBe(true);
      }
    }
  });

  it("gives English-taught programs an English requirement and other programs a language requirement", () => {
    for (const p of programs) {
      if (p.language === "en") expect(p.english_tests.length, p.slug).toBeGreaterThan(0);
      else expect(p.language_requirement_en, p.slug).toBeTruthy();
    }
  });
});

describe("planted edge cases", () => {
  it("covers every case the brief and plan ask for", () => {
    expect(programs.some((p) => p.degree_level === "master" && !p.accepts_3yr_bachelor)).toBe(true);
    expect(programs.some((p) => p.accepts_moi)).toBe(true);
    expect(programs.some((p) => p.seats_non_eu === null)).toBe(true);
    expect(scholarships.some((s) => s.type === "need")).toBe(true);
    expect(programs.some((p) => p.intakes.some((i) => i.deadline < SEED_DATE))).toBe(true);
    expect(scholarships.some((s) => s.deadline < SEED_DATE)).toBe(true);
    expect(programs.some((p) => p.min_gpa_requirement?.local_note_en?.includes("German grade"))).toBe(true);
    // Added from the project brief
    expect(programs.some((p) => !p.open_to_bd_citizens)).toBe(true);
    expect(programs.some((p) => p.accepts_provisional)).toBe(true);
    expect(programs.some((p) => p.tuition_per_year === 0)).toBe(true);
    expect(programs.some((p) => p.language !== "en")).toBe(true);
    expect(scholarships.some((s) => !s.bd_eligible)).toBe(true);
    expect(programs.some((p) => p.degree_level === "bachelor")).toBe(true);
  });
});

describe("Bangla content", () => {
  it("names every country, city and field in Bangla", () => {
    for (const row of [...countries, ...cities, ...fields]) expect(row.name_bn.trim(), row.slug).not.toBe("");
  });

  it("explains every glossary term and labels every degree in Bangla", () => {
    for (const t of glossary) expect(t.explain_bn.trim(), t.slug).not.toBe("");
    for (const d of degreeMappings) expect(d.label_bn.trim(), d.slug).not.toBe("");
  });

  it("has Bangla overviews for every country and city, and for some programs", () => {
    for (const row of [...countries, ...cities]) expect(row.overview_bn?.trim(), row.slug).toBeTruthy();
    expect(programs.filter((p) => p.overview_bn).length).toBeGreaterThanOrEqual(3);
  });
});

describe("lib/data", () => {
  it("joins a program with its university, city and country", async () => {
    const ctx = await getProgramContext("stub-msc-computer-science");
    expect(ctx?.university.slug).toBe("sample-technical-university-of-berlin");
    expect(ctx?.city.slug).toBe("berlin");
    expect(ctx?.country.slug).toBe("germany");
    expect(await getProgramContext("does-not-exist")).toBeUndefined();
    expect(await listProgramContexts()).toHaveLength(programs.length);
  });

  it("finds scholarships for a program through the program, its university and its country", async () => {
    const debrecen = (await listScholarshipsForProgram("dchs-msc-public-health")).map((s) => s.slug).sort();
    expect(debrecen).toEqual(["sample-debrecen-public-health-grant", "sample-hungary-government-scholarship"]);

    const milan = (await listScholarshipsForProgram("sum-msc-computer-science")).map((s) => s.slug).sort();
    expect(milan).toEqual(["sample-italy-regional-study-grant", "sample-milan-excellence-scholarship"]);
  });

  it("only offers a scholarship at the degree levels it covers", async () => {
    const bachelor = (await listScholarshipsForProgram("sum-bsc-international-economics")).map((s) => s.slug);
    expect(bachelor).toContain("sample-italy-regional-study-grant");
    expect(bachelor).not.toContain("sample-milan-excellence-scholarship");
  });

  it("lists scholarships for universities and countries", async () => {
    const munich = (await listScholarshipsForUniversity("sample-munich-international-business-school")).map((s) => s.slug);
    expect(munich).toEqual(expect.arrayContaining(["sample-munich-leadership-award", "sample-german-academic-exchange-fund"]));
    const hungary = (await listScholarshipsForCountry("hungary")).map((s) => s.slug).sort();
    expect(hungary).toEqual(["sample-debrecen-public-health-grant", "sample-hungary-government-scholarship"]);
  });

  it("reports an honest coverage count", async () => {
    expect(await getCoverage()).toEqual({ countries: 3, universities: 12, programs: 42, scholarships: 6, allSample: true, lastUpdated: null, newThisWeek: 0 });
  });
});

describe("freshness line", () => {
  it("finds the latest update and counts programs added in the last 7 days", async () => {
    const { freshness } = await import("@/lib/data");
    const now = Date.parse("2026-11-08T12:00:00Z");
    expect(
      freshness(
        [
          { updated_at: "2026-11-08T10:00:00Z", created_at: "2026-11-08T09:00:00Z" },
          { updated_at: "2026-11-07T10:00:00Z", created_at: "2026-10-01T09:00:00Z" },
          {},
        ],
        now,
      ),
    ).toEqual({ lastUpdated: "2026-11-08T10:00:00Z", newThisWeek: 1 });
  });
});
