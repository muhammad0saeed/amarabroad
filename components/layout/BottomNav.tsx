"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { MoreSheet } from "./MoreSheet";
import { NavLink } from "./NavLink";
import { Icon, type IconName } from "@/components/icons";

const ITEMS: [string, IconName, "home" | "search" | "match" | "saved"][] = [
  ["/", "home", "home"],
  ["/programs", "search", "search"],
  ["/match", "match", "match"],
  ["/saved", "bookmark", "saved"],
];

/** Floating pill bar on phones: Home, Search, Match, Saved, More. */
export function BottomNav() {
  const t = useTranslations("nav");
  const [moreOpen, setMoreOpen] = useState(false);
  return (
    <>
      <nav
        aria-label={t("main")}
        className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:hidden"
      >
        <ul className="mx-auto grid max-w-md grid-cols-5 gap-1 rounded-full border border-border bg-surface p-1 shadow-float">
          {ITEMS.map(([href, icon, key]) => (
            <li key={href}>
              <NavLink href={href} variant="bottom">
                <Icon name={icon} className="size-5" />
                <span>{t(key)}</span>
              </NavLink>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              className="flex min-h-tap w-full flex-col items-center justify-center gap-0.5 rounded-full px-3 text-[0.6875rem] font-semibold text-ink-muted hover:text-ink"
            >
              <Icon name="more" className="size-5" />
              <span>{t("more")}</span>
            </button>
          </li>
        </ul>
      </nav>
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}
