"use client";

// The filter panel: grouped sections, an option count next to every choice, and searchable long lists
// (cities, universities, subjects) so it stays usable with thousands of options.
// Desktop shows it as a sidebar; phones open the same panel in a bottom sheet.

import { useLocale, useTranslations } from "next-intl";
import { useId, useState, type ReactNode } from "react";
import { GROUP_ICON, Icon } from "@/components/icons";
import {
  BUDGET_PRESETS_LAKH,
  DURATIONS,
  ENGLISH_TESTS,
  IELTS_PRESETS,
  TUITION_PRESETS_LAKH,
  UNIVERSITY_TYPES,

} from "@/lib/filters";
import { monthName } from "@/lib/format";
import { localizeDigits, type AppLocale } from "@/lib/localize";
import type { FieldGroup, TeachingLanguage } from "@/types";
import { useSearch } from "./SearchState";

const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

export function FilterPanel() {
  const t = useTranslations("search");
  const labels = useTranslations("labels");
  const locale = useLocale() as AppLocale;
  const { filters: f, facets, options, update } = useSearch();
  const n = (count: number | undefined) => localizeDigits(String(count ?? 0), locale);
  const name = (o: { name_en: string; name_bn: string }) => (locale === "bn" ? o.name_bn : o.name_en);

  // Cities and universities follow the chosen countries, so the lists stay short.
  const inCountries = (country: string) => !f.countries.length || f.countries.includes(country);
  const cities = options.cities.filter((c) => inCountries(c.country) && (facets.cities[c.slug] || f.cities.includes(c.slug)));
  const universities = options.universities.filter(
    (u) => inCountries(u.country) && (!f.cities.length || f.cities.includes(u.city)) && (facets.universities[u.slug] || f.universities.includes(u.slug)),
  );
  const fields = options.fields.filter((x) => (!f.fieldGroups.length || f.fieldGroups.includes(x.group)) && (facets.fields[x.slug] || f.fields.includes(x.slug)));
  const languages = (Object.keys(facets.languages) as TeachingLanguage[]).concat(f.languages.filter((l) => !facets.languages[l]));

  return (
    <div className="divide-y divide-border">
      <Group title={t("groupBd")} icon="checkCircle" defaultOpen>
        <p className="-mt-1 mb-2 text-meta text-ink-muted">{t("bdFiltersHint")}</p>
        <ToggleRow label={t("accepts3yr")} checked={f.accepts3yr} count={n(facets.flags.accepts3yr)} onChange={() => update({ accepts3yr: !f.accepts3yr })} />
        <ToggleRow label={t("moi")} checked={f.moi} count={n(facets.flags.moi)} onChange={() => update({ moi: !f.moi })} />
        <ToggleRow label={t("provisional")} checked={f.provisional} count={n(facets.flags.provisional)} onChange={() => update({ provisional: !f.provisional })} />
        <ToggleRow label={t("bdOpen")} checked={f.bdOpen} count={n(facets.flags.bdOpen)} onChange={() => update({ bdOpen: !f.bdOpen })} />
      </Group>

      <Group title={t("groupWhere")} icon="globe" defaultOpen>
        <CheckList
          legend={t("country")}
          options={options.countries.map((c) => ({ value: c.slug, label: name(c), count: facets.countries[c.slug] ?? 0 }))}
          selected={f.countries}
          onToggle={(v) => update({ countries: toggle(f.countries, v), cities: [], universities: [] })}
          countLabel={n}
        />
        <CheckList
          legend={t("city")}
          options={cities.map((c) => ({ value: c.slug, label: name(c), count: facets.cities[c.slug] ?? 0 }))}
          selected={f.cities}
          onToggle={(v) => update({ cities: toggle(f.cities, v), universities: [] })}
          countLabel={n}
        />
        <CheckList
          legend={t("university")}
          options={universities.map((u) => ({ value: u.slug, label: u.name, count: facets.universities[u.slug] ?? 0 }))}
          selected={f.universities}
          onToggle={(v) => update({ universities: toggle(f.universities, v) })}
          countLabel={n}
        />
        <Chips legend={t("universityType")}>
          {UNIVERSITY_TYPES.map((type) => (
            <Chip key={type} pressed={f.universityTypes.includes(type)} count={n(facets.universityTypes[type])} onClick={() => update({ universityTypes: toggle(f.universityTypes, type) })}>
              {labels(`universityType.${type}`)}
            </Chip>
          ))}
        </Chips>
      </Group>

      <Group title={t("groupStudy")} icon="cap" defaultOpen>
        <Chips legend={t("level")}>
          {(["master", "bachelor"] as const).map((level) => (
            <Chip key={level} pressed={f.level === level} count={n(facets.levels[level])} onClick={() => update({ level: f.level === level ? null : level })}>
              {labels(`level.${level}`)}
            </Chip>
          ))}
        </Chips>
        <Chips legend={t("area")}>
          {options.fieldGroups.map((g: FieldGroup) => (
            <Chip
              key={g}
              icon={<Icon name={GROUP_ICON[g]} className="size-4" />}
              pressed={f.fieldGroups.includes(g)}
              count={n(facets.fieldGroups[g])}
              onClick={() => update({ fieldGroups: toggle(f.fieldGroups, g), fields: [] })}
            >
              {t(`areas.${g}`)}
            </Chip>
          ))}
        </Chips>
        <CheckList
          legend={t("field")}
          options={fields.map((x) => ({ value: x.slug, label: name(x), count: facets.fields[x.slug] ?? 0 }))}
          selected={f.fields}
          onToggle={(v) => update({ fields: toggle(f.fields, v) })}
          countLabel={n}
        />
        <Chips legend={t("language")}>
          {languages.map((lang) => (
            <Chip key={lang} pressed={f.languages.includes(lang)} count={n(facets.languages[lang])} onClick={() => update({ languages: toggle(f.languages, lang) })}>
              {labels(`lang.${lang}`)}
            </Chip>
          ))}
        </Chips>
        <Chips legend={t("duration")}>
          {DURATIONS.map((d) => (
            <Chip key={d} pressed={f.durations.includes(d)} count={n(facets.durations[d])} onClick={() => update({ durations: toggle(f.durations, d) })}>
              {t(`dur.${d}`)}
            </Chip>
          ))}
        </Chips>
      </Group>

      <Group title={t("groupCost")} icon="coins" defaultOpen>
        <Chips legend={t("budget")} hint={t("budgetHint")}>
          {BUDGET_PRESETS_LAKH.map((lakh) => (
            <Chip key={lakh} pressed={f.maxBudgetLakh === lakh} count={n(facets.budget[lakh])} onClick={() => update({ maxBudgetLakh: f.maxBudgetLakh === lakh ? null : lakh })}>
              {t("underLakh", { amount: localizeDigits(String(lakh), locale) })}
            </Chip>
          ))}
        </Chips>
        <Chips legend={t("tuition")}>
          {TUITION_PRESETS_LAKH.map((lakh) => (
            <Chip key={lakh} pressed={f.maxTuitionLakh === lakh} count={n(facets.tuition[lakh])} onClick={() => update({ maxTuitionLakh: f.maxTuitionLakh === lakh ? null : lakh })}>
              {t("tuitionUnder", { amount: localizeDigits(String(lakh), locale) })}
            </Chip>
          ))}
        </Chips>
        <div className="mt-2">
          <ToggleRow label={t("tuitionFree")} checked={f.tuitionFree} count={n(facets.flags.tuitionFree)} onChange={() => update({ tuitionFree: !f.tuitionFree })} />
          <ToggleRow label={t("scholarship")} checked={f.scholarship} count={n(facets.flags.scholarship)} onChange={() => update({ scholarship: !f.scholarship })} />
        </div>
      </Group>

      <Group title={t("groupAdmission")} icon="calendar">
        <Chips legend={t("deadline")}>
          <Chip pressed={f.deadline === "open"} count={n(facets.flags.deadlineOpen)} onClick={() => update({ deadline: f.deadline === "open" ? null : "open" })}>
            {t("deadlineOpen")}
          </Chip>
          <Chip pressed={f.deadline === "soon"} count={n(facets.flags.deadlineSoon)} onClick={() => update({ deadline: f.deadline === "soon" ? null : "soon" })}>
            {t("deadlineSoon")}
          </Chip>
        </Chips>
        <Chips legend={t("intake")}>
          {options.intakeMonths.map((m) => (
            <Chip key={m} pressed={f.intakeMonths.includes(m)} count={n(facets.intakeMonths[m])} onClick={() => update({ intakeMonths: toggle(f.intakeMonths, m) })}>
              {monthName(m, locale)}
            </Chip>
          ))}
        </Chips>
        <Chips legend={t("ielts")}>
          {IELTS_PRESETS.map((score) => (
            <Chip key={score} pressed={f.maxIelts === score} count={n(facets.ielts[score])} onClick={() => update({ maxIelts: f.maxIelts === score ? null : score })}>
              {t("ieltsUpTo", { score: localizeDigits(String(score), locale) })}
            </Chip>
          ))}
        </Chips>
        <Chips legend={t("englishTest")}>
          {ENGLISH_TESTS.map((test) => (
            <Chip key={test} pressed={f.englishTests.includes(test)} count={n(facets.englishTests[test])} onClick={() => update({ englishTests: toggle(f.englishTests, test) })}>
              {labels(`test.${test}`)}
            </Chip>
          ))}
        </Chips>
        <div className="mt-2">
          <ToggleRow label={t("seats")} checked={f.seatsPublished} count={n(facets.flags.seatsPublished)} onChange={() => update({ seatsPublished: !f.seatsPublished })} />
        </div>
      </Group>
    </div>
  );
}

