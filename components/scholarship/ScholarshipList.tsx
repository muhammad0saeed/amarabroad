"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { AddToCalendar } from "@/components/ui/AddToCalendar";
import { ChipToggle } from "@/components/ui/fields";
import { Badge, EmptyState } from "@/components/ui/primitives";
import { SampleBadge } from "@/components/ui/SampleBadge";
import { cycleOf, roundRank } from "@/lib/scholarshipRound";
import { RoundLine } from "./RoundLine";
import { Link } from "@/i18n/navigation";
import { useHydrated } from "@/lib/clientStore";
import { todayISO } from "@/lib/dates";
import { pick, type AppLocale } from "@/lib/localize";
import type { DegreeLevel, Scholarship, ScholarshipType } from "@/types";

const TYPES: ScholarshipType[] = ["merit", "need", "mixed"];

export function ScholarshipList({ scholarships }: { scholarships: Scholarship[] }) {
  const t = useTranslations("scholarship");
  const labels = useTranslations("labels");
  const locale = useLocale() as AppLocale;
  const [bdOnly, setBdOnly] = useState(true);
  const [types, setTypes] = useState<ScholarshipType[]>([]);
  const [level, setLevel] = useState<DegreeLevel | null>(null);

  const hydrated = useHydrated();
  const today = hydrated ? todayISO() : "";
  // Soonest known deadline first, then open, varying, not announced and closed rounds (today is known only on the device).
  const shown = scholarships
    .filter((s) => (!bdOnly || s.bd_eligible) && (!types.length || types.includes(s.type)) && (!level || s.levels.includes(level)))
    .sort((a, b) => roundRank(a, today) - roundRank(b, today) || (a.deadline ?? "9").localeCompare(b.deadline ?? "9") || a.name.localeCompare(b.name));

  return (
    <div className="space-y-4">
      <div className="-mx-1 flex gap-2 no-scrollbar overflow-x-auto px-1 pb-1">
        <ChipToggle pressed={bdOnly} onClick={() => setBdOnly(!bdOnly)}>
          {t("bdOnly")}
        </ChipToggle>
        {TYPES.map((type) => (
          <ChipToggle key={type} pressed={types.includes(type)} onClick={() => setTypes(types.includes(type) ? types.filter((x) => x !== type) : [...types, type])}>
            {labels(`scholarshipType.${type}`)}
          </ChipToggle>
        ))}
        {(["master", "bachelor"] as const).map((l) => (
          <ChipToggle key={l} pressed={level === l} onClick={() => setLevel(level === l ? null : l)}>
            {labels(`level.${l}`)}
          </ChipToggle>
        ))}
      </div>
      <p aria-live="polite" className="font-semibold">
        {t("count", { count: shown.length })}
      </p>
      {shown.length === 0 ? (
        <EmptyState icon="scholarship" title={t("emptyTitle")} />
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {shown.map((s) => (
            <li key={s.slug} className="flex flex-col gap-3 rounded-card bg-surface p-4 shadow-card">
              <div>
                <h2 className="font-semibold leading-snug">
                  <Link href={`/scholarships/${s.slug}`} className="hover:underline">
                    {s.name}
                  </Link>
                </h2>
                <p className="text-meta text-ink-muted">{s.provider}</p>
              </div>
              <p className="text-meta">{pick(s.coverage, "summary", locale)}</p>
              <div className="flex flex-wrap gap-1.5">
                <Badge tone={s.type === "need" ? "neutral" : "primary"}>{labels(`scholarshipType.${s.type}`)}</Badge>
                <Badge>{labels(`coverage.${s.coverage.tuition}`)}</Badge>
                {s.bd_eligible ? <Badge tone="success" icon="check">{t("bdEligible")}</Badge> : <Badge tone="danger">{t("notBdEligible")}</Badge>}
              </div>
              <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
                <p className="text-meta text-ink-muted">
                  <RoundLine s={s} />
                </p>
                {s.deadline && (
                  <AddToCalendar
                    variant="ghost"
                    fileSlug={s.slug}
                    event={{ uid: `scholarship-${s.slug}@amarabroad`, title: t("calendarTitle", { name: s.name }), description: s.provider, url: s.official_url, date: s.deadline }}
                  />
                )}
              </div>
              {!s.deadline && cycleOf(s, locale) && <p className="-mt-1 text-meta text-ink-muted">{cycleOf(s, locale)}</p>}
              <SampleBadge />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
