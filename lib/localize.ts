// Picking the right language from content records: `_bn` when present, else `_en`.

import type { Bilingual } from "@/types";

export type AppLocale = "en" | "bn";

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";

/** "2027" → "২০২৭" in Bangla; unchanged in English. */
export function localizeDigits(text: string, locale: AppLocale): string {
  return locale === "bn" ? text.replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]!) : text;
}

/** A plain number as text, with Bangla digits in Bangla. */
export function formatNumber(value: number, locale: AppLocale, maxFraction = 1): string {
  return localizeDigits(String(Number(value.toFixed(maxFraction))), locale);
}

type WithLocalized<K extends string> = { [P in `${K}_en`]: string } & { [P in `${K}_bn`]?: string };

/** pick(country, "overview", "bn") → overview_bn, falling back to overview_en. */
export function pick<K extends string>(record: WithLocalized<K>, key: K, locale: AppLocale): string {
  const bn = (record as Record<string, string | undefined>)[`${key}_bn`];
  return locale === "bn" && bn ? bn : (record as Record<string, string>)[`${key}_en`]!;
}

/** True when the Bangla page is showing English because the Bangla text is missing. */
export function isFallback<K extends string>(record: WithLocalized<K>, key: K, locale: AppLocale): boolean {
  return locale === "bn" && !(record as Record<string, string | undefined>)[`${key}_bn`];
}

export function bilingual(text: Bilingual, locale: AppLocale): string {
  return locale === "bn" && text.bn ? text.bn : text.en;
}

/** Parallel `_en` / `_bn` lists, e.g. career paths. */
export function pickList(en: string[], bn: string[] | undefined, locale: AppLocale): string[] {
  return locale === "bn" && bn && bn.length === en.length ? bn : en;
}
