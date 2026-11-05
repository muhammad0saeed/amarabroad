import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { setReportStatus } from "../actions";
import { ActionButton, Empty, PageTitle, Tabs, when } from "../ui";

export const metadata: Metadata = { title: "Reports" };

const STATUSES = ["new", "working", "fixed", "rejected"] as const;
type Status = (typeof STATUSES)[number];
const NEXT: Record<Status, { to: Status; label: string; tone: "neutral" | "good" | "bad" }[]> = {
  new: [{ to: "working", label: "Working on it", tone: "neutral" }, { to: "fixed", label: "Fixed", tone: "good" }, { to: "rejected", label: "Reject", tone: "bad" }],
  working: [{ to: "fixed", label: "Fixed", tone: "good" }, { to: "rejected", label: "Reject", tone: "bad" }],
  fixed: [{ to: "new", label: "Reopen", tone: "neutral" }],
  rejected: [{ to: "new", label: "Reopen", tone: "neutral" }],
};

type Search = { kind?: string; status?: string };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { db } = await requireAdmin();
  const sp = await searchParams;
  const kind = sp.kind === "problem" ? "problem" : "wrong";
  const status: Status = STATUSES.includes(sp.status as Status) ? (sp.status as Status) : "new";
  const table = kind === "wrong" ? "wrong_info_reports" : "problem_reports";

  const counts = await Promise.all(
    STATUSES.map(async (s) => (await db.from(table).select("id", { count: "exact", head: true }).eq("status", s)).count ?? 0),
  );
  const [wrongNew, problemNew] = await Promise.all(
    ["wrong_info_reports", "problem_reports"].map(async (t) => (await db.from(t).select("id", { count: "exact", head: true }).eq("status", "new")).count ?? 0),
  );
  const href = (k: string, s: string) => `/admin/reports/?kind=${k}&status=${s}`;

  return (
    <>
      <PageTitle title="Reports" hint="Sent from the site's forms. Senders' emails are only for replying; never share them." />
      <Tabs
        active={href(kind, "new")}
        items={[
          { href: href("wrong", "new"), label: "Wrong info", count: wrongNew },
          { href: href("problem", "new"), label: "Problems", count: problemNew },
        ]}
      />
      <Tabs active={href(kind, status)} items={STATUSES.map((s, i) => ({ href: href(kind, s), label: label(s), count: counts[i] }))} />
      {kind === "wrong" ? <WrongInfo db={db} status={status} /> : <Problems db={db} status={status} />}
    </>
  );
}

type Db = Awaited<ReturnType<typeof requireAdmin>>["db"];

async function WrongInfo({ db, status }: { db: Db; status: Status }) {
  const { data } = await db
    .from("wrong_info_reports")
    .select("id, created_at, program, topic, correction, source_url, email, admin_note, programs(title)")
    .eq("status", status)
    .order("created_at", { ascending: status === "new" })
    .limit(100);
  if (!data?.length) return <Empty>No {label(status).toLowerCase()} wrong-info reports.</Empty>;
  return (
    <ul className="divide-y divide-border border-y border-border">
      {data.map((r) => {
        const title = (r.programs as unknown as { title: string } | null)?.title;
        return (
          <li key={r.id} className="py-4">
            <p className="text-meta text-ink-muted">
              {when(r.created_at)} · <span className="font-semibold text-ink">{r.topic}</span>
              {r.program && (
                <>
                  {" · "}
                  <Link href={`/en/programs/${r.program}/`} className="underline hover:text-ink" target="_blank">
                    {title ?? r.program}
                  </Link>
                </>
              )}
            </p>
            <p className="mt-1.5 max-w-[75ch] whitespace-pre-wrap">{r.correction}</p>
            <Meta source={r.source_url} email={r.email} note={r.admin_note} />
            <Actions kind="wrong" id={r.id} status={status} />
          </li>
        );
      })}
    </ul>
  );
}

async function Problems({ db, status }: { db: Db; status: Status }) {
  const { data } = await db
    .from("problem_reports")
    .select("id, created_at, type, description, page_url, user_agent, app_version, email, admin_note")
    .eq("status", status)
    .order("created_at", { ascending: status === "new" })
    .limit(100);
  if (!data?.length) return <Empty>No {label(status).toLowerCase()} problem reports.</Empty>;
  return (
    <ul className="divide-y divide-border border-y border-border">
      {data.map((r) => (
        <li key={r.id} className="py-4">
          <p className="text-meta text-ink-muted">
            {when(r.created_at)} · <span className="font-semibold text-ink">{r.type.replaceAll("_", " ")}</span>
            {r.page_url && (
              <>
                {" · "}
                <a href={r.page_url} className="underline hover:text-ink" target="_blank" rel="noreferrer">
                  {r.page_url.replace(/^https?:\/\/[^/]+/, "") || "/"}
                </a>
              </>
            )}
          </p>
          <p className="mt-1.5 max-w-[75ch] whitespace-pre-wrap">{r.description}</p>
          {r.user_agent && <p className="mt-1 truncate text-meta text-ink-muted" title={r.user_agent}>{r.user_agent}</p>}
          <Meta email={r.email} note={r.admin_note} />
          <Actions kind="problem" id={r.id} status={status} />
        </li>
      ))}
    </ul>
  );
}

function Meta({ source, email, note }: { source?: string | null; email?: string | null; note?: string | null }) {
  if (!source && !email && !note) return null;
  return (
    <dl className="mt-2 space-y-0.5 text-meta">
      {source && (
        <div className="flex gap-2">
          <dt className="text-ink-muted">Source</dt>
          <dd className="min-w-0 truncate">
            <a href={source} className="underline" target="_blank" rel="noreferrer nofollow">{source}</a>
          </dd>
        </div>
      )}
      {email && (
        <div className="flex gap-2">
          <dt className="text-ink-muted">Reply to</dt>
          <dd><a href={`mailto:${email}`} className="underline">{email}</a></dd>
        </div>
      )}
      {note && (
        <div className="flex gap-2">
          <dt className="text-ink-muted">Your note</dt>
          <dd>{note}</dd>
        </div>
      )}
    </dl>
  );
}

function Actions({ kind, id, status }: { kind: "wrong" | "problem"; id: string; status: Status }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {NEXT[status].map((n) => (
        <ActionButton key={n.to} action={setReportStatus} fields={{ kind, id, status: n.to }} tone={n.tone}>
          {n.label}
        </ActionButton>
      ))}
    </div>
  );
}

function label(s: Status) {
  return { new: "New", working: "Working", fixed: "Fixed", rejected: "Rejected" }[s];
}
