// Page helpers for Server Components: locale setup and data every page reuses.

import { setRequestLocale } from "next-intl/server";
import { listExchangeRates, listFields, listProgramContexts } from "./data";
import type { FitContext } from "./fitScore";
import type { AppLocale } from "./localize";
import { rateTable, type RateTable } from "./money";
import { summarizeProgram, type ProgramSummary } from "./summary";
import type { FieldGroup, TileColor } from "@/types";

export type LocaleParams = { params: Promise<{ locale: string }> };

/** Reads the locale from the route and enables static rendering for it. */
export async function initPage(params: Promise<{ locale: string }>): Promise<AppLocale> {
  const { locale } = await params;
  setRequestLocale(locale);
  return locale as AppLocale;
}

export async function getRates(): Promise<RateTable> {
  return rateTable(await listExchangeRates());
}

export async function getFitContext(): Promise<FitContext> {
  return { fieldGroups: Object.fromEntries((await listFields()).map((f) => [f.slug, f.group])) };
}

/** Field slug → display names, for cards and filters. */
export async function getFieldNames(): Promise<Record<string, { en: string; bn: string }>> {
  return Object.fromEntries((await listFields()).map((f) => [f.slug, { en: f.name_en, bn: f.name_bn }]));
}

/** Field slug → name, group and tile colour, for icon tiles on cards. */
export async function getFieldInfo(): Promise<Record<string, { name: { en: string; bn: string }; group: FieldGroup; tile: TileColor }>> {
  return Object.fromEntries((await listFields()).map((f) => [f.slug, { name: { en: f.name_en, bn: f.name_bn }, group: f.group, tile: f.tile }]));
}

export async function getSummaries(): Promise<ProgramSummary[]> {
  const rates = await getRates();
  return (await listProgramContexts()).map((ctx) => summarizeProgram(ctx, rates));
}
