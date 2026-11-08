"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { matchPrograms, type MatchResult } from "@/app/actions/programs";
import { ScoreDisclaimer, useReasonText } from "@/components/fit/FitScore";
import { Icon } from "@/components/icons";
import { ProfileForm, type ProfileFormOptions } from "@/components/profile/ProfileForm";
import { ProgramCard, type FieldInfo } from "@/components/program/ProgramCard";
import { ChipToggle } from "@/components/ui/fields";
import { Badge, buttonClass, EmptyState } from "@/components/ui/primitives";
import { Link } from "@/i18n/navigation";
import { profileStore, useHydrated, useStore } from "@/lib/clientStore";
import type { FitContext, FitResult } from "@/lib/fitScore";
import { localizeDigits, type AppLocale } from "@/lib/localize";
import { formatBDT } from "@/lib/money";
import { isProfileComplete } from "@/lib/profile";
import type { ProgramSummary } from "@/lib/summary";
import type { StudentProfile } from "@/types";

const BAND_TONE = { strong: "success", good: "primary", possible: "warning", weak: "neutral" } as const;

interface Props {
  fields: Record<string, FieldInfo>;
  fitContext: FitContext;
  options: ProfileFormOptions;
}

export function MatchView({ fields, fitContext, options }: Props) {
  const t = useTranslations("match");
  const hydrated = useHydrated();
  const profile = useStore(profileStore);
  const [editing, setEditing] = useState(false);

  function save(p: StudentProfile) {
    profileStore.set(p);
    setEditing(false);
    window.scrollTo({ top: 0 });
  }

  // The static HTML shows step 1 of the quiz (no layout jump for new visitors);
  // a saved profile swaps it for the results once the page loads.
  if (!hydrated || editing || !isProfileComplete(profile)) {
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
  return <MatchResults profile={profile} fields={fields} fitContext={fitContext} onEdit={() => setEditing(true)} />;
}

// Scoring runs on the server (every program), so the phone only downloads the best matches.
// fitContext is kept for the card badges' shape; the scores come from the server.
function MatchResults({ profile, fields, onEdit }: { profile: StudentProfile; fields: Record<string, FieldInfo>; fitContext: FitContext; onEdit: () => void }) {
  const t = useTranslations("match");
  const fit = useTranslations("fit");
  const locale = useLocale() as AppLocale;
  const fieldNames = useMemo(() => Object.fromEntries(Object.entries(fields).map(([k, f]) => [k, f.name])), [fields]);
  const reasonText = useReasonText(fieldNames);
  const hasPrefs = profile.target_countries.length > 0 || profile.target_fields.length > 0;
  const [onlyMine, setOnlyMine] = useState(hasPrefs);
  const [withinBudget, setWithinBudget] = useState(false);
  const budget = profile.budget_bdt_total;

  const [result, setResult] = useState<{ key: string; value: MatchResult | null } | null>(null);
  const key = JSON.stringify([profile, onlyMine, withinBudget]);
  useEffect(() => {
    let live = true;
    matchPrograms(profile, { onlyMine, withinBudget })
      .then((value) => live && setResult({ key, value }))
      .catch(() => live && setResult({ key, value: null }));
    return () => {
      live = false;
    };
    // key covers profile and both toggles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const loading = !result || result.key !== key;
  const data = loading ? null : result.value;
  type Eligible = { program: ProgramSummary; fit: Extract<FitResult, { eligible: true }> };
  type Ineligible = { program: ProgramSummary; fit: Extract<FitResult, { eligible: false }> };
  const eligible = (data?.eligible ?? []) as Eligible[];
  const ineligible = (data?.ineligible ?? []) as Ineligible[];
  const eligibleCount = data?.eligibleCount ?? 0;
  const ineligibleCount = data?.ineligibleCount ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p aria-live="polite" className="text-heading font-semibold">
          {loading ? t("loading") : t("resultCount", { count: eligibleCount })}
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

      {loading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-card bg-surface-2" />
          ))}
        </div>
      ) : eligible.length === 0 ? (
        <EmptyState icon="match" title={t("emptyTitle")} body={t("emptyBody")} />
      ) : (
        <ol className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {eligible.map(({ program, fit: r }, i) => (
            <li key={program.slug}>
              <ProgramCard
                program={program}
                field={fields[program.field]}
                headingLevel="h2"
                fit={
                  <span className="flex items-center gap-1.5">
                    <span className="text-meta font-semibold text-ink-muted">#{localizeDigits(String(i + 1), locale)}</span>
                    <Badge tone={BAND_TONE[r.band]}>{fit("badge", { score: localizeDigits(String(r.score), locale), band: fit(`band.${r.band}`) })}</Badge>
                    {budget !== null && program.total_bdt !== null && program.total_bdt > budget && <Badge tone="warning">{t("overBudget")}</Badge>}
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
      {!loading && eligibleCount > eligible.length && (
        <p className="text-meta text-ink-muted">{t("showingTop", { shown: localizeDigits(String(eligible.length), locale), total: localizeDigits(String(eligibleCount), locale) })}</p>
      )}

      <ScoreDisclaimer />

      {ineligibleCount > 0 && (
        <details className="rounded-card bg-surface shadow-card [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex min-h-tap cursor-pointer list-none items-center justify-between px-4 py-3 font-semibold">
            {t("notEligible", { count: ineligibleCount })}
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
