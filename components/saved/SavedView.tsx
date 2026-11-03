"use client";

import { useLocale, useTranslations } from "next-intl";
import { FitBadge } from "@/components/fit/FitScore";
import { Icon } from "@/components/icons";
import { ProgramCard, type FieldInfo } from "@/components/program/ProgramCard";
import { ButtonLink, EmptyState, Section } from "@/components/ui/primitives";
import { Link } from "@/i18n/navigation";
import { comparisonsStore, savedStore, useHydrated, useStore } from "@/lib/clientStore";
import { compareQuery } from "@/lib/filters";
import type { FitContext } from "@/lib/fitScore";
import { formatDate } from "@/lib/format";
import type { AppLocale } from "@/lib/localize";
import type { ProgramSummary } from "@/lib/summary";

export function SavedView({ programs, fields, fitContext }: { programs: ProgramSummary[]; fields: Record<string, FieldInfo>; fitContext: FitContext }) {
  const t = useTranslations("saved");
  const locale = useLocale() as AppLocale;
  const hydrated = useHydrated();
  const saved = useStore(savedStore);
  const comparisons = useStore(comparisonsStore);
  const bySlug = new Map(programs.map((p) => [p.slug, p]));
  const savedPrograms = saved.map((s) => bySlug.get(s)).filter((p): p is ProgramSummary => !!p);

  if (!hydrated) return <p className="text-ink-muted">{t("loading")}</p>;

  return (
    <div className="space-y-8">
      <Section title={t("programs", { count: savedPrograms.length })}>
        {savedPrograms.length === 0 ? (
          <EmptyState icon="bookmark" title={t("emptyTitle")} body={t("emptyBody")} action={<ButtonLink href="/programs">{t("browse")}</ButtonLink>} />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {savedPrograms.map((p) => (
              <li key={p.slug}>
                <ProgramCard program={p} field={fields[p.field]} fit={<FitBadge program={p} ctx={fitContext} />} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t("comparisons", { count: comparisons.length })}>
        {comparisons.length === 0 ? (
          <p className="text-ink-muted">{t("noComparisons")}</p>
        ) : (
          <ul className="space-y-2">
            {comparisons.map((c) => (
              <li key={c.ids.join()} className="flex items-center justify-between gap-2 rounded-card bg-surface p-4 shadow-card">
                <Link href={`/compare?${compareQuery(c.ids)}`} className="min-w-0 hover:underline">
                  <span className="block truncate font-semibold">{c.ids.map((id) => bySlug.get(id)?.title ?? id).join(" · ")}</span>
                  <span className="text-meta text-ink-muted">{t("savedOn", { date: formatDate(c.saved_on, locale) })}</span>
                </Link>
                <button
                  type="button"
                  onClick={() => comparisonsStore.set((list) => list.filter((x) => x.ids.join() !== c.ids.join()))}
                  aria-label={t("removeComparison")}
                  className="grid size-tap shrink-0 place-items-center rounded-full text-ink-muted hover:bg-surface-2 hover:text-danger"
                >
                  <Icon name="trash" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <p className="flex gap-2 text-meta text-ink-muted">
        <Icon name="info" className="size-4 shrink-0" /> {t("deviceNote")}
      </p>
    </div>
  );
}
