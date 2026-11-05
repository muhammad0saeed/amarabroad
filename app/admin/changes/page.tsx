import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { decideChange } from "../actions";
import { ActionButton, Empty, PageTitle, Tabs, when } from "../ui";

export const metadata: Metadata = { title: "Robot changes" };

const VIEWS = { held: "On hold", applied: "Applied", rejected: "Rejected" } as const;
type View = keyof typeof VIEWS;

export default async function ChangesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { db } = await requireAdmin();
  const sp = await searchParams;
  const view: View = sp.status && sp.status in VIEWS ? (sp.status as View) : "held";
  const counts = await Promise.all(
    (Object.keys(VIEWS) as View[]).map(async (s) => (await db.from("field_changes").select("id", { count: "exact", head: true }).eq("status", s)).count ?? 0),
  );
  const { data } = await db
    .from("field_changes")
    .select("id, entity_type, entity_slug, field, old_value, new_value, evidence, source_url, reason, decided_by, created_at, decided_at")
    .eq("status", view)
    .order(view === "held" ? "created_at" : "decided_at", { ascending: view === "held", nullsFirst: false })
    .limit(150);

  const slugs = [...new Set((data ?? []).filter((c) => c.entity_type === "program").map((c) => c.entity_slug))];
  const { data: programs } = slugs.length ? await db.from("programs").select("slug, title, university").in("slug", slugs) : { data: [] };
  const titles = new Map((programs ?? []).map((p) => [p.slug, `${p.title} · ${p.university}`]));
  const href = (s: string) => `/admin/changes/?status=${s}`;

  return (
    <>
      <PageTitle
        title="Robot changes"
        hint="The robot applies small, clear changes itself. It holds back big jumps (a fee that doubles, a deadline that moves months), values it read twice differently, and anything that removes a fact. Check the quote from the page, then decide."
      />
      <Tabs active={href(view)} items={(Object.keys(VIEWS) as View[]).map((s, i) => ({ href: href(s), label: VIEWS[s], count: counts[i] }))} />
      {!data?.length ? (
        <Empty>{view === "held" ? "Nothing is waiting for you." : `No ${VIEWS[view].toLowerCase()} changes yet.`}</Empty>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {data.map((c) => (
            <li key={c.id} className="py-4">
              <p className="text-meta text-ink-muted">
                {when(c.created_at)} ·{" "}
                {c.entity_type === "program" ? (
                  <Link href={`/en/programs/${c.entity_slug}/`} className="underline hover:text-ink" target="_blank">
                    {titles.get(c.entity_slug) ?? c.entity_slug}
                  </Link>
                ) : (
                  `${c.entity_type} ${c.entity_slug}`
                )}
              </p>
              <p className="mt-1 font-semibold">{c.field.replaceAll("_", " ")}</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <Value label="Now on the site" value={c.old_value} />
                <Value label="Robot read" value={c.new_value} fresh />
              </div>
              {c.reason && <p className="mt-2 text-meta font-semibold text-warning">Held because: {c.reason}</p>}
              {c.evidence && (
                <blockquote className="mt-2 max-w-[75ch] border-l-2 border-accent pl-3 text-meta">
                  &ldquo;{c.evidence}&rdquo;
                </blockquote>
              )}
              {c.source_url && (
                <a href={c.source_url} target="_blank" rel="noreferrer" className="mt-1 block truncate text-meta text-ink-muted underline">
                  {c.source_url}
                </a>
              )}
              {view === "held" ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <ActionButton action={decideChange} fields={{ id: c.id, decision: "approve" }} tone="good">
                    Approve and apply
                  </ActionButton>
                  <ActionButton action={decideChange} fields={{ id: c.id, decision: "reject" }} tone="bad">
                    Keep the old value
                  </ActionButton>
                </div>
              ) : (
                <p className="mt-2 text-meta text-ink-muted">
                  {VIEWS[view]} by {c.decided_by ?? "robot"}
                  {c.decided_at && ` · ${when(c.decided_at)}`}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Value({ label, value, fresh }: { label: string; value: unknown; fresh?: boolean }) {
  return (
    <div className={`rounded-tile border p-3 ${fresh ? "border-accent" : "border-border"}`}>
      <p className="text-meta text-ink-muted">{label}</p>
      <div className="mt-1 text-meta break-words">{show(value)}</div>
    </div>
  );
}

/** Values are JSON: show the common shapes (intakes, tests, lists) as readable text. */
function show(v: unknown): React.ReactNode {
  if (v === null || v === undefined || (Array.isArray(v) && v.length === 0)) return <span className="text-ink-muted">not stated</span>;
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (typeof v !== "object") return String(v);
  if (Array.isArray(v)) {
    return (
      <ul className="list-disc pl-4">
        {v.map((item, i) => (
          <li key={i}>{typeof item === "object" && item ? line(item as Record<string, unknown>) : String(item)}</li>
        ))}
      </ul>
    );
  }
  return line(v as Record<string, unknown>);
}

function line(o: Record<string, unknown>) {
  return Object.entries(o)
    .filter(([, x]) => x !== null && x !== undefined && x !== "")
    .map(([k, x]) => `${k.replaceAll("_", " ")}: ${typeof x === "object" ? JSON.stringify(x) : x}`)
    .join(" · ");
}
