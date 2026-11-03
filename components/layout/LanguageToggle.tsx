"use client";

import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import { STORAGE_KEYS, writeStorage } from "@/lib/storage";

// Switches /en/... ⇄ /bn/... on the same page and remembers the choice.
// A full page load (not a client-side route change) because each language has its own
// <html lang> root layout; it also keeps the query string, so filters survive the switch.
export function LanguageToggle() {
  const t = useTranslations("header");
  const locale = useLocale() as Locale;
  const next: Locale = locale === "en" ? "bn" : "en";

  function switchLanguage() {
    writeStorage(STORAGE_KEYS.locale, next);
    const { pathname, search, hash } = window.location;
    const rest = pathname.replace(/^\/(en|bn)(?=\/|$)/, "");
    // Deliberate full load: a client-side switch between the two root layouts drops the theme attribute.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/${next}${rest || "/"}${search}${hash}`);
  }

  return (
    <button
      type="button"
      onClick={switchLanguage}
      lang={next}
      aria-label={t("switchLanguageLabel")}
      className="inline-flex min-h-tap items-center rounded-full border border-border bg-surface px-4 text-meta font-semibold hover:bg-surface-2"
    >
      {t("switchLanguage")}
    </button>
  );
}
