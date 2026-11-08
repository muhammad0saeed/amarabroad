import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { Empty, PageTitle, Tabs, when } from "../ui";

export const metadata: Metadata = { title: "Cross-checks" };

const VIEWS = { conflict: "Disagree", agree: "Agree" } as const;
type View = keyof typeof VIEWS;
const FIELDS = { tuition: "Tuition per year", ielts: "IELTS overall" } as const;

export default async function ChecksPage({ searchParams }: { searchParams: Promise<{ status?: string; field?: string }> }) {
  const { db } = await requireAdmin();
  const sp = await searchParams;
  const view: View = sp.status && sp.status in VIEWS ? (sp.status as View) : "conflict";
  const field = sp.field && sp.field in FIELDS ? (sp.field as keyof typeof FIELDS) : null;
  const counts = await Promise.all(
    (Object.keys(VIEWS) as View[]).map(async (s) => (await db.from("fact_checks").select("program", { count: "exact", head: true }).eq("status", s)).count ?? 0),
  );
  let query = db
    .from("fact_checks")
    .select("program, field, status, program_value, general_value, currency, general_quote, general_url, checked_at")
    .eq("status", view)
    .order("checked_at", { ascending: false })
    .limit(150);
  if (field) query = query.eq("field", field);
  const { data } = await query;

  const slugs = [...new Set((data ?? []).map((c) => c.program))];
  const { data: programs } = slugs.length ? await db.from("programs").select("slug, title, university, source_url").in("slug", slugs) : { data: [] };
  const info = new Map((programs ?? []).map((p) => [p.slug, p]));
  const href = (s: View, f: string | null = field) => `/admin/checks/?status=${s}${f ? `&field=${f}` : ""}`;
  const fmt = (v: number, f: string, cur: string | null) => (f === "ielts" ? String(v) : `${Number(v).toLocaleString("en")} ${cur ?? ""}`.trim());

  return (
    <>
      <PageTitle
        title="Cross-checks"
        hint="Two robots read the same fact from different pages: the program's own page, and the university's general page (fees, English requirements). When they disagree by a lot, one of them is probably wrong. Open both pages and fix the program in Content if needed. The checker runs again after each gap-filler shift, so fixed ones drop off."
      />
      <Tabs active={href(view)} items={(Object.keys(VIEWS) as View[]).map((s, i) => ({ href: href(s), label: VIEWS[s], count: counts[i] }))} />
      <ul className="mb-5 flex flex-wrap gap-2 text-meta">
        {[null, ...Object.keys(FIELDS)].map((f) => (
          <li key={f ?? "all"}>
            <Link
              href={href(view, f)}
              aria-current={f === field ? "page" : undefined}
              className="inline-flex min-h-9 items-center rounded-full px-3 font-semibold text-ink-muted hover:text-ink aria-[current=page]:bg-surface-2 aria-[current=page]:text-ink"
            >
              {f ? FIELDS[f as keyof typeof FIELDS] : "All facts"}
            </Link>
          </li>
        ))}
      </ul>
      {!data?.length ? (
        <Empty>{view === "conflict" ? "No disagreements right now." : "No agreeing checks yet."}</Empty>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {data.map((c) => {
            const p = info.get(c.program);
            return (
              <li key={`${c.program}-${c.field}`} className="py-4">
                <p className="text-meta text-ink-muted">
                  {when(c.checked_at)} · {FIELDS[c.field as keyof typeof FIELDS] ?? c.field}
                </p>
                <Link href={`/en/programs/${c.program}/`} target="_blank" className="mt-1 block font-semibold underline-offset-2 hover:underline">
                  {p ? `${p.title} · ${p.university}` : c.program}
                </Link>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-tile border border-border p-3">
                    <p className="text-meta text-ink-muted">Program page says</p>
                    <p className="font-bold tabular-nums">{fmt(c.program_value, c.field, c.currency)}</p>
                    {p?.source_url && (
                      <a href={p.source_url} target="_blank" rel="noreferrer" className="mt-1 block truncate text-meta text-ink-muted underline">
                        {p.source_url}
                      </a>
                    )}
                  </div>
                  <div className={`rounded-tile border p-3 ${c.status === "conflict" ? "border-warning" : "border-success"}`}>
                    <p className="text-meta text-ink-muted">University&apos;s general page says</p>
                    <p className="font-bold tabular-nums">{fmt(c.general_value, c.field, c.currency)}</p>
                    <a href={c.general_url} target="_blank" rel="noreferrer" className="mt-1 block truncate text-meta text-ink-muted underline">
                      {c.general_url}
                    </a>
                  </div>
                </div>
                <blockquote className="mt-2 max-w-[75ch] border-l-2 border-accent pl-3 text-meta">&ldquo;{c.general_quote}&rdquo;</blockquote>
                <Link href={`/admin/content/programs/${c.program}/`} className="mt-2 inline-block text-meta font-semibold underline">
                  Edit this program
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
