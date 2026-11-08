// The data robot's commands. No AI and no paid service: it needs only SUPABASE_URL and
// SUPABASE_SECRET_KEY in .env.local (to save what it finds).
//
//   npm run robot -- seed-top [--total 5000] [--floor 50] [--fresh] [--dry]   add the top universities of all our countries (OpenAlex rank)
//   npm run robot -- seed <country code> [--limit 30]   add a country's universities from Wikidata
//   npm run robot -- discover <university-slug>          find a university's program pages and watch them
//   npm run robot -- discover-all [--limit 20] [--parallel 10] [--minutes M] [--shard i/n]
//                                                        the same for universities never searched, then each again every 30 days
//   npm run robot -- grow [--step 500] [--when-below 500] add the next universities by rank when the search queue runs low
//   npm run robot -- add <url> --university <slug>       watch one program page
//   npm run robot -- check [--parallel 50] [--minutes M] [--shard i/n] [--reread]   visit due program pages, update what changed
//                                                        (--reread: read known pages again after a rule improvement)
//   npm run robot -- official <au|us|uk> [--file F] [--all] [--dry]   programs from official government course lists
//                                                        for universities whose websites block the robot

import { planChanges } from "./checks.ts";
import * as store from "./db.ts";
import { discoverPrograms } from "./discover.ts";
import { fetchPage, fetchPageDetailed, preferEnglish, readPages, relatedCandidates, type FetchedPage } from "./pipeline.ts";
import { seedCountry, slugify } from "./seed.ts";
import { seedTop } from "./seed-top.ts";
import { interleave, pool, shardOf } from "./pool.ts";
import { nextCheckHours } from "./schedule.ts";
import { importOfficial } from "./official-data.ts";

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

  // Shortcut for pages we already read: ask "changed since last time?" (ETag / Last-Modified).
  // If the program page and its fee/deadline pages all say no, confirm the facts without downloading anything.
  if (source.entity_slug && !reread && (source.http_etag || source.http_last_modified)) {
    const first = await fetchPageDetailed(source.url, { etag: source.http_etag, lastModified: source.http_last_modified });
    stats.pages_checked++;
    if (!first.page && first.notModified) {
      let childChanged = false;
      for (const c of await store.childSources(source.entity_slug)) {
        const r = await fetchPageDetailed(c.url, { etag: c.http_etag, lastModified: c.http_last_modified });
        stats.pages_checked++;
        if (!(r.page ? r.page.hash === c.content_hash : r.notModified)) {
          childChanged = true;
          break;
        }
      }
      const existing = childChanged ? null : await store.loadProgram(source.entity_slug);
      if (existing) {
        await store.confirmProgram(existing.slug, today());
        await store.markChecked(source, { hours: nextCheckHours({ changedNow: false, lastChangedAt: source.last_changed_at, deadlines: existing.intakes.map((i) => i.deadline) }) });
        log("  not modified, confirmed");
        return;
      }
    }
  }

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
      // Already watched under its English address: this entry was a duplicate and is gone; the other one covers it.
      if ((await store.moveSource(source.id, english.url)) === "duplicate") {
        log("  already watched in English, skipped");
        return;
      }
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
    const hours = nextCheckHours({ changedNow: false, lastChangedAt: source.last_changed_at, deadlines: existing.intakes.map((i) => i.deadline) });
    await store.markChecked(source, { hash: main.hash, etag: main.etag, lastModified: main.lastModified, hours });
    for (const c of childPages) await store.markChecked(c.source!, { hash: c.page.hash, etag: c.page.etag, lastModified: c.page.lastModified });
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
  // Pages that aren't a program are not stored at all (saves database space).
  if (!read.facts.is_program_page || !read.facts.title || (!existing && !read.facts.degree_level)) {
    await store.markChecked(source, { hash: main.hash, error: "not a single program page" });
    log("  not a program page");
    return;
  }
  const snapshot = await store.saveSnapshot(source.id, main);
  const extraction = await store.saveExtraction({ source: source.id, snapshot, model: RULES_VERSION, result: { raw: read.raw, dropped: read.dropped }, input_tokens: 0, output_tokens: 0, cost_usd: 0 });
  await store.pruneSource(source.id);

  // The same course imported earlier from an official government list: the page adds its facts to that program.
  const twin = existing ? null : await store.datasetTwin(uni.slug, read.facts.title);
  const current = existing ?? (twin ? await store.loadProgram(twin) : null);
  const slug = current?.slug ?? (await newProgramSlug(read.facts.title, uni.name));
  const changes = planChanges(current, read.facts, today(), validFields);
  const result = await store.applyProgram({
    slug,
    isNew: !current,
    create: current ? undefined : { title: read.facts.title, university: uni.slug, degree_level: read.facts.degree_level!.value, official_url: main.url },
    changes,
    extraction,
    sourceUrl: main.url,
    today: today(),
  });
  stats.changes_applied += result.applied;
  stats.changes_held += result.held;
  if (!existing) await store.linkSource(source.id, slug);
  await store.markChecked(source, { hash: main.hash, etag: main.etag, lastModified: main.lastModified, changed: true, hours: nextCheckHours({ changedNow: true, lastChangedAt: null, deadlines: [] }) });
  for (const c of childPages) {
    if (c.source) await store.markChecked(c.source, { hash: c.page.hash, etag: c.page.etag, lastModified: c.page.lastModified, changed: true });
    else await store.addSource({ url: c.page.url, kind: "fees_page", university: uni.slug, entity_slug: slug });
  }
  log(`  ${existing ? "updated" : current ? "joined the official-list program" : "new"} ${slug}: ${result.applied} applied, ${result.held} held, ${read.dropped.length} dropped${result.published ? ", published" : ", not complete yet"}`);
}

