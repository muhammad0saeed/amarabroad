"use client";

// Search bar, the phone filter sheet, sort menu and removable chips for every active filter.

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Icon } from "@/components/icons";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { activeFilterCount, SORT_KEYS, type ProgramFilters } from "@/lib/filters";
import { monthName } from "@/lib/format";
import { localizeDigits, type AppLocale } from "@/lib/localize";
import { FilterPanel } from "./FilterPanel";
import { useSearch } from "./SearchState";

export function SearchBar() {
  const t = useTranslations("search");
  const { filters, update } = useSearch();
  const [text, setText] = useState(filters.q);
  const [lastQ, setLastQ] = useState(filters.q);
  // Keep the box in step when the query changes elsewhere (chips, clear all, back button).
  if (lastQ !== filters.q) {
    setLastQ(filters.q);
    setText(filters.q);
  }

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        update({ q: text.trim() });
      }}
      className="flex items-center gap-1 rounded-full border border-border bg-surface p-1 pl-4 shadow-card focus-within:border-accent"
    >
      <label htmlFor="program-search" className="sr-only">
        {t("searchLabel")}
      </label>
      <Icon name="search" className="size-5 shrink-0 text-ink-muted" />
      <input
        id="program-search"
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t("placeholder")}
        className="min-h-tap min-w-0 flex-1 bg-transparent px-2 focus:outline-none"
      />
      <button type="submit" className="inline-flex min-h-10 shrink-0 items-center rounded-full bg-primary px-4 text-meta font-semibold text-on-primary hover:bg-primary-hover">
        {t("go")}
      </button>
    </form>
  );
}

