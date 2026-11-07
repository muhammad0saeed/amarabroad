// The robot's reads and writes in Supabase, with the secret key (server-only: never shipped to browsers).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { stable, type PlannedChange, type ProgramRow } from "./checks.ts";
import type { FetchedPage } from "./pipeline.ts";
import { fromDataset } from "./official-data.ts";

let client: SupabaseClient | null = null;
export function db(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set in .env.local");
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

function must<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
}

export interface SourceRow {
  id: string;
  url: string;
  kind: string;
  entity_type: string | null;
  entity_slug: string | null;
  university: string | null;
  status: string;
  check_every: string;
  content_hash: string | null;
  http_etag: string | null;
  http_last_modified: string | null;
  consecutive_errors: number;
  next_check_at: string;
  last_changed_at: string | null;
}

/** Program pages due for a visit, longest-waiting first; `after` continues from the previous batch. */
export async function dueProgramSources(limit: number, after?: string): Promise<SourceRow[]> {
  let q = db().from("sources").select("*").eq("kind", "program_page").in("status", ["active", "discovered"]).lte("next_check_at", new Date().toISOString());
  if (after) q = q.gt("next_check_at", after);
  return must(await q.order("next_check_at").limit(limit), "due sources") as SourceRow[];
}

/** Program pages already read, longest-unread first: for re-reading them after the rules improved. */
export async function knownProgramSources(limit: number): Promise<SourceRow[]> {
  return must(
    await db().from("sources").select("*").eq("kind", "program_page").eq("status", "active").not("entity_slug", "is", null).order("last_checked_at", { ascending: true, nullsFirst: true }).limit(limit),
    "known sources",
  ) as SourceRow[];
}

export async function childSources(programSlug: string): Promise<SourceRow[]> {
  return must(await db().from("sources").select("*").eq("entity_type", "program").eq("entity_slug", programSlug).neq("kind", "program_page"), "child sources") as SourceRow[];
}

export async function addSource(row: { url: string; kind: string; university: string | null; entity_slug?: string | null; status?: string }) {
  const { error } = await db()
    .from("sources")
    .upsert({ entity_type: row.entity_slug ? "program" : null, entity_slug: row.entity_slug ?? null, status: "active", ...row }, { onConflict: "url", ignoreDuplicates: true });
  if (error) throw new Error(`add source: ${error.message}`);
}

/** Next visit: after `hours` (see schedule.ts; daily by default), later after errors (1, 2, 4 … days, at most 14). */
export async function markChecked(source: SourceRow, result: { hash?: string; etag?: string | null; lastModified?: string | null; changed?: boolean; error?: string; gone?: boolean; hours?: number }) {
  const errors = result.error ? source.consecutive_errors + 1 : 0;
  const hours = result.error ? Math.min(2 ** (errors - 1), 14) * 24 : (result.hours ?? 24);
  // A little random spread, so pages found together don't all fall due in the same minute.
  const next = new Date(Date.now() + hours * 3_600_000 + Math.random() * Math.min(hours, 24) * 150_000);
  const update: Record<string, unknown> = {
    last_checked_at: new Date().toISOString(),
    next_check_at: next.toISOString(),
    consecutive_errors: errors,
    last_error: result.error ?? null,
  };
  if (result.hash) update.content_hash = result.hash;
  if (result.etag !== undefined) update.http_etag = result.etag;
  if (result.lastModified !== undefined) update.http_last_modified = result.lastModified;
  if (result.changed) update.last_changed_at = new Date().toISOString();
  if (result.gone && errors >= 3) update.status = "gone";
  else if (errors >= 8) update.status = "paused";
  must(await db().from("sources").update(update).eq("id", source.id), "mark checked");
}

/** Longest page text kept for page search: enough for a program page's facts, small enough for the free plan. */
const SNAPSHOT_MAX_CHARS = 12_000;

export async function saveSnapshot(sourceId: string, page: FetchedPage): Promise<number | null> {
  const { data, error } = await db()
    .from("page_snapshots")
    .upsert({ source: sourceId, http_status: page.status, content_hash: page.hash, text_content: page.text.slice(0, SNAPSHOT_MAX_CHARS) }, { onConflict: "source,content_hash" })
    .select("id")
    .single();
  if (error) throw new Error(`snapshot: ${error.message}`);
  return (data as { id: number } | null)?.id ?? null;
}

/** Keep only the latest saved copy and reading of a page (supabase/05_robot_storage.sql). Skipped if that SQL isn't applied yet. */
export async function pruneSource(sourceId: string) {
  await db().rpc("robot_prune_source", { p_source: sourceId });
}

/** Database size in MB, or null when supabase/05_robot_storage.sql isn't applied yet. */
export async function databaseMB(): Promise<number | null> {
  const { data, error } = await db().rpc("robot_db_size");
  return error || typeof data !== "number" ? null : Math.round(data / 1_048_576);
}

