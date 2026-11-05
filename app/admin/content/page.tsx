import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { STALE_DAYS, TABLE_ORDER, TABLES } from "@/lib/admin/content";
import { PageTitle } from "../ui";

export const metadata: Metadata = { title: "Content" };

export default async function ContentHome() {
  const { db } = await requireAdmin();
  const staleBefore = daysAgo(STALE_DAYS);
  const rows = await Promise.all(
    TABLE_ORDER.map(async (key) => {
      const spec = TABLES[key];
      const head = { count: "exact" as const, head: true };
      const [total, hidden, stale] = await Promise.all([
        db.from(key).select(spec.id, head),
        db.from(key).select(spec.id, head).eq("published", false),
        spec.verified ? db.from(key).select(spec.id, head).eq("published", true).or(`last_verified.is.null,last_verified.lt.${staleBefore}`) : Promise.resolve({ count: 0 }),
      ]);
      return { spec, total: total.count ?? 0, hidden: hidden.count ?? 0, stale: stale.count ?? 0 };
    }),
  );

  return (
    <>
      <PageTitle
        title="Content"
        hint={`Everything on the site. Fix what the robot can't read, add what it hasn't found, and keep check dates current: anything not checked for ${STALE_DAYS} days is flagged.`}
      />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(({ spec, total, hidden, stale }) => (
          <li key={spec.key}>
            <Link href={`/admin/content/${spec.key}/`} className="block h-full rounded-tile border border-border p-4 hover:bg-surface-2">
              <span className="flex items-baseline justify-between gap-2">
                <span className="font-bold">{spec.label}</span>
                <span className="text-heading font-bold tabular-nums">{total}</span>
              </span>
              <span className="mt-1 block text-meta text-ink-muted">
                {hidden} hidden
                {spec.verified && (
                  <>
                    {" · "}
                    <span className={stale ? "font-semibold text-warning" : undefined}>{stale} need checking</span>
                  </>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
}