/** True (and says so) when the database is near the plan limit: then the robot only updates what it already has. */
/** Tries a database call up to 3 times (5 and 15 seconds apart): one slow answer shouldn't end a whole job. */
async function retry<T>(call: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await call();
    } catch (e) {
      if (attempt >= 3) throw e;
      log(`Database call failed (${e instanceof Error ? e.message : String(e)}); trying again`);
      await new Promise((r) => setTimeout(r, attempt * attempt * 5000));
    }
  }
}

async function databaseFull(): Promise<boolean> {
  const mb = await store.databaseMB();
  if (mb === null || mb < store.DATABASE_BRAKE_MB) return false;
  log(`Database is ${mb} MB (brake at ${store.DATABASE_BRAKE_MB} MB): updating known programs only, adding nothing new. More room: Supabase Pro, or raise ROBOT_DB_LIMIT_MB.`);
  return true;
}

/**
 * Visits due program pages and updates what changed. Built for thousands of universities:
 *   --parallel 40   websites visited at the same time (each website still gets one request every few seconds)
 *   --minutes 300   stop taking new pages after this long (GitHub stops a job at 6 hours)
 *   --shard 2/4     only universities in shard 2 of 4, so several jobs can share the work
 * Pages are taken longest-waiting first, so if there are ever more pages than time, every page still gets its turn.
 */
