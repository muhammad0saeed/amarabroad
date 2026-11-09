// Deadlines first. A program page is normally read again only when it changes, so programs read
// before the deadline rules improved keep "no deadline" for ever. This finds the programs that have no
// upcoming deadline and hands their pages back to be read with today's rules, best-ranked universities first.
// Each page is re-read once per rules version (its saved reading carries the version), never twice.

import { db, type SourceRow } from "./db.ts";
import { everyRow } from "./official-data.ts";
import { nextUsualStart, usualStartsFor } from "./rules.ts";

interface IntakeLike {
  deadline?: string | null;
}

/** True when at least one deadline is today or later (a week's grace, like the rules). */
export function hasUpcomingDeadline(intakes: IntakeLike[] | null | undefined, today: string): boolean {
  const from = Date.parse(today) - 7 * 86_400_000;
  return (intakes ?? []).some((i) => !!i.deadline && Date.parse(i.deadline) >= from);
}

/** Best rank first; universities without a rank go last. */
export function byRank<T extends { university: string | null }>(rows: T[], rank: Map<string, number>): T[] {
  return [...rows].sort((a, b) => (rank.get(a.university ?? "") ?? Infinity) - (rank.get(b.university ?? "") ?? Infinity));
}

/** Program pages to re-read for deadlines: no upcoming deadline, not yet read with `rulesVersion`, not failing. */
export async function deadlineTargets(rulesVersion: string, today: string): Promise<{ sources: SourceRow[]; missing: number; total: number }> {
  const programs = await everyRow<{ slug: string; intakes: IntakeLike[] | null }>(
    (from, to) => db().from("programs").select("slug, intakes").order("slug").range(from, to),
    "programs",
  );
  const missing = new Set(programs.filter((p) => !hasUpcomingDeadline(p.intakes, today)).map((p) => p.slug));

  const readAlready = new Set(
    (
      await everyRow<{ source: string }>((from, to) => db().from("extractions").select("source").eq("model", rulesVersion).order("id").range(from, to), "extractions")
    ).map((e) => e.source),
  );

  const slugs = [...missing];
  const sources: SourceRow[] = [];
  for (let i = 0; i < slugs.length; i += 150) {
    const { data, error } = await db()
      .from("sources")
      .select("*")
      .eq("kind", "program_page")
      .eq("status", "active")
      .in("entity_slug", slugs.slice(i, i + 150));
    if (error) throw new Error(`deadline sources: ${error.message}`);
    for (const s of (data ?? []) as SourceRow[]) if (!readAlready.has(s.id) && s.consecutive_errors < 3) sources.push(s);
  }

  const ranks = await everyRow<{ slug: string; ranking: { rank?: number } | null }>(
    (from, to) => db().from("universities").select("slug, ranking").order("slug").range(from, to),
    "universities",
  );
  const rank = new Map(ranks.filter((u) => u.ranking?.rank).map((u) => [u.slug, u.ranking!.rank!]));
  return { sources: byRank(sources, rank), missing: missing.size, total: programs.length };
}

// ---------------------------------------------------------------- university-wide fallback deadlines
//
// The gap-filler (university-info.ts) keeps what universities' general pages say. A general page lists
// many dates, and most are not "the last day to apply": financial aid, scholarships, appeals, accepting an
// offer, exchange students, one specific program... So a general deadline becomes a program's (labelled)
// fallback only when its sentence clearly is a general application deadline, and nothing else.

/** The sentence must say "application deadline" in one of these ways. */
const SAYS_APPLY = /(application (deadline|closing date|period|round|window)|deadline (to|for) (apply|applications?|submit (your |an )?applications?)|applications? (close|closes|closing|must be (received|submitted))|apply by|closing date (for (receipt of )?applications)?|general application deadline|final (application )?deadline|regular (application |decision )?deadline|^\W*deadlines?\W*:|søknadsfrist|ansökningsdag|bewerbungsfrist|hakuaika)/i;

