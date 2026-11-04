"use client";

import { useLocale, useTranslations } from "next-intl";
import { Icon } from "@/components/icons";
import { useHydrated } from "@/lib/clientStore";
import { todayISO } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import type { AppLocale } from "@/lib/localize";
import { nextDeadline } from "@/lib/summary";
import type { Intake } from "@/types";
import { DaysLeft } from "./DaysLeft";
import { NotFound } from "./NotFound";
import { Badge } from "./primitives";

/** The next open application deadline, worked out on the device; "All intakes closed" otherwise. */
export function NextDeadline({ intakes }: { intakes: Intake[] }) {
  const t = useTranslations("common");
  const locale = useLocale() as AppLocale;
  const hydrated = useHydrated();
  const latest = [...intakes].sort((a, b) => (a.deadline < b.deadline ? -1 : 1)).at(-1);
  const next = hydrated ? nextDeadline(intakes, todayISO()) : latest;

  // No deadlines found on the official page is not the same as "all closed".
  if (intakes.length === 0) {
    return (
      <span className="flex items-center gap-1.5 text-meta text-ink-muted">
        <Icon name="calendar" className="size-4" />
        <NotFound />
      </span>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-1.5 text-meta text-ink-muted">
      <Icon name="calendar" className="size-4" />
      {next ? (
        <>
          <span>{formatDate(next.deadline, locale)}</span>
          <DaysLeft date={next.deadline} />
        </>
      ) : (
        <Badge>{t("allClosed")}</Badge>
      )}
    </span>
  );
}