export function SortSelect() {
  const t = useTranslations("search");
  const { filters, update } = useSearch();
  return (
    <label className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border bg-surface pr-1 pl-3 text-meta">
      <span className="text-ink-muted max-sm:sr-only">{t("sort")}</span>
      <select
        value={filters.sort}
        onChange={(e) => update({ sort: e.target.value as ProgramFilters["sort"] })}
        className="min-h-10 max-w-[11rem] cursor-pointer bg-transparent pr-1 font-semibold focus:outline-none"
      >
        {SORT_KEYS.map((k) => (
          <option key={k} value={k}>
            {t(`sortBy.${k}`)}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Phone and tablet: a button that opens the full panel in a sheet. Hidden on desktop, where the sidebar shows. */
export function MobileFilters() {
  const t = useTranslations("search");
  const locale = useLocale() as AppLocale;
  const { filters, total, clear } = useSearch();
  const [open, setOpen] = useState(false);
  const active = activeFilterCount(filters);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="inline-flex min-h-10 items-center gap-2 rounded-full bg-primary px-4 text-meta font-semibold text-on-primary lg:hidden"
      >
        <Icon name="filter" className="size-4" />
        {t("filters")}
        {active > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-on-primary px-1 text-[0.6875rem] text-primary">{localizeDigits(String(active), locale)}</span>}
      </button>
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title={t("filters")}
        closeLabel={t("close")}
        footer={
          <div className="flex gap-2">
            <button type="button" onClick={clear} className="inline-flex min-h-tap shrink-0 items-center rounded-full border border-border px-5 font-semibold whitespace-nowrap">
              {t("clearAll")}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="inline-flex min-h-tap flex-1 items-center justify-center rounded-full bg-primary px-5 font-semibold text-on-primary">
              {t("showResults", { count: total })}
            </button>
          </div>
        }
      >
        <FilterPanel />
      </BottomSheet>
    </>
  );
}

/** One removable chip per active filter value. */
export function ActiveFilters() {
  const t = useTranslations("search");
  const labels = useTranslations("labels");
  const locale = useLocale() as AppLocale;
  const { filters: f, options, update, clear } = useSearch();
  const d = (v: string | number) => localizeDigits(String(v), locale);
  const nm = (o?: { name_en: string; name_bn: string }) => (o ? (locale === "bn" ? o.name_bn : o.name_en) : "");
  const without = <T,>(list: T[], v: T) => list.filter((x) => x !== v);

  const chips: { key: string; label: string; remove: Partial<ProgramFilters> }[] = [
    ...(f.q ? [{ key: "q", label: `“${f.q}”`, remove: { q: "" } }] : []),
    ...f.countries.map((v) => ({ key: `c-${v}`, label: nm(options.countries.find((c) => c.slug === v)) || v, remove: { countries: without(f.countries, v) } })),
    ...f.cities.map((v) => ({ key: `ci-${v}`, label: nm(options.cities.find((c) => c.slug === v)) || v, remove: { cities: without(f.cities, v) } })),
    ...f.universities.map((v) => ({ key: `u-${v}`, label: options.universities.find((u) => u.slug === v)?.name ?? v, remove: { universities: without(f.universities, v) } })),
    ...f.universityTypes.map((v) => ({ key: `ut-${v}`, label: labels(`universityType.${v}`), remove: { universityTypes: without(f.universityTypes, v) } })),
    ...(f.level ? [{ key: "level", label: labels(`level.${f.level}`), remove: { level: null } }] : []),
    ...f.fieldGroups.map((v) => ({ key: `a-${v}`, label: t(`areas.${v}`), remove: { fieldGroups: without(f.fieldGroups, v) } })),
    ...f.fields.map((v) => ({ key: `f-${v}`, label: nm(options.fields.find((x) => x.slug === v)) || v, remove: { fields: without(f.fields, v) } })),
    ...f.languages.map((v) => ({ key: `l-${v}`, label: labels(`lang.${v}`), remove: { languages: without(f.languages, v) } })),
    ...f.durations.map((v) => ({ key: `d-${v}`, label: t(`dur.${v}`), remove: { durations: without(f.durations, v) } })),
    ...(f.maxBudgetLakh !== null ? [{ key: "budget", label: t("underLakh", { amount: d(f.maxBudgetLakh) }), remove: { maxBudgetLakh: null } }] : []),
    ...(f.maxTuitionLakh !== null ? [{ key: "tuition", label: t("tuitionUnder", { amount: d(f.maxTuitionLakh) }), remove: { maxTuitionLakh: null } }] : []),
    ...(f.tuitionFree ? [{ key: "free", label: t("tuitionFree"), remove: { tuitionFree: false } }] : []),
    ...(f.scholarship ? [{ key: "sch", label: t("scholarship"), remove: { scholarship: false } }] : []),
    ...(f.deadline ? [{ key: "deadline", label: t(f.deadline === "open" ? "deadlineOpen" : "deadlineSoon"), remove: { deadline: null } }] : []),
    ...f.intakeMonths.map((m) => ({ key: `m-${m}`, label: monthName(m, locale), remove: { intakeMonths: without(f.intakeMonths, m) } })),
    ...(f.maxIelts !== null ? [{ key: "ielts", label: t("ieltsUpTo", { score: d(f.maxIelts) }), remove: { maxIelts: null } }] : []),
    ...f.englishTests.map((v) => ({ key: `t-${v}`, label: labels(`test.${v}`), remove: { englishTests: without(f.englishTests, v) } })),
    ...(f.accepts3yr ? [{ key: "3yr", label: t("accepts3yr"), remove: { accepts3yr: false } }] : []),
    ...(f.moi ? [{ key: "moi", label: t("moi"), remove: { moi: false } }] : []),
    ...(f.provisional ? [{ key: "prov", label: t("provisional"), remove: { provisional: false } }] : []),
    ...(f.bdOpen ? [{ key: "bd", label: t("bdOpen"), remove: { bdOpen: false } }] : []),
    ...(f.seatsPublished ? [{ key: "seats", label: t("seats"), remove: { seatsPublished: false } }] : []),
  ];
  if (!chips.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t("activeFilters")}>
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => update(c.remove)}
          aria-label={t("remove", { label: c.label })}
          className="inline-flex min-h-9 items-center gap-1 rounded-full bg-primary-soft py-1 pr-2 pl-3 text-meta font-medium text-primary-ink hover:bg-primary-soft/70"
        >
          {c.label}
          <Icon name="close" className="size-3.5" />
        </button>
      ))}
      <button type="button" onClick={clear} className="inline-flex min-h-9 items-center px-2 text-meta font-semibold text-ink-muted underline-offset-4 hover:text-ink hover:underline">
        {t("clearAll")}
      </button>
    </div>
  );
}

