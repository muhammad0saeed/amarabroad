"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { FitBadge } from "@/components/fit/FitScore";
import { Icon } from "@/components/icons";
import { NotFound } from "@/components/ui/NotFound";
import { NextDeadline } from "@/components/ui/NextDeadline";
import { ButtonLink, buttonClass, EmptyState, YesNoTag } from "@/components/ui/primitives";
import { Link, useRouter } from "@/i18n/navigation";
import { compareStore, comparisonsStore, useHydrated, useStore } from "@/lib/clientStore";
import { todayISO } from "@/lib/dates";
import { compareQuery, COMPARE_MAX, COMPARE_MIN, parseCompareIds } from "@/lib/filters";
import type { FitContext } from "@/lib/fitScore";
import { formatNumber, localizeDigits, type AppLocale } from "@/lib/localize";
import { formatBDT, formatMoney } from "@/lib/money";
import type { ProgramSummary } from "@/lib/summary";
import { useProgramSummaries } from "@/lib/useProgramSummaries";

export function CompareView({ fitContext }: { fitContext: FitContext }) {
  const t = useTranslations("compare");
  const p = useTranslations("program");
  const labels = useTranslations("labels");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const params = useSearchParams();
  const hydrated = useHydrated();
  const tray = useStore(compareStore);
  const [copied, setCopied] = useState(false);
  const [savedNow, setSavedNow] = useState(false);

  const fromUrl = parseCompareIds(new URLSearchParams(params.toString()));
  const wanted = fromUrl.length ? fromUrl : hydrated ? tray : [];
  // Only the compared programs are loaded from the server; ones that no longer exist drop out.
  const loaded = useProgramSummaries(wanted, fromUrl.length > 0 || hydrated);
  const selected = wanted.map((id) => loaded?.find((x) => x.slug === id)).filter((x) => x !== undefined);
  const ids = selected.map((x) => x.slug);

  // Keep the tray in step with a shared link, so "add more" continues from it.
  useEffect(() => {
    if (fromUrl.length && fromUrl.join() !== compareStore.get().join()) compareStore.set(fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  function remove(slug: string) {
    const next = ids.filter((id) => id !== slug);
    compareStore.set(next);
    router.replace(next.length ? `/compare?${compareQuery(next)}` : "/compare", { scroll: false });
  }

  async function copyLink() {
    const url = `${window.location.origin}${window.location.pathname}?${compareQuery(ids)}`;
    try {
      if (navigator.share) await navigator.share({ title: t("title"), url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      // Dismissed.
    }
  }

  function save() {
    comparisonsStore.set((list) => [{ ids, saved_on: todayISO() }, ...list.filter((c) => c.ids.join() !== ids.join())]);
    setSavedNow(true);
  }

  if ((!hydrated && !fromUrl.length) || loaded === null) return <p className="min-h-[60dvh] text-ink-muted">{t("loading")}</p>;
  if (selected.length < COMPARE_MIN) {
    return (
      <EmptyState
        icon="compare"
        title={t("emptyTitle", { min: COMPARE_MIN, max: COMPARE_MAX })}
        body={selected.length === 1 ? t("needOneMore", { title: selected[0]!.title }) : t("emptyBody")}
        action={<ButtonLink href="/programs">{t("browse")}</ButtonLink>}
      />
    );
  }

  const name = (x: { name_en: string; name_bn: string }) => (locale === "bn" ? x.name_bn : x.name_en);
  const rows: [string, (x: ProgramSummary) => ReactNode][] = [
    [t("row.fit"), (x) => <FitBadge program={x} ctx={fitContext} />],
    [t("row.place"), (x) => `${name(x.city)}, ${name(x.country)}`],
    [t("row.level"), (x) => labels(`level.${x.degree_level}`)],
    [t("row.duration"), (x) => (x.duration_months === null ? <NotFound /> : p("months", { count: x.duration_months }))],
    [t("row.language"), (x) => (x.language === null ? <NotFound /> : labels(`lang.${x.language}`))],
    [
      t("row.tuition"),
      (x) =>
        x.tuition_per_year === null || x.currency === null ? (
          <NotFound />
        ) : x.tuition_per_year === 0 ? (
          p("tuitionFree")
        ) : (
          <>
            {x.tuition_per_year_bdt === null ? null : formatBDT(x.tuition_per_year_bdt, locale)}
            <span className="block text-ink-muted">{formatMoney(x.tuition_per_year, x.currency, locale)}</span>
          </>
        ),
    ],
    [t("row.total"), (x) => (x.total_bdt === null ? <NotFound /> : <strong>{formatBDT(x.total_bdt, locale)}</strong>)],
    [t("row.firstYear"), (x) => (x.first_year_bdt === null ? <NotFound /> : formatBDT(x.first_year_bdt, locale))],
    [t("row.minGrade"), (x) => (x.min_gpa_requirement === null ? <NotFound /> : `${formatNumber(x.min_gpa_requirement.value, locale, 2)} / ${formatNumber(x.min_gpa_requirement.scale, locale)}`)],
    [t("row.ielts"), (x) => { const i = x.english_tests.find((e) => e.test === "ielts"); return i ? formatNumber(i.min_score, locale) : "—"; }],
    [t("row.moi"), (x) => (x.accepts_moi === null ? <NotFound /> : <YesNoTag yes={x.accepts_moi}>{t(x.accepts_moi ? "yes" : "no")}</YesNoTag>)],
    [t("row.threeYear"), (x) => (x.degree_level !== "master" ? "—" : x.accepts_3yr_bachelor === null ? <NotFound /> : <YesNoTag yes={x.accepts_3yr_bachelor}>{t(x.accepts_3yr_bachelor ? "yes" : "no")}</YesNoTag>)],
    [t("row.provisional"), (x) => (x.accepts_provisional === null ? <NotFound /> : <YesNoTag yes={x.accepts_provisional}>{t(x.accepts_provisional ? "yes" : "no")}</YesNoTag>)],
    [t("row.seats"), (x) => (x.seats_non_eu === null ? p("notPublished") : localizeDigits(String(x.seats_non_eu), locale))],
    [t("row.deadline"), (x) => <NextDeadline intakes={x.intakes} />],
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={copyLink} className={buttonClass("primary", "sm")}>
          <Icon name={copied ? "check" : "share"} className="size-4" /> <span aria-live="polite">{t(copied ? "copied" : "share")}</span>
        </button>
        <button type="button" onClick={save} disabled={savedNow} className={buttonClass("secondary", "sm")}>
          <Icon name={savedNow ? "check" : "bookmark"} className="size-4" /> {t(savedNow ? "savedDone" : "save")}
        </button>
        {selected.length < COMPARE_MAX && (
          <ButtonLink href="/programs" variant="ghost" size="sm">
            <Icon name="plus" className="size-4" /> {t("addMore")}
          </ButtonLink>
        )}
      </div>

      <div className="overflow-x-auto rounded-card bg-surface shadow-card">
        <table className="w-full min-w-[34rem] border-collapse text-meta">
          <caption className="sr-only">{t("caption")}</caption>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 w-28 bg-surface p-3 text-left font-normal text-ink-muted">
                <span className="sr-only">{t("row.program")}</span>
              </th>
              {selected.map((x) => (
                <th key={x.slug} scope="col" className="min-w-40 p-3 text-left align-top">
                  <Link href={`/programs/${x.slug}`} className="font-semibold leading-snug hover:underline">
                    {x.title}
                  </Link>
                  <span className="block font-normal text-ink-muted">{x.university.name}</span>
                  <button type="button" onClick={() => remove(x.slug)} className="mt-1 inline-flex min-h-tap items-center gap-1 text-danger hover:underline">
                    <Icon name="close" className="size-4" /> {t("remove")}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(([label, cell]) => (
              <tr key={label}>
                <th scope="row" className="sticky left-0 z-10 bg-surface p-3 text-left font-normal text-ink-muted">
                  {label}
                </th>
                {selected.map((x) => (
                  <td key={x.slug} className="p-3 align-top">
                    {cell(x)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-meta text-ink-muted">{t("note")}</p>
    </div>
  );
}
