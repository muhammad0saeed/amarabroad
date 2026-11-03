"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { ScoreDisclaimer, useReasonText } from "@/components/fit/FitScore";
import { Icon } from "@/components/icons";
import { ProfileForm, type ProfileFormOptions } from "@/components/profile/ProfileForm";
import { ProgramCard, type FieldInfo } from "@/components/program/ProgramCard";
import { ChipToggle } from "@/components/ui/fields";
import { Badge, buttonClass, EmptyState } from "@/components/ui/primitives";
import { Link } from "@/i18n/navigation";
import { profileStore, useHydrated, useStore } from "@/lib/clientStore";
import { computeFit, type FitContext, type FitResult } from "@/lib/fitScore";
import { localizeDigits, type AppLocale } from "@/lib/localize";
import { formatBDT } from "@/lib/money";
import { isProfileComplete } from "@/lib/profile";
import type { ProgramSummary } from "@/lib/summary";
import type { StudentProfile } from "@/types";

const BAND_TONE = { strong: "success", good: "primary", possible: "warning", weak: "neutral" } as const;

interface Props {
  programs: ProgramSummary[];
  fields: Record<string, FieldInfo>;
  fitContext: FitContext;
  options: ProfileFormOptions;
}

export function MatchView({ programs, fields, fitContext, options }: Props) {
  const t = useTranslations("match");
  const hydrated = useHydrated();
  const profile = useStore(profileStore);
  const [editing, setEditing] = useState(false);

  function save(p: StudentProfile) {
    profileStore.set(p);
    setEditing(false);
    window.scrollTo({ top: 0 });
  }

  if (!hydrated) return <p className="text-ink-muted">{t("loading")}</p>;
  if (editing || !isProfileComplete(profile)) {
    return (
      <div className="space-y-3">
        <p className="flex gap-2 text-meta text-ink-muted">
          <Icon name="info" className="size-4 shrink-0" /> {t("privacy")}
        </p>
        <ProfileForm options={options} initial={profile} mode="wizard" onSave={save} submitLabel={t("seeMatches")} />
        {editing && (
          <button type="button" onClick={() => setEditing(false)} className={buttonClass("ghost", "sm")}>
            {t("cancel")}
          </button>
        )}
      </div>
    );
  }
  return <MatchResults profile={profile} programs={programs} fields={fields} fitContext={fitContext} onEdit={() => setEditing(true)} />;
}

function MatchResults({ profile, programs, fields, fitContext, onEdit }: { profile: StudentProfile; programs: ProgramSummary[]; fields: Record<string, FieldInfo>; fitContext: FitContext; onEdit: () => void }) {
  const t = useTranslations("match");
  const fit = useTranslations("fit");
  const locale = useLocale() as AppLocale;
  const fieldNames = useMemo(() => Object.fromEntries(Object.entries(fields).map(([k, f]) => [k, f.name])), [fields]);
  const reasonText = useReasonText(fieldNames);
  const hasPrefs = profile.target_countries.length > 0 || profile.target_fields.length > 0;
  const [onlyMine, setOnlyMine] = useState(hasPrefs);
  const [withinBudget, setWithinBudget] = useState(false);
  const budget = profile.budget_bdt_total;

  const scored = useMemo(() => {
    const level = profile.field.startsWith("hsc-") ? "bachelor" : "master";
    return programs
      .filter((p) => p.degree_level === level)
      .filter((p) => !onlyMine || ((!profile.target_countries.length || profile.target_countries.includes(p.country.slug)) && (!profile.target_fields.length || profile.target_fields.includes(p.field))))
      .filter((p) => !withinBudget || budget === null || p.total_bdt <= budget)
      .map((p) => ({ program: p, fit: computeFit(profile, p, fitContext) }));
  }, [programs, profile, fitContext, onlyMine, withinBudget, budget]);

  const eligible = scored.filter((x): x is { program: ProgramSummary; fit: Extract<FitResult, { eligible: true }> } => x.fit.eligible).sort((a, b) => b.fit.score - a.fit.score);
  const ineligible = scored.filter((x): x is { program: ProgramSummary; fit: Extract<FitResult, { eligible: false }> } => !x.fit.eligible);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p aria-live="polite" className="text-heading font-semibold">
          {t("resultCount", { count: eligible.length })}
        </p>
        <button type="button" onClick={onEdit} className={buttonClass("secondary", "sm")}>
          {t("edit")}
        </button>
      </div>
      <div className="-mx-1 flex gap-2 no-scrollbar overflow-x-auto px-1 pb-1">
        {hasPrefs && (
          <ChipToggle pressed={onlyMine} onClick={() => setOnlyMine(!onlyMine)}>
            {t("onlyMine")}
          </ChipToggle>
        )}
        {budget !== null && (
          <ChipToggle pressed={withinBudget} onClick={() => setWithinBudget(!withinBudget)}>
            {t("withinBudget", { amount: formatBDT(budget, locale) })}
          </ChipToggle>
        )}
      </div>

      {eligible.length === 0 ? (
        <EmptyState icon="match" title={t("emptyTitle")} body={t("emptyBody")} />
      ) : (
        <ol className="grid gap-3 md:grid-cols-2">
          {eligible.map(({ program, fit: r }, i) => (
            <li key={program.slug}>
              <ProgramCard
                program={program}
                field={fields[program.field]}
                fit={
                  <span className="flex items-center gap-1.5">
                    <span className="text-meta font-semibold text-ink-muted">#{localizeDigits(String(i + 1), locale)}</span>
                    <Badge tone={BAND_TONE[r.band]}>{fit("badge", { score: localizeDigits(String(r.score), locale), band: fit(`band.${r.band}`) })}</Badge>
                    {budget !== null && program.total_bdt > budget && <Badge tone="warning">{t("overBudget")}</Badge>}
                  </span>
                }
              />
              <p className="mt-1 px-2 text-meta text-ink-muted">
                {r.parts
                  .filter((p) => p.scored)
                  .map((p) => `${fit(`part.${p.key}`)} ${localizeDigits(String(p.points), locale)}/${localizeDigits(String(p.max), locale)}`)
                  .join(" · ")}
              </p>
            </li>
          ))}
        </ol>
      )}

      <ScoreDisclaimer />

      {ineligible.length > 0 && (
        <details className="rounded-card bg-surface shadow-card [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex min-h-tap cursor-pointer list-none items-center justify-between px-4 py-3 font-semibold">
            {t("notEligible", { count: ineligible.length })}
            <Icon name="chevronDown" className="size-5 text-ink-muted" />
          </summary>
          <ul className="divide-y divide-border border-t border-border">
            {ineligible.map(({ program, fit: r }) => (
              <li key={program.slug} className="px-4 py-3">
                <Link href={`/programs/${program.slug}`} className="font-semibold hover:underline">
                  {program.title}
                </Link>
                <p className="text-meta text-ink-muted">{program.university.name}</p>
                <ul className="mt-1 space-y-0.5">
                  {r.reasons.map((reason) => (
                    <li key={reason.code} className="flex gap-1.5 text-meta">
                      <Icon name="close" className="mt-0.5 size-3.5 shrink-0 text-danger" /> {reasonText(reason)}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
