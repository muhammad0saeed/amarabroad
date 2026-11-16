// One-off repairs of facts already on the site, after a reading rule turned out to be wrong.
// Each one only removes or fills what the corrected rule says; hand-edited (locked) fields are never touched.

import { db } from "./db.ts";
import { everyRow } from "./official-data.ts";
import { tuitionLineOk } from "./rules.ts";

/** Countries where university teaching is in English unless a page says otherwise. */
export const ENGLISH_COUNTRIES = new Set(["united-kingdom", "united-states", "australia", "ireland"]);
export const ENGLISH_COUNTRY_NAMES = new Set(["United Kingdom", "United States", "Australia", "Ireland"]);

/**
 * Tuition read from a line about something else (a scholarship "worth £10,000", a £2,500 deposit, "£100
 * for printing"). The figure is removed, so the site says "Not found, check the official page" instead of
 * a wrong fee; the next reading fills it again if the page states the real one.
 */
export async function clearWrongTuition(apply: boolean): Promise<{ checked: number; wrong: { slug: string; amount: number; quote: string }[] }> {
  const rows = await everyRow<{ id: number; entity_slug: string; evidence: string | null }>(
    (from, to) => db().from("field_changes").select("id, entity_slug, evidence").eq("entity_type", "program").eq("field", "tuition_per_year").eq("status", "applied").order("id").range(from, to),
    "tuition evidence",
  );
  const suspect = rows.filter((r) => r.evidence && !r.evidence.startsWith("(") && !tuitionLineOk(r.evidence));
  const wrong: { slug: string; amount: number; quote: string }[] = [];
  for (let i = 0; i < suspect.length; i += 150) {
    const chunk = suspect.slice(i, i + 150);
    const { data, error } = await db().from("programs").select("slug, tuition_per_year, locked_fields").in("slug", chunk.map((c) => c.entity_slug));
    if (error) throw new Error(`programs: ${error.message}`);
    const bySlug = new Map((data ?? []).map((p) => [p.slug as string, p as { slug: string; tuition_per_year: string | number | null; locked_fields: string[] | null }]));
    const hit = chunk.filter((c) => {
      const p = bySlug.get(c.entity_slug);
      return p && p.tuition_per_year !== null && Number(p.tuition_per_year) > 0 && !(p.locked_fields ?? []).includes("tuition_per_year");
    });
    for (const h of hit) wrong.push({ slug: h.entity_slug, amount: Number(bySlug.get(h.entity_slug)!.tuition_per_year), quote: h.evidence!.slice(0, 110) });
    if (apply && hit.length) {
      const a = await db().from("programs").update({ tuition_per_year: null }).in("slug", hit.map((h) => h.entity_slug));
      if (a.error) throw new Error(`clear tuition: ${a.error.message}`);
      const b = await db().from("field_changes").delete().in("id", hit.map((h) => h.id));
      if (b.error) throw new Error(`clear tuition evidence: ${b.error.message}`);
    }
  }
  return { checked: rows.length, wrong };
}

/** Programs with no teaching language at universities in English-speaking countries: taught in English. */
export async function fillEnglish(apply: boolean): Promise<number> {
  const unis = await everyRow<{ slug: string; cities: { country: string } | null }>(
    (from, to) => db().from("universities").select("slug, cities(country)").order("slug").range(from, to),
    "universities",
  );
  const english = unis.filter((u) => u.cities && ENGLISH_COUNTRIES.has(u.cities.country)).map((u) => u.slug);
  let n = 0;
  for (let i = 0; i < english.length; i += 100) {
    const chunk = english.slice(i, i + 100);
    if (apply) {
      const { data, error } = await db().from("programs").update({ language: "en" }).is("language", null).in("university", chunk).select("slug");
      if (error) throw new Error(`fill language: ${error.message}`);
      n += data?.length ?? 0;
    } else {
      const { count, error } = await db().from("programs").select("slug", { count: "exact", head: true }).is("language", null).in("university", chunk);
      if (error) throw new Error(`count language: ${error.message}`);
      n += count ?? 0;
    }
  }
  return n;
}

