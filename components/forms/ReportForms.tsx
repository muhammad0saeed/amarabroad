"use client";

// The three report forms. Full UI and validation; on submit they show "Preview mode: not sent".
// Stage 2 connects them to the backend (with Turnstile).

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Icon } from "@/components/icons";
import { SelectField, TextArea, TextField } from "@/components/ui/fields";
import { buttonClass } from "@/components/ui/primitives";
import { usePathname } from "@/i18n/navigation";
import { localizeDigits, type AppLocale } from "@/lib/localize";
import {
  ENGLISH_TESTS,
  isValid,
  LIMITS,
  OUTCOME_RESULTS,
  PROBLEM_TYPES,
  UNIVERSITY_TYPES,
  validateOutcome,
  validateProblem,
  validateWrongInfo,
  WRONG_INFO_TOPICS,
  type Errors,
  type OutcomeForm,
  type ProblemForm,
  type WrongInfoForm,
} from "@/lib/validation";

const APP_VERSION = "stage-1-preview";

function PreviewNotice({ onReset }: { onReset: () => void }) {
  const t = useTranslations("forms");
  return (
    <div role="status" className="rounded-tile bg-warning-soft p-4 text-warning">
      <p className="flex items-center gap-2 font-semibold">
        <Icon name="info" /> {t("previewTitle")}
      </p>
      <p className="mt-1 text-meta">{t("previewBody")}</p>
      <button type="button" onClick={onReset} className={`${buttonClass("ghost", "sm")} mt-2 -ml-3`}>
        {t("again")}
      </button>
    </div>
  );
}

function useForm<T extends object>(initial: T, validate: (v: T) => Errors<T>) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Errors<T>>({});
  const [sent, setSent] = useState(false);
  const set = (key: keyof T) => (value: string) => setValues((v) => ({ ...v, [key]: value }));
  function submit(e: FormEvent) {
    e.preventDefault();
    const found = validate(values);
    setErrors(found);
    if (isValid(found)) setSent(true);
    else document.getElementById(String(Object.keys(found)[0]))?.focus();
  }
  const reset = () => {
    setValues(initial);
    setErrors({});
    setSent(false);
  };
  return { values, errors, set, submit, sent, reset };
}

