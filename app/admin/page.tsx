import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { getRobotStats, type RobotRun } from "@/lib/supabase/robotStats";
import { PageTitle, when } from "./ui";

export const metadata: Metadata = { title: "Overview" };

const STALE_DAYS = 60;
/** The free database plan's size, and where the robot stops adding new pages (robot/db.ts). */
const DB_LIMIT_MB = 500;
const DB_BRAKE_MB = 430;
/** A robot shift runs at most ~6 hours; an unfinished run older than this was stopped. */
const RUN_MAX_HOURS = 7;

export default async function AdminOverview() {
  const { db } = await requireAdmin();
  const staleBefore = daysAgo(STALE_DAYS);
  const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
  const head = { count: "exact" as const, head: true };

  const [wrongNew, problemNew, outcomesPending, published, total, stale, unis, robot] = await Promise.all([
    count(db.from("wrong_info_reports").select("id", head).eq("status", "new")),
    count(db.from("problem_reports").select("id", head).eq("status", "new")),
    count(db.from("outcome_reports").select("id", head).eq("status", "pending")),
    count(db.from("programs").select("slug", head).eq("published", true)),
    count(db.from("programs").select("slug", head)),
    count(db.from("programs").select("slug", head).eq("published", true).lt("last_verified", staleBefore)),
    count(db.from("universities").select("slug", head)),
    getRobotStats(15000),
  ]);

  const todo = [
    { href: "/admin/reports/", label: "New reports", value: wrongNew + problemNew, note: `${wrongNew} wrong info · ${problemNew} ${problemNew === 1 ? "problem" : "problems"}` },
    { href: "/admin/outcomes/", label: "Outcomes to check", value: outcomesPending, note: "Shown on the site only after you approve" },
    { href: "/admin/changes/", label: "Robot changes on hold", value: robot?.held ?? 0, note: "Big or odd changes wait for you" },
    { href: "/admin/checks/", label: "Cross-check conflicts", value: robot?.checks_conflict ?? 0, note: `Program page and general page disagree · ${robot?.checks_agree ?? 0} agree` },
  ];
  const running = (robot?.runs ?? []).filter((r) => isRunning(r));

  return (
    <>
      <PageTitle title="Overview" hint="What needs you, and how the robots are doing." />
      <section aria-label="To do" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {todo.map((t) => (
          <Link key={t.href} href={t.href} className="rounded-tile border border-border p-4 hover:bg-surface-2">
            <span className="text-meta font-semibold text-ink-muted">{t.label}</span>
            <span className={`mt-1 block text-display font-bold tabular-nums ${t.value ? "text-ink" : "text-ink-muted"}`}>{t.value.toLocaleString("en")}</span>
            <span className="mt-1 block text-meta text-ink-muted">{t.note}</span>
          </Link>
        ))}
      </section>

      <h2 className="mt-10 mb-3 text-heading font-bold">Robots, last 24 hours</h2>
      {robot ? (
        <>
          <p className="mb-3 text-meta text-ink-muted">
            {running.length ? `${running.length} robot ${running.length === 1 ? "job is" : "jobs are"} running now.` : "No robot job is running right now."} Counts refresh each time you open this page.
          </p>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-border pt-4 sm:grid-cols-4">
            <Stat label="Pages checked" value={robot.pages_checked} />
            <Stat label="Pages that failed" value={robot.page_errors} warn={robot.page_errors > robot.pages_checked / 3} />
            <Stat label="Programs found" value={robot.programs_found} />
            <Stat label="Of those, complete and on the site" value={robot.programs_published} />
            <Stat label="Programs updated" value={robot.programs_updated} />
            <Stat label="Universities searched" value={robot.universities_searched} />
            <Stat label="General-page facts found" value={robot.facts_found} />
            <Stat label="Pages the robots watch" value={robot.sources_total} />
          </dl>

          <h3 className="mt-8 mb-2 font-bold">Database size</h3>
          <DbBar mb={robot.db_mb} />

          <h3 className="mt-8 mb-2 font-bold">Latest robot jobs</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-meta">
              <thead className="text-ink-muted">
                <tr className="border-b border-border">
                  <th className="py-2 pr-3 font-semibold">Started</th>
                  <th className="py-2 pr-3 font-semibold">State</th>
                  <th className="py-2 pr-3 text-right font-semibold">Checked</th>
                  <th className="py-2 pr-3 text-right font-semibold">Changed</th>
                  <th className="py-2 pr-3 text-right font-semibold">Applied / held</th>
                  <th className="py-2 text-right font-semibold">Errors</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {robot.runs.map((r) => (
                  <tr key={r.id} className="border-b border-border">
                    <td className="py-2 pr-3">{when(r.started_at)}</td>
                    <td className="py-2 pr-3">{r.finished_at ? `done ${when(r.finished_at).split(", ").at(-1)}` : isRunning(r) ? <span className="font-semibold text-accent">running</span> : <span className="text-warning">stopped early</span>}</td>
                    <td className="py-2 pr-3 text-right">{r.finished_at ? r.pages_checked : "–"}</td>
                    <td className="py-2 pr-3 text-right">{r.finished_at ? r.pages_changed : "–"}</td>
                    <td className="py-2 pr-3 text-right">{r.finished_at ? `${r.changes_applied} / ${r.changes_held}` : "–"}</td>
                    <td className={`py-2 text-right ${r.errors ? "text-warning" : ""}`}>{r.finished_at ? r.errors : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-meta text-ink-muted">A job writes its numbers when it finishes, so running jobs show dashes. Gap-filler and discovery jobs count in the totals above.</p>
        </>
      ) : (
        <p className="text-meta text-ink-muted">The robot stats didn&apos;t load in time (the database is busy). Reload in a minute.</p>
      )}

      <h2 className="mt-10 mb-3 text-heading font-bold">Directory</h2>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-border pt-4 sm:grid-cols-4">
        <Stat label="Programs on the site" value={`${published.toLocaleString("en")} of ${total.toLocaleString("en")}`} />
        <Stat label="Universities" value={unis} />
        <Stat label={`Not re-read for ${STALE_DAYS}+ days`} value={stale} warn={stale > 0} />
        <Stat label="Hidden (missing a subject or date)" value={total - published} />
      </dl>
    </>
  );
}

function isRunning(r: RobotRun) {
  return !r.finished_at && Date.now() - Date.parse(r.started_at) < RUN_MAX_HOURS * 3600_000;
}

function DbBar({ mb }: { mb: number }) {
  const pct = Math.min(100, (mb / DB_LIMIT_MB) * 100);
  const near = mb >= DB_BRAKE_MB * 0.85;
  return (
    <div>
      <div className="relative h-3 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`${mb} of ${DB_LIMIT_MB} MB used`}>
        <div className={`h-full rounded-full ${near ? "bg-warning" : "bg-accent"}`} style={{ width: `${pct}%` }} />
        <div className="absolute inset-y-0 w-0.5 bg-ink" style={{ left: `${(DB_BRAKE_MB / DB_LIMIT_MB) * 100}%` }} />
      </div>
      <p className="mt-1.5 text-meta text-ink-muted">
        <span className="font-semibold text-ink tabular-nums">{mb} MB</span> of {DB_LIMIT_MB} MB (free plan). At {DB_BRAKE_MB} MB (the line) the robot stops adding new programs and only keeps the existing ones up to date.
      </p>
    </div>
  );
}

function Stat({ label, value, warn, small }: { label: string; value: string | number; warn?: boolean; small?: boolean }) {
  return (
    <div>
      <dt className="text-meta text-ink-muted">{label}</dt>
      <dd className={`mt-0.5 font-bold tabular-nums ${small ? "text-body" : "text-heading"} ${warn ? "text-warning" : ""}`}>{typeof value === "number" ? value.toLocaleString("en") : value}</dd>
    </div>
  );
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
}
