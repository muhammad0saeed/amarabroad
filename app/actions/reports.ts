"use server";

// What happens when a visitor sends one of the three report forms:
// 1. the same checks as in the browser, again on the server (nobody can skip them)
// 2. spam protection: Turnstile, a hidden trap field, 5 reports per 10 minutes per visitor
// 3. saved in Supabase with the secret key (visitors can't write to these tables directly)
// 4. a Telegram message to Said (if that fails, the report is still saved)

import { guard, type GuardFailure } from "@/lib/reports/guard";
import { notify } from "@/lib/reports/telegram";
import { serviceClient } from "@/lib/supabase/clients";
import { hasSupabaseSecret } from "@/lib/supabase/env";
import {
  isValid,
  validateOutcome,
  validateProblem,
  validateWrongInfo,
  type Errors,
  type OutcomeForm,
  type ProblemForm,
  type WrongInfoForm,
} from "@/lib/validation";

export type ReportResult<T> =
  | { ok: true; notified: boolean }
  | { ok: false; error: "invalid"; fields: Errors<T> }
  | { ok: false; error: GuardFailure | "not_configured" | "server" };

interface Envelope {
  /** Turnstile token from the widget. */
  token?: string;
  /** The hidden trap field: people leave it empty. */
  website?: string;
}

const site = () => (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, "");
const clean = (v: string) => v.trim() || null;

type Table = "wrong_info_reports" | "problem_reports" | "outcome_reports";

/** Insert; if the program isn't in the database (sample data), keep the report and put the slug in the text instead. */
async function save(table: Table, row: Record<string, unknown>, textField: string): Promise<boolean> {
  const db = serviceClient();
  let { error } = await db.from(table).insert(row);
  if (error?.code === "23503" && row.program) {
    ({ error } = await db.from(table).insert({ ...row, program: null, [textField]: `[program: ${row.program}] ${row[textField] ?? ""}`.trim() }));
  }
  if (error) console.error(`report insert into ${table} failed: ${error.message}`);
  return !error;
}

export async function sendWrongInfo(programSlug: string, form: WrongInfoForm, env: Envelope): Promise<ReportResult<WrongInfoForm>> {
  const fields = validateWrongInfo(form);
  if (!isValid(fields)) return { ok: false, error: "invalid", fields };
  if (!hasSupabaseSecret()) return { ok: false, error: "not_configured" };
  const { failure, hash } = await guard("wrong_info_reports", env.token, env.website);
  if (failure) return { ok: false, error: failure };

  const saved = await save(
    "wrong_info_reports",
    { program: programSlug, topic: form.topic, correction: form.correction.trim(), source_url: clean(form.sourceUrl), email: clean(form.email), ip_hash: hash },
    "correction",
  );
  if (!saved) return { ok: false, error: "server" };
  const notified = await notify({
    title: "⚠️ Wrong info reported",
    lines: [
      ["Program", programSlug],
      ["Topic", form.topic],
      ["Correction", form.correction.trim()],
      ["Source", clean(form.sourceUrl)],
      ["Reply to", clean(form.email)],
    ],
    link: { label: "Open the program", url: `${site()}/en/programs/${programSlug}/` },
  });
  return { ok: true, notified };
}

export async function sendProblem(form: ProblemForm, context: { pageUrl: string; userAgent: string; appVersion: string }, env: Envelope): Promise<ReportResult<ProblemForm>> {
  const fields = validateProblem(form);
  if (!isValid(fields)) return { ok: false, error: "invalid", fields };
  if (!hasSupabaseSecret()) return { ok: false, error: "not_configured" };
  const { failure, hash } = await guard("problem_reports", env.token, env.website);
  if (failure) return { ok: false, error: failure };

  const saved = await save(
    "problem_reports",
    {
      type: form.type,
      description: form.description.trim(),
      page_url: context.pageUrl.slice(0, 500),
      user_agent: context.userAgent.slice(0, 500),
      app_version: context.appVersion.slice(0, 50),
      email: clean(form.email),
      ip_hash: hash,
    },
    "description",
  );
  if (!saved) return { ok: false, error: "server" };
  const notified = await notify({
    title: "🐞 Problem reported",
    lines: [
      ["Type", form.type],
      ["What happened", form.description.trim()],
      ["Page", context.pageUrl],
      ["Device", context.userAgent],
      ["Reply to", clean(form.email)],
    ],
  });
  return { ok: true, notified };
}

export async function sendOutcome(programSlug: string, form: OutcomeForm, env: Envelope): Promise<ReportResult<OutcomeForm>> {
  const fields = validateOutcome(form);
  if (!isValid(fields)) return { ok: false, error: "invalid", fields };
  if (!hasSupabaseSecret()) return { ok: false, error: "not_configured" };
  const { failure, hash } = await guard("outcome_reports", env.token, env.website);
  if (failure) return { ok: false, error: failure };

  const num = (v: string) => (v.trim() === "" ? null : Number(v));
  const saved = await save(
    "outcome_reports",
    {
      program: programSlug,
      intake: form.intake.trim(),
      result: form.result,
      cgpa: Number(form.cgpa),
      cgpa_scale: Number(form.cgpaScale),
      degree: form.degree.trim(),
      university_type: form.universityType,
      english_test: form.englishTest,
      english_score: form.englishTest === "moi" ? null : num(form.englishScore),
      experience_months: num(form.experienceMonths),
      tips: clean(form.tips),
      ip_hash: hash,
    },
    "tips",
  );
  if (!saved) return { ok: false, error: "server" };
  const notified = await notify({
    title: "🎓 New outcome report (waiting for your approval)",
    lines: [
      ["Program", programSlug],
      ["Result", `${form.result} (${form.intake})`],
      ["CGPA", `${form.cgpa} / ${form.cgpaScale}`],
      ["Degree", `${form.degree} (${form.universityType})`],
      ["English", form.englishTest === "moi" ? "MOI" : `${form.englishTest} ${form.englishScore}`],
      ["Tips", clean(form.tips)],
    ],
    link: { label: "Open the program", url: `${site()}/en/programs/${programSlug}/` },
  });
  return { ok: true, notified };
}
