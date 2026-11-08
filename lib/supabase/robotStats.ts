import "server-only";

// What the robots did in the last 24 hours (supabase/12_robot_stats.sql), for /admin and the public
// "collected by our robot" counter. One database call.

import { DATA_SOURCE } from "../source";
import { serviceClient } from "./clients";

export interface RobotRun {
  id: number;
  trigger: string;
  started_at: string;
  finished_at: string | null;
  pages_checked: number;
  pages_changed: number;
  changes_applied: number;
  changes_held: number;
  errors: number;
  notes: string | null;
}

export interface RobotStats {
  pages_checked: number;
  page_errors: number;
  programs_found: number;
  programs_published: number;
  programs_updated: number;
  facts_found: number;
  universities_searched: number;
  held: number;
  checks_agree: number;
  checks_conflict: number;
  programs_total: number;
  universities_total: number;
  sources_total: number;
  db_mb: number;
  runs: RobotRun[];
}

function readStats(): Promise<RobotStats | null> {
  return Promise.resolve(
    serviceClient()
      .rpc("robot_stats")
      .then(({ data, error }) => (error || !data ? null : (data as RobotStats))),
  ).catch(() => null);
}

const within = <T,>(p: Promise<T | null>, ms: number) => Promise.race([p, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);

/** The stats, or null when they can't be read within `timeoutMs` (the database is busy). */
export async function getRobotStats(timeoutMs = 8000): Promise<RobotStats | null> {
  if (DATA_SOURCE !== "supabase") return null;
  return within(readStats(), timeoutMs);
}

// The public counter: one copy per server process, refreshed after 10 minutes. The page waits at most
// 4 seconds; a slower read still finishes in the background and is kept for the next visitor.
let latest: RobotStats | null = null;
let readingSince = 0;
let reading: Promise<RobotStats | null> | null = null;
export async function getPublicRobotStats(): Promise<RobotStats | null> {
  if (DATA_SOURCE !== "supabase") return null;
  if (!reading && Date.now() - readingSince > 10 * 60 * 1000) {
    readingSince = Date.now();
    reading = readStats().then((v) => {
      if (v) latest = v;
      else readingSince = 0; // Failed: try again on the next request.
      reading = null;
      return v;
    });
  }
  if (latest) return latest;
  return reading ? within(reading, 4000) : null;
}