async function check() {
  const limit = Number(flag("limit", "100000"));
  const reread = rest.includes("--reread");
  const parallel = Number(flag("parallel", "1"));
  const minutes = Number(flag("minutes", "0"));
  const deadline = minutes > 0 ? Date.now() + minutes * 60_000 : Infinity;
  const [shard, shards] = (flag("shard", "0/1") ?? "0/1").split("/").map(Number) as [number, number];
  const validFields = new Set((await store.fieldList()).map((f) => f.split(":")[0]!));
  const run = await store.startRun(process.env.GITHUB_ACTIONS ? "schedule" : "manual");
  const stats: Stats = { pages_checked: 0, pages_changed: 0, changes_applied: 0, changes_held: 0, errors: 0, cost_usd: 0 };
  log(`Checking up to ${limit} program pages, ${parallel} websites at a time${minutes ? `, for ${minutes} minutes` : ""}${shards > 1 ? `, shard ${shard}/${shards}` : ""}`);

  const one = async (source: store.SourceRow) => {
    log(source.url);
    try {
      await checkOne(source, validFields, stats, reread);
    } catch (e) {
      stats.errors++;
      const message = e instanceof Error ? e.message : String(e);
      log("  error:", message, `(${source.url})`);
      await store.markChecked(source, { error: message.slice(0, 500) }).catch(() => {});
    }
  };

  if (reread) {
    await pool(interleave(await retry(() => store.knownProgramSources(Math.min(limit, 1000)))), parallel, deadline, one);
  } else {
    // Batches of 1000, oldest due first; a checked page moves to tomorrow, so the next batch starts after the last one seen.
    let after: string | undefined;
    let taken = 0;
    while (taken < limit && Date.now() < deadline) {
      const batch = await retry(() => store.dueProgramSources(1000, after));
      if (!batch.length) break;
      after = batch.at(-1)!.next_check_at;
      // Near the database limit: keep known programs up to date, but don't read new pages.
      const full = await retry(() => databaseFull());
      const mine = batch.filter((s) => shardOf(s.university ?? s.url, shards) === shard && (!full || s.entity_slug)).slice(0, limit - taken);
      taken += mine.length;
      await pool(interleave(mine), parallel, deadline, one);
    }
    if (Date.now() >= deadline) log("Time budget used up; the rest are first in line tomorrow.");
  }
  const mb = await store.databaseMB();
  await store.finishRun(run, { ...stats, notes: mb === null ? undefined : `database ${mb} MB` });
  log(`Done: ${stats.pages_checked} pages, ${stats.pages_changed} changed, ${stats.changes_applied} values applied, ${stats.changes_held} held, ${stats.errors} errors`);
}

