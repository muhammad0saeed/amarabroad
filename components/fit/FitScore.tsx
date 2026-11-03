"use client";

import { useLocale, useTranslations } from "next-intl";
import { Icon } from "@/components/icons";
import { Badge, ButtonLink } from "@/components/ui/primitives";
import { profileStore, useHydrated, useStore } from "@/lib/clientStore";
import {
  computeFit,
  improvementTips,
  scholarshipFit,
  type Band,
  type FitContext,
  type FitProgram,
  type FitResult,
  type FitTip,
  type GateReason,
} from "@/lib/fitScore";
import { formatNumber, localizeDigits, type AppLocale } from "@/lib/localize";
import { isProfileComplete } from "@/lib/profile";
import type { Scholarship } from "@/types";

const BAND_TONE: Record<Band, "success" | "primary" | "warning" | "neutral"> = {
  strong: "success",
  good: "primary",
  possible: "warning",
  weak: "neutral",
};

export function useFit(program: FitProgram, ctx: FitContext): FitResult | null {
  const profile = useStore(profileStore);
  const hydrated = useHydrated();
  if (!hydrated || !isProfileComplete(profile)) return null;
  return computeFit(profile, program, ctx);
}

/** Small "Fit 70 · Good" badge for cards and tables. */
export function FitBadge({ program, ctx }: { program: FitProgram; ctx: FitContext }) {
  const t = useTranslations("fit");
  const locale = useLocale() as AppLocale;
  const fit = useFit(program, ctx);
  if (!fit) return null;
  if (!fit.eligible) return <Badge tone="danger">{t("notEligible")}</Badge>;
  return (
    <Badge tone={BAND_TONE[fit.band]}>
      {t("badge", { score: localizeDigits(String(fit.score), locale), band: t(`band.${fit.band}`) })}
    </Badge>
  );
}

