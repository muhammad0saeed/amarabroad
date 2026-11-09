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

  it("visits pages that just changed or changed this week every 6 hours", () => {
    expect(nextCheckHours({ changedNow: true, lastChangedAt: null, deadlines: [], now })).toBe(HOURS.hot);
    expect(nextCheckHours({ changedNow: false, lastChangedAt: ago(3), deadlines: [], now })).toBe(HOURS.hot);
  });

  it("visits pages with a deadline in the next 45 days every 6 hours", () => {
    expect(nextCheckHours({ changedNow: false, lastChangedAt: ago(200), deadlines: [ahead(20)], now })).toBe(HOURS.hot);
    expect(nextCheckHours({ changedNow: false, lastChangedAt: ago(30), deadlines: [ahead(120)], now })).toBe(HOURS.normal);
  });

  it("visits long-quiet pages every 2 days, the rest daily", () => {
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