/** Anything else on a general page that also has a date and the word deadline. */
const NOT_APPLY = new RegExp(
  [
    // money
    "fafsa", "css ?profile", "financial aid", "\\baid\\b", "scholarships?", "bursar(y|ies)", "funding", "\\bawards?\\b", "grants?", "tuition", "\\bfees?\\b", "deposit", "payment", "promissory",
    // after admission, or not admission at all
    "appeal", "accept(ing|ance)? (your |the |an )?(fall |spring )?(admissions? )?offer", "acceptance deadline", "firm and insurance", "re-?registration", "re-?enrol", "readmission", "returning",
    "registration", "timetable", "residence hall", "housing", "accommodation", "visa", "i-20", "orientation", "teaching starts", "classes", "first day", "notif", "decision by", "results",
    "interviews?", "documents? (deadline|due)", "predicted grades", "transcripts?", "english proficiency", "toefl", "ielts", "lsat", "amcas", "audition", "portfolio", "personal statement",
    // other kinds of students
    "exchange", "visiting", "nomination", "incoming student", "study abroad", "transfer", "part-time", "non-degree", "senior audit", "interest student", "single course", "credit transfer", "family members",
    // not the final deadline
    "early (action|decision|consideration)", "priority", "recommend(ed)?", "encourage", "opens?\\b", "begins?\\b", "initial deadline", "by the (application )?deadline",
    // the page sends you to each program, or the date isn't a deadline at all
    "refer to", "respective program", "specific program", "program page", "start date", "starts?:", "exams?\\b", "exemption",
    // other intakes or tracks
    "summer", "fixed-quota", "numerus", "pathways?", "term \\d", "with credit",
    // one program, not the whole university
    "master of ", "bachelor of ", "doctor of ", "school of ", "faculty of ", "\\bms in\\b", "\\bma in\\b", "\\bbba\\b", "\\bmba\\b", "\\bllm\\b", "\\bphd\\b",
    "medicine", "dentistry", "veterinary", "engineering programs?", "architecture", "music", "drama", "nursing", "law\\b", "divinity", "physiotherapy", "social work", "anthropology", "optometry",
  ].join("|"),
  "i",
);

/** True when a general page's sentence is a plain, general application deadline. */
export function isGeneralApplicationDeadline(quote: string): boolean {
  const q = quote.replace(/\s+/g, " ");
  return SAYS_APPLY.test(q) && !NOT_APPLY.test(q);
}

export interface UniversityDeadlineFact {
  university: string;
  level: "bachelor" | "master" | null;
  value: { deadline?: string; start_month?: number; start_year?: number; for?: string };
  quote: string;
  source_url: string;
}

export interface FallbackIntake {
  month: number;
  year: number;
  deadline: string;
  estimated: true;
  university_wide: true;
  source_url: string;
  quote: string;
}

/**
 * The fallback deadlines for one program level at one university: upcoming, not EU-only, passing the
 * filter, at most one per start month (the earliest). A level-specific page beats a page for both levels.
 * More than 3 left means a calendar with many tracks: too unclear to use.
 */
export function fallbackFor(facts: UniversityDeadlineFact[], level: "bachelor" | "master", today: string): FallbackIntake[] {
  const usable = (f: UniversityDeadlineFact) =>
    !!f.value.deadline &&
    f.value.for !== "eu" &&
    Date.parse(f.value.deadline) >= Date.parse(today) &&
    Date.parse(f.value.deadline) <= Date.parse(today) + 540 * 86_400_000 &&
    isGeneralApplicationDeadline(f.quote);
  const specific = facts.filter((f) => f.level === level && usable(f));
  const pool = specific.length ? specific : facts.filter((f) => f.level === null && usable(f));
  // The start month stored with a general page's date is unreliable (older rules guessed it), so it is
  // always estimated here: the country's usual intake after the deadline, and marked as an estimate.
  const best = new Map<number, FallbackIntake>();
  for (const f of pool) {
    const deadline = f.value.deadline!;
    // North America names its terms: "spring/winter" starts in January, "fall" in September. A sentence
    // naming both is a table of terms; which date belongs to which can't be told, so it is skipped.
    const northAmerica = isNorthAmerican(f.source_url);
    const spring = /\b(spring|winter)\b/i.test(f.quote);
    const fall = /\b(fall|autumn)\b/i.test(f.quote);
    if (northAmerica && spring && fall) continue;
    const month = northAmerica && spring ? 1 : northAmerica && fall ? 9 : nextUsualStart(deadline, usualStartsFor(f.source_url));
    const year = Number(deadline.slice(0, 4)) + (month <= Number(deadline.slice(5, 7)) ? 1 : 0);
    const cur = best.get(month);
    if (!cur || deadline < cur.deadline) best.set(month, { month, year, deadline, estimated: true, university_wide: true, source_url: f.source_url, quote: f.quote.slice(0, 220) });
  }
  if (best.size > 3) return [];
  return [...best.values()].sort((a, b) => (a.deadline < b.deadline ? -1 : 1));
}

