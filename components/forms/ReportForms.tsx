"use client";

// The three report forms. Checked in the browser, then sent to the server (app/actions/reports.ts), which
// checks again, stops spam (Turnstile, a hidden trap field, a rate limit), saves the report and tells Said on Telegram.

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { sendOutcome, sendProblem, sendWrongInfo, type ReportResult } from "@/app/actions/reports";
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
import { Turnstile } from "./Turnstile";

const APP_VERSION = "stage-2";

type Kind = "wrong" | "problem" | "outcome";
type Failure = "spam" | "rate_limited" | "server" | "not_configured";

function SentNotice({ kind, onReset }: { kind: Kind; onReset: () => void }) {
  const t = useTranslations("forms");
  return (
    <div role="status" className="rounded-tile bg-success-soft p-4 text-success">
      <p className="flex items-center gap-2 font-semibold">
        <Icon name="checkCircle" /> {t("sentTitle")}
      </p>
      <p className="mt-1 text-meta">{t(`sent.${kind}`)}</p>
      <button type="button" onClick={onReset} className={`${buttonClass("ghost", "sm")} mt-2 -ml-3`}>
        {t("again")}
      </button>
    </div>
  );
}

interface Envelope {
  token?: string;
  website?: string;
}

function useForm<T extends object>(initial: T, validate: (v: T) => Errors<T>, send: (values: T, env: Envelope) => Promise<ReportResult<T>>) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Errors<T>>({});
  const [sent, setSent] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [pending, startTransition] = useTransition();
  const [token, setToken] = useState<string | null>(null);
  const [trap, setTrap] = useState("");
  // Turnstile tokens work once: a new widget after every attempt.
  const [attempt, setAttempt] = useState(0);
  const set = (key: keyof T) => (value: string) => setValues((v) => ({ ...v, [key]: value }));

  function submit(e: FormEvent) {
    e.preventDefault();
    const found = validate(values);
    setErrors(found);
    setFailure(null);
    if (!isValid(found)) {
      document.getElementById(String(Object.keys(found)[0]))?.focus();
      return;
    }
    startTransition(async () => {
      const result = await send(values, { token: token ?? undefined, website: trap });
      setAttempt((n) => n + 1);
      setToken(null);
      if (result.ok) setSent(true);
      else if (result.error === "invalid") setErrors(result.fields);
      else setFailure(result.error);
    });
  }
  const reset = () => {
    setValues(initial);
    setErrors({});
    setSent(false);
    setFailure(null);
  };
  return { values, errors, set, submit, sent, reset, pending, failure, attempt, setToken, trap, setTrap };
}

/** What the shared form frame needs from useForm. */
interface ShellState {
  submit: (e: FormEvent) => void;
  pending: boolean;
  failure: Failure | null;
  attempt: number;
  setToken: (token: string | null) => void;
  trap: string;
  setTrap: (value: string) => void;
}

function FormShell({ form, children, submitLabel }: { form: ShellState; children: ReactNode; submitLabel: string }) {
  const t = useTranslations("forms");
  return (
    <form noValidate onSubmit={form.submit} className="space-y-4" aria-busy={form.pending}>
      <p className="text-meta text-ink-muted">{t("privacyHint")}</p>
      {children}
      {/* A field people never see; bots that fill in every field give themselves away. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" value={form.trap} onChange={(e) => form.setTrap(e.target.value)} />
        </label>
      </div>
      <Turnstile key={form.attempt} onToken={form.setToken} />
      {form.failure && (
        <p role="alert" className="rounded-tile bg-danger-soft p-3 text-meta font-semibold text-danger">
          {t(`failed.${form.failure}`)}
        </p>
      )}
      <button type="submit" disabled={form.pending} className={buttonClass("primary", "md", true)}>
        {form.pending ? t("sending") : submitLabel}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------- report wrong info

export function WrongInfoReport({ programSlug }: { programSlug: string }) {
  const t = useTranslations("forms");
  const err = (code?: string) => (code ? t(`error.${code}`, { min: LIMITS.minDescription, max: LIMITS.description }) : undefined);
  const f = useForm<WrongInfoForm>({ topic: "", correction: "", sourceUrl: "", email: "" }, validateWrongInfo, (v, env) => sendWrongInfo(programSlug, v, env));
  if (f.sent) return <SentNotice kind="wrong" onReset={f.reset} />;
  return (
    <FormShell form={f} submitLabel={t("sendReport")}>
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
    (v, env) => sendOutcome(programSlug, v, env),
  );
  if (f.sent) return <SentNotice kind="outcome" onReset={f.reset} />;
  return (
    <FormShell form={f} submitLabel={t("sendResult")}>
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
  const [device, setDevice] = useState("");
  const f = useForm<ProblemForm>({ type: "", description: "", email: "" }, validateProblem, (v, env) =>
    sendProblem(v, { pageUrl: typeof window === "undefined" ? pathname : window.location.href, userAgent: device, appVersion: APP_VERSION }, env),
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDevice(navigator.userAgent);
  }, []);

  if (f.sent) return <SentNotice kind="problem" onReset={f.reset} />;
  return (
    <FormShell form={f} submitLabel={t("sendReport")}>
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
