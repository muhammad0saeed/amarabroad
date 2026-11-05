"use server";

// Admin actions. Every one checks requireAdmin() first and runs with the admin's own session,
// so the database's row-level security applies on top (only admins may change these rows).

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { siteOrigin } from "@/lib/admin/origin";
import { invalidateData } from "@/lib/data";
import { serviceClient, sessionClient } from "@/lib/supabase/clients";

// ---------------------------------------------------------------- sign in / out

export type SignInState = { status: "idle" | "sent" } | { status: "error"; message: string };

export async function sendSignInLink(_: SignInState, form: FormData): Promise<SignInState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { status: "error", message: "That doesn't look like an email address." };

  // Only admins get a link. Everyone sees the same answer, so the form doesn't reveal who is an admin.
  const { data: admin } = await serviceClient().from("admins").select("email").eq("email", email).maybeSingle();
  if (admin) {
    const origin = siteOrigin(await headers());
    const db = await sessionClient();
    const { error } = await db.auth.signInWithOtp({ email, options: { emailRedirectTo: `${origin}/admin/auth/callback/`, shouldCreateUser: true } });
    if (error) {
      console.error("sign-in link failed:", error.message);
      return { status: "error", message: error.status === 429 ? "Too many links asked for. Wait a few minutes and try again." : "The sign-in email couldn't be sent. Try again in a minute." };
    }
  }
  return { status: "sent" };
}

export async function signOut() {
  const db = await sessionClient();
  await db.auth.signOut();
  redirect("/admin/login/");
}

// ---------------------------------------------------------------- reports

const REPORT_TABLES = { wrong: "wrong_info_reports", problem: "problem_reports" } as const;
const REPORT_STATUSES = ["new", "working", "fixed", "rejected"] as const;

export async function setReportStatus(form: FormData) {
  const { db } = await requireAdmin();
  const table = REPORT_TABLES[String(form.get("kind")) as keyof typeof REPORT_TABLES];
  const status = String(form.get("status"));
  const id = String(form.get("id"));
  if (!table || !REPORT_STATUSES.includes(status as (typeof REPORT_STATUSES)[number])) return;
  const note = String(form.get("note") ?? "").trim();
  await db.from(table).update({ status, ...(note ? { admin_note: note.slice(0, 1000) } : {}) }).eq("id", id);
  revalidatePath("/admin", "layout");
}

// ---------------------------------------------------------------- outcome reports

export async function moderateOutcome(form: FormData) {
  const { db } = await requireAdmin();
  const status = String(form.get("status"));
  if (status !== "approved" && status !== "rejected" && status !== "pending") return;
  await db.from("outcome_reports").update({ status }).eq("id", String(form.get("id")));
  revalidatePath("/admin", "layout");
}

// ---------------------------------------------------------------- the robot's held changes

/** Columns an approved change may write (the same ones the robot maintains). */
const PROGRAM_FIELDS = new Set([
  "degree_level", "field", "related_bachelor_fields", "duration_months", "ects_credits", "language", "language_requirement_en",
  "currency", "tuition_per_year", "other_fees_per_year", "application_fee", "intakes", "english_tests", "accepts_moi",
  "accepts_3yr_bachelor", "accepts_provisional", "min_gpa_requirement", "seats_total", "seats_non_eu", "required_documents",
  "overview_en", "career_paths_en", "published",
]);

export async function decideChange(form: FormData) {
  const { db, email } = await requireAdmin();
  const id = Number(form.get("id"));
  const approve = form.get("decision") === "approve";
  const { data: change } = await db.from("field_changes").select("id, entity_type, entity_slug, field, new_value, status").eq("id", id).maybeSingle();
  if (!change || change.status !== "held") return;

  if (approve) {
    if (change.entity_type !== "program" || !PROGRAM_FIELDS.has(change.field)) return;
    const { error } = await db.from("programs").update({ [change.field]: change.new_value }).eq("slug", change.entity_slug);
    if (error) {
      console.error("applying change failed:", error.message);
      return;
    }
  }
  await db
    .from("field_changes")
    .update({ status: approve ? "applied" : "rejected", decided_by: email, decided_at: new Date().toISOString() })
    .eq("id", id);
  if (approve) {
    // The public site reads a cached copy: drop it so the change shows (other servers refresh within 10 minutes).
    invalidateData();
    revalidatePath(`/[locale]/programs/${change.entity_slug}`, "page");
  }
  revalidatePath("/admin", "layout");
}