/** Stop adding new pages and universities above this size (free plan: 500 MB, read-only when full). */
export const DATABASE_BRAKE_MB = Number(process.env.ROBOT_DB_LIMIT_MB ?? 430);

export async function saveExtraction(row: { source: string; snapshot: number | null; model: string; result: unknown; input_tokens: number; output_tokens: number; cost_usd: number }): Promise<number> {
  return (must(await db().from("extractions").insert(row).select("id").single(), "extraction") as { id: number }).id;
}

export interface UniversityContext {
  slug: string;
  name: string;
  countryName: string;
  website: string;
}

export async function universityContext(slug: string): Promise<UniversityContext | null> {
  const { data } = await db().from("universities").select("slug, name, website, cities(countries(name_en))").eq("slug", slug).maybeSingle();
  if (!data) return null;
  const d = data as unknown as { slug: string; name: string; website: string; cities: { countries: { name_en: string } | null } | null };
  return { slug: d.slug, name: d.name, website: d.website, countryName: d.cities?.countries?.name_en ?? "" };
}

export async function fieldList(): Promise<string[]> {
  return (must(await db().from("fields").select("slug, name_en").order("slug"), "fields") as { slug: string; name_en: string }[]).map((f) => `${f.slug}: ${f.name_en}`);
}

const PROGRAM_COLUMNS =
  "slug, title, degree_level, field, related_bachelor_fields, duration_months, ects_credits, language, language_requirement_en, currency, tuition_per_year, other_fees_per_year, application_fee, intakes, english_tests, accepts_moi, accepts_3yr_bachelor, accepts_provisional, min_gpa_requirement, seats_total, seats_non_eu, required_documents, overview_en, career_paths_en";

export async function loadProgram(slug: string): Promise<(ProgramRow & { published: boolean; origin: string }) | null> {
  const { data, error } = await db().from("programs").select(`${PROGRAM_COLUMNS}, published, origin, locked_fields`).eq("slug", slug).maybeSingle();
  if (error) throw new Error(`load program: ${error.message}`);
  if (!data) return null;
  const row = data as Record<string, unknown>;
  for (const k of ["tuition_per_year", "other_fees_per_year", "application_fee"]) if (row[k] !== null) row[k] = Number(row[k]);
  return row as unknown as ProgramRow & { published: boolean; origin: string };
}

/** A program at this university with the same title whose facts came from an official dataset (official-data.ts). */
export async function datasetTwin(university: string, title: string): Promise<string | null> {
  const pattern = title.trim().replace(/[\\%_]/g, (c) => `\\${c}`);
  const { data } = await db().from("programs").select("slug, source_url").eq("university", university).ilike("title", pattern).limit(5);
  return ((data ?? []) as { slug: string; source_url: string }[]).find((p) => fromDataset(p.source_url))?.slug ?? null;
}

export async function slugTaken(slug: string): Promise<boolean> {
  const { count } = await db().from("programs").select("slug", { count: "exact", head: true }).eq("slug", slug);
  return (count ?? 0) > 0;
}

/**
 * Writes the robot's findings: creates the program if it's new, applies the changes that passed the checks,
 * logs every change (applied or held) with its evidence, refreshes last_verified, and publishes the program
 * once it's complete (the database refuses incomplete ones).
 */
export async function applyProgram(args: {
  slug: string;
  isNew: boolean;
  create?: { title: string; university: string; degree_level: string; official_url: string };
  changes: PlannedChange[];
  /** The saved page reading; null when the facts came from an official dataset, not a page. */
  extraction: number | null;
  sourceUrl: string;
  /** Where students apply (defaults to sourceUrl, the page the facts were read from). */
  officialUrl?: string;
  today: string;
}): Promise<{ applied: number; held: number; published: boolean }> {
  const { slug, changes, today } = args;
  if (args.isNew && args.create) {
    must(await db().from("programs").insert({ slug, ...args.create, origin: "robot", is_sample: false, published: false, source_url: args.sourceUrl }), "create program");
  }
  const applied = changes.filter((c) => !c.hold);
  const update: Record<string, unknown> = Object.fromEntries(applied.map((c) => [c.field, c.newValue]));
  update.last_verified = today;
  update.source_url = args.sourceUrl;
  update.official_url = args.officialUrl ?? args.sourceUrl;
  update.is_sample = false;
  must(await db().from("programs").update(update).eq("slug", slug), "update program");

  // A held reading already waiting, or one an admin already said no to, isn't logged again.
  const { data: waiting } = await db().from("field_changes").select("field, new_value").eq("entity_type", "program").eq("entity_slug", slug).in("status", ["held", "rejected"]);
  const key = (field: string, value: unknown) => `${field}=${stable(value)}`;
  const seen = new Set(((waiting ?? []) as { field: string; new_value: unknown }[]).map((w) => key(w.field, w.new_value)));
  const toLog = changes.filter((c) => !c.hold || !seen.has(key(c.field, c.newValue)));
  if (toLog.length) {
    must(
      await db()
        .from("field_changes")
        .insert(
          toLog.map((c) => ({
            entity_type: "program",
            entity_slug: slug,
            field: c.field,
            old_value: c.oldValue ?? null,
            new_value: c.newValue ?? null,
            evidence: c.evidence,
            source_url: args.sourceUrl,
            extraction: args.extraction,
            status: c.hold ? "held" : "applied",
            reason: c.hold,
            decided_by: c.hold ? null : "robot",
            decided_at: c.hold ? null : new Date().toISOString(),
          })),
        ),
      "log changes",
    );
  }

  // Publish when complete. A failed check constraint just means "not complete yet".
  let published = false;
  const { data: row } = await db().from("programs").select("published, university").eq("slug", slug).single();
  const r = row as { published: boolean; university: string } | null;
  if (r?.published) published = true;
  else {
    const { error } = await db().from("programs").update({ published: true }).eq("slug", slug);
    published = !error;
  }
  // A university appears once it has a published program.
  if (published && r) await db().from("universities").update({ published: true, last_verified: today }).eq("slug", r.university).eq("published", false);
  return { applied: applied.length, held: changes.length - applied.length, published };
}

