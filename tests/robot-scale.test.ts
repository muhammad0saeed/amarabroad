import { describe, expect, it } from "vitest";
import { interleave, pool, shardOf } from "@/robot/pool";
import { choose } from "@/robot/seed-top";

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
