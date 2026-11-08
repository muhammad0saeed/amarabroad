"use server";

// Programs for pages that run in the browser (quiz results, compare, saved). They used to receive
// every program (about 20 MB with 18,000 programs); now they ask for just what they show.

import { computeFit, type FitResult } from "@/lib/fitScore";
import { parseProfile } from "@/lib/profile";
import { getCatalogue } from "@/lib/search";
import { getFitContext } from "@/lib/server";
import type { ProgramSummary } from "@/lib/summary";

/** Most programs one call returns (saved lists and comparisons are short). */
const MAX_SLUGS = 100;
/** Best matches the quiz shows, and how many of the not-eligible ones it lists. */
const MAX_MATCHES = 60;
const MAX_INELIGIBLE = 30;

/** Summaries for these program slugs, in the same order; unknown slugs are left out. */
export async function programsBySlug(slugs: unknown): Promise<ProgramSummary[]> {
  if (!Array.isArray(slugs)) return [];
  const wanted = [...new Set(slugs.filter((s): s is string => typeof s === "string" && s.length <= 200))].slice(0, MAX_SLUGS);
  if (!wanted.length) return [];
  const bySlug = new Map((await getCatalogue()).map((p) => [p.slug, p]));
  return wanted.map((s) => bySlug.get(s)).filter((p): p is ProgramSummary => p !== undefined);
}

export interface MatchItem {
  program: ProgramSummary;
  fit: FitResult;
}

export interface MatchResult {
  eligible: MatchItem[];
  eligibleCount: number;
  ineligible: MatchItem[];
  ineligibleCount: number;
}

/** The quiz: every program of the student's level scored on the server, best first. */
export async function matchPrograms(rawProfile: unknown, options: { onlyMine?: unknown; withinBudget?: unknown }): Promise<MatchResult | null> {
  const profile = parseProfile(rawProfile);
  if (!profile) return null;
  const onlyMine = options.onlyMine === true;
  const withinBudget = options.withinBudget === true;
  const budget = profile.budget_bdt_total;
  const level = profile.field.startsWith("hsc-") ? "bachelor" : "master";
  const ctx = await getFitContext();
  const scored = (await getCatalogue())
    .filter((p) => p.degree_level === level)
    .filter(
      (p) =>
        !onlyMine ||
        ((!profile.target_countries.length || profile.target_countries.includes(p.country.slug)) &&
          (!profile.target_fields.length || profile.target_fields.includes(p.field))),
    )
    .filter((p) => !withinBudget || budget === null || (p.total_bdt !== null && p.total_bdt <= budget))
    .map((p) => ({ program: p, fit: computeFit(profile, p, ctx) }));
  const eligible = scored.filter((x) => x.fit.eligible).sort((a, b) => score(b.fit) - score(a.fit));
  const ineligible = scored.filter((x) => !x.fit.eligible);
  return {
    eligible: eligible.slice(0, MAX_MATCHES),
    eligibleCount: eligible.length,
    ineligible: ineligible.slice(0, MAX_INELIGIBLE),
    ineligibleCount: ineligible.length,
  };
}

const score = (fit: FitResult) => (fit.eligible ? fit.score : -1);
