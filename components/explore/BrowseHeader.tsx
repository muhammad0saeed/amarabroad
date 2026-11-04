import type { ReactNode } from "react";
import { SampleBadge } from "@/components/ui/SampleBadge";
import { ExploreTabs, type ExploreTab } from "./ExploreTabs";

/** Tabs, title and subtitle shared by every browse page. */
export function BrowseHeader({ tab, title, subtitle, children }: { tab: ExploreTab; title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="space-y-4 pt-2">
      <ExploreTabs active={tab} />
      <header className="pt-2">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <h1 className="text-title font-bold tracking-tight sm:text-display">{title}</h1>
          <SampleBadge />
        </div>
        {subtitle && <p className="mt-2 max-w-prose text-ink-muted">{subtitle}</p>}
      </header>
      {children}
    </div>
  );
}

/** A row of link chips (country filter etc.); plain links, so they work without JavaScript. */
export function LinkChips({ label, items }: { label: string; items: { href: string; label: string; active: boolean; count?: string }[] }) {
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 no-scrollbar">
      <ul className="flex w-max gap-1.5">
        {items.map((item) => (
          <li key={item.href}>
            <a
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-meta font-medium ${
                item.active ? "border-ink bg-ink text-canvas" : "border-border bg-surface hover:border-ink/30"
              }`}
            >
              {item.label}
              {item.count && <span className={item.active ? "text-canvas/70" : "text-ink-muted"}>{item.count}</span>}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
