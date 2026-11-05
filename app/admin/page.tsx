import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { PageTitle, when } from "./ui";

export const metadata: Metadata = { title: "Overview" };

const STALE_DAYS = 60;

export default async function AdminOverview() {
  const { db } = await requireAdmin();
  const staleBefore = daysAgo(STALE_DAYS);
  const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
  const head = { count: "exact" as const, head: true };

  const [wrongNew, problemNew, outcomesPending, held, published, total, stale, unis, lastRun] = await Promise.all([
    count(db.from("wrong_info_reports").select("id", head).eq("status", "new")),
    count(db.from("problem_reports").select("id", head).eq("status", "new")),
    count(db.from("outcome_reports").select("id", head).eq("status", "pending")),
    count(db.from("field_changes").select("id", head).eq("status", "held")),
    count(db.from("programs").select("slug", head).eq("published", true)),
    count(db.from("programs").select("slug", head)),
    count(db.from("programs").select("slug", head).eq("published", true).lt("last_verified", staleBefore)),
    count(db.from("universities").select("slug", head)),
    db.from("crawl_runs").select("started_at, finished_at, pages_checked, pages_changed, changes_applied, changes_held, errors, trigger").order("started_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const run = lastRun.data;

  const todo = [
    { href: "/admin/reports/", label: "New reports", value: wrongNew + problemNew, note: `${wrongNew} wrong info · ${problemNew} ${problemNew === 1 ? "problem" : "problems"}` },
    { href: "/admin/outcomes/", label: "Outcomes to check", value: outcomesPending, note: "Shown on the site only after you approve" },
    { href: "/admin/changes/", label: "Robot changes on hold", value: held, note: "Big or odd changes wait for you" },
  ];

  return (
    <>
      <PageTitle title="Overview" hint="What needs you, and how the robot is doing." />
      <section aria-label="To do" className="grid gap-3 sm:grid-cols-3">
        {todo.map((t) => (
          <Link key={t.href} href={t.href} className="rounded-tile border border-border p-4 hover:bg-surface-2">
            <span className="text-meta font-semibold text-ink-muted">{t.label}</span>
            <span className={`mt-1 block text-display font-bold tabular-nums ${t.value ? "text-ink" : "text-ink-muted"}`}>{t.value}</span>
            <span className="mt-1 block text-meta text-ink-muted">{t.note}</span>
          </Link>
        ))}
      </section>

      <h2 className="mt-10 mb-3 text-heading font-bold">Directory</h2>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-border pt-4 sm:grid-cols-4">
        <Stat label="Programs on the site" value={`${published} of ${total}`} />
        <Stat label="Universities" value={unis} />
        <Stat label={`Not re-read for ${STALE_DAYS}+ days`} value={stale} warn={stale > 0} />
        <Stat label="Hidden (missing a subject or date)" value={total - published} />
      </dl>

      <h2 className="mt-10 mb-3 text-heading font-bold">Last robot run</h2>
      {run ? (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-border pt-4 sm:grid-cols-4">
          <Stat label="Started" value={when(run.started_at)} small />
          <Stat label="Finished" value={run.finished_at ? when(run.finished_at) : "still running (or stopped)"} small />
          <Stat label="Pages checked / changed" value={`${run.pages_checked} / ${run.pages_changed}`} />
          <Stat label="Applied / held / errors" value={`${run.changes_applied} / ${run.changes_held} / ${run.errors}`} warn={run.errors > 0} />
        </dl>
      ) : (
        <p className="text-meta text-ink-muted">The robot hasn&apos;t recorded a run yet.</p>
      )}
    </>
  );
}

function Stat({ label, value, warn, small }: { label: string; value: string | number; warn?: boolean; small?: boolean }) {
  return (
    <div>
      <dt className="text-meta text-ink-muted">{label}</dt>
      <dd className={`mt-0.5 font-bold tabular-nums ${small ? "text-body" : "text-heading"} ${warn ? "text-warning" : ""}`}>{value}</dd>
    </div>
  );
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
}
