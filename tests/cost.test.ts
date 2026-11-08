import { beforeAll, describe, expect, it } from "vitest";
import { estimateCost, monthlyLivingCost, programCost } from "@/lib/cost";
import { getProgramContext, listExchangeRates } from "@/lib/data";
import { rateTable, type RateTable } from "@/lib/money";
import type { ProgramContext } from "@/types";

let rates: RateTable;
const ctx = async (slug: string) => (await getProgramContext(slug)) as ProgramContext;

beforeAll(async () => {
  rates = rateTable(await listExchangeRates());
});

describe("program cost in taka", () => {
  it("adds tuition, fees, application fee and living costs (Milan, 2 years)", async () => {
    const c = programCost(await ctx("sum-msc-computer-science"), rates);
    // Milan shared: 600 + 280 + 30 + 12 + 15 = 937 a month
    expect(c.livingMonthly).toBe(937);
    expect(c.tuitionTotal).toBe(5600);
    // (5600 + 30 + 937 × 24) × 140
    expect(c.bdt.total).toBe(3936520);
    // (2800 + 30 + 937 × 12) × 140
    expect(c.bdt.firstYear).toBe(1970360);
  });

  it("converts tuition and living costs from different currencies (Budapest)", async () => {
    const c = programCost(await ctx("subp-msc-computer-science-engineering"), rates);
    expect(c.programCurrency).toBe("EUR");
    expect(c.livingCurrency).toBe("HUF");
    // (12000 + 150) EUR × 140 + 273,500 HUF × 24 × 0.35
    expect(c.bdt.total).toBeCloseTo(1701000 + 2297400);
  });

  it("includes semester fees for tuition-free programs (Berlin)", async () => {
    const c = programCost(await ctx("stub-msc-computer-science"), rates);
    expect(c.tuitionTotal).toBe(0);
    expect(c.bdt.fees).toBe(1300 * 140);
  });

  it("uses the country's range when the city has no costs, and shows the total as a range", async () => {
    const base = await ctx("sum-msc-computer-science");
    const noCityCosts = { ...base.city, cost_rent_shared: null };
    const country = { ...base.country, living_cost_min: 783, living_cost_max: 1020 };
    const c = programCost({ ...base, city: noCityCosts, country }, rates);
    expect(c.livingFrom).toBe("country");
    expect(c.livingMonthly).toBe(783);
    expect(c.livingMonthlyMax).toBe(1020);
    // (5600 + 30 + 783 × 24) × 140 and (5600 + 30 + 1020 × 24) × 140
    expect(c.bdt.total).toBe(3419080);
    expect(c.bdt.totalMax).toBe(4215400);
    // No country range either: no total.
    expect(programCost({ ...base, city: noCityCosts }, rates).bdt.total).toBeNull();
  });

  it("costs more with a studio than a shared room", async () => {
    const context = await ctx("sum-msc-computer-science");
    expect(monthlyLivingCost(context.city, "studio")).toBe(1437);
    expect(programCost(context, rates, "studio").bdt.total!).toBeGreaterThan(programCost(context, rates).bdt.total!);
  });

  it("handles programs shorter than a year in the first-year figure", async () => {
    const c = programCost(await ctx("ebs-mba-international-business"), rates);
    expect(c.bdt.firstYear).toBeCloseTo(c.bdt.total!);
  });
});

describe("BDT cost calculator (Tools)", () => {
  it("estimates a custom plan", () => {
    const e = estimateCost(
      { tuitionPerYear: 3000, tuitionCurrency: "EUR", months: 24, livingMonthly: 200000, livingCurrency: "HUF", oneTimeBDT: 250000 },
      rates,
    );
    expect(e.tuitionBDT).toBe(840000);
    expect(e.livingBDT).toBeCloseTo(1680000);
    expect(e.totalBDT).toBeCloseTo(2770000);
    expect(e.perMonthBDT).toBeCloseTo(2770000 / 24);
  });

  it("never goes negative", () => {
    const e = estimateCost({ tuitionPerYear: 1000, tuitionCurrency: "EUR", months: -3, livingMonthly: 500, livingCurrency: "EUR", oneTimeBDT: -10 }, rates);
    expect(e).toEqual({ tuitionBDT: 0, livingBDT: 0, oneTimeBDT: 0, totalBDT: 0, perMonthBDT: 0 });
  });
});
