// Presentational building blocks shared by every page (no client JS).

import type { ComponentProps, ReactNode } from "react";
import { GROUP_ICON, Icon, type IconName } from "@/components/icons";
import { Link } from "@/i18n/navigation";
import type { FieldGroup, TileColor } from "@/types";

type Variant = "primary" | "secondary" | "ghost" | "soft";
type Size = "md" | "sm";

export function buttonClass(variant: Variant = "primary", size: Size = "md", full = false) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
  const sizes = { md: "min-h-tap px-5 text-body", sm: "min-h-tap px-4 text-meta" };
  const variants = {
    primary: "bg-primary text-on-primary hover:bg-primary-hover",
    secondary: "border border-border bg-surface text-ink hover:bg-surface-2",
    ghost: "text-primary-ink hover:bg-primary-soft",
    soft: "bg-primary-soft text-primary-ink hover:bg-primary-soft/70",
  };
  return `${base} ${sizes[size]} ${variants[variant]} ${full ? "w-full" : ""}`;
}

export function ButtonLink({
  variant,
  size,
  full,
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size; full?: boolean }) {
  return <Link {...props} className={`${buttonClass(variant, size, full)} ${className}`} />;
}

export function Card({ as: Tag = "div", className = "", children }: { as?: "div" | "section" | "article" | "li"; className?: string; children: ReactNode }) {
  return <Tag className={`rounded-card bg-surface p-4 shadow-card sm:p-5 ${className}`}>{children}</Tag>;
}

export function Section({ title, action, id, children, className = "" }: { title: string; action?: ReactNode; id?: string; children: ReactNode; className?: string }) {
  return (
    <section aria-labelledby={id ? `${id}-title` : undefined} id={id} className={`scroll-mt-20 ${className}`}>
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 id={id ? `${id}-title` : undefined} className="text-heading font-semibold">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

type Tone = "neutral" | "primary" | "success" | "warning" | "danger";
const TONES: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink-muted",
  primary: "bg-primary-soft text-primary-ink",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
};

export function Badge({ tone = "neutral", icon, children, className = "" }: { tone?: Tone; icon?: IconName; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-meta font-semibold ${TONES[tone]} ${className}`}>
      {icon && <Icon name={icon} className="size-3.5" />}
      {children}
    </span>
  );
}

/** Yes/no requirement tag: green check or grey cross. */
export function YesNoTag({ yes, children }: { yes: boolean; children: ReactNode }) {
  return (
    <Badge tone={yes ? "success" : "neutral"} icon={yes ? "check" : "close"}>
      {children}
    </Badge>
  );
}

const TILE_BG: Record<TileColor, string> = {
  indigo: "bg-tile-indigo",
  blue: "bg-tile-blue",
  green: "bg-tile-green",
  pink: "bg-tile-pink",
  amber: "bg-tile-amber",
  teal: "bg-tile-teal",
};

export function IconTile({ tile = "indigo", group, icon, size = "md" }: { tile?: TileColor; group?: FieldGroup; icon?: IconName; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "size-10 rounded-xl", md: "size-12 rounded-tile", lg: "size-14 rounded-tile" };
  return (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center text-ink ${TILE_BG[tile]} ${sizes[size]}`}>
      <Icon name={icon ?? (group ? GROUP_ICON[group] : "cap")} className={size === "lg" ? "size-7" : "size-6"} />
    </span>
  );
}

export function Fact({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-tile bg-surface-2 p-3">
      <dt className="text-meta text-ink-muted">{label}</dt>
      <dd className="mt-0.5 font-semibold">{value}</dd>
      {hint && <dd className="text-meta text-ink-muted">{hint}</dd>}
    </div>
  );
}

export function EmptyState({ icon = "search", title, body, action }: { icon?: IconName; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-border p-6 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-full bg-primary-soft text-primary-ink">
        <Icon name={icon} />
      </span>
      <p className="mt-3 font-semibold">{title}</p>
      {body && <p className="mt-1 text-meta text-ink-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Disclosure({ summary, children, defaultOpen = false, id }: { summary: ReactNode; children: ReactNode; defaultOpen?: boolean; id?: string }) {
  return (
    <details id={id} open={defaultOpen} className="group rounded-card bg-surface shadow-card [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex min-h-tap cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-semibold sm:px-5">
        <span>{summary}</span>
        <Icon name="chevronDown" className="size-5 shrink-0 text-ink-muted transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-border px-4 py-4 sm:px-5">{children}</div>
    </details>
  );
}

export function ExternalLink({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={`inline-flex min-h-tap items-center gap-1.5 font-semibold text-primary-ink underline-offset-4 hover:underline ${className}`}>
      {children}
      <Icon name="external" className="size-4" />
    </a>
  );
}

export function PageHeader({ eyebrow, title, subtitle, children }: { eyebrow?: ReactNode; title: string; subtitle?: ReactNode; children?: ReactNode }) {
  return (
    <header className="pt-2 pb-5">
      {eyebrow && <div className="mb-2 flex flex-wrap items-center gap-2">{eyebrow}</div>}
      <h1 className="text-title font-bold sm:text-display">{title}</h1>
      {subtitle && <p className="mt-2 max-w-prose text-ink-muted">{subtitle}</p>}
      {children}
    </header>
  );
}

export function Breadcrumbs({ items, label }: { items: { href?: string; label: string }[]; label: string }) {
  return (
    <nav aria-label={label} className="mb-1 overflow-hidden text-meta text-ink-muted">
      <ol className="flex flex-wrap items-center gap-x-1">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <Icon name="chevronRight" className="size-3.5" />}
            {item.href ? (
              <Link href={item.href} className="inline-flex min-h-8 items-center hover:text-ink hover:underline">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-ink">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
