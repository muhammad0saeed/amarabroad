"use client";

import { useLocale, useTranslations } from "next-intl";
import { DaysLeft } from "@/components/ui/DaysLeft";
import { Badge } from "@/components/ui/primitives";
import { formatDate } from "@/lib/format";
import type { AppLocale } from "@/lib/localize";
import { roundOf, type RoundInfo } from "@/lib/scholarshipRound";

/** "4 Feb 2027 · 87 days left", "Closed for this round (closed 20 Oct 2026)", "Deadline set by each university"… */
export function RoundLine({ s, prefix }: { s: RoundInfo; prefix?: "applyBy" }) {
  const t = useTranslations("scholarship");
  const locale = useLocale() as AppLocale;
  if (s.deadline) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        {prefix ? t("applyBy", { date: formatDate(s.deadline, locale) }) : formatDate(s.deadline, locale)} <DaysLeft date={s.deadline} />
      </span>
    );
  }
  const status = roundOf(s);
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Badge tone={status === "open" ? "success" : "neutral"}>{t(`round.${status}`)}</Badge>
      {status === "closed" && s.last_deadline && <span>{t("round.closedOn", { date: formatDate(s.last_deadline, locale) })}</span>}
    </span>
  );
}
