"use client";

// The student profile form. The Match quiz shows it one step at a time; the Profile page shows it whole.

import { useLocale, useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { Icon } from "@/components/icons";
import { CheckboxField, ChipToggle, Fieldset, SelectField, TextField } from "@/components/ui/fields";
import { buttonClass } from "@/components/ui/primitives";
import { localizeDigits, type AppLocale } from "@/lib/localize";
import { ACTIVITY_CHIPS, chipToItem, emptyProfile, ENGLISH_SCORE_RANGE, ENGLISH_TESTS } from "@/lib/profile";
import type { DegreeMapping, EnglishTest, StudentProfile } from "@/types";

export interface ProfileFormOptions {
  degrees: DegreeMapping[];
  fields: { slug: string; name_en: string; name_bn: string }[];
  /** Fields that programs are offered in (for "fields you're interested in"). */
  programFields: string[];
  countries: { slug: string; name_en: string; name_bn: string }[];
}

export const STEP_COUNT = 5;
type Step = 1 | 2 | 3 | 4 | 5;

interface Draft {
  degree: string;
  years: string;
  universityType: StudentProfile["university_type"];
  cgpa: string;
  cgpaScale: string;
  ssc: string;
  hsc: string;
  field: string;
  englishTest: string;
  englishScore: string;
  moi: boolean;
  budgetLakh: string;
  countries: string[];
  targetFields: string[];
  experience: string;
  research: boolean;
  chips: string[];
  skills: string;
}

const s = (n: number | null) => (n === null ? "" : String(n));

function toDraft(p: StudentProfile): Draft {
  return {
    degree: p.degree_type,
    years: String(p.degree_years),
    universityType: p.university_type,
    cgpa: s(p.cgpa),
    cgpaScale: String(p.cgpa_scale),
    ssc: s(p.ssc_gpa),
    hsc: s(p.hsc_gpa),
    field: p.field,
    englishTest: p.english_test ?? "",
    englishScore: s(p.english_score),
    moi: p.has_moi,
    budgetLakh: p.budget_bdt_total === null ? "" : String(Math.round(p.budget_bdt_total / 1e5)),
    countries: p.target_countries,
    targetFields: p.target_fields,
    experience: String(p.experience_months || ""),
    research: p.research,
    chips: [...p.extracurriculars, ...p.certificates].map((i) => i.label).filter((l) => ACTIVITY_CHIPS.some((c) => c.id === l)),
    skills: p.skills.join(", "),
  };
}

const toNum = (v: string) => (v.trim() === "" || !Number.isFinite(Number(v)) ? null : Number(v));

function fromDraft(d: Draft): StudentProfile {
  const chips = ACTIVITY_CHIPS.filter((c) => d.chips.includes(c.id)).map(chipToItem);
  const test = (ENGLISH_TESTS as string[]).includes(d.englishTest) ? (d.englishTest as EnglishTest) : null;
  const isHsc = d.field.startsWith("hsc-");
  return {
    ...emptyProfile(),
    degree_type: d.degree,
    degree_years: toNum(d.years) ?? 4,
    university_type: d.universityType,
    cgpa: isHsc ? null : toNum(d.cgpa),
    cgpa_scale: d.cgpaScale === "5" ? 5 : 4,
    ssc_gpa: toNum(d.ssc),
    hsc_gpa: toNum(d.hsc),
    field: d.field,
    english_test: test,
    english_score: test ? toNum(d.englishScore) : null,
    has_moi: d.moi,
    budget_bdt_total: toNum(d.budgetLakh) === null ? null : toNum(d.budgetLakh)! * 1e5,
    target_countries: d.countries,
    target_fields: d.targetFields,
    experience_months: toNum(d.experience) ?? 0,
    research: d.research,
    extracurriculars: chips.filter((c) => c.kind !== "certificate"),
    certificates: chips.filter((c) => c.kind === "certificate"),
    skills: d.skills.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 20),
  };
}

type Errors = Partial<Record<"degree" | "cgpa" | "ssc" | "hsc" | "englishScore" | "budgetLakh" | "experience", string>>;

function check(d: Draft, step: Step | "all", t: (key: string, values?: Record<string, string | number>) => string): Errors {
  const e: Errors = {};
  const range = (v: string, min: number, max: number) => {
    const n = toNum(v);
    return v.trim() !== "" && (n === null || n < min || n > max) ? t("error.range", { min, max }) : undefined;
  };
  const on = (n: Step) => step === "all" || step === n;
  if (on(1)) {
    if (!d.degree) e.degree = t("error.degree");
    e.cgpa = range(d.cgpa, 0, d.cgpaScale === "5" ? 5 : 4);
    e.ssc = range(d.ssc, 1, 5);
    e.hsc = range(d.hsc, 1, 5);
  }
  if (on(2) && d.englishTest) {
    const r = ENGLISH_SCORE_RANGE[d.englishTest as EnglishTest];
    e.englishScore = d.englishScore.trim() === "" ? t("error.score") : range(d.englishScore, r.min, r.max);
  }
  if (on(3)) e.budgetLakh = range(d.budgetLakh, 1, 1000);
  if (on(5)) e.experience = range(d.experience, 0, 600);
  return Object.fromEntries(Object.entries(e).filter(([, v]) => v)) as Errors;
}

