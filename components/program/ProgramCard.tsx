import { useLocale, useTranslations } from "next-intl";
import { languageName } from "@/lib/language";
import type { ReactNode } from "react";
import { GROUP_ICON, Icon } from "@/components/icons";
import { NextDeadline } from "@/components/ui/NextDeadline";
import { NotFound } from "@/components/ui/NotFound";
import { Link } from "@/i18n/navigation";
import { localizeDigits, type AppLocale } from "@/lib/localize";
import { formatBDT, formatMoney } from "@/lib/money";
import type { ProgramSummary } from "@/lib/summary";
import type { FieldGroup, TileColor } from "@/types";
import { ProgramCardActions } from "./ProgramActions";

export interface FieldInfo {
  name: { en: string; bn: string };
  group: FieldGroup;
  tile: TileColor;
}

/** One program in a list. Read top to bottom: what, where, what it costs, does my degree fit, when to apply. */
export function ProgramCard({
  program: p,
  field,
  fit,
  headingLevel = "h3",
  snippet,
}: {
  program: ProgramSummary;
  field?: FieldInfo;
  fit?: ReactNode;
  headingLevel?: "h2" | "h3";
  /** Where a search matched the program's official page. */
  snippet?: ReactNode;
}) {
  const t = useTranslations("program");
  const labels = useTranslations("labels");
  const common = useTranslations("common");
  const locale = useLocale() as AppLocale;
  const Heading = headingLevel;
  const ielts = p.english_tests.find((e) => e.test === "ielts");
  const place = `${locale === "bn" ? p.city.name_bn : p.city.name_en}, ${locale === "bn" ? p.country.name_bn : p.country.name_en}`;
  const fieldName = field ? (locale === "bn" ? field.name.bn : field.name.en) : null;

  // Bangladesh rules, as a compact checklist. Only the ones that matter for this level.
  const rules: { ok: boolean; label: string }[] = [
    // Only stated answers appear on the card; "not stated" is spelled out on the program page.
    ...(p.degree_level === "master" && p.accepts_3yr_bachelor !== null ? [{ ok: p.accepts_3yr_bachelor, label: p.accepts_3yr_bachelor ? t("tag3yr") : t("tagNo3yr") }] : []),
    ...(p.accepts_moi ? [{ ok: true, label: t("tagMoi") }] : []),
    ...(p.accepts_provisional ? [{ ok: true, label: t("tagProvisional") }] : []),
  ];

  return (
    <article className="group/card relative flex h-full flex-col rounded-card bg-surface p-4 shadow-card transition-shadow hover:shadow-float sm:p-5">
      <div className="flex items-center gap-2 text-meta text-ink-muted">
        <span aria-hidden="true" className="grid size-7 place-items-center rounded-full bg-surface-2 text-ink">
          <Icon name={field ? GROUP_ICON[field.group] : "cap"} className="size-4" />
        </span>
        <span className="min-w-0 truncate">
          {labels(`level.${p.degree_level}`)}
          {fieldName && ` · ${fieldName}`}
        </span>
        {p.is_sample && (
          <span title={common("sampleNotice")} className="ml-auto shrink-0 rounded-full bg-warning-soft px-2 py-0.5 text-[0.6875rem] font-semibold text-warning">
            {common("sampleData")}
          </span>
        )}
      </div>

      <Heading className="mt-3 text-heading leading-snug font-semibold tracking-tight">
        <Link href={`/programs/${p.slug}`} className="after:absolute after:inset-0 after:rounded-card group-hover/card:underline">
          {p.title}
        </Link>
      </Heading>
      <p className="mt-1 flex items-center gap-1 text-meta text-ink-muted">
        <Icon name="building" className="size-4 shrink-0" />
        <span className="truncate">
          {p.university.name} · {place}
        </span>
      </p>

      <div className="mt-4 flex items-end justify-between gap-3">
        {/* The whole cost when we know it; otherwise tuition per year; otherwise "Not found". Never a guess. */}
        <div>
          {p.total_bdt !== null ? (
            <>
              <p className="text-meta text-ink-muted">{t("totalCost")}</p>
              <p className="text-title leading-none font-bold tracking-tight tabular-nums">{formatBDT(p.total_bdt, locale)}</p>
            </>
          ) : p.tuition_per_year !== null ? (
            <>
              <p className="text-meta text-ink-muted">{t("tuitionPerYear")}</p>
              <p className="text-title leading-none font-bold tracking-tight tabular-nums">
                {p.tuition_per_year === 0 ? t("tuitionFree") : p.tuition_per_year_bdt !== null ? formatBDT(p.tuition_per_year_bdt, locale) : formatMoney(p.tuition_per_year, p.currency ?? "EUR", locale)}
              </p>
            </>
          ) : (
            <>
              <p className="text-meta text-ink-muted">{t("tuitionPerYear")}</p>
              <NotFound className="mt-1 text-body" />
            </>
          )}
        </div>
        <dl className="flex gap-4 text-right text-meta">
          <div>
            <dt className="text-ink-muted">{t("duration")}</dt>
            <dd className="font-semibold">{p.duration_months === null ? <NotFound /> : t("months", { count: p.duration_months })}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">{p.language === "en" || p.language === null ? "IELTS" : t("teaching")}</dt>
            <dd className="font-semibold">
              {p.language === "en" || p.language === null ? ielts ? localizeDigits(String(ielts.min_score), locale) : <NotFound /> : languageName(labels, p.language, locale)}
            </dd>
          </div>
        </dl>
      </div>

      {(rules.length > 0 || p.tuition_per_year === 0 || !p.open_to_bd_citizens) && (
        <ul className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-meta">
          {p.tuition_per_year === 0 && (
            <li className="inline-flex items-center gap-1 font-semibold text-success">
              <Icon name="coins" className="size-4" />
              {t("tuitionFree")}
            </li>
          )}
          {rules.map((r) => (
            <li key={r.label} className={`inline-flex items-center gap-1 ${r.ok ? "text-ink" : "text-ink-muted"}`}>
              <Icon name={r.ok ? "check" : "close"} className={`size-4 ${r.ok ? "text-success" : ""}`} weight="bold" />
              {r.label}
            </li>
          ))}
          {!p.open_to_bd_citizens && (
            <li className="inline-flex items-center gap-1 font-semibold text-danger">
              <Icon name="alert" className="size-4" />
              {t("tagNotBd")}
            </li>
          )}
        </ul>
      )}

      {snippet}
      <div className="flex-1" />
      <div className="relative z-10 mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <NextDeadline intakes={p.intakes} />
          {fit}
        </div>
        <ProgramCardActions slug={p.slug} title={p.title} />
      </div>
    </article>
  );
}
