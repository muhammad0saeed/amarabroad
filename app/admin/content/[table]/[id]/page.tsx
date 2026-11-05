import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { allFields, isTable, refLabel, TABLES, type Option, type TableKey } from "@/lib/admin/content";
import { saveRecord } from "../../actions";
import { EditForm } from "../../EditForm";
import { when } from "../../../ui";

type Params = { table: string; id: string };

const PUBLIC: Partial<Record<TableKey, string>> = {
  programs: "programs",
  universities: "universities",
  cities: "cities",
  countries: "countries",
  scholarships: "scholarships",
};

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { table, id } = await params;
  if (!isTable(table)) return { title: "Content" };
  return { title: id === "new" ? `New ${TABLES[table].one}` : `${decodeURIComponent(id)} · ${TABLES[table].label}` };
}

export default async function EditPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<{ saved?: string }> }) {
  const { table, id: rawId } = await params;
  if (!isTable(table)) notFound();
  const { db } = await requireAdmin();
  const spec = TABLES[table];
  const id = decodeURIComponent(rawId);
  const isNew = id === "new";

  const { data: row } = isNew ? { data: null } : await db.from(table).select("*").eq(spec.id, id).maybeSingle();
  if (!isNew && !row) notFound();
  const record = row as Record<string, unknown> | null;

  // Choices for fields that point at other tables (a program's university, a city's country…).
  const options: Record<string, Option[]> = {};
  await Promise.all(
    allFields(spec).map(async (f) => {
      const target = f.kind === "ref" ? f.table : f.kind === "multi" ? f.table : undefined;
      if (!target) return;
      const { id: key, name } = refLabel(target);
      const { data } = await db.from(target).select(`${key}, ${name}`).order(name).limit(5000);
      options[f.name] = ((data ?? []) as unknown as Record<string, string>[]).map((r) => [r[key]!, r[name] === r[key] ? r[key]! : `${r[name]} (${r[key]})`]);
    }),
  );

  const history =
    spec.logged && !isNew
      ? (
          await db
            .from("field_changes")
            .select("id, field, old_value, new_value, status, decided_by, created_at")
            .eq("entity_type", spec.logged)
            .eq("entity_slug", id)
            .order("created_at", { ascending: false })
            .limit(15)
        ).data ?? []
      : [];
  const publicPath = PUBLIC[table];
  const action = saveRecord.bind(null, table, isNew ? null : id);
  const { saved } = await searchParams;

  return (
    <>
      <p className="mb-2 text-meta text-ink-muted">
        <Link href="/admin/content/" className="underline hover:text-ink">
          Content
        </Link>
        {" / "}
        <Link href={`/admin/content/${table}/`} className="underline hover:text-ink">
          {spec.label}
        </Link>
      </p>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-title font-bold tracking-tight">{isNew ? `New ${spec.one}` : String(record?.[spec.name] ?? id)}</h1>
          {record && (
            <p className="mt-1 text-meta text-ink-muted">
              {id}
              {typeof record.origin === "string" && ` · added by ${record.origin === "robot" ? "the robot" : record.origin}`}
              {typeof record.updated_at === "string" && ` · last saved ${when(record.updated_at)}`}
            </p>
          )}
        </div>
        {record && publicPath && record.published === true && (
          <a href={`/en/${publicPath}/${id}/`} target="_blank" className="inline-flex min-h-10 items-center rounded-full border border-border px-4 text-meta font-semibold hover:bg-surface-2">
            Open on the site
          </a>
        )}
      </div>

      {table === "programs" && !isNew && (
        <p className="mb-6 max-w-[75ch] rounded-tile bg-surface-2 p-3 text-meta text-ink-muted">
          The robot keeps this program up to date from its official page. Anything you change here is marked <span className="text-warning">set by hand</span>: the robot won&apos;t
          overwrite it, and if the page later says something different it asks you in Robot changes.
        </p>
      )}

      <EditForm table={table} action={action} row={record} options={options} locked={(record?.locked_fields as string[] | undefined) ?? []} saved={saved === "1"} />

      {history.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-3 text-heading font-bold">History</h2>
          <ul className="divide-y divide-border border-y border-border text-meta">
            {history.map((h) => (
              <li key={h.id} className="flex flex-wrap gap-x-3 py-2">
                <span className="text-ink-muted tabular-nums">{when(h.created_at)}</span>
                <span className="font-semibold">{h.field.replaceAll("_", " ")}</span>
                <span className="min-w-0 truncate">
                  {short(h.old_value)} → {short(h.new_value)}
                </span>
                <span className="text-ink-muted">
                  {h.status} by {h.decided_by ?? "(waiting)"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function short(v: unknown) {
  if (v === null || v === undefined) return "empty";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > 60 ? `${s.slice(0, 57)}…` : s;
}
