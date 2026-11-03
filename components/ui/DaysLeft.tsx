"use client";

import { useTranslations } from "next-intl";
import { useHydrated } from "@/lib/clientStore";
import { daysBetween, todayISO } from "@/lib/dates";
import type { ISODate } from "@/types";
import { Badge } from "./primitives";

/** "21 days left" / "Closed", worked out on the device (the static page can't know today's date). */
export function DaysLeft({ date }: { date: ISODate }) {
  const t = useTranslations("common");
  const hydrated = useHydrated();
  if (!hydrated) return null;
  const days = daysBetween(todayISO(), date);
  if (days < 0) return <Badge tone="neutral">{t("closed")}</Badge>;
  if (days === 0) return <Badge tone="danger">{t("closesToday")}</Badge>;
  return <Badge tone={days <= 30 ? "warning" : "neutral"}>{t("daysLeft", { count: days })}</Badge>;
}
