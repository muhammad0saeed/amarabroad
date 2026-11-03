"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Icon } from "@/components/icons";
import { SelectField, TextField } from "@/components/ui/fields";
import { Badge } from "@/components/ui/primitives";
import { useHydrated } from "@/lib/clientStore";
import { estimateCost } from "@/lib/cost";
import { todayISO } from "@/lib/dates";
import { formatDate, formatMonthYear } from "@/lib/format";
import { convertGrade } from "@/lib/grades";
import { formatNumber, type AppLocale } from "@/lib/localize";
import { formatBDT, type RateTable } from "@/lib/money";
import { planTimeline } from "@/lib/timeline";
import type { CurrencyCode, Intake, ISODate } from "@/types";

const card = "rounded-card bg-surface p-4 shadow-card sm:p-5";
const num = (v: string) => (v.trim() === "" || !Number.isFinite(Number(v)) ? null : Number(v));

// ---------------------------------------------------------------- grade converter

export function GradeConverter() {
  const t = useTranslations("tools");
  const locale = useLocale() as AppLocale;
  const [value, setValue] = useState("3.50");
  const [scale, setScale] = useState("4");
  const v = num(value);
  const max = Number(scale);
  const invalid = v === null || v < 0 || v > max;
  const r = invalid ? null : convertGrade({ value: v!, scale: max });
  const show = (x: number | null, places = 2) => (x === null ? t("belowPass") : formatNumber(x, locale, places));

  return (
    <section aria-labelledby="grade-title" className={card}>
      <h2 id="grade-title" className="flex items-center gap-2 text-heading font-semibold">
        <Icon name="scale" /> {t("gradeTitle")}
      </h2>
      <p className="mt-1 text-meta text-ink-muted">{t("gradeIntro")}</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <TextField id="grade-value" inputMode="decimal" label={t("yourGrade")} value={value} onChange={setValue} error={invalid ? t("gradeRange", { max }) : undefined} />
        <SelectField id="grade-scale" label={t("scale")} value={scale} onChange={setScale} options={[{ value: "4", label: t("scaleCgpa") }, { value: "5", label: t("scaleGpa") }]} />
      </div>
      {r && (
        <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3" aria-live="polite">
          {[
            [t("fourPoint"), show(r.fourPoint)],
            [t("fivePoint"), show(r.fivePoint)],
            [t("percent"), `${show(r.percent, 1)}%`],
            [t("german"), show(r.german, 1)],
            [t("italian"), show(r.italian110, 0)],
            [t("hungarian"), show(r.hungarian5)],
          ].map(([label, val]) => (
            <div key={label} className="rounded-tile bg-surface-2 p-3">
              <dt className="text-meta text-ink-muted">{label}</dt>
              <dd className="text-heading font-semibold">{val}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="mt-3 text-meta text-ink-muted">{t("gradeNote")}</p>
    </section>
  );
}

// ---------------------------------------------------------------- BDT cost calculator

export interface CityCost {
  slug: string;
  name_en: string;
  name_bn: string;
  currency: CurrencyCode;
  shared: number;
  studio: number;
}

export function CostCalculator({ cities, rates }: { cities: CityCost[]; rates: RateTable }) {
  const t = useTranslations("tools");
  const locale = useLocale() as AppLocale;
  const [citySlug, setCitySlug] = useState(cities[0]?.slug ?? "");
  const [housing, setHousing] = useState<"shared" | "studio">("shared");
  const [tuition, setTuition] = useState("3000");
  const [months, setMonths] = useState("24");
  const [oneTime, setOneTime] = useState("250000");
  const city = cities.find((c) => c.slug === citySlug);

  const e = city
    ? estimateCost(
        {
          tuitionPerYear: num(tuition) ?? 0,
          tuitionCurrency: "EUR",
          months: num(months) ?? 0,
          livingMonthly: housing === "shared" ? city.shared : city.studio,
          livingCurrency: city.currency,
          oneTimeBDT: num(oneTime) ?? 0,
        },
        rates,
      )
    : null;

  return (
    <section aria-labelledby="cost-title" className={card}>
      <h2 id="cost-title" className="flex items-center gap-2 text-heading font-semibold">
        <Icon name="coins" /> {t("costTitle")}
      </h2>
      <p className="mt-1 text-meta text-ink-muted">{t("costIntro")}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <SelectField id="cost-city" label={t("city")} value={citySlug} onChange={setCitySlug} options={cities.map((c) => ({ value: c.slug, label: locale === "bn" ? c.name_bn : c.name_en }))} />
        <SelectField id="cost-housing" label={t("housing")} value={housing} onChange={(v) => setHousing(v as "shared" | "studio")} options={[{ value: "shared", label: t("shared") }, { value: "studio", label: t("studio") }]} />
        <TextField id="cost-tuition" inputMode="numeric" label={t("tuitionEur")} hint={t("tuitionHint")} value={tuition} onChange={setTuition} />
        <TextField id="cost-months" inputMode="numeric" label={t("months")} value={months} onChange={setMonths} />
        <div className="sm:col-span-2">
          <TextField id="cost-onetime" inputMode="numeric" label={t("oneTime")} hint={t("oneTimeHint")} value={oneTime} onChange={setOneTime} />
        </div>
      </div>
      {e && (
        <dl className="mt-4 space-y-1 rounded-tile bg-surface-2 p-3 text-meta" aria-live="polite">
          {[
            [t("tuitionTotal"), e.tuitionBDT],
            [t("livingTotal"), e.livingBDT],
            [t("oneTimeTotal"), e.oneTimeBDT],
          ].map(([label, value]) => (
            <div key={String(label)} className="flex justify-between gap-2">
              <dt>{label}</dt>
              <dd className="font-semibold">{formatBDT(Number(value), locale)}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-2 border-t border-border pt-2 text-body">
            <dt className="font-semibold">{t("grandTotal")}</dt>
            <dd className="font-bold">{formatBDT(e.totalBDT, locale)}</dd>
          </div>
          <div className="flex justify-between gap-2 text-ink-muted">
            <dt>{t("perMonth")}</dt>
            <dd>{formatBDT(e.perMonthBDT, locale)}</dd>
          </div>
        </dl>
      )}
      <p className="mt-3 text-meta text-ink-muted">{t("costNote")}</p>
    </section>
  );
}

// ---------------------------------------------------------------- timeline planner

export interface TimelineProgram {
  slug: string;
  title: string;
  intakes: Intake[];
}

export function TimelinePlanner({ programs, scholarships }: { programs: TimelineProgram[]; scholarships: { slug: string; name: string; deadline: ISODate }[] }) {
  const t = useTranslations("tools");
  const locale = useLocale() as AppLocale;
  const options = programs.flatMap((p) => p.intakes.map((i) => ({ value: `${p.slug}|${i.year}-${i.month}`, label: `${p.title} · ${formatMonthYear(i.month, i.year, locale)}`, intake: i })));
  const [choice, setChoice] = useState(options.find((o) => o.value.startsWith("sum-msc-computer-science"))?.value ?? options[0]?.value ?? "");
  const [scholarship, setScholarship] = useState("");
  const hydrated = useHydrated();
  const picked = options.find((o) => o.value === choice);
  const s = scholarships.find((x) => x.slug === scholarship);
  // Late / soon depend on today's date, which only the device knows.
  const steps = picked && hydrated
    ? planTimeline({
        intakeStart: `${picked.intake.year}-${String(picked.intake.month).padStart(2, "0")}-01`,
        applicationDeadline: picked.intake.deadline,
        scholarshipDeadline: s?.deadline,
        today: todayISO(),
      })
    : [];

  return (
    <section aria-labelledby="timeline-title" className={card}>
      <h2 id="timeline-title" className="flex items-center gap-2 text-heading font-semibold">
        <Icon name="calendar" /> {t("timelineTitle")}
      </h2>
      <p className="mt-1 text-meta text-ink-muted">{t("timelineIntro")}</p>
      <div className="mt-4 grid gap-3">
        <SelectField id="tl-program" label={t("programIntake")} value={choice} onChange={setChoice} options={options} />
        <SelectField id="tl-scholarship" label={t("scholarship")} value={scholarship} onChange={setScholarship} placeholder={t("noScholarship")} options={scholarships.map((x) => ({ value: x.slug, label: x.name }))} />
      </div>
      {picked && (
        <p className="mt-3 text-meta text-ink-muted">{t("deadlineIs", { date: formatDate(picked.intake.deadline, locale) })}</p>
      )}
      <ol className="mt-4 space-y-0" aria-live="polite">
        {steps.map((step, i) => (
          <li key={step.key} className="relative flex gap-3 pb-4">
            {i < steps.length - 1 && <span aria-hidden="true" className="absolute top-6 bottom-0 left-[0.6875rem] w-px bg-border" />}
            <span
              aria-hidden="true"
              className={`relative mt-0.5 grid size-6 shrink-0 place-items-center rounded-full ${step.late ? "bg-danger-soft text-danger" : step.soon ? "bg-warning-soft text-warning" : "bg-primary-soft text-primary-ink"}`}
            >
              <span className="size-2 rounded-full bg-current" />
            </span>
            <div>
              <p className="font-semibold">{t(`step.${step.key}`)}</p>
              <p className="flex flex-wrap items-center gap-1.5 text-meta text-ink-muted">
                {formatDate(step.date, locale)}
                {step.late && <Badge tone="danger">{t("late")}</Badge>}
                {step.soon && <Badge tone="warning">{t("soon")}</Badge>}
              </p>
            </div>
          </li>
        ))}
      </ol>
      <p className="text-meta text-ink-muted">{t("timelineNote")}</p>
    </section>
  );
}
