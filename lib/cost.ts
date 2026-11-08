// What a program really costs a family, in taka.
// Total = tuition × years + yearly fees × years + application fee + city living cost × months.

import type { City, Country, CurrencyCode, ProgramContext } from "@/types";
import { canConvert, toBDT, type RateTable } from "./money";

export type Housing = "shared" | "studio";

/** Monthly living cost in the city's currency: rent + food + transport + phone + insurance; null until the city guide has costs. */
export function monthlyLivingCost(city: City, housing: Housing = "shared"): number | null {
  const rent = housing === "shared" ? city.cost_rent_shared : city.cost_rent_studio;
  const parts = [rent, city.cost_food, city.cost_transport, city.cost_phone, city.cost_insurance];
  return parts.some((x) => x === null) ? null : (parts as number[]).reduce((a, b) => a + b, 0);
}

/**
 * Monthly living cost as a range, in the country's currency: the city's own costs when its guide has
 * them (one figure), otherwise the country's range for a careful student (visa minimum → upper figure).
 */
export function livingRange(city: City, country: Country, housing: Housing = "shared"): { min: number; max: number; from: "city" | "country" } | null {
  const own = monthlyLivingCost(city, housing);
  if (own !== null) return { min: own, max: own, from: "city" };
  const min = country.living_cost_min ?? null;
  if (min === null) return null;
  return { min, max: Math.max(min, country.living_cost_max ?? min), from: "country" };
}

/** A part of the total that couldn't be worked out, so the site can say what's missing. */
export type CostGap = "tuition" | "duration" | "living" | "rate";

export interface ProgramCost {
  programCurrency: CurrencyCode | null;
  livingCurrency: CurrencyCode;
  years: number | null;
  /** In the program's currency. */
  tuitionTotal: number | null;
  feesTotal: number | null;
  applicationFee: number;
  /** In the country's currency; the low end when it's a range. */
  livingMonthly: number | null;
  livingTotal: number | null;
  /** High end of the monthly living cost (same as livingMonthly for a city's own figure). */
  livingMonthlyMax: number | null;
  /** Where the living cost comes from: the city's guide or the country's range. */
  livingFrom: "city" | "country" | null;
  /** In taka. A null means "not known": never read it as zero. */
  bdt: {
    tuitionPerYear: number | null;
    tuition: number | null;
    fees: number | null;
    application: number | null;
    livingMonthly: number | null;
    living: number | null;
    total: number | null;
    /** First 12 months (or the whole program if shorter), application fee included. */
    firstYear: number | null;
    /** High ends, when living costs are a range (equal to the low ends otherwise). */
    livingMonthlyMax: number | null;
    livingMax: number | null;
    totalMax: number | null;
  };
  /** Why total is null (empty when it's complete). */
  gaps: CostGap[];
}

export function programCost({ program, city, country }: ProgramContext, rates: RateTable, housing: Housing = "shared"): ProgramCost {
  const gaps: CostGap[] = [];
  const months = program.duration_months;
  if (months === null) gaps.push("duration");
  if (program.tuition_per_year === null) gaps.push("tuition");
  const range = livingRange(city, country, housing);
  const livingMonthly = range?.min ?? null;
  const livingMonthlyMax = range?.max ?? null;
  if (livingMonthly === null) gaps.push("living");
  // Fees without a tuition currency are charged in the country's currency.
  const feeCurrency = program.currency ?? country.currency;
  if ((program.tuition_per_year !== null && !canConvert(program.currency, rates)) || !canConvert(feeCurrency, rates) || !canConvert(country.currency, rates)) gaps.push("rate");

  const years = months === null ? null : months / 12;
  const firstMonths = months === null ? null : Math.min(12, months);
  const tuitionTotal = program.tuition_per_year !== null && years !== null ? program.tuition_per_year * years : null;
  const feesTotal = years === null ? null : program.other_fees_per_year * years;
  const livingTotal = livingMonthly !== null && months !== null ? livingMonthly * months : null;
  const livingTotalMax = livingMonthlyMax !== null && months !== null ? livingMonthlyMax * months : null;

  const conv = (amount: number | null, currency: CurrencyCode | null) => (amount === null || !canConvert(currency, rates) ? null : toBDT(amount, currency, rates));
  const bdt: ProgramCost["bdt"] = {
    tuitionPerYear: conv(program.tuition_per_year, program.currency),
    tuition: conv(tuitionTotal, program.currency),
    fees: conv(feesTotal, feeCurrency),
    application: conv(program.application_fee, feeCurrency),
    livingMonthly: conv(livingMonthly, country.currency),
    living: conv(livingTotal, country.currency),
    total: null,
    firstYear: null,
    livingMonthlyMax: conv(livingMonthlyMax, country.currency),
    livingMax: conv(livingTotalMax, country.currency),
    totalMax: null,
  };
  if (gaps.length === 0) {
    bdt.total = bdt.tuition! + bdt.fees! + bdt.application! + bdt.living!;
    bdt.totalMax = bdt.total - bdt.living! + bdt.livingMax!;
    bdt.firstYear =
      conv((program.tuition_per_year! + program.other_fees_per_year) * (firstMonths! / 12) + program.application_fee, program.currency)! +
      conv(livingMonthly! * firstMonths!, country.currency)!;
  }

  return {
    programCurrency: program.currency,
    livingCurrency: country.currency,
    years,
    tuitionTotal,
    feesTotal,
    applicationFee: program.application_fee,
    livingMonthly,
    livingTotal,
    livingMonthlyMax,
    livingFrom: range?.from ?? null,
    bdt,
    gaps,
  };
}

// ---------------------------------------------------------------- Tools: BDT cost calculator

export interface CostEstimateInput {
  tuitionPerYear: number;
  tuitionCurrency: CurrencyCode;
  months: number;
  livingMonthly: number;
  livingCurrency: CurrencyCode;
  /** One-time costs already in taka: visa fee, flight, deposit, etc. */
  oneTimeBDT?: number;
}

export interface CostEstimate {
  tuitionBDT: number;
  livingBDT: number;
  oneTimeBDT: number;
  totalBDT: number;
  perMonthBDT: number;
}

export function estimateCost(input: CostEstimateInput, rates: RateTable): CostEstimate {
  const months = Math.max(0, input.months);
  const tuitionBDT = toBDT((input.tuitionPerYear * months) / 12, input.tuitionCurrency, rates);
  const livingBDT = toBDT(input.livingMonthly * months, input.livingCurrency, rates);
  const oneTimeBDT = Math.max(0, input.oneTimeBDT ?? 0);
  const totalBDT = tuitionBDT + livingBDT + oneTimeBDT;
  return { tuitionBDT, livingBDT, oneTimeBDT, totalBDT, perMonthBDT: months > 0 ? totalBDT / months : 0 };
}
