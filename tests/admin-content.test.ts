import { describe, expect, it } from "vitest";
import { readForm, sameValue, slugify, TABLES, allFields, TABLE_ORDER } from "@/lib/admin/content";

const form = (entries: [string, string][]) => {
  const f = new FormData();
  for (const [k, v] of entries) f.append(k, v);
  return f;
};
const program = (extra: [string, string][] = []) =>
  form([
    ["f.title", "Data Science MSc"],
    ["f.university", "tum"],
    ["f.degree_level", "master"],
    ["f.official_url", "https://www.tum.de/x"],
    ["f.other_fees_per_year", "0"],
    ["f.application_fee", "0"],
    ...extra,
  ]);

describe("content manager: reading the form", () => {
  it("keeps missing facts empty (null), never 0", () => {
    const { values, errors } = readForm(TABLES.programs, program());
    expect(errors).toEqual({});
    expect(values.tuition_per_year).toBeNull();
    expect(values.accepts_moi).toBeNull();
    expect(values.min_gpa_requirement).toBeNull();
    expect(values.intakes).toEqual([]);
    expect(values.published).toBe(false);
  });

  it("reads numbers, yes/no/not stated, rows and groups", () => {
    const { values, errors } = readForm(
      TABLES.programs,
      program([
        ["f.tuition_per_year", "6,000"],
        ["f.currency", "eur"],
        ["f.accepts_moi", "no"],
        ["f.intakes.count", "3"],
        ["f.intakes.0.month", "10"], ["f.intakes.0.year", "2027"], ["f.intakes.0.deadline", "2027-05-31"],
        ["f.intakes.1.month", ""], ["f.intakes.1.year", ""], ["f.intakes.1.deadline", ""],
        ["f.min_gpa_requirement.value", "3.0"], ["f.min_gpa_requirement.scale", "4"],
        ["f.required_documents", "cv"], ["f.required_documents", "passport"],
        ["f.career_paths_en", "Data scientist\r\n\r\nML engineer"],
      ]),
    );
    expect(errors).toEqual({});
    expect(values).toMatchObject({
      tuition_per_year: 6000,
      currency: "EUR",
      accepts_moi: false,
      intakes: [{ month: 10, year: 2027, deadline: "2027-05-31" }],
      min_gpa_requirement: { value: 3, scale: 4 },
      required_documents: ["cv", "passport"],
      career_paths_en: ["Data scientist", "ML engineer"],
    });
  });

  it("says what's wrong instead of saving half a row or a bad value", () => {
    const { errors } = readForm(
      TABLES.programs,
      form([
        ["f.title", ""],
        ["f.official_url", "tum.de"],
        ["f.duration_months", "500"],
        ["f.intakes.count", "1"], ["f.intakes.0.month", "10"],
        ["f.min_gpa_requirement.value", "3.0"],
      ]),
    );
    expect(errors.title).toBe("Required");
    expect(errors.official_url).toMatch(/http/);
    expect(errors.duration_months).toMatch(/At most/);
    expect(errors.intakes).toMatch(/Row 1: fill in Year, Apply by/);
    expect(errors.min_gpa_requirement).toMatch(/Out of/);
  });

  it("builds nested objects from dotted names (a scholarship's cash grant)", () => {
    const { values } = readForm(
      TABLES.scholarships,
      form([["f.coverage.tuition", "full"], ["f.coverage.stipend.amount", "5200"], ["f.coverage.stipend.currency", "EUR"], ["f.coverage.summary_en", "Free tuition and a grant."]]),
    );
    expect(values.coverage).toEqual({ tuition: "full", stipend: { amount: 5200, currency: "EUR" }, summary_en: "Free tuition and a grant." });
  });

  it("compares like the database: numeric strings and key order don't count as changes", () => {
    expect(sameValue(6000, "6000.00")).toBe(true);
    expect(sameValue({ year: 2027, month: 10 }, { month: 10, year: 2027 })).toBe(true);
    expect(sameValue(null, "")).toBe(true);
    expect(sameValue(null, 0)).toBe(false);
    expect(sameValue([], null)).toBe(false);
  });

  it("makes clean IDs", () => {
    expect(slugify("Università di Bologna – Data Science (M.Sc.)")).toBe("universita-di-bologna-data-science-m-sc");
  });

  it("every editable field names a real column once per table", () => {
    for (const key of TABLE_ORDER) {
      const names = allFields(TABLES[key]).map((f) => f.name);
      expect(new Set(names).size, key).toBe(names.length);
    }
  });
});
