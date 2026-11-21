import { describe, expect, it } from "vitest";
import { inScope, levelInScope, SCOPE, SCOPE_FILTER } from "@/robot/scope";

describe("what the site covers (robot/scope.ts)", () => {
  it("keeps the world top 700 and each country's top 3", () => {
    expect(SCOPE.worldRank).toBe(700);
    expect(inScope({ rank: 6, country_rank: 1 })).toBe(true);
    expect(inScope({ rank: 700, country_rank: 40 })).toBe(true);
    expect(inScope({ rank: 701, country_rank: 40 })).toBe(false);
    expect(inScope({ rank: 2400, country_rank: 2 })).toBe(true); // e.g. Latvia's second university
    expect(inScope(null)).toBe(false);
    expect(SCOPE_FILTER).toBe("ranking->rank.lte.700,ranking->country_rank.lte.3");
  });

  it("lists master's programs only", () => {
    expect(levelInScope("master")).toBe(true);
    expect(levelInScope("bachelor")).toBe(false);
    expect(levelInScope(undefined)).toBe(false);
  });
});
