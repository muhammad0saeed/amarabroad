"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { readStorage, removeStorage, STORAGE_KEYS, writeStorage } from "@/lib/storage";

/** Lite mode for slow data and budget phones: no animations, blur or decorative tiles. */
export function LiteToggle() {
  const t = useTranslations("nav");
  const [on, setOn] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOn(readStorage(STORAGE_KEYS.lite) === "1");
  }, []);

  function toggle() {
    const next = !on;
    if (next) {
      writeStorage(STORAGE_KEYS.lite, "1");
      document.documentElement.setAttribute("data-lite", "");
    } else {
      removeStorage(STORAGE_KEYS.lite);
      document.documentElement.removeAttribute("data-lite");
    }
    setOn(next);
  }

  return (
    <label className="flex min-h-tap cursor-pointer items-center justify-between gap-3 px-1">
      <span>
        <span className="font-semibold">{t("lite")}</span>
        <span className="block text-meta text-ink-muted">{t("liteHint")}</span>
      </span>
      <input type="checkbox" role="switch" checked={on} onChange={toggle} className="size-5 shrink-0 accent-[var(--primary)]" />
    </label>
  );
}