function FormShell({ onSubmit, children, submitLabel }: { onSubmit: (e: FormEvent) => void; children: ReactNode; submitLabel: string }) {
  const t = useTranslations("forms");
  return (
    <form noValidate onSubmit={onSubmit} className="space-y-4">
      <p className="text-meta text-ink-muted">{t("previewHint")}</p>
      {children}
      <button type="submit" className={buttonClass("primary", "md", true)}>
        {submitLabel}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------- report wrong info

export function WrongInfoReport({ programSlug }: { programSlug: string }) {
  const t = useTranslations("forms");
  const err = (code?: string) => (code ? t(`error.${code}`, { min: LIMITS.minDescription, max: LIMITS.description }) : undefined);
  const f = useForm<WrongInfoForm>({ topic: "", correction: "", sourceUrl: "", email: "" }, validateWrongInfo);
  if (f.sent) return <PreviewNotice onReset={f.reset} />;
  return (
    <FormShell onSubmit={f.submit} submitLabel={t("sendReport")}>
      <input type="hidden" name="program" value={programSlug} />
      <SelectField
        id="topic"
        label={t("wrong.topic")}
        value={f.values.topic}
        onChange={f.set("topic")}
        placeholder={t("choose")}
        options={WRONG_INFO_TOPICS.map((v) => ({ value: v, label: t(`wrong.topics.${v}`) }))}
        error={err(f.errors.topic)}
      />
      <TextArea id="correction" label={t("wrong.correction")} hint={t("wrong.correctionHint")} value={f.values.correction} onChange={f.set("correction")} maxLength={LIMITS.description} error={err(f.errors.correction)} />
      <TextField id="sourceUrl" type="url" inputMode="url" label={t("wrong.source")} hint={t("optional")} value={f.values.sourceUrl} onChange={f.set("sourceUrl")} error={err(f.errors.sourceUrl)} />
      <TextField id="email" type="email" inputMode="email" autoComplete="email" label={t("email")} hint={t("emailHint")} value={f.values.email} onChange={f.set("email")} error={err(f.errors.email)} />
    </FormShell>
  );
}

// ---------------------------------------------------------------- share your result

export function OutcomeReport({ programSlug }: { programSlug: string }) {
  const t = useTranslations("forms");
  const labels = useTranslations("labels");
  const locale = useLocale() as AppLocale;
  const err = (code?: string) => (code ? t(`error.${code}`, { min: 0, max: LIMITS.tips }) : undefined);
  const f = useForm<OutcomeForm>(
    { intake: "", result: "", cgpa: "", cgpaScale: "4", degree: "", universityType: "", englishTest: "", englishScore: "", experienceMonths: "", tips: "" },
    validateOutcome,
  );
  if (f.sent) return <PreviewNotice onReset={f.reset} />;
  return (
    <FormShell onSubmit={f.submit} submitLabel={t("sendResult")}>
      <input type="hidden" name="program" value={programSlug} />
      <p className="text-meta text-ink-muted">{t("outcome.anonymous")}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="intake" type="month" label={t("outcome.intake")} hint={t("outcome.intakeHint")} value={f.values.intake} onChange={f.set("intake")} error={err(f.errors.intake)} />
        <SelectField id="result" label={t("outcome.result")} value={f.values.result} onChange={f.set("result")} placeholder={t("choose")} options={OUTCOME_RESULTS.map((v) => ({ value: v, label: t(`outcome.results.${v}`) }))} error={err(f.errors.result)} />
        <TextField id="cgpa" inputMode="decimal" label={t("outcome.cgpa")} value={f.values.cgpa} onChange={f.set("cgpa")} error={err(f.errors.cgpa)} />
        <SelectField id="cgpaScale" label={t("outcome.cgpaScale")} value={f.values.cgpaScale} onChange={f.set("cgpaScale")} options={[{ value: "4", label: localizeDigits("4.00", locale) }, { value: "5", label: localizeDigits("5.00", locale) }]} error={err(f.errors.cgpaScale)} />
        <TextField id="degree" label={t("outcome.degree")} hint={t("outcome.degreeHint")} value={f.values.degree} onChange={f.set("degree")} error={err(f.errors.degree)} />
        <SelectField id="universityType" label={t("outcome.universityType")} value={f.values.universityType} onChange={f.set("universityType")} placeholder={t("choose")} options={UNIVERSITY_TYPES.map((v) => ({ value: v, label: labels(`universityType.${v}`) }))} error={err(f.errors.universityType)} />
        <SelectField id="englishTest" label={t("outcome.englishTest")} value={f.values.englishTest} onChange={f.set("englishTest")} placeholder={t("choose")} options={ENGLISH_TESTS.map((v) => ({ value: v, label: v === "moi" ? labels("test.moi") : labels(`test.${v}`) }))} error={err(f.errors.englishTest)} />
        {f.values.englishTest && f.values.englishTest !== "moi" && (
          <TextField id="englishScore" inputMode="decimal" label={t("outcome.englishScore")} value={f.values.englishScore} onChange={f.set("englishScore")} error={err(f.errors.englishScore)} />
        )}
        <TextField id="experienceMonths" inputMode="numeric" label={t("outcome.experience")} hint={t("optional")} value={f.values.experienceMonths} onChange={f.set("experienceMonths")} error={err(f.errors.experienceMonths)} />
      </div>
      <TextArea id="tips" label={t("outcome.tips")} hint={t("optional")} value={f.values.tips} onChange={f.set("tips")} maxLength={LIMITS.tips} error={err(f.errors.tips)} />
    </FormShell>
  );
}

// ---------------------------------------------------------------- report a problem

export function ProblemReport() {
  const t = useTranslations("forms");
  const pathname = usePathname();
  const err = (code?: string) => (code ? t(`error.${code}`, { min: LIMITS.minDescription, max: LIMITS.description }) : undefined);
  const f = useForm<ProblemForm>({ type: "", description: "", email: "" }, validateProblem);
  const [device, setDevice] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDevice(navigator.userAgent);
  }, []);

  if (f.sent) return <PreviewNotice onReset={f.reset} />;
  return (
    <FormShell onSubmit={f.submit} submitLabel={t("sendReport")}>
      <SelectField id="type" label={t("problem.type")} value={f.values.type} onChange={f.set("type")} placeholder={t("choose")} options={PROBLEM_TYPES.map((v) => ({ value: v, label: t(`problem.types.${v}`) }))} error={err(f.errors.type)} />
      <TextArea id="description" label={t("problem.description")} value={f.values.description} onChange={f.set("description")} maxLength={LIMITS.description} error={err(f.errors.description)} />
      <TextField id="email" type="email" inputMode="email" autoComplete="email" label={t("email")} hint={t("emailHint")} value={f.values.email} onChange={f.set("email")} error={err(f.errors.email)} />
      <div className="rounded-tile bg-surface-2 p-3 text-meta">
        <p className="font-semibold">{t("problem.attached")}</p>
        <dl className="mt-1 space-y-1 text-ink-muted">
          <div>
            <dt className="inline font-semibold">{t("problem.page")}: </dt>
            <dd className="inline break-all">{pathname}</dd>
          </div>
          <div>
            <dt className="inline font-semibold">{t("problem.device")}: </dt>
            <dd className="inline break-all">{device}</dd>
          </div>
          <div>
            <dt className="inline font-semibold">{t("problem.version")}: </dt>
            <dd className="inline">{APP_VERSION}</dd>
          </div>
        </dl>
      </div>
    </FormShell>
  );
}