/** The page still says the same: the facts are confirmed as of today. */
export async function confirmProgram(slug: string, today: string) {
  must(await db().from("programs").update({ last_verified: today }).eq("slug", slug), "confirm program");
}

/** The official page is gone for good: take the program off the site and log why. */
export async function retireProgram(slug: string, url: string) {
  must(await db().from("programs").update({ published: false }).eq("slug", slug), "retire program");
  await db().from("field_changes").insert({ entity_type: "program", entity_slug: slug, field: "published", old_value: true, new_value: false, evidence: `${url} returns "not found"`, source_url: url, status: "applied", reason: "official page gone", decided_by: "robot", decided_at: new Date().toISOString() });
}

/** Watches a different URL for this source (its English version). Drops it if that URL is already watched. */
export async function moveSource(sourceId: string, url: string): Promise<"moved" | "duplicate"> {
  const { error } = await db().from("sources").update({ url }).eq("id", sourceId);
  if (error?.code === "23505") {
    await db().from("sources").delete().eq("id", sourceId);
    return "duplicate";
  }
  if (error) throw new Error(`move source: ${error.message}`);
  return "moved";
}

/** Universities are searched again this often, to find programs they added since. */
export const REDISCOVER_DAYS = 30;
const DAY = 86_400_000;

/**
 * Universities due for a search: never searched first (best ranked first), then the longest ago.
 * Rows that failed are dated so they come back after a few days (see markDiscoveryFailed).
 */
export async function undiscoveredUniversities(limit: number, offset = 0): Promise<string[]> {
  const due = new Date(Date.now() - REDISCOVER_DAYS * DAY).toISOString();
  const res = await db()
    .from("universities")
    .select("slug")
    .or(`discovered_at.is.null,discovered_at.lt.${due}`)
    .order("discovered_at", { ascending: true, nullsFirst: true })
    .order("ranking->rank", { ascending: true, nullsFirst: false })
    .range(offset, offset + limit - 1);
  return (must(res, "undiscovered") as { slug: string }[]).map((u) => u.slug);
}

/** How many universities came from the ranked list (they have a rank). */
export async function rankedCount(): Promise<number> {
  const { count, error } = await db().from("universities").select("slug", { count: "exact", head: true }).not("ranking", "is", null);
  if (error) throw new Error(`count ranked: ${error.message}`);
  return count ?? 0;
}

/** How many universities are waiting for their first search. */
export async function neverSearchedCount(): Promise<number> {
  const { count, error } = await db().from("universities").select("slug", { count: "exact", head: true }).is("discovered_at", null);
  if (error) throw new Error(`count unsearched: ${error.message}`);
  return count ?? 0;
}

export async function markDiscovered(slug: string, programPages: number) {
  must(await db().from("universities").update({ discovered_at: new Date().toISOString(), program_pages_found: programPages }).eq("slug", slug), "mark discovered");
}

/** The website failed (down, blocked, too slow): try again in 3 days, not every shift. */
export async function markDiscoveryFailed(slug: string) {
  const retry = new Date(Date.now() - (REDISCOVER_DAYS - 3) * DAY).toISOString();
  must(await db().from("universities").update({ discovered_at: retry }).eq("slug", slug), "mark discovery failed");
}

export async function linkSource(sourceId: string, programSlug: string) {
  must(await db().from("sources").update({ entity_type: "program", entity_slug: programSlug, status: "active" }).eq("id", sourceId), "link source");
}

export async function startRun(trigger: string): Promise<number> {
  return (must(await db().from("crawl_runs").insert({ trigger }).select("id").single(), "start run") as { id: number }).id;
}

export async function finishRun(id: number, stats: { pages_checked: number; pages_changed: number; changes_applied: number; changes_held: number; errors: number; cost_usd: number; notes?: string }) {
  must(await db().from("crawl_runs").update({ ...stats, finished_at: new Date().toISOString() }).eq("id", id), "finish run");
}
