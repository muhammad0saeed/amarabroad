// Where a scholarship's round stands (robot/scholarships.ts), shared by server and client components.

import type { AppLocale } from "./localize";
import type { Scholarship, ScholarshipRound } from "@/types";

export type RoundInfo = Pick<Scholarship, "deadline" | "round_status" | "last_deadline">;

/** Where the round stands; older sample data has only a deadline. */
export function roundOf(s: RoundInfo): ScholarshipRound {
  return s.round_status ?? (s.deadline ? "open" : "unknown");
}

/** The usual yearly timeline in the page language (null when not written). */
export function cycleOf(s: Pick<Scholarship, "cycle_en" | "cycle_bn">, locale: AppLocale): string | null {
  return (locale === "bn" && s.cycle_bn) || s.cycle_en || null;
}

/** Sort order for lists: a known deadline first (soonest first), then open, varying, not announced, closed. */
export function roundRank(s: RoundInfo, today: string): number {
  if (s.deadline && (!today || s.deadline >= today)) return 0;
  return { open: 1, varies: 2, unknown: 3, closed: 4 }[roundOf(s)];
}