function isNorthAmerican(url: string): boolean {
  try {
    return /\.(edu|us|ca)$/.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

const stableJson = (v: unknown) => JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort()) : x));

/**
 * Gives programs with no deadline of their own their university's general deadline, labelled
 * `university_wide` (with the page and sentence), and refreshes or removes earlier fallbacks.
 * A program's own deadline is never touched, and a hand-locked deadline neither.
 */
export async function applyUniversityFallbacks(today: string, dry = false): Promise<{ added: number; refreshed: number; removed: number; universities: number }> {
  const facts = await everyRow<UniversityDeadlineFact & { id: number }>(
    (from, to) => db().from("university_facts").select("id, university, level, value, quote, source_url").eq("field", "deadline").order("id").range(from, to),
    "university facts",
  );
  const byUni = new Map<string, UniversityDeadlineFact[]>();
  for (const f of facts) byUni.set(f.university, [...(byUni.get(f.university) ?? []), f]);

  const programs = await everyRow<{ slug: string; university: string; degree_level: "bachelor" | "master"; intakes: (IntakeLike & { university_wide?: boolean })[] | null; locked_fields: string[] | null; official_url: string }>(
    (from, to) => db().from("programs").select("slug, university, degree_level, intakes, locked_fields, official_url").order("slug").range(from, to),
    "programs",
  );

  let added = 0, refreshed = 0, removed = 0;
  const used = new Set<string>();
  for (const p of programs) {
    if (p.locked_fields?.includes("intakes")) continue;
    const current = p.intakes ?? [];
    const own = current.filter((i) => !i.university_wide);
    if (hasUpcomingDeadline(own, today)) continue; // its own page states a deadline: that always wins
    const hadFallback = current.some((i) => i.university_wide);
    const next = fallbackFor(byUni.get(p.university) ?? [], p.degree_level, today);
    if (!next.length && !hadFallback) continue;
    if (stableJson(next) === stableJson(current)) continue;
    if (next.length) used.add(p.university);
    if (next.length && hadFallback) refreshed++;
    else if (next.length) added++;
    else removed++;
    if (dry) continue;
    const { error } = await db().from("programs").update({ intakes: next }).eq("slug", p.slug);
    if (error) throw new Error(`fallback deadline for ${p.slug}: ${error.message}`);
    await db().from("field_changes").insert({
      entity_type: "program", entity_slug: p.slug, field: "intakes", old_value: current, new_value: next,
      evidence: next[0]?.quote ?? "(the university's general deadline no longer applies)", source_url: next[0]?.source_url ?? p.official_url,
      status: "applied", reason: next.length ? "university-wide deadline from the university's general page (the program page states none)" : "university-wide deadline removed",
      decided_by: "robot", decided_at: new Date().toISOString(),
    });
  }
  return { added, refreshed, removed, universities: used.size };
}

/** Share of published programs with an upcoming deadline, for the logs and the admin page. */
export async function deadlineCoverage(today: string): Promise<{ published: number; withDeadline: number; percent: number }> {
  const rows = await everyRow<{ intakes: IntakeLike[] | null }>(
    (from, to) => db().from("programs").select("intakes").eq("published", true).order("slug").range(from, to),
    "programs",
  );
  const withDeadline = rows.filter((r) => hasUpcomingDeadline(r.intakes, today)).length;
  return { published: rows.length, withDeadline, percent: rows.length ? Math.round((withDeadline / rows.length) * 1000) / 10 : 0 };
}
