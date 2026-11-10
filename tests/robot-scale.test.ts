import { describe, expect, it } from "vitest";
import { interleave, pool, shardOf } from "@/robot/pool";
import { choose } from "@/robot/seed-top";
import { HOURS, nextCheckHours } from "@/robot/schedule";

const inst = (id: string, h: number) => ({
  id,
  display_name: id,
  homepage_url: `https://${id}.edu`,
  geo: { city: "City", country_code: "XX" },
  summary_stats: { h_index: h },
  cited_by_count: h,
  ids: {},
});

describe("choosing the top universities", () => {
  const lists = new Map([
    ["US", [inst("us1", 900), inst("us2", 800), inst("us3", 700), inst("us4", 600)]],
    ["MT", [inst("mt1", 50), inst("mt2", 10)]],
  ]);

  it("gives every country its floor, then fills by rank", () => {
    // Malta's two make the cut although the US's 3rd and 4th rank higher.
    expect(choose(lists, 4, 2).map((p) => p.inst.id)).toEqual(["us1", "us2", "mt1", "mt2"]);
  });

  it("ranks overall and within the country by h-index", () => {
    const picks = choose(lists, 5, 1);
    expect(picks.map((p) => [p.inst.id, p.rank, p.countryRank])).toEqual([
      ["us1", 1, 1],
      ["us2", 2, 2],
      ["us3", 3, 3],
      ["us4", 4, 4],
      ["mt1", 5, 1],
    ]);
  });

  it("takes everything a small country has when the floor is higher", () => {
    expect(choose(lists, 100, 10)).toHaveLength(6);
  });
});

describe("sharing the daily check between jobs", () => {
  it("always puts a university in the same shard, and uses every shard", () => {
    const keys = Array.from({ length: 200 }, (_, i) => `university-${i}`);
    expect(keys.map((k) => shardOf(k, 4))).toEqual(keys.map((k) => shardOf(k, 4)));
    expect(new Set(keys.map((k) => shardOf(k, 4)))).toEqual(new Set([0, 1, 2, 3]));
  });

  it("alternates between universities so parallel workers hit different websites", () => {
    const rows = ["a", "a", "a", "b", "c", "c"].map((university, i) => ({ university, i }));
    expect(interleave(rows).map((r) => r.university)).toEqual(["a", "b", "c", "a", "c", "a"]);
  });

  it("does every item, and none after the deadline", async () => {
    const done: number[] = [];
    await pool([1, 2, 3, 4, 5], 2, Infinity, async (n) => void done.push(n));
    expect(done.sort()).toEqual([1, 2, 3, 4, 5]);
    const late: number[] = [];
    await pool([1, 2, 3], 2, Date.now() - 1, async (n) => void late.push(n));
    expect(late).toEqual([]);
  });
});

describe("when to visit a page next", () => {
  const now = new Date("2026-11-07T00:00:00Z");
  const ago = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
  const ahead = (days: number) => new Date(now.getTime() + days * 86_400_000).toISOString().slice(0, 10);

  it("visits pages with a deadline in the next 45 days twice a day, before anything else", () => {
    expect(HOURS.deadline).toBe(12);
    expect(nextCheckHours({ changedNow: false, lastChangedAt: ago(200), deadlines: [ahead(20)], now })).toBe(HOURS.deadline);
    expect(nextCheckHours({ changedNow: true, lastChangedAt: null, deadlines: [ahead(10)], now })).toBe(HOURS.deadline);
    expect(nextCheckHours({ changedNow: false, lastChangedAt: ago(30), deadlines: [ahead(120)], now })).toBe(HOURS.normal);
  });

  it("visits pages that just changed or changed this week daily", () => {
    expect(nextCheckHours({ changedNow: true, lastChangedAt: null, deadlines: [], now })).toBe(HOURS.changed);
    expect(nextCheckHours({ changedNow: false, lastChangedAt: ago(3), deadlines: [], now })).toBe(HOURS.changed);
  });

  it("visits long-quiet pages weekly, the rest every 3 days", () => {
    expect([HOURS.normal, HOURS.quiet]).toEqual([72, 168]);
    expect(nextCheckHours({ changedNow: false, lastChangedAt: ago(120), deadlines: [ahead(-30)], now })).toBe(HOURS.quiet);
    expect(nextCheckHours({ changedNow: false, lastChangedAt: ago(30), deadlines: [], now })).toBe(HOURS.normal);
    expect(nextCheckHours({ changedNow: false, lastChangedAt: null, deadlines: [], now })).toBe(HOURS.normal);
  });
});

