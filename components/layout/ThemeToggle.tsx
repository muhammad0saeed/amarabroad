"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { readStorage, STORAGE_KEYS, writeStorage, type ThemeChoice } from "@/lib/storage";

const ORDER: ThemeChoice[] = ["system", "light", "dark"];

function applyTheme(choice: ThemeChoice) {
  const dark =
    choice === "dark" || (choice === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  if (dark) document.documentElement.setAttribute("data-theme", "dark");
  else document.documentElement.removeAttribute("data-theme");
}

function readChoice(): ThemeChoice {
  const saved = readStorage(STORAGE_KEYS.theme);
  return saved === "light" || saved === "dark" ? saved : "system";
}

// Cycles System → Light → Dark. The head script already applied the saved choice before paint.
export function ThemeToggle() {
  const t = useTranslations("header");
  const [choice, setChoice] = useState<ThemeChoice | null>(null);

  useEffect(() => {
    // Read after mount: the server-rendered HTML can't know the saved choice.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChoice(readChoice());
  }, []);

  useEffect(() => {
    if (choice !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const follow = () => applyTheme("system");
    media.addEventListener("change", follow);
    return () => media.removeEventListener("change", follow);
  }, [choice]);

  function cycle() {
    const current = choice ?? readChoice();
    const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length]!;
    writeStorage(STORAGE_KEYS.theme, next);
    applyTheme(next);
    setChoice(next);
  }

  const shown = choice ?? "system";
  const modeLabel = t(shown === "system" ? "themeSystem" : shown === "light" ? "themeLight" : "themeDark");

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={t("theme", { mode: modeLabel })}
      title={t("theme", { mode: modeLabel })}
      className="inline-flex size-tap items-center justify-center rounded-full border border-border bg-surface hover:bg-surface-2"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {shown === "dark" ? (
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
        ) : shown === "light" ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        ) : (
          <>
            <rect x="3" y="4" width="18" height="12" rx="2" />
            <path d="M8 20h8M12 16v4" />
          </>
        )}
      </svg>
    </button>
  );
}
