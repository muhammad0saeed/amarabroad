// Small building blocks shared by the admin pages (server components, no client JS).

import Link from "next/link";

export function PageTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-title font-bold tracking-tight">{title}</h1>
      {hint && <p className="mt-1 max-w-[65ch] text-meta text-ink-muted">{hint}</p>}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-tile border border-dashed border-border p-8 text-center text-meta text-ink-muted">{children}</p>;
}

export function Tabs({ items, active }: { items: { href: string; label: string; count?: number }[]; active: string }) {
  return (
    <ul className="mb-5 flex flex-wrap gap-2 text-meta">
      {items.map((t) => (
        <li key={t.href}>
          <Link
            href={t.href}
            aria-current={t.href === active ? "page" : undefined}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border px-3 font-semibold text-ink-muted hover:text-ink aria-[current=page]:border-ink aria-[current=page]:text-ink"
          >
            {t.label}
            {t.count !== undefined && <span className="tabular-nums text-ink-muted">{t.count}</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function when(iso: string | null | undefined) {
  if (!iso) return "never";
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dhaka" });
}

/** A button that posts its own little form to a server action. */
export function ActionButton({
  action,
  fields,
  children,
  tone = "neutral",
}: {
  action: (form: FormData) => Promise<void>;
  fields: Record<string, string | number>;
  children: React.ReactNode;
  tone?: "neutral" | "good" | "bad";
}) {
  const tones = {
    neutral: "border-border hover:bg-surface-2",
    good: "border-success bg-success-soft text-success hover:brightness-95",
    bad: "border-danger bg-danger-soft text-danger hover:brightness-95",
  };
  return (
    <form action={action}>
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button className={`min-h-9 rounded-full border px-3 text-meta font-semibold active:scale-[0.98] ${tones[tone]}`}>{children}</button>
    </form>
  );
}
