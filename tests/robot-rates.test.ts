import { describe, expect, it } from "vitest";
import { ratesFromFeed } from "../robot/rates.ts";

describe("exchange rates", () => {
  const feed = { date: "2026-11-08", perTaka: { eur: 0.0071885, usd: 0.0080148, krw: 10.94, xyz: 0 } };

  it("turns 'per taka' into taka per unit", () => {
    const { rates } = ratesFromFeed(feed, ["EUR", "USD", "KRW"], {});
    expect(rates).toEqual({ EUR: 139.1111, USD: 124.7692, KRW: 0.0914 });
  });

  it("skips missing currencies and sudden jumps", () => {
    const { rates, skipped } = ratesFromFeed(feed, ["EUR", "GBP", "XYZ", "USD"], { USD: 80 });
    expect(Object.keys(rates)).toEqual(["EUR"]);
    expect(skipped.GBP).toBe("not in the feed");
    expect(skipped.XYZ).toBe("not in the feed");
    expect(skipped.USD).toMatch(/kept the old rate/);
  });
});