/** "UK (home) / International and EU / £10,050" saved as everyone's fee: the home column, not the international one. */
const HOME_FEE_AS_ALL = /(uk|home)[^£$€]{0,40}(international|overseas)[^£$€]{0,40}[£$€][0-9,]+\s*$/i;

/**
 * Fees laid out as columns (labels first, then amounts) used to be read as the first amount for everyone, which
 * is the UK home fee. Each such program page is read again with the corrected rule: the international fee is
 * saved when the page gives one; otherwise the fee is removed ("Not found") rather than left wrong.
 */
export async function fixHomeFees(apply: boolean, today: string, given?: string[]): Promise<{ found: number; fixed: { slug: string; from: number; to: number | null; quote: string }[] }> {
  const { fetchPageDetailed } = await import("./pipeline.ts");
  const { readFacts } = await import("./rules.ts");
  const { pool } = await import("./pool.ts");
  // The scan below can time out while the database is slow; a list of program slugs can be given instead
  // (from SQL: field_changes rows of tuition_per_year whose evidence matches HOME_FEE_AS_ALL).
  const slugs = given ?? [
    ...new Set(
      (
        await everyRow<{ entity_slug: string; evidence: string | null }>(
          (from, to) => db().from("field_changes").select("entity_slug, evidence").eq("entity_type", "program").eq("field", "tuition_per_year").eq("status", "applied").or("evidence.ilike.*international*,evidence.ilike.*overseas*").order("id").range(from, to),
          "tuition evidence",
        )
      )
        .filter((r) => r.evidence && HOME_FEE_AS_ALL.test(r.evidence))
        .map((r) => r.entity_slug),
    ),
  ];
  const programs: { slug: string; tuition_per_year: string | number | null; currency: string | null; official_url: string | null; locked_fields: string[] | null }[] = [];
  for (let i = 0; i < slugs.length; i += 150) {
    const { data, error } = await db().from("programs").select("slug, tuition_per_year, currency, official_url, locked_fields").in("slug", slugs.slice(i, i + 150));
    if (error) throw new Error(`programs: ${error.message}`);
    programs.push(...(data ?? []));
  }
  const todo = programs.filter((p) => p.tuition_per_year !== null && p.official_url && !(p.locked_fields ?? []).includes("tuition_per_year"));
  const fixed: { slug: string; from: number; to: number | null; quote: string }[] = [];
  await pool(todo, 6, Infinity, async (p) => {
    const page = (await fetchPageDetailed(p.official_url!)).page;
    if (!page) return; // blocked or down today: left as it is, tried again on the next run
    const t = readFacts([{ url: page.url, text: page.text, meta: page.meta }], today).tuition;
    const from = Number(p.tuition_per_year);
    const good = t && t.applies_to === "non_eu" && t.amount_per_year > 0 ? t : null;
    if (good && good.amount_per_year === from) return;
    fixed.push({ slug: p.slug, from, to: good?.amount_per_year ?? null, quote: (good?.quote ?? "(no international fee on the page)").slice(0, 110) });
    if (!apply) return;
    const update = good ? { tuition_per_year: good.amount_per_year, currency: good.currency } : { tuition_per_year: null };
    const u = await db().from("programs").update(update).eq("slug", p.slug);
    if (u.error) throw new Error(`fix fee ${p.slug}: ${u.error.message}`);
    const l = await db().from("field_changes").insert({
      entity_type: "program", entity_slug: p.slug, field: "tuition_per_year", old_value: from, new_value: good?.amount_per_year ?? null,
      evidence: good?.quote ?? "(the saved figure was the UK home fee; the page gives no international fee)", source_url: page.url,
      status: "applied", reason: "the home fee had been saved as everyone's fee; corrected to the international fee", decided_by: "robot", decided_at: new Date().toISOString(),
    });
    if (l.error) throw new Error(`log fee ${p.slug}: ${l.error.message}`);
  });
  return { found: slugs.length, fixed };
}