describe("deadlines first", () => {
  it("counts only deadlines that are still ahead (a week's grace)", async () => {
    const { hasUpcomingDeadline } = await import("@/robot/deadlines");
    expect(hasUpcomingDeadline([{ deadline: "2027-01-15" }], "2026-11-10")).toBe(true);
    expect(hasUpcomingDeadline([{ deadline: "2026-11-05" }], "2026-11-10")).toBe(true);
    expect(hasUpcomingDeadline([{ deadline: "2026-10-01" }], "2026-11-10")).toBe(false);
    expect(hasUpcomingDeadline([], "2026-11-10")).toBe(false);
    expect(hasUpcomingDeadline(null, "2026-11-10")).toBe(false);
  });

  it("puts the best-ranked universities first", async () => {
    const { byRank } = await import("@/robot/deadlines");
    const rank = new Map([["oxford", 7], ["harvard", 2]]);
    expect(byRank([{ university: "unranked" }, { university: "oxford" }, { university: "harvard" }], rank).map((r) => r.university)).toEqual(["harvard", "oxford", "unranked"]);
  });
});

describe("university-wide fallback deadlines", () => {
  const fact = (quote: string, deadline: string, extra: Partial<{ level: "bachelor" | "master" | null; for: string; source_url: string }> = {}) => ({
    university: "u",
    level: extra.level ?? null,
    value: { deadline, for: extra.for ?? "all" },
    quote,
    source_url: extra.source_url ?? "https://www.example.ac.uk/apply",
  });

  it("accepts only plain, general application deadlines", async () => {
    const { isGeneralApplicationDeadline: ok } = await import("@/robot/deadlines");
    expect(ok("For 2027 entry, the closing date for receipt of applications is 13 January 2027 at 6pm")).toBe(true);
    expect(ok("• Application deadline: 15 January 2027")).toBe(true);
    expect(ok("Deadline: November 15")).toBe(true);
    // money, after admission, other students, not final, one program, not a deadline
    expect(ok("November 15 Deadline to submit the CSS Financial Aid/PROFILE and FAFSA")).toBe(false);
    expect(ok("Deadline to accept fall offer of admission dated April 1")).toBe(false);
    expect(ok("Academic appeal deadline: April 1")).toBe(false);
    expect(ok("Fall 2027 Transfer Admissions Application deadline December 11")).toBe(false);
    expect(ok("Nov. 15 - Early Action Deadline")).toBe(false);
    expect(ok("Application deadline for Engineering programs (excluding Architecture) – January 15")).toBe(false);
    expect(ok("Term 2 application closing dates With credit: 3 February 2027 Teaching starts: 8 March 2027")).toBe(false);
    expect(ok("Please refer to the specific programs for information on application deadlines")).toBe(false);
  });

  it("estimates the start month, prefers the program's level, and skips unclear calendars", async () => {
    const { fallbackFor } = await import("@/robot/deadlines");
    const today = "2026-11-10";
    expect(fallbackFor([fact("Application deadline: 30 November 2026", "2026-11-30", { source_url: "https://www.uts.edu.au/apply" })], "master", today)).toMatchObject([
      { deadline: "2026-11-30", month: 2, year: 2027, estimated: true, university_wide: true },
    ]);
    // A bachelor-only page beats a page for both levels.
    const both = [fact("Application deadline: 15 January 2027", "2027-01-15", { level: "bachelor" }), fact("Application deadline: 1 March 2027", "2027-03-01")];
    expect(fallbackFor(both, "bachelor", today).map((i) => i.deadline)).toEqual(["2027-01-15"]);
    expect(fallbackFor(both, "master", today).map((i) => i.deadline)).toEqual(["2027-03-01"]);
    // North America: "spring/winter" is a January start; a sentence with both fall and spring is skipped.
    expect(fallbackFor([fact("• Nov. 15 : General application deadline for Winter term", "2026-11-15", { source_url: "https://www.unb.ca/apply" })], "master", today)[0]).toMatchObject({ month: 1, year: 2027 });
    expect(fallbackFor([fact("Application Deadlines • Fall Semester: June 30 • Spring Semester: November 30", "2026-11-30", { source_url: "https://www.wright.edu/apply" })], "master", today)).toEqual([]);
    // EU-only and past deadlines are never used.
    expect(fallbackFor([fact("Application deadline: 15 January 2027", "2027-01-15", { for: "eu" })], "master", today)).toEqual([]);
    expect(fallbackFor([fact("Application deadline: 1 October 2026", "2026-10-01")], "master", today)).toEqual([]);
  });
});

describe("fewer database writes", () => {
  it("saves 'still the same' at most every 3 days", async () => {
    const { confirmDue } = await import("@/robot/schedule");
    expect(confirmDue(null, "2026-11-11")).toBe(true);
    expect(confirmDue("2026-11-10", "2026-11-11")).toBe(false);
    expect(confirmDue("2026-11-08", "2026-11-11")).toBe(true);
  });
});
