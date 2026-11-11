import { beforeAll, describe, expect, it, vi } from "vitest";
import { listProgramContexts, listScholarships, listScholarshipsForProgram } from "@/lib/data";
import { parseFilters } from "@/lib/filters";
import { APPLIES_SAMPLE_SIZE, scholarshipAppliesGroups, scholarshipCovers } from "@/lib/scholarshipPrograms";
import { searchPrograms } from "@/lib/search";
import type { ProgramContext, Scholarship } from "@/types";

// lib/search.ts is server-only (a Next.js guard); in tests it is plain code.
vi.mock("server-only", () => ({}));

let contexts: ProgramContext[];
let scholarships: Scholarship[];

beforeAll(async () => {
  contexts = await listProgramContexts();
  scholarships = await listScholarships();
});

describe("scholarship 'Where it applies' list", () => {
  it("lists at most a few programs per country, however many it covers", () => {
    // A country-wide scholarship over thousands of programs, like Chevening over every UK master's.
    const base = contexts.find((c) => c.program.degree_level === "master")!;
    const many = Array.from({ length: 4050 }, (_, i) => ({ ...base, program: { ...base.program, slug: `${base.program.slug}-${i}` } }));
    const s = { levels: ["master"], programs: [], universities: [], countries: [base.country.slug], bd_eligible: true } as unknown as Scholarship;
    const [group, ...rest] = scholarshipAppliesGroups(s, many);
    expect(rest).toHaveLength(0);
    expect(group!.total).toBe(4050);
    expect(group!.sample).toHaveLength(APPLIES_SAMPLE_SIZE);
    expect(group!.searchHref).toBe(`/programs?country=${base.country.slug}&level=master&sch=1`);
  });

  it("covers the same programs as the program pages do", async () => {
    for (const s of scholarships) {
      for (const ctx of contexts) {
        const onProgramPage = (await listScholarshipsForProgram(ctx.program.slug)).some((x) => x.slug === s.slug);
        expect(scholarshipCovers(s, ctx), `${s.slug} / ${ctx.program.slug}`).toBe(onProgramPage);
      }
    }
  });

  it("links to a search whose result count matches the count shown", async () => {
    for (const s of scholarships) {
      for (const group of scholarshipAppliesGroups(s, contexts)) {
        expect(group.sample.length).toBeLessThanOrEqual(group.searchHref ? APPLIES_SAMPLE_SIZE : group.total);
        if (!group.searchHref) {
          expect(group.sample).toHaveLength(group.total);
          continue;
        }
        const query = new URLSearchParams(group.searchHref.split("?")[1]);
        const result = await searchPrograms(parseFilters(query), "2026-11-04");
        expect(result.total, `${s.slug} in ${group.country.slug}`).toBe(group.total);
      }
    }
  });

  it("shows every program of a hand-picked list (no search filter can reach them)", () => {
    const s = scholarships.find((x) => x.programs.length && !x.universities.length && !x.countries.length)!;
    const groups = scholarshipAppliesGroups(s, contexts);
    expect(groups.every((g) => g.searchHref === null && g.sample.length === g.total)).toBe(true);
  });
});
