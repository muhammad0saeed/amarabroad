// Daily exchange rates to Bangladeshi taka, so every program can show its total cost in taka.
//
// Source: the free currency dataset by Fawaz Ahmed (github.com/fawazahmed0/exchange-api), public
// domain (CC0), updated daily from central-bank and market rates, no key needed. Rates are for
// planning only; a bank's rate on the day will differ a little.

import { db } from "./db.ts";
import { USER_AGENT } from "./fetch.ts";

const SOURCES = [
  "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/bdt.json",
  "https://latest.currency-api.pages.dev/v1/currencies/bdt.json",
];
/** Shown on the site as where the rates come from. */
export const RATES_SOURCE_PAGE = "https://github.com/fawazahmed0/exchange-api";
/** A rate that moves more than this in a day is held back (a broken feed, not a real move). */
const MAX_DAILY_CHANGE = 0.25;

export interface RateFeed {
  date: string;
  /** Currency code (lower case) → units of that currency per 1 taka. */
  perTaka: Record<string, number>;
}

/** Taka per unit of each wanted currency, or a reason it was skipped. */
export function ratesFromFeed(feed: RateFeed, wanted: string[], current: Record<string, number>) {
  const rates: Record<string, number> = {};
  const skipped: Record<string, string> = {};
  for (const code of wanted) {
    const perTaka = feed.perTaka[code.toLowerCase()];
    if (!perTaka || !Number.isFinite(perTaka) || perTaka <= 0) {
      skipped[code] = "not in the feed";
      continue;
    }
    const bdt = Math.round((1 / perTaka) * 10_000) / 10_000;
    const before = current[code];
    if (before && Math.abs(bdt - before) / before > MAX_DAILY_CHANGE) {
      skipped[code] = `moved from ${before} to ${bdt} in a day; kept the old rate`;
      continue;
    }
    if (bdt <= 0) {
      skipped[code] = "rounds to zero";
      continue;
    }
    rates[code] = bdt;
  }
  return { rates, skipped };
}

async function fetchFeed(): Promise<RateFeed> {
  let last: unknown;
  for (const url of SOURCES) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { date?: unknown; bdt?: unknown };
      if (typeof json.date !== "string" || !json.bdt || typeof json.bdt !== "object") throw new Error("unexpected format");
      return { date: json.date, perTaka: json.bdt as Record<string, number> };
    } catch (e) {
      last = e;
    }
  }
  throw new Error(`exchange rates: ${last instanceof Error ? last.message : String(last)}`);
}

/** Updates exchange_rates for every currency a country or program uses. Hand-entered rates (origin admin) are left alone. */
export async function updateRates(log: (line: string) => void) {
  const [countries, programs, existing] = await Promise.all([
    db().from("countries").select("currency"),
    db().from("programs").select("currency").not("currency", "is", null).limit(5000),
    db().from("exchange_rates").select("currency, bdt_per_unit, origin"),
  ]);
  for (const r of [countries, programs, existing]) if (r.error) throw new Error(`exchange rates: ${r.error.message}`);
  const wanted = [...new Set([...(countries.data ?? []), ...(programs.data ?? [])].map((r) => r.currency as string).filter((c) => /^[A-Z]{3}$/.test(c) && c !== "BDT"))].sort();
  const rows = (existing.data ?? []) as { currency: string; bdt_per_unit: string | number; origin: string }[];
  const byHand = new Set(rows.filter((r) => r.origin === "admin").map((r) => r.currency));
  // Sample rates (made-up numbers) are replaced without the daily-change check.
  const current = Object.fromEntries(rows.filter((r) => r.origin === "robot").map((r) => [r.currency, Number(r.bdt_per_unit)]));
  const feed = await fetchFeed();
  const { rates, skipped } = ratesFromFeed(feed, wanted.filter((c) => !byHand.has(c)), current);
  const today = new Date().toISOString().slice(0, 10);
  const upserts = Object.entries(rates).map(([currency, bdt]) => ({
    currency,
    bdt_per_unit: bdt,
    updated_on: feed.date,
    source_url: RATES_SOURCE_PAGE,
    last_verified: today,
    is_sample: false,
    origin: "robot",
    published: true,
  }));
  if (upserts.length) {
    const { error } = await db().from("exchange_rates").upsert(upserts, { onConflict: "currency" });
    if (error) throw new Error(`exchange rates: ${error.message}`);
  }
  log(`Exchange rates of ${feed.date}: ${Object.entries(rates).map(([c, v]) => `${c} ৳${v}`).join(", ") || "none"}`);
  for (const [c, why] of Object.entries(skipped)) log(`  ${c} skipped: ${why}`);
  if (byHand.size) log(`  Left alone (entered by hand): ${[...byHand].join(", ")}`);
}
