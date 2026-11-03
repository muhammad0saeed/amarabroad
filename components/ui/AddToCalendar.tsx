"use client";

import { useTranslations } from "next-intl";
import { Icon } from "@/components/icons";
import { buildICS, icsFileName, type CalendarEvent } from "@/lib/ics";
import { buttonClass } from "./primitives";

/** Downloads a .ics file for one deadline, with reminders a week and a day before. Built on the device. */
export function AddToCalendar({ event, fileSlug, variant = "secondary" }: { event: CalendarEvent; fileSlug: string; variant?: "secondary" | "ghost" }) {
  const t = useTranslations("common");

  function download() {
    const blob = new Blob([buildICS(event)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = icsFileName(fileSlug);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <button type="button" onClick={download} className={buttonClass(variant, "sm")}>
      <Icon name="calendar" className="size-4" /> {t("addToCalendar")}
    </button>
  );
}
