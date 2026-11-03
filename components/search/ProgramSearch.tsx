"use client";

import type Fuse from "fuse.js";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FitBadge } from "@/components/fit/FitScore";
import { Icon } from "@/components/icons";
import { ProgramCard, type FieldInfo } from "@/components/program/ProgramCard";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { ChipToggle, Fieldset, SelectField } from "@/components/ui/fields";
import { buttonClass, EmptyState } from "@/components/ui/primitives";
import { useRouter } from "@/i18n/navigation";
import { useHydrated } from "@/lib/clientStore";
import { todayISO } from "@/lib/dates";
import { activeFilterCount, applyFilters, BUDGET_PRESETS_LAKH, EMPTY_FILTERS, parseFilters, serializeFilters, SORT_KEYS, type ProgramFilters } from "@/lib/filters";
import type { FitContext } from "@/lib/fitScore";
import { monthName } from "@/lib/format";
import { localizeDigits, type AppLocale } from "@/lib/localize";
import type { ProgramSummary } from "@/lib/summary";
import type { TeachingLanguage } from "@/types";

interface Props {
  programs: ProgramSummary[];
  fields: Record<string, FieldInfo>;
  countries: { slug: string; name_en: string; name_bn: string }[];
  fitContext: FitContext;
}

const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

export function ProgramSearch({ programs, fields, countries, fitContext }: Props) {
  const t = useTranslations("search");
  const labels = useTranslations("labels");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const params = useSearchParams();
  const hydrated = useHydrated();
  const filters = useMemo(() => parseFilters(new URLSearchParams(params.toString())), [params]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [text, setText] = useState(filters.q);
  const [fuse, setFuse] = useState<Fuse<ProgramSummary> | null>(null);

  // Fuzzy search only downloads once someone types.
  useEffect(() => {
    if (!filters.q || fuse) return;
    let cancelled = false;
    void import("fuse.js").then(({ default: FuseClass }) => {
      if (cancelled) return;
      setFuse(
        new FuseClass(programs, {
          keys: ["title", "university.name", "city.name_en", "city.name_bn", "country.name_en", "country.name_bn", { name: "fieldName", getFn: (p) => [fields[p.field]?.name.en ?? "", fields[p.field]?.name.bn ?? ""] }],
          threshold: 0.35,
          ignoreLocation: true,
        }),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [filters.q, fuse, programs, fields]);

  const fieldNames = useMemo(() => Object.fromEntries(Object.entries(fields).map(([slug, f]) => [slug, [f.name.en, f.name.bn]])), [fields]);
  const results = useMemo(() => {
    const today = hydrated ? todayISO() : "2000-01-01";
    if (filters.q && fuse) {
      const matched = new Set(fuse.search(filters.q).map((r) => r.item.slug));
      const pool = programs.filter((p) => matched.has(p.slug));
      return applyFilters(pool, filters, { today, skipText: true });
    }
    return applyFilters(programs, filters, { today, fieldNames });
  }, [programs, filters, fuse, fieldNames, hydrated]);

  function update(next: Partial<ProgramFilters>) {
    const qs = serializeFilters({ ...filters, ...next });
    router.replace(qs ? `/programs?${qs}` : "/programs", { scroll: false });
  }

  const active = activeFilterCount(filters);
  const countryName = (c: (typeof countries)[number]) => (locale === "bn" ? c.name_bn : c.name_en);
  const fieldsInUse = [...new Set(programs.map((p) => p.field))].sort((a, b) => (fields[a]?.name.en ?? a).localeCompare(fields[b]?.name.en ?? b));
  const languagesInUse = [...new Set(programs.map((p) => p.language))] as TeachingLanguage[];
  const monthsInUse = [...new Set(programs.flatMap((p) => p.intakes.map((i) => i.month)))].sort((a, b) => a - b);

  const panel = (
    <div className="space-y-5">
      <Fieldset legend={t("country")}>
        {countries.map((c) => (
          <ChipToggle key={c.slug} pressed={filters.countries.includes(c.slug)} onClick={() => update({ countries: toggle(filters.countries, c.slug) })}>
            {countryName(c)}
          </ChipToggle>
        ))}
      </Fieldset>
      <Fieldset legend={t("level")}>
        {(["master", "bachelor"] as const).map((level) => (
          <ChipToggle key={level} pressed={filters.level === level} onClick={() => update({ level: filters.level === level ? null : level })}>
            {labels(`level.${level}`)}
          </ChipToggle>
        ))}
      </Fieldset>
      <Fieldset legend={t("budget")} hint={t("budgetHint")}>
        {BUDGET_PRESETS_LAKH.map((lakh) => (
          <ChipToggle key={lakh} pressed={filters.maxBudgetLakh === lakh} onClick={() => update({ maxBudgetLakh: filters.maxBudgetLakh === lakh ? null : lakh })}>
            {t("underLakh", { amount: localizeDigits(String(lakh), locale) })}
          </ChipToggle>
        ))}
        <ChipToggle pressed={filters.tuitionFree} onClick={() => update({ tuitionFree: !filters.tuitionFree })}>
          {t("tuitionFree")}
        </ChipToggle>
      </Fieldset>
      <Fieldset legend={t("bdFilters")} hint={t("bdFiltersHint")}>
        <ChipToggle pressed={filters.accepts3yr} onClick={() => update({ accepts3yr: !filters.accepts3yr })}>
          {t("accepts3yr")}
        </ChipToggle>
        <ChipToggle pressed={filters.moi} onClick={() => update({ moi: !filters.moi })}>
          {t("moi")}
        </ChipToggle>
        <ChipToggle pressed={filters.provisional} onClick={() => update({ provisional: !filters.provisional })}>
          {t("provisional")}
        </ChipToggle>
        <ChipToggle pressed={filters.bdOpen} onClick={() => update({ bdOpen: !filters.bdOpen })}>
          {t("bdOpen")}
        </ChipToggle>
      </Fieldset>
      <Fieldset legend={t("field")}>
        {fieldsInUse.map((slug) => (
          <ChipToggle key={slug} pressed={filters.fields.includes(slug)} onClick={() => update({ fields: toggle(filters.fields, slug) })}>
            {locale === "bn" ? fields[slug]?.name.bn : fields[slug]?.name.en}
          </ChipToggle>
        ))}
      </Fieldset>
      <Fieldset legend={t("language")}>
        {languagesInUse.map((lang) => (
          <ChipToggle key={lang} pressed={filters.languages.includes(lang)} onClick={() => update({ languages: toggle(filters.languages, lang) })}>
            {labels(`lang.${lang}`)}
          </ChipToggle>
        ))}
      </Fieldset>
      <Fieldset legend={t("intake")}>
        {monthsInUse.map((m) => (
          <ChipToggle key={m} pressed={filters.intakeMonths.includes(m)} onClick={() => update({ intakeMonths: toggle(filters.intakeMonths, m) })}>
            {monthName(m, locale)}
          </ChipToggle>
        ))}
      </Fieldset>
    </div>
  );

  return (
    <div className="space-y-4">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          update({ q: text.trim() });
        }}
        className="flex gap-2"
      >
        <label htmlFor="program-search" className="sr-only">
          {t("searchLabel")}
        </label>
        <div className="relative flex-1">
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-muted" />
          <input
            id="program-search"
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("placeholder")}
            className="min-h-tap w-full rounded-full border border-border bg-surface pr-4 pl-11 focus:border-primary focus:outline-none"
          />
        </div>
        <button type="submit" className={buttonClass("primary", "md")}>
          {t("go")}
        </button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => setSheetOpen(true)} aria-haspopup="dialog" className={buttonClass("secondary", "sm")}>
          <Icon name="filter" className="size-4" /> {active ? t("filtersCount", { count: active }) : t("filters")}
        </button>
        <div className="w-44">
          <SelectField
            id="sort"
            label={t("sort")}
            value={filters.sort}
            onChange={(v) => update({ sort: v as ProgramFilters["sort"] })}
            options={SORT_KEYS.map((k) => ({ value: k, label: t(`sortBy.${k}`) }))}
          />
        </div>
      </div>

      <div className="-mx-1 flex gap-2 no-scrollbar overflow-x-auto px-1 pb-1">
        {countries.map((c) => (
          <ChipToggle key={c.slug} pressed={filters.countries.includes(c.slug)} onClick={() => update({ countries: toggle(filters.countries, c.slug) })}>
            {countryName(c)}
          </ChipToggle>
        ))}
        <ChipToggle pressed={filters.accepts3yr} onClick={() => update({ accepts3yr: !filters.accepts3yr })}>
          {t("accepts3yr")}
        </ChipToggle>
        <ChipToggle pressed={filters.moi} onClick={() => update({ moi: !filters.moi })}>
          {t("moi")}
        </ChipToggle>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p aria-live="polite" className="font-semibold">
          {t("resultCount", { count: results.length })}
        </p>
        {(active > 0 || filters.q) && (
          <button
            type="button"
            onClick={() => {
              setText("");
              update(EMPTY_FILTERS);
            }}
            className={buttonClass("ghost", "sm")}
          >
            {t("clearAll")}
          </button>
        )}
      </div>

      {results.length === 0 ? (
        <EmptyState title={t("emptyTitle")} body={t("emptyBody")} />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {results.map((p) => (
            <li key={p.slug}>
              <ProgramCard program={p} field={fields[p.field]} fit={<FitBadge program={p} ctx={fitContext} />} headingLevel="h2" />
            </li>
          ))}
        </ul>
      )}

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={t("filters")}
        closeLabel={t("close")}
        footer={
          <div className="flex gap-2">
            <button type="button" onClick={() => update({ ...EMPTY_FILTERS, q: filters.q, sort: filters.sort })} className={`${buttonClass("secondary", "md")} shrink-0 whitespace-nowrap`}>
              {t("clearAll")}
            </button>
            <button type="button" onClick={() => setSheetOpen(false)} className={buttonClass("primary", "md", true)}>
              {t("showResults", { count: results.length })}
            </button>
          </div>
        }
      >
        {panel}
      </BottomSheet>
    </div>
  );
}