// ---------------------------------------------------------------- building blocks

function Group({ title, icon, defaultOpen, children }: { title: string; icon: Parameters<typeof Icon>[0]["name"]; defaultOpen?: boolean; children: ReactNode }) {
  return (
    <details open={defaultOpen} className="group py-1 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex min-h-tap cursor-pointer list-none items-center gap-2.5 font-semibold">
        <Icon name={icon} className="size-5 text-ink-muted" />
        <span className="flex-1">{title}</span>
        <Icon name="chevronDown" className="size-4 text-ink-muted transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-4 pb-4">{children}</div>
    </details>
  );
}

function Legend({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <>
      <legend className="text-meta font-semibold text-ink-muted">{children}</legend>
      {hint && <p className="text-meta text-ink-muted">{hint}</p>}
    </>
  );
}

function Chips({ legend, hint, children }: { legend: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset>
      <Legend hint={hint}>{legend}</Legend>
      <div className="mt-2 flex flex-wrap gap-1.5">{children}</div>
    </fieldset>
  );
}

function Chip({ pressed, count, onClick, icon, children }: { pressed: boolean; count: string; onClick: () => void; icon?: ReactNode; children: ReactNode }) {
  const empty = count === "0" || count === "০";
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={empty && !pressed}
      onClick={onClick}
      className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-meta font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        pressed ? "border-ink bg-ink text-canvas" : "border-border bg-surface text-ink hover:border-ink/30"
      }`}
    >
      {icon}
      {children}
      <span className={`tabular-nums ${pressed ? "text-canvas/70" : "text-ink-muted"}`}>{count}</span>
    </button>
  );
}

function ToggleRow({ label, checked, count, onChange }: { label: string; checked: boolean; count: string; onChange: () => void }) {
  const id = useId();
  const empty = count === "0" || count === "০";
  return (
    <label htmlFor={id} className={`flex min-h-tap cursor-pointer items-center gap-3 ${empty && !checked ? "opacity-40" : ""}`}>
      <span className="flex-1 text-body">{label}</span>
      <span className="text-meta text-ink-muted tabular-nums">{count}</span>
      <input id={id} type="checkbox" role="switch" checked={checked} disabled={empty && !checked} onChange={onChange} className="peer sr-only" />
      <span
        aria-hidden="true"
        className="relative h-6 w-10 shrink-0 rounded-full bg-border transition-colors peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:after:translate-x-4"
      />
    </label>
  );
}

const VISIBLE = 6;

/** A checkbox list; past six options it gets a search box and a "show all" button. */
function CheckList({
  legend,
  options,
  selected,
  onToggle,
  countLabel,
}: {
  legend: string;
  options: { value: string; label: string; count: number }[];
  selected: string[];
  onToggle: (value: string) => void;
  countLabel: (n: number) => string;
}) {
  const t = useTranslations("search");
  const locale = useLocale() as AppLocale;
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  if (!options.length) return null;

  const sorted = [...options].sort((a, b) => Number(selected.includes(b.value)) - Number(selected.includes(a.value)) || b.count - a.count || a.label.localeCompare(b.label));
  const q = query.trim().toLowerCase();
  const matching = q ? sorted.filter((o) => o.label.toLowerCase().includes(q)) : sorted;
  const shown = expanded || q ? matching : matching.slice(0, VISIBLE);
  const long = options.length > VISIBLE;

  return (
    <fieldset>
      <Legend>{legend}</Legend>
      {long && (
        <div className="relative mt-2">
          <label htmlFor={id} className="sr-only">
            {t("findIn", { name: legend })}
          </label>
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
          <input
            id={id}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("findIn", { name: legend })}
            className="min-h-10 w-full rounded-full border border-border bg-surface-2 pr-3 pl-9 text-meta focus:border-accent focus:outline-none"
          />
        </div>
      )}
      <ul className="mt-1">
        {shown.map((o) => {
          const checked = selected.includes(o.value);
          return (
            <li key={o.value}>
              <label className={`flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-1 hover:bg-surface-2 ${!o.count && !checked ? "opacity-40" : ""}`}>
                <input type="checkbox" checked={checked} disabled={!o.count && !checked} onChange={() => onToggle(o.value)} className="size-4.5 shrink-0 accent-[var(--accent)]" />
                <span className="min-w-0 flex-1 truncate text-body">{o.label}</span>
                <span className="text-meta text-ink-muted tabular-nums">{countLabel(o.count)}</span>
              </label>
            </li>
          );
        })}
        {!shown.length && <li className="px-1 py-2 text-meta text-ink-muted">{t("noOptions")}</li>}
      </ul>
      {long && !q && (
        <button type="button" onClick={() => setExpanded(!expanded)} className="mt-1 inline-flex min-h-10 items-center gap-1 text-meta font-semibold text-primary-ink hover:underline">
          {expanded ? t("showLess") : t("showMore", { count: localizeDigits(String(options.length), locale) })}
          <Icon name="chevronDown" className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      )}
    </fieldset>
  );
}

