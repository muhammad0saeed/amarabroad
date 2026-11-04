// The data robot's commands. No AI and no paid service: it needs only SUPABASE_URL and
// SUPABASE_SECRET_KEY in .env.local (to save what it finds).
//
//   npm run robot -- seed <country code> [--limit 30]   add a country's universities from Wikidata
//   npm run robot -- discover <university-slug>          find a university's program pages and watch them
//   npm run robot -- discover-all [--limit 20]           the same for every university not yet searched
//   npm run robot -- add <url> --university <slug>       watch one program page
//   npm run robot -- check [--limit 300] [--reread]      visit due program pages, update what changed
//                                                        (--reread: read known pages again after a rule improvement)

import { planChanges } from "./checks.ts";
import * as store from "./db.ts";
import { discoverPrograms } from "./discover.ts";
import { fetchPage, fetchPageDetailed, preferEnglish, readPages, relatedCandidates, type FetchedPage } from "./pipeline.ts";
import { seedCountry, slugify } from "./seed.ts";

const [command, ...rest] = process.argv.slice(2);
const flag = (name: string, fallback?: string) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : fallback;
};
const today = () => new Date().toISOString().slice(0, 10);
const log = (...parts: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...parts);
/** Version of the reading rules, saved with every extraction so results can be traced to the rules that made them. */
const RULES_VERSION = "rules-v1";

async function newProgramSlug(title: string, university: string): Promise<string> {
  const base = slugify(`${title} ${university}`);
  for (let i = 1; ; i++) {
    const slug = i === 1 ? base : `${base}-${i}`;
    if (!(await store.slugTaken(slug))) return slug;
  }
}

interface Stats {
  pages_checked: number;
  pages_changed: number;
  changes_applied: number;
  changes_held: number;
  errors: number;
  cost_usd: number;
}

async function checkOne(source: store.SourceRow, validFields: Set<string>, stats: Stats, reread = false) {
  const uni = source.university ? await store.universityContext(source.university) : null;
  if (!uni) throw new Error(`source ${source.url} has no university`);
  const fetched = await fetchPageDetailed(source.url);
  stats.pages_checked++;
  if (!fetched.page) {
    const gone = fetched.status === 404 || fetched.status === 410;
    await store.markChecked(source, { error: fetched.reason, gone });
    if (gone && source.entity_slug && source.consecutive_errors + 1 >= 3) await store.retireProgram(source.entity_slug, source.url);
    log("  skipped:", fetched.reason);
    return;
  }
  // A new page in another language: watch its English version instead, when the page lists one.
  let main = fetched.page;
  if (!source.entity_slug) {
    const english = await preferEnglish(main);
    if (english.url !== main.url) {
      log("  switching to the English page", english.url);
      await store.moveSource(source.id, english.url);
      main = english;
    }
  }

  const children = source.entity_slug ? await store.childSources(source.entity_slug) : [];
  const childPages: { source: store.SourceRow | null; page: FetchedPage }[] = [];
  for (const c of children) {
    const p = await fetchPage(c.url);
    stats.pages_checked++;
    if (p) childPages.push({ source: c, page: p });
  }
  // --reread: read again even if the page didn't change (after the rules improved). Surprising differences are still held.
  const changed = reread || main.hash !== source.content_hash || childPages.some((c) => c.page.hash !== c.source?.content_hash);
  const existing = source.entity_slug ? await store.loadProgram(source.entity_slug) : null;

  if (!changed && existing) {
    await store.confirmProgram(existing.slug, today());
    await store.markChecked(source, { hash: main.hash, etag: main.etag, lastModified: main.lastModified });
    for (const c of childPages) await store.markChecked(c.source!, { hash: c.page.hash });
    log("  unchanged, confirmed");
    return;
  }
  stats.pages_changed++;

  // New program: also read a few likely related pages (fees, deadlines…), and watch them from now on.
  if (!existing) {
    for (const url of relatedCandidates(main)) {
      const p = await fetchPage(url);
      if (p && p.text.length > 200) childPages.push({ source: null, page: p });
    }
  }
  const read = readPages([main, ...childPages.map((c) => c.page)], today());
  const snapshot = await store.saveSnapshot(source.id, main);
  const extraction = await store.saveExtraction({ source: source.id, snapshot, model: RULES_VERSION, result: { raw: read.raw, dropped: read.dropped }, input_tokens: 0, output_tokens: 0, cost_usd: 0 });

  if (!read.facts.is_program_page || !read.facts.title || (!existing && !read.facts.degree_level)) {
    await store.markChecked(source, { hash: main.hash, error: "not a single program page" });
    log("  not a program page");
    return;
  }

  const slug = existing?.slug ?? (await newProgramSlug(read.facts.title, uni.name));
  const changes = planChanges(existing, read.facts, today(), validFields);
  const result = await store.applyProgram({
    slug,
    isNew: !existing,
    create: existing ? undefined : { title: read.facts.title, university: uni.slug, degree_level: read.facts.degree_level!.value, official_url: main.url },
    changes,
    extraction,
    sourceUrl: main.url,
    today: today(),
  });
  stats.changes_applied += result.applied;
  stats.changes_held += result.held;
  if (!existing) await store.linkSource(source.id, slug);
  await store.markChecked(source, { hash: main.hash, etag: main.etag, lastModified: main.lastModified, changed: true });
  for (const c of childPages) {
    if (c.source) await store.markChecked(c.source, { hash: c.page.hash, changed: true });
    else await store.addSource({ url: c.page.url, kind: "fees_page", university: uni.slug, entity_slug: slug });
  }
  log(`  ${existing ? "updated" : "new"} ${slug}: ${result.applied} applied, ${result.held} held, ${read.dropped.length} dropped${result.published ? ", published" : ", not complete yet"}`);
}

