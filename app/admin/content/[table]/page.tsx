import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { isTable, STALE_DAYS, TABLES } from "@/lib/admin/content";
import { markChecked } from "../actions";
import { ActionButton, Empty, PageTitle, Tabs } from "../../ui";

const PER_PAGE = 50;

type Params = { table: string };
type Search = { q?: string; show?: string; page?: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { table } = await params;
  return { title: isTable(table) ? TABLES[table].label : "Content" };
}

export default async function ContentList({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Search> }) {
  const { table } = await params;
  if (!isTable(table)) notFound();
  const { db } = await requireAdmin();
  const spec = TABLES[table];
  const sp = await searchParams;
  const q = (sp.q ?? "").replace(/[^\p{L}\p{N}\s.-]/gu, " ").trim().slice(0, 80);
  const shows = ["all", "live", "hidden", ...(spec.verified ? ["check"] : []), ...(table === "programs" ? ["locked"] : [])];
  const show = shows.includes(sp.show ?? "") ? sp.show! : "all";
  const page = Math.max(1, Number(sp.page) || 1);
  const staleBefore = new Date(Date.parse(today()) - STALE_DAYS * 864e5).toISOString().slice(0, 10);

  const cols = [spec.id, spec.name, ...spec.list.map((l) => l.name), "published", ...(spec.verified ? ["last_verified"] : [])];
  let query = db.from(table).select([...new Set(cols)].join(", "), { count: "exact" });
  if (q) query = query.or(`${spec.name}.ilike.%${q}%,${spec.id}.ilike.%${q}%`);
  if (show === "live") query = query.eq("published", true);
  if (show === "hidden") query = query.eq("published", false);
  if (show === "check") query = query.or(`last_verified.is.null,last_verified.lt.${staleBefore}`);
  if (show === "locked") query = query.neq("locked_fields", "{}");
  query = spec.verified && show === "check" ? query.order("last_verified", { ascending: true, nullsFirst: true }) : query.order(spec.name);
  const { data, count, error } = await query.range((page - 1) * PER_PAGE, page * PER_PAGE - 1);
  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  const pages = Math.max(1, Math.ceil((count ?? 0) / PER_PAGE));

  const link = (over: Partial<Search>) => {
    const p = new URLSearchParams({ ...(q ? { q } : {}), ...(show !== "all" ? { show } : {}), ...(page > 1 ? { page: String(page) } : {}), ...over });
    for (const [k, v] of [...p.entries()]) if (!v || (k === "show" && v === "all") || (k === "page" && v === "1")) p.delete(k);
    const s = p.toString();
    return `/admin/content/${table}/${s ? `?${s}` : ""}`;
  };
  const LABELS: Record<string, string> = { all: "All", live: "On the site", hidden: "Hidden", check: `Need checking (${STALE_DAYS}+ days)`, locked: "Set by hand" };

  return (
    <>
      <p className="mb-2 text-meta">
        <Link href="/admin/content/" className="text-ink-muted underline hover:text-ink">
          Content
        </Link>
      </p>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageTitle title={spec.label} />
        <Link href={`/admin/content/${table}/new/`} className="inline-flex min-h-10 items-center rounded-full bg-primary px-4 text-meta font-semibold text-on-primary hover:bg-primary-hover">
          Add {spec.one}
        </Link>
      </div>

      <form className="mb-4 flex gap-2" action={`/admin/content/${table}/`}>
        {show !== "all" && <input type="hidden" name="show" value={show} />}
        <input
          name="q"
          defaultValue={q}
          placeholder={`Search by ${spec.name.replace("_en", "").replace("_", " ")} or ID`}
          aria-label="Search"
          className="min-h-10 w-full max-w-md rounded-full border border-border bg-surface px-4 focus:border-accent focus:outline-none"
        />
        <button className="min-h-10 rounded-full border border-border px-4 text-meta font-semibold hover:bg-surface-2">Search</button>
      </form>
      <Tabs active={link({ show, page: "1" })} items={shows.map((s) => ({ href: link({ show: s, page: "1" }), label: LABELS[s]! }))} />

      {error ? (
        <p className="text-danger">Couldn&apos;t load: {error.message}</p>
      ) : !rows.length ? (
        <Empty>{q ? `Nothing matches "${q}".` : "Nothing here."}</Empty>
      ) : (
        <>
          <p className="mb-2 text-meta text-ink-muted">
            {count} {count === 1 ? spec.one : spec.label.toLowerCase()}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-meta">
              <thead className="border-b border-border text-ink-muted">
                <tr>
                  <th className="py-2 pr-3 font-semibold">Name</th>
                  {spec.list.map((l) => (
                    <th key={l.name} className="py-2 pr-3 font-semibold">
                      {l.label}
                    </th>
                  ))}
                  {spec.verified && <th className="py-2 pr-3 font-semibold">Checked</th>}
                  <th className="py-2 pr-3 font-semibold">Site</th>
                  {spec.verified && <th className="py-2" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => {
                  const id = String(r[spec.id]);
                  const checked = r.last_verified as string | null;
                  const stale = spec.verified && (!checked || checked < staleBefore);
                  return (
                    <tr key={id} className="align-top">
                      <td className="py-2.5 pr-3">
                        <Link href={`/admin/content/${table}/${encodeURIComponent(id)}/`} className="font-semibold text-ink underline-offset-2 hover:underline">
                          {String(r[spec.name] ?? id)}
                        </Link>
                        {r[spec.name] !== id && <span className="block text-ink-muted">{id}</span>}
                      </td>
                      {spec.list.map((l) => (
                        <td key={l.name} className="py-2.5 pr-3">
                          {r[l.name] === null || r[l.name] === undefined ? <span className="text-ink-muted">—</span> : String(r[l.name])}
                        </td>
                      ))}
                      {spec.verified && <td className={`py-2.5 pr-3 tabular-nums ${stale ? "font-semibold text-warning" : ""}`}>{checked ?? "never"}</td>}
                      <td className="py-2.5 pr-3">{r.published ? "shown" : <span className="text-ink-muted">hidden</span>}</td>
                      {spec.verified && (
                        <td className="py-1.5 text-right">
                          {stale && (
                            <ActionButton action={markChecked} fields={{ table, id }}>
                              Checked today
                            </ActionButton>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <nav aria-label="Pages" className="mt-4 flex items-center gap-3 text-meta">
              {page > 1 && (
                <Link href={link({ page: String(page - 1) })} className="underline">
                  Previous
                </Link>
              )}
              <span className="text-ink-muted">
                Page {page} of {pages}
              </span>
              {page < pages && (
                <Link href={link({ page: String(page + 1) })} className="underline">
                  Next
                </Link>
              )}
            </nav>
          )}
        </>
      )}
    </>
  );
}

function today() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });
}