function ScoreRing({ score, band }: { score: number; band: Band }) {
  const locale = useLocale() as AppLocale;
  const r = 34;
  const c = 2 * Math.PI * r;
  const color = { strong: "var(--success)", good: "var(--primary)", possible: "var(--warning)", weak: "var(--ink-muted)" }[band];
  return (
    <svg viewBox="0 0 80 80" className="size-20 shrink-0" aria-hidden="true">
      <circle cx="40" cy="40" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="8" />
      <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(score / 100) * c} ${c}`} transform="rotate(-90 40 40)" />
      <text x="40" y="46" textAnchor="middle" fontSize="20" fontWeight="700" fill="var(--ink)">
        {localizeDigits(String(score), locale)}
      </text>
    </svg>
  );
}

export function ScoreDisclaimer() {
  const t = useTranslations("fit");
  return (
    <details className="mt-3 text-meta text-ink-muted [&_summary::-webkit-details-marker]:hidden">
      <summary className="inline-flex min-h-tap cursor-pointer list-none items-center gap-1.5 font-semibold">
        <Icon name="info" className="size-4" /> {t("disclaimerShort")}
      </summary>
      <p className="mt-1">{t("disclaimerFull")}</p>
    </details>
  );
}

export function useReasonText(fieldNames: Record<string, { en: string; bn: string }>) {
  const t = useTranslations("fit");
  const labels = useTranslations("labels");
  const locale = useLocale() as AppLocale;
  const n = (v: string | number | undefined) => formatNumber(Number(v), locale, 2);
  return (reason: GateReason): string => {
    const p = reason.params ?? {};
    switch (reason.code) {
      case "field_not_related": {
        const name = fieldNames[String(p.field)];
        return t("reason.field_not_related", { field: name ? (locale === "bn" ? name.bn : name.en) : String(p.field) });
      }
      case "english_below_minimum":
        return t("reason.english_below_minimum", { test: labels(`test.${p.test}`), score: n(p.score), min: n(p.min) });
      case "english_test_not_accepted":
        return t("reason.english_test_not_accepted", {
          test: labels(`test.${p.test}`),
          accepted: String(p.accepted)
            .split(",")
            .map((x) => labels(`test.${x}`))
            .join(", "),
        });
      case "grade_below_minimum":
        return t("reason.grade_below_minimum", { yours: n(p.yours), yoursScale: n(p.yoursScale), min: n(p.min), scale: n(p.scale) });
      case "grade_missing":
        return t(Number(p.scale) === 5 ? "reason.hsc_missing" : "reason.grade_missing");
      default:
        return t(`reason.${reason.code}`);
    }
  };
}

function TipText({ tip }: { tip: FitTip }) {
  const t = useTranslations("fit");
  const labels = useTranslations("labels");
  const locale = useLocale() as AppLocale;
  const gain = localizeDigits(String(tip.gain), locale);
  if (tip.kind === "english") {
    // IELTS bands always show one decimal ("6.5 → 7.0"); other tests are whole numbers.
    const score = (v: number) => (tip.test === "ielts" ? localizeDigits(v.toFixed(1), locale) : formatNumber(v, locale));
    return <>{t("tip.english", { test: labels(`test.${tip.test}`), from: score(tip.from), to: score(tip.to), gain })}</>;
  }
  if (tip.kind === "experience")
    return <>{t("tip.experience", { months: localizeDigits(String(tip.toMonths - tip.fromMonths), locale), gain })}</>;
  return <>{t("tip.certificate", { gain })}</>;
}

/** Full Fit Score card on the program page. */
export function FitScoreCard({
  program,
  ctx,
  fieldNames,
  languageRequirement,
}: {
  program: FitProgram;
  ctx: FitContext;
  fieldNames: Record<string, { en: string; bn: string }>;
  languageRequirement?: string;
}) {
  const t = useTranslations("fit");
  const locale = useLocale() as AppLocale;
  const profile = useStore(profileStore);
  const hydrated = useHydrated();
  const reasonText = useReasonText(fieldNames);

  const shell = (children: React.ReactNode) => (
    <section aria-labelledby="fit-title" className="rounded-card border border-primary/20 bg-primary-soft p-4 sm:p-5">
      <h2 id="fit-title" className="flex items-center gap-2 text-heading font-semibold text-primary-ink">
        <Icon name="match" /> {t("title")}
      </h2>
      {children}
    </section>
  );

  // The static HTML already shows the intro text (so the page paints it right away); the button
  // stays invisible until we know there's no saved profile, then the score replaces both if there is.
  if (!hydrated || !isProfileComplete(profile)) {
    return shell(
      <>
        <p className="mt-2 text-ink-muted">{t("noProfile")}</p>
        <ButtonLink href="/match" className={`mt-4 ${hydrated ? "" : "invisible"}`} full>
          {t("cta")} <Icon name="arrowRight" className="size-4" />
        </ButtonLink>
      </>,
    );
  }

  const fit = computeFit(profile, program, ctx);
  const notes = fit.notes.map((note) =>
    note.code === "language_requirement" ? t("note.language_requirement", { requirement: languageRequirement ?? note.requirement }) : t(`note.${note.code}`),
  );

  if (!fit.eligible) {
    return shell(
      <>
        <p className="mt-3 flex items-center gap-2 text-title font-bold text-danger">
          <Icon name="xCircle" className="size-6" /> {t("notEligible")}
        </p>
        <ul className="mt-3 space-y-2">
          {fit.reasons.map((r) => (
            <li key={r.code} className="flex gap-2 rounded-tile bg-surface p-3 text-meta">
              <Icon name="alert" className="mt-0.5 size-4 shrink-0 text-danger" />
              {reasonText(r)}
            </li>
          ))}
        </ul>
        {notes.map((n) => (
          <p key={n} className="mt-2 text-meta text-ink-muted">
            {n}
          </p>
        ))}
        <ButtonLink href="/profile" variant="ghost" size="sm" className="mt-2 -ml-3">
          {t("editProfile")}
        </ButtonLink>
        <ScoreDisclaimer />
      </>,
    );
  }

  const tips = improvementTips(profile, program, ctx);
  return shell(
    <>
      <div className="mt-3 flex items-center gap-4">
        <ScoreRing score={fit.score} band={fit.band} />
        <div>
          <p className="text-title font-bold">{t(`band.${fit.band}`)}</p>
          <p className="text-meta text-ink-muted">{t("outOf100")}</p>
        </div>
      </div>
      <ul className="mt-4 space-y-2">
        {fit.parts.map((part) => (
          <li key={part.key}>
            <div className="flex justify-between text-meta">
              <span>{t(`part.${part.key}`)}</span>
              <span className="font-semibold">
                {part.scored ? `${localizeDigits(String(part.points), locale)} / ${localizeDigits(String(part.max), locale)}` : t("notScored")}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface" aria-hidden="true">
              <div className="h-full rounded-full bg-primary" style={{ width: part.scored ? `${(part.points / part.max) * 100}%` : "0%" }} />
            </div>
          </li>
        ))}
      </ul>
      {notes.map((n) => (
        <p key={n} className="mt-3 flex gap-2 text-meta text-ink-muted">
          <Icon name="info" className="mt-0.5 size-4 shrink-0" /> {n}
        </p>
      ))}
      {tips.length > 0 && (
        <div className="mt-4">
          <h3 className="font-semibold">{t("tipsTitle")}</h3>
          <ul className="mt-2 space-y-1.5">
            {tips.map((tip) => (
              <li key={tip.kind} className="flex gap-2 text-meta">
                <Icon name="plus" className="mt-0.5 size-4 shrink-0 text-success" />
                <TipText tip={tip} />
              </li>
            ))}
          </ul>
        </div>
      )}
      <ButtonLink href="/profile" variant="ghost" size="sm" className="mt-2 -ml-3">
        {t("editProfile")}
      </ButtonLink>
      <ScoreDisclaimer />
    </>,
  );
}

/** Fit for one scholarship against one program, shown on scholarship cards. */
export function ScholarshipFitBadge({ scholarship, program, ctx }: { scholarship: Scholarship; program: FitProgram; ctx: FitContext }) {
  const t = useTranslations("fit");
  const locale = useLocale() as AppLocale;
  const profile = useStore(profileStore);
  const hydrated = useHydrated();
  if (scholarship.type === "need") return <Badge>{t("needBased")}</Badge>;
  if (!hydrated || !isProfileComplete(profile)) return null;
  const fit = scholarshipFit(profile, scholarship, program, ctx);
  if (fit.kind === "need_based") return <Badge>{t("needBased")}</Badge>;
  if (fit.kind === "not_eligible") return <Badge tone="danger">{t(`scholarshipReason.${fit.reason}`)}</Badge>;
  return (
    <Badge tone={BAND_TONE[fit.band]}>
      {t("badge", { score: localizeDigits(String(fit.score), locale), band: t(`band.${fit.band}`) })}
      {fit.partlyNeedBased ? ` · ${t("partlyNeed")}` : ""}
    </Badge>
  );
}

