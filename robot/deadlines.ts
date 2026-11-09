// Deadlines first. A program page is normally read again only when it changes, so programs read
// before the deadline rules improved keep "no deadline" for ever. This finds the programs that have no
// upcoming deadline and hands their pages back to be read with today's rules, best-ranked universities first.
// Each page is re-read once per rules version (its saved reading carries the version), never twice.

import { db, type SourceRow } from "./db.ts";
import { everyRow } from "./official-data.ts";

interface IntakeLike {
  deadline?: string | null;
}

/** True when at least one deadline is today or later (a week's grace, like the rules). */
export function hasUpcomingDeadline(intakes: IntakeLike[] | null | undefined, today: string): boolean {
  const from = Date.parse(today) - 7 * 86_400_000;
  return (intakes ?? []).some((i) => !!i.deadline && Date.parse(i.deadline) >= from);
}

/** Best rank first; universities without a rank go last. */
export function byRank<T extends { university: string | null }>(rows: T[], rank: Map<string, number>): T[] {
  return [...rows].sort((a, b) => (rank.get(a.university ?? "") ?? Infinity) - (rank.get(b.university ?? "") ?? Infinity));
}

/** Program pages to re-read for deadlines: no upcoming deadline, not yet read with `rulesVersion`, not failing. */
export async function deadlineTargets(rulesVersion: string, today: string): Promise<{ sources: SourceRow[]; missing: number; total: number }> {
  const programs = await everyRow<{ slug: string; intakes: IntakeLike[] | null }>(
    (from, to) => db().from("programs").select("slug, intakes").order("slug").range(from, to),
    "programs",
  );
  const missing = new Set(programs.filter((p) => !hasUpcomingDeadline(p.intakes, today)).map((p) => p.slug));

  const readAlready = new Set(
    (
      await everyRow<{ source: string }>((from, to) => db().from("extractions").select("source").eq("model", rulesVersion).order("id").range(from, to), "extractions")
    ).map((e) => e.source),
  );

  const slugs = [...missing];
  const sources: SourceRow[] = [];
  for (let i = 0; i < slugs.length; i += 150) {
    const { data, error } = await db()
      .from("sources")
      .select("*")
      .eq("kind", "program_page")
      .eq("status", "active")
      .in("entity_slug", slugs.slice(i, i + 150));
    if (error) throw new Error(`deadline sources: ${error.message}`);
    for (const s of (data ?? []) as SourceRow[]) if (!readAlready.has(s.id) && s.consecutive_errors < 3) sources.push(s);
  }

  const ranks = await everyRow<{ slug: string; ranking: { rank?: number } | null }>(
    (from, to) => db().from("universities").select("slug, ranking").order("slug").range(from, to),
    "universities",
  );
  const rank = new Map(ranks.filter((u) => u.ranking?.rank).map((u) => [u.slug, u.ranking!.rank!]));
  return { sources: byRank(sources, rank), missing: missing.size, total: programs.length };
}

/** Share of published programs with an upcoming deadline, for the logs and the admin page. */
export async function deadlineCoverage(today: string): Promise<{ published: number; withDeadline: number; percent: number }> {
  const rows = await everyRow<{ intakes: IntakeLike[] | null }>(
    (from, to) => db().from("programs").select("intakes").eq("published", true).order("slug").range(from, to),
    "programs",
  );
  const withDeadline = rows.filter((r) => hasUpcomingDeadline(r.intakes, today)).length;
  return { published: rows.length, withDeadline, percent: rows.length ? Math.round((withDeadline / rows.length) * 1000) / 10 : 0 };
}
