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