export function ProfileForm({
  options,
  initial,
  mode,
  onSave,
  submitLabel,
}: {
  options: ProfileFormOptions;
  initial: StudentProfile | null;
  mode: "wizard" | "full";
  onSave: (profile: StudentProfile) => void;
  submitLabel: string;
}) {
  const t = useTranslations("profileForm");
  const labels = useTranslations("labels");
  const locale = useLocale() as AppLocale;
  const [d, setD] = useState<Draft>(() => toDraft(initial ?? emptyProfile()));
  const [step, setStep] = useState<Step>(1);
  const [errors, setErrors] = useState<Errors>({});
  const set = <K extends keyof Draft>(key: K) => (value: Draft[K]) => setD((x) => ({ ...x, [key]: value }));
  const name = (x: { name_en: string; name_bn: string }) => (locale === "bn" ? x.name_bn : x.name_en);
  const degree = options.degrees.find((g) => g.slug === d.degree);
  const isHsc = degree?.kind === "hsc";
  const toggle = (key: "countries" | "targetFields" | "chips", value: string) =>
    setD((x) => ({ ...x, [key]: x[key].includes(value) ? x[key].filter((v) => v !== value) : [...x[key], value] }));

  function chooseDegree(slug: string) {
    const g = options.degrees.find((x) => x.slug === slug);
    setD((x) => ({ ...x, degree: slug, field: g?.field ?? x.field, years: g ? String(g.years) : x.years }));
  }

  function validate(which: Step | "all") {
    const found = check(d, which, t);
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) document.getElementById(`pf-${first}`)?.focus();
    return !first;
  }

  function next() {
    if (!validate(step)) return;
    if (step < STEP_COUNT) {
      setStep((step + 1) as Step);
      document.getElementById("profile-form")?.scrollIntoView({ block: "start" });
    } else onSave(fromDraft(d));
  }

  function saveAll() {
    if (validate("all")) onSave(fromDraft(d));
  }

  const sections: Record<Step, { title: string; body: ReactNode }> = {
    1: {
      title: t("step1"),
      body: (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <SelectField
              id="pf-degree"
              label={t("degree")}
              hint={t("degreeHint")}
              value={d.degree}
              onChange={chooseDegree}
              placeholder={t("choose")}
              options={options.degrees.map((g) => ({ value: g.slug, label: locale === "bn" ? g.label_bn : g.label_en }))}
              error={errors.degree}
            />
          </div>
          {!isHsc && (
            <>
              <SelectField id="pf-years" label={t("years")} hint={t("yearsHint")} value={d.years} onChange={set("years")} options={["3", "4", "5"].map((y) => ({ value: y, label: t("yearsValue", { years: localizeDigits(y, locale) }) }))} />
              <SelectField id="pf-unitype" label={t("universityType")} value={d.universityType} onChange={(v) => set("universityType")(v as Draft["universityType"])} options={(["public", "private", "nu"] as const).map((v) => ({ value: v, label: labels(`universityType.${v}`) }))} />
              <TextField id="pf-cgpa" inputMode="decimal" label={t("cgpa")} value={d.cgpa} onChange={set("cgpa")} error={errors.cgpa} placeholder="3.50" />
              <SelectField id="pf-cgpaScale" label={t("cgpaScale")} value={d.cgpaScale} onChange={set("cgpaScale")} options={[{ value: "4", label: "4.00" }, { value: "5", label: "5.00" }]} />
            </>
          )}
          <TextField id="pf-ssc" inputMode="decimal" label={t("ssc")} value={d.ssc} onChange={set("ssc")} error={errors.ssc} placeholder="5.00" />
          <TextField id="pf-hsc" inputMode="decimal" label={t("hsc")} hint={isHsc ? t("hscHint") : undefined} value={d.hsc} onChange={set("hsc")} error={errors.hsc} placeholder="5.00" />
        </div>
      ),
    },
    2: {
      title: t("step2"),
      body: (
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            id="pf-test"
            label={t("englishTest")}
            value={d.englishTest}
            onChange={set("englishTest")}
            placeholder={t("noTest")}
            options={ENGLISH_TESTS.map((x) => ({ value: x, label: labels(`test.${x}`) }))}
          />
          {d.englishTest && (
            <TextField
              id="pf-englishScore"
              inputMode="decimal"
              label={t("englishScore")}
              hint={t("scoreRange", { min: ENGLISH_SCORE_RANGE[d.englishTest as EnglishTest].min, max: ENGLISH_SCORE_RANGE[d.englishTest as EnglishTest].max })}
              value={d.englishScore}
              onChange={set("englishScore")}
              error={errors.englishScore}
            />
          )}
          <div className="sm:col-span-2">
            <CheckboxField id="pf-moi" label={t("moi")} hint={t("moiHint")} checked={d.moi} onChange={set("moi")} />
          </div>
        </div>
      ),
    },
    3: {
      title: t("step3"),
      body: (
        <div className="space-y-4">
          <TextField id="pf-budgetLakh" inputMode="numeric" label={t("budget")} hint={t("budgetHint")} value={d.budgetLakh} onChange={set("budgetLakh")} error={errors.budgetLakh} placeholder="35" />
          <Fieldset legend={t("countries")} hint={t("countriesHint")}>
            {options.countries.map((c) => (
              <ChipToggle key={c.slug} pressed={d.countries.includes(c.slug)} onClick={() => toggle("countries", c.slug)}>
                {name(c)}
              </ChipToggle>
            ))}
          </Fieldset>
        </div>
      ),
    },
    4: {
      title: t("step4"),
      body: (
        <div className="space-y-4">
          <SelectField
            id="pf-field"
            label={t("field")}
            hint={t("fieldHint")}
            value={d.field}
            onChange={set("field")}
            placeholder={t("choose")}
            options={options.fields.filter((f) => isHsc === f.slug.startsWith("hsc-")).map((f) => ({ value: f.slug, label: name(f) }))}
          />
          <Fieldset legend={t("targetFields")} hint={t("targetFieldsHint")}>
            {options.programFields.map((slug) => {
              const f = options.fields.find((x) => x.slug === slug);
              return (
                <ChipToggle key={slug} pressed={d.targetFields.includes(slug)} onClick={() => toggle("targetFields", slug)}>
                  {f ? name(f) : slug}
                </ChipToggle>
              );
            })}
          </Fieldset>
        </div>
      ),
    },
    5: {
      title: t("step5"),
      body: (
        <div className="space-y-4">
          <TextField id="pf-experience" inputMode="numeric" label={t("experience")} hint={t("experienceHint")} value={d.experience} onChange={set("experience")} error={errors.experience} placeholder="0" />
          <CheckboxField id="pf-research" label={t("research")} hint={t("researchHint")} checked={d.research} onChange={set("research")} />
          {(["extracurricular", "leadership", "certificate"] as const).map((kind) => (
            <Fieldset key={kind} legend={t(`chips.${kind}`)} hint={kind === "certificate" ? t("chipsHint") : undefined}>
              {ACTIVITY_CHIPS.filter((c) => c.kind === kind).map((c) => (
                <ChipToggle key={c.id} pressed={d.chips.includes(c.id)} onClick={() => toggle("chips", c.id)}>
                  {labels(`activity.${c.id}`)}
                </ChipToggle>
              ))}
            </Fieldset>
          ))}
          <TextField id="pf-skills" label={t("skills")} hint={t("skillsHint")} value={d.skills} onChange={set("skills")} />
        </div>
      ),
    },
  };

  if (mode === "full") {
    return (
      <form
        id="profile-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          saveAll();
        }}
        className="space-y-4"
      >
        {([1, 2, 3, 4, 5] as Step[]).map((n) => (
          <fieldset key={n} className="rounded-card bg-surface p-4 shadow-card sm:p-5">
            <legend className="sr-only">{sections[n].title}</legend>
            <h2 aria-hidden="true" className="mb-4 text-heading font-semibold">
              {sections[n].title}
            </h2>
            {sections[n].body}
          </fieldset>
        ))}
        <button type="submit" className={buttonClass("primary", "md", true)}>
          {submitLabel}
        </button>
      </form>
    );
  }

  return (
    <form
      id="profile-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        next();
      }}
      className="scroll-mt-20 rounded-card bg-surface p-4 shadow-card sm:p-5"
    >
      <p className="text-meta font-semibold text-ink-muted">{t("stepOf", { step: localizeDigits(String(step), locale), total: localizeDigits(String(STEP_COUNT), locale) })}</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(step / STEP_COUNT) * 100}%` }} />
      </div>
      <fieldset className="mt-4">
        <legend className="mb-4 text-heading font-semibold">{sections[step].title}</legend>
        {sections[step].body}
      </fieldset>
      <div className="mt-6 flex gap-2">
        {step > 1 && (
          <button type="button" onClick={() => setStep((step - 1) as Step)} className={buttonClass("secondary", "md")}>
            <Icon name="chevronLeft" className="size-4" /> {t("back")}
          </button>
        )}
        <button type="submit" className={buttonClass("primary", "md", true)}>
          {step < STEP_COUNT ? t("next") : submitLabel} <Icon name="arrowRight" className="size-4" />
        </button>
      </div>
    </form>
  );
}