async function discoverOne(slug: string): Promise<number> {
  const uni = await store.universityContext(slug);
  if (!uni) throw new Error(`No university ${slug}`);
  log(`Looking for program pages on ${uni.website}`);
  const { programs, method, fetched } = await discoverPrograms(uni.website, { maxPages: Number(flag("pages", "400")), maxMinutes: Number(flag("uni-minutes", "40")) });
  // Nothing readable past the home page: the site blocked the robot (403) or is down. That is a failure
  // (retried in a few days), not "this university has no programs".
  if (!programs.length && method === "crawl" && fetched <= 2) throw new Error("website blocked the robot or did not answer");
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
/** Best-ranked first. --minutes stops taking new universities after that long (each one takes at most 40 minutes). */
/**
 * Searches universities for program pages: never-searched ones first (best ranked first), then each
 * one again every 30 days to catch new programs. --shard i/n splits the work between jobs.
 * --minutes stops taking new universities after that long (each one takes at most 40 minutes).
 */
async function discoverAll() {
  const limit = Number(flag("limit", "20"));
  const parallel = Number(flag("parallel", "10"));
  const minutes = Number(flag("minutes", "0"));
  const deadline = minutes > 0 ? Date.now() + minutes * 60_000 : Infinity;
  const [shard, shards] = (flag("shard", "0/1") ?? "0/1").split("/").map(Number) as [number, number];
  log(`Searching up to ${limit} universities, ${parallel} at a time${minutes ? `, for ${minutes} minutes` : ""}${shards > 1 ? `, shard ${shard}/${shards}` : ""}`);
  let total = 0;
  let searched = 0;
  let offset = 0; // rows ahead of ours that stay in the list (other shards' turn)
  const tried = new Set<string>();
  while (searched < limit && Date.now() < deadline) {
    if (await retry(() => databaseFull())) break;
    const batch = await retry(() => store.undiscoveredUniversities(1000, offset));
    if (!batch.length) break;
    const mine = batch.filter((s) => shardOf(s, shards) === shard && !tried.has(s)).slice(0, limit - searched);
    offset += batch.filter((s) => shardOf(s, shards) !== shard || tried.has(s)).length;
    if (!mine.length) {
      if (batch.length < 1000) break;
      continue;
    }
    for (const s of mine) tried.add(s);
    searched += mine.length;
    await pool(mine, parallel, deadline, async (slug) => {
      try {
        total += await discoverOne(slug);
      } catch (e) {
        log(`  ${slug}: ${e instanceof Error ? e.message : String(e)}`);
        await store.markDiscoveryFailed(slug).catch(() => {});
      }
    });
  }
  log(`${total} program pages added. They'll be read on the next check.`);
}

/**
 * Keeps the list growing: when fewer than --when-below universities wait for their first search,
 * adds the next --step universities by rank (OpenAlex), so discovery never runs out of work.
 */
async function grow() {
  const step = Number(flag("step", "500"));
  const below = Number(flag("when-below", "500"));
  if (await databaseFull()) return;
  const waiting = await store.neverSearchedCount();
  if (waiting >= below) {
    log(`${waiting} universities still wait for their first search; adding more once that drops below ${below}.`);
    return;
  }
  const ranked = await store.rankedCount();
  log(`Only ${waiting} wait for a first search: growing the ranked list from ${ranked} to ${ranked + step}`);
  await seedTop({ total: ranked + step, floor: Number(flag("floor", "50")), fresh: false, dry: false });
}

async function add() {
  const url = rest[0];
  const university = flag("university");
  if (!url || !university) throw new Error("Usage: npm run robot -- add <url> --university <slug>");
  await store.addSource({ url, kind: "program_page", university, status: "discovered" });
  log("Added. It will be read on the next check.");
}

/** Programs from official government course lists, for universities whose websites block the robot (official-data.ts). */
async function official() {
  const country = rest[0];
  if (country !== "au" && country !== "us" && country !== "uk") throw new Error("Usage: npm run robot -- official <au|us|uk> [--file <zip or folder>] [--university <slug>] [--all] [--dry]");
  await importOfficial(country, { file: flag("file"), university: flag("university"), all: rest.includes("--all"), dry: rest.includes("--dry"), parallel: Number(flag("parallel", "8")), log });
}

const commands: Record<string, () => Promise<void>> = {
  check,
  official,
  discover,
  "discover-all": discoverAll,
  grow,
  add,
  seed: () => seedCountry(rest[0] ?? "", Number(flag("limit", "30"))),
  "seed-top": () => seedTop({ total: Number(flag("total", "5000")), floor: Number(flag("floor", "50")), fresh: rest.includes("--fresh"), dry: rest.includes("--dry") }),
};
// GitHub turns output lines starting with "::error" / "::warning" into notes on the run page that anyone can
// read without signing in, so a stopped job always says why.
function oneLine(e: unknown): string {
  const text = e instanceof Error ? `${e.message} | ${(e.stack ?? "").split("\n").slice(1, 4).join(" ")}` : String(e);
  return text.replace(/\s+/g, " ").slice(0, 900);
}
// A stray failed request from some website (a promise nobody waited for) must not end a 5-hour job.
process.on("unhandledRejection", (e) => {
  log(`Ignored an error nobody was waiting for: ${oneLine(e)}`);
  if (process.env.GITHUB_ACTIONS) console.log(`::warning title=Robot kept going after an error::${oneLine(e)}`);
});

const run = command ? commands[command] : undefined;
if (!run) {
  console.log("Commands: seed, seed-top, discover, discover-all, grow, add, check, official. See robot/README.md.");
  process.exitCode = 1;
} else {
  try {
    await run();
  } catch (e) {
    console.error(e);
    if (process.env.GITHUB_ACTIONS) console.log(`::error title=Robot stopped::${oneLine(e)}`);
    process.exitCode = 1;
  }
}
