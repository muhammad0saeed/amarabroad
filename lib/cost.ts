// What a program really costs a family, in taka.
// Total = tuition × years + yearly fees × years + application fee + city living cost × months.

import type { City, CurrencyCode, ProgramContext } from "@/types";
import { toBDT, type RateTable } from "./money";

export type Housing = "shared" | "studio";

/** Monthly living cost in the city's currency: rent + food + transport + phone + insurance. */
export function monthlyLivingCost(city: City, housing: Housing = "shared"): number {
  const rent = housing === "shared" ? city.cost_rent_shared : city.cost_rent_studio;
  return rent + city.cost_food + city.cost_transport + city.cost_phone + city.cost_insurance;
}

export interface ProgramCost {
  programCurrency: CurrencyCode;
  livingCurrency: CurrencyCode;
  years: number;
  /** In the program's currency. */
  tuitionTotal: number;
  feesTotal: number;
  applicationFee: number;
  /** In the city's currency. */
  livingMonthly: number;
  livingTotal: number;
  bdt: {
    tuitionPerYear: number;
    tuition: number;
    fees: number;
    application: number;
    livingMonthly: number;
    living: number;
    total: number;
    /** First 12 months (or the whole program if shorter), application fee included. */
    firstYear: number;
  };
}

export function programCost({ program, city, country }: ProgramContext, rates: RateTable, housing: Housing = "shared"): ProgramCost {
  const years = program.duration_months / 12;
  const firstMonths = Math.min(12, program.duration_months);
  const tuitionTotal = program.tuition_per_year * years;
  const feesTotal = program.other_fees_per_year * years;
  const livingMonthly = monthlyLivingCost(city, housing);
  const livingTotal = livingMonthly * program.duration_months;

  const p = (amount: number) => toBDT(amount, program.currency, rates);
  const l = (amount: number) => toBDT(amount, country.currency, rates);
  const bdt = {
    tuitionPerYear: p(program.tuition_per_year),
    tuition: p(tuitionTotal),
    fees: p(feesTotal),
    application: p(program.application_fee),
    livingMonthly: l(livingMonthly),
    living: l(livingTotal),
    total: 0,
    firstYear:
      p((program.tuition_per_year + program.other_fees_per_year) * (firstMonths / 12) + program.application_fee) +
      l(livingMonthly * firstMonths),
  };
  bdt.total = bdt.tuition + bdt.fees + bdt.application + bdt.living;

  return {
    programCurrency: program.currency,
    livingCurrency: country.currency,
    years,
    tuitionTotal,
    feesTotal,
    applicationFee: program.application_fee,
    livingMonthly,
    livingTotal,
    bdt,
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