async function check() {
  const limit = Number(flag("limit", "300"));
  const reread = rest.includes("--reread");
  const due = reread ? await store.knownProgramSources(limit) : await store.dueProgramSources(limit);
  const validFields = new Set((await store.fieldList()).map((f) => f.split(":")[0]!));
  const run = await store.startRun(process.env.GITHUB_ACTIONS ? "schedule" : "manual");
  const stats: Stats = { pages_checked: 0, pages_changed: 0, changes_applied: 0, changes_held: 0, errors: 0, cost_usd: 0 };
  log(`Checking ${due.length} program pages`);
  for (const source of due) {
    log(source.url);
    try {
      await checkOne(source, validFields, stats, reread);
    } catch (e) {
      stats.errors++;
      const message = e instanceof Error ? e.message : String(e);
      log("  error:", message);
      await store.markChecked(source, { error: message.slice(0, 500) }).catch(() => {});
    }
  }
  await store.finishRun(run, stats);
  log(`Done: ${stats.pages_checked} pages, ${stats.pages_changed} changed, ${stats.changes_applied} values applied, ${stats.changes_held} held, ${stats.errors} errors`);
}

async function discoverOne(slug: string): Promise<number> {
  const uni = await store.universityContext(slug);
  if (!uni) throw new Error(`No university ${slug}`);
  log(`Looking for program pages on ${uni.website}`);
  const { programs, method, fetched } = await discoverPrograms(uni.website, { maxPages: Number(flag("pages", "400")) });
  for (const p of programs) await store.addSource({ url: p.url, kind: "program_page", university: slug, status: "discovered" });
  await store.markDiscovered(slug, programs.length);
  log(`  ${uni.name}: ${programs.length} program pages (${method}${fetched ? `, ${fetched} pages read` : ""})`);
  return programs.length;
}

async function discover() {
  const slug = rest[0];
  if (!slug) throw new Error("Usage: npm run robot -- discover <university-slug>");
  await discoverOne(slug);
  log("They'll be read on the next check.");
}

/** Several universities at once: each website still gets one request at a time, a few seconds apart. */
async function discoverAll() {
  const slugs = await store.undiscoveredUniversities(Number(flag("limit", "20")));
  const parallel = Number(flag("parallel", "10"));
  log(`Searching ${slugs.length} universities, ${parallel} at a time`);
  let total = 0;
  const queue = [...slugs];
  await Promise.all(
    Array.from({ length: Math.min(parallel, queue.length) }, async () => {
      for (let slug = queue.shift(); slug; slug = queue.shift()) {
        try {
          total += await discoverOne(slug);
        } catch (e) {
          log(`  ${slug}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }),
  );
  log(`${total} program pages added. They'll be read on the next check.`);
}

async function add() {
  const url = rest[0];
  const university = flag("university");
  if (!url || !university) throw new Error("Usage: npm run robot -- add <url> --university <slug>");
  await store.addSource({ url, kind: "program_page", university, status: "discovered" });
  log("Added. It will be read on the next check.");
}

const commands: Record<string, () => Promise<void>> = {
  check,
  discover,
  "discover-all": discoverAll,
  add,
  seed: () => seedCountry(rest[0] ?? "", Number(flag("limit", "30"))),
};
const run = command ? commands[command] : undefined;
if (!run) {
  console.log("Commands: seed, discover, discover-all, add, check. See robot/README.md.");
  process.exitCode = 1;
} else {
  await run();
}
