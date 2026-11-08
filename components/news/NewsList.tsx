"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Icon } from "@/components/icons";
import { ChipToggle } from "@/components/ui/fields";
import { Badge, EmptyState } from "@/components/ui/primitives";
import { formatDate } from "@/lib/format";
import type { AppLocale } from "@/lib/localize";

export interface NewsItem {
  id: number;
  url: string;
  title: string;
  source: string;
  official: boolean;
  published_on: string;
  countries: string[];
  topics: string[];
  kind: "news" | "deadline" | "evergreen" | "open";
  deadline: string | null;
}

/** News links with a country filter (only countries that have news). */
export function NewsList({ items, countryNames }: { items: NewsItem[]; countryNames: Record<string, string> }) {
  const t = useTranslations("news");
  const locale = useLocale() as AppLocale;
  const [country, setCountry] = useState<string | null>(null);
  const counts = new Map<string, number>();
  for (const i of items) for (const c of i.countries) if (countryNames[c]) counts.set(c, (counts.get(c) ?? 0) + 1);
  const countries = [...counts.keys()].sort((a, b) => counts.get(b)! - counts.get(a)!);
  const shown = country ? items.filter((i) => i.countries.includes(country)) : items;

  return (
    <div className="space-y-4">
      {countries.length > 0 && (
        <div className="-mx-1 flex gap-2 no-scrollbar overflow-x-auto px-1 pb-1">
          <ChipToggle pressed={country === null} onClick={() => setCountry(null)}>
            {t("all")}
          </ChipToggle>
          {countries.map((c) => (
            <ChipToggle key={c} pressed={country === c} onClick={() => setCountry(country === c ? null : c)}>
              {countryNames[c]}
            </ChipToggle>
          ))}
        </div>
      )}
      <p aria-live="polite" className="font-semibold">
        {t("count", { count: shown.length })}
      </p>
      {shown.length === 0 ? (
        <EmptyState icon="news" title={t("empty")} />
      ) : (
        <ul className="divide-y divide-border rounded-card bg-surface shadow-card">
          {shown.map((i) => (
            <li key={i.id}>
              <a href={i.url} target="_blank" rel="noopener noreferrer" className="group flex gap-3 p-4 hover:bg-surface-2">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold leading-snug group-hover:underline">{i.title}</span>
                  <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-meta text-ink-muted">
                    {i.official && <Badge tone="success" icon="check">{t("official")}</Badge>}
                    {i.kind === "deadline" && i.deadline && <Badge tone="warning">{t("deadline", { date: formatDate(i.deadline, locale) })}</Badge>}
                    {(i.kind === "evergreen" || i.kind === "open") && <Badge tone="primary">{t("kept")}</Badge>}
                    <span>{i.source}</span>
                    <span aria-hidden="true">·</span>
                    <time dateTime={i.published_on}>{formatDate(i.published_on, locale)}</time>
                    {i.countries
                      .filter((c) => countryNames[c])
                      .slice(0, 3)
                      .map((c) => (
                        <Badge key={c}>{countryNames[c]}</Badge>
                      ))}
                  </span>
                </span>
                <Icon name="external" className="mt-1 size-4 shrink-0 text-ink-muted" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
