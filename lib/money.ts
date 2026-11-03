// Money formatting: taka first ("৳ 12.5 lakh"), local currency second ("€2,800").
// Built by hand rather than with Intl so output is identical on every phone and in tests.

import type { CurrencyCode, ExchangeRate } from "@/types";
import { localizeDigits, type AppLocale } from "./localize";

/** BDT per one unit of each currency. */
export type RateTable = Record<CurrencyCode, number>;

export function rateTable(rates: ExchangeRate[]): RateTable {
  return Object.fromEntries(rates.map((r) => [r.currency, r.bdt_per_unit])) as RateTable;
}

export function toBDT(amount: number, currency: CurrencyCode, rates: RateTable): number {
  return amount * rates[currency];
}

/** 1234567 → "12,34,567" (lakh/crore grouping). */
export function formatIndianInteger(value: number): string {
  const sign = value < 0 ? "-" : "";
  const digits = String(Math.round(Math.abs(value)));
  if (digits.length <= 3) return sign + digits;
  const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${sign}${rest},${digits.slice(-3)}`;
}

/** 12500.5 → "12,500.5" (thousands grouping, up to `maxFraction` decimals, trailing zeros dropped). */
export function formatWestern(value: number, maxFraction = 2): string {
  const fixed = Number(value.toFixed(maxFraction));
  const [int = "0", frac] = String(Math.abs(fixed)).split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${fixed < 0 ? "-" : ""}${grouped}${frac ? `.${frac}` : ""}`;
}

const trim = (value: number, places: number) => String(Number(value.toFixed(places)));

const UNITS: Record<AppLocale, { lakh: string; crore: string }> = {
  en: { lakh: "lakh", crore: "crore" },
  bn: { lakh: "লাখ", crore: "কোটি" },
};

/**
 * Taka amount. Compact (default): "৳ 85,000", "৳ 12.5 lakh", "৳ 1.25 crore".
 * Full: "৳ 12,50,000". Bangla locale uses Bangla digits and units.
 */
export function formatBDT(amount: number, locale: AppLocale = "en", { compact = true } = {}): string {
  const abs = Math.abs(amount);
  const lakhs = Number((amount / 1e5).toFixed(1));
  let body: string;
  if (compact && (abs >= 1e7 || Math.abs(lakhs) >= 100)) body = `${trim(amount / 1e7, 2)} ${UNITS[locale].crore}`;
  else if (compact && abs >= 1e5) body = `${trim(lakhs, 1)} ${UNITS[locale].lakh}`;
  else body = formatIndianInteger(amount);
  return localizeDigits(`৳ ${body}`, locale);
}

const SYMBOLS: Record<CurrencyCode, { symbol: string; suffix: boolean }> = {
  EUR: { symbol: "€", suffix: false },
  HUF: { symbol: "Ft", suffix: true },
};

/** Local currency: "€2,800", "160,000 Ft". */
export function formatMoney(amount: number, currency: CurrencyCode, locale: AppLocale = "en"): string {
  const { symbol, suffix } = SYMBOLS[currency];
  const number = formatWestern(amount, 2);
  return localizeDigits(suffix ? `${number} ${symbol}` : `${symbol}${number}`, locale);
}
