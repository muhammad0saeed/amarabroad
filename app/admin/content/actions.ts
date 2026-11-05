"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { allFields, isTable, readForm, sameValue, slugify, TABLES, ROBOT_FIELDS } from "@/lib/admin/content";
import { invalidateData } from "@/lib/data";

export type SaveState =
  | { status: "idle" }
  | { status: "saved"; message: string }
  | { status: "error"; message: string; errors?: Record<string, string> };

/** Why the database said no, in words. */
const CONSTRAINTS: Record<string, string> = {
  programs_complete: "To show it on the site it needs a subject and a check date, and a currency if tuition is filled in.",
  universities_complete: "To show it on the site it needs a check date.",
  cities_complete: "To show it on the site it needs a check date, all six monthly costs, and whether the local language is needed for jobs.",
  countries_complete: "To show it on the site it needs an overview, a check date and the weekly work hours for students.",
  scholarships_complete: "To show it on the site it needs what it pays, a deadline and a check date.",
};

function explain(error: { code?: string; message: string }): string {
  if (error.code === "23514") {
    const name = Object.keys(CONSTRAINTS).find((c) => error.message.includes(c));
    return name ? CONSTRAINTS[name]! : `A value isn't allowed here (${error.message}).`;
  }
  if (error.code === "23505") return "Something with that ID already exists. Choose another.";
  if (error.code === "23503") return "It points to something that doesn't exist (check the university, city, country or subject).";
  if (error.code === "22P02" || error.code === "22003") return `A value has the wrong form (${error.message}).`;
  if (error.code === "42501") return "The database refused: you're not signed in as an admin any more. Sign in again.";
  return `The database refused the change: ${error.message}`;
}

const todayInDhaka = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });

export async function saveRecord(table: string, id: string | null, _: SaveState, form: FormData): Promise<SaveState> {
  const { db, email } = await requireAdmin();
  if (!isTable(table)) return { status: "error", message: "Unknown table." };
  const spec = TABLES[table];
  const { values, errors } = readForm(spec, form);
  if (Object.keys(errors).length) return { status: "error", message: "Some boxes need fixing.", errors };
  if (spec.verified && form.get("checked_today") === "on") values.last_verified = todayInDhaka();

  // ---------------------------------------------------------------- new
  if (!id) {
    const typed = String(form.get("new_id") ?? "").trim();
    const newId = spec.id === "currency" ? typed.toUpperCase() : slugify(typed || String(values[spec.name] ?? ""));
    if (spec.id === "currency" ? !/^[A-Z]{3}$/.test(newId) : !newId || newId === "new")
      return { status: "error", message: "Give it an ID.", errors: { new_id: spec.id === "currency" ? "Three letters, e.g. EUR" : "Letters and numbers" } };
    const row: Record<string, unknown> = { ...values, [spec.id]: newId };
    if ("origin" in sample(table)) row.origin = "admin";
    const { error } = await db.from(table).insert(row);
    if (error) return { status: "error", message: explain(error) };
    refresh(table, newId);
    redirect(`/admin/content/${table}/${encodeURIComponent(newId)}/?saved=1`);
  }

  // ---------------------------------------------------------------- edit
  const { data: current, error: loadError } = await db.from(table).select("*").eq(spec.id, id).maybeSingle();
  if (loadError || !current) return { status: "error", message: loadError ? explain(loadError) : "It was deleted or renamed." };
  const row = current as Record<string, unknown>;

  const changed = Object.keys(values).filter((k) => !sameValue(values[k], row[k]));
  const update: Record<string, unknown> = Object.fromEntries(changed.map((k) => [k, values[k]]));

  // Fields set by hand are locked: the robot holds its readings of them for review instead of overwriting.
  if (table === "programs") {
    const before = (row.locked_fields as string[] | null) ?? [];
    const release = new Set(form.getAll("unlock").map(String));
    // "Let the robot update this again" wins over an edit to the same field.
    const locked = [...new Set([...before, ...changed.filter((f) => ROBOT_FIELDS.has(f))])].filter((f) => !release.has(f)).sort();
    if (!sameValue(locked, [...before].sort())) update.locked_fields = locked;
  }
  if (!Object.keys(update).length) return { status: "saved", message: "Nothing changed." };

  const { error } = await db.from(table).update(update).eq(spec.id, id);
  if (error) return { status: "error", message: explain(error) };

  if (spec.logged && changed.length) {
    const { error: logError } = await db.from("field_changes").insert(
      changed.map((field) => ({
        entity_type: spec.logged,
        entity_slug: id,
        field,
        old_value: row[field] ?? null,
        new_value: values[field] ?? null,
        evidence: "(edited by hand)",
        status: "applied",
        decided_by: email,
        decided_at: new Date().toISOString(),
      })),
    );
    if (logError) console.error("logging the edit failed:", logError.message);
  }
  refresh(table, id);
  const labels = new Map(allFields(spec).map((f) => [f.name, f.label]));
  const what = changed.map((c) => labels.get(c) ?? c);
  return { status: "saved", message: what.length ? `Saved: ${what.join(", ")}.` : "Saved." };
}

/** Quick action from a list: mark a row as checked against its official page today. */
export async function markChecked(form: FormData) {
  const { db } = await requireAdmin();
  const table = String(form.get("table"));
  const id = String(form.get("id"));
  if (!isTable(table) || !TABLES[table].verified) return;
  await db.from(table).update({ last_verified: todayInDhaka() }).eq(TABLES[table].id, id);
  refresh(table, id);
}

function refresh(table: string, id: string) {
  // The public site keeps a copy of the data for 10 minutes: drop it on this server so the edit shows now.
  invalidateData();
  revalidatePath("/", "layout");
  revalidatePath(`/admin/content/${table}/${id}`);
}

/** Tables with an "origin" column (robot / admin / sample). */
function sample(table: string): Record<string, true> {
  return ["exchange_rates", "glossary_terms", "countries", "cities", "universities", "programs", "scholarships"].includes(table) ? { origin: true } : {};
}
