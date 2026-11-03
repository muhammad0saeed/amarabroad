"use client";

import { useTranslations } from "next-intl";
import { Icon } from "@/components/icons";
import { Link, usePathname } from "@/i18n/navigation";
import { compareStore, useStore } from "@/lib/clientStore";
import { compareQuery, COMPARE_MAX } from "@/lib/filters";

/** Floating "n selected · Compare" bar while programs are picked for comparison. */
export function CompareTray() {
  const t = useTranslations("compare");
  const ids = useStore(compareStore);
  const pathname = usePathname();
  if (ids.length === 0 || pathname.startsWith("/compare")) return null;

  return (
    <div role="region" aria-label={t("tray")} className="fixed inset-x-0 bottom-20 z-30 px-3 lg:bottom-4">
      <div className="mx-auto flex max-w-md items-center justify-between gap-2 rounded-full bg-ink py-1 pr-1 pl-4 text-canvas shadow-float">
        <span className="text-meta font-semibold">{t("selected", { count: ids.length, max: COMPARE_MAX })}</span>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => compareStore.clear()} className="min-h-tap rounded-full px-3 text-meta font-semibold opacity-80 hover:opacity-100">
            {t("clear")}
          </button>
          <Link
            href={`/compare?${compareQuery(ids)}`}
            className="inline-flex min-h-tap items-center gap-1 rounded-full bg-primary px-4 text-meta font-semibold text-on-primary"
          >
            {t("open")} <Icon name="arrowRight" className="size-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
