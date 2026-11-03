"use client";

import type { ReactNode } from "react";
import { Link, usePathname } from "@/i18n/navigation";

/** Highlights the current section (Home only on exact match). */
export function NavLink({ href, children, variant }: { href: string; children: ReactNode; variant: "desktop" | "bottom" }) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
  const styles =
    variant === "desktop"
      ? `inline-flex min-h-tap items-center rounded-full px-3 text-meta font-semibold ${active ? "bg-primary-soft text-primary-ink" : "text-ink-muted hover:text-ink"}`
      : `flex min-h-tap flex-col items-center justify-center gap-0.5 rounded-full px-3 text-[0.6875rem] font-semibold ${
          active ? "bg-primary text-on-primary" : "text-ink-muted hover:text-ink"
        }`;
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={styles}>
      {children}
    </Link>
  );
}
