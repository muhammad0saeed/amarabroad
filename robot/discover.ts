// Finds a university's program pages with no AI and no outside service:
// 1. Sitemap: if the site lists its program pages there (like TU Munich), take the ones shaped like programs.
// 2. Focused crawl: start at the homepage, follow the most promising links first ("study", "programmes",
//    "master's", English pages…) within the university's own domain and subdomains, and read every page with
//    the same rules as the daily check. A page counts as a program page only if it names a degree AND states
//    program facts (length, credits, fees, deadlines, language), so a staff page that says "MA" doesn't.

import { extractLinks, htmlToText, pageMeta, registrable, sitemapUrls } from "./clean.ts";
import { politeFetch, USER_AGENT } from "./fetch.ts";
import { readFacts } from "./rules.ts";

const NOT_PROGRAM = /(news|event|press|blog|job|vacanc|career-service|staff|people|person|team|profile|research-?(project|group)|publication|calendar|library|alumni|login|intranet|shop|gallery|video|podcast|\.(pdf|jpe?g|png|gif|svg|docx?|xlsx?|zip|mp4)$)/i;
/** Things that aren't full degrees: PhDs, single modules, certificates, summer schools, exchange semesters. */
const NOT_A_DEGREE = /(phd|doctor|doktor|promotion|dottorato|modulstudium|sonstiges|module-studies|zertifikat|certificate-program|summer-?school|winter-?school|exchange|erasmus|continuing-education|weiterbildung|short-course|junior|schüler|pupils)/i;
/** Level words in a URL slug (whole words, so "dr-jianije-ma" doesn't count). */
const DEGREE_SLUG = /(^|[-_/])(master|masters|bachelor|bachelors|msc|m-sc|bsc|b-sc|mba|meng|beng|llm|laurea|magistrale|triennale|mesterkepzes|alapkepzes)([-_/]|$)/i;
/** Overview pages, not single programs. */
const LISTING = /^(degree-?programs?|degree-?programmes?|programmes?|programs?|study-?programs?|studies|courses?|master|masters|bachelor|bachelors|studienangebot|studiengaenge|corsi(-di-laurea)?|overview|all|search)$/i;
/** Links worth following first. */
const PROMISING = /(stud(y|ies|ium|iare|ying)|program|degree|course|corsi|laurea|master|bachelor|msc|bsc|admission|apply|international|prospective|future-students|english-taught|taught-in-english|képzés|studiengang|studienangebot|\/en\/|\/en$|english)/i;
const UNPROMISING = /(research|forschung|ricerca|kutatás|about|ueber|chi-siamo|contact|kontakt|press|media|library|news|event|staff|jobs|career|alumni|donate|shop)/i;

async function body(url: string, accept?: string): Promise<{ html: string; finalUrl: string } | null> {
  try {
    const res = await politeFetch(url, {}, accept);
    return res.status < 400 && res.body ? { html: res.body, finalUrl: res.finalUrl } : null;
  } catch {
    return null;
  }
}

function lastSegment(url: string): string {
  return new URL(url).pathname.split("/").filter(Boolean).at(-1) ?? "";
}

/** URL-only guess at "one degree program's page" (used on sitemap URLs, which we haven't fetched). */
export function looksLikeProgramUrl(url: string, text = ""): boolean {
  const u = new URL(url);
  const slug = lastSegment(url);
  const path = u.pathname.toLowerCase();
  if (!slug || LISTING.test(slug) || NOT_A_DEGREE.test(path) || NOT_A_DEGREE.test(text) || NOT_PROGRAM.test(path)) return false;
  if (slug.split(/[-_]/).filter(Boolean).length < 2) return false;
  return DEGREE_SLUG.test(slug) || /\/(detail|details)\//.test(path);
}

function levelOf(text: string): "master" | "bachelor" | null {
  return /master|msc|m-sc|mba|meng|llm|magistrale|mester/i.test(text) ? "master" : /bachelor|bsc|b-sc|beng|triennale|alapk/i.test(text) ? "bachelor" : null;
}

/** Sitemap URLs shaped like program pages. */
export async function sitemapPrograms(website: string, max = 3000): Promise<string[]> {
  const origin = new URL(website).origin;
  const robots = await fetch(`${origin}/robots.txt`, { headers: { "User-Agent": USER_AGENT } })
    .then((r) => (r.ok ? r.text() : ""))
    .catch(() => "");
  const sitemaps = [...robots.matchAll(/^sitemap:\s*(\S+)/gim)].map((m) => m[1]!);
  if (!sitemaps.length) sitemaps.push(`${origin}/sitemap.xml`);
  const xmlAccept = "application/xml,text/xml;q=0.9,*/*;q=0.5";
  const found = new Set<string>();
  const queue = sitemaps.slice(0, 3);
  let read = 0;
  while (queue.length && read < 12) {
    const sm = queue.shift()!;
    read++;
    const xml = (await body(sm, xmlAccept))?.html;
    if (!xml) continue;
    const urls = sitemapUrls(xml);
    if (/<sitemapindex/i.test(xml)) {
      // Sub-sitemaps that sound like study pages first; skip news/event archives.
      queue.push(...urls.filter((u) => !/(news|event|press|blog|person|people)/i.test(u)).sort((a, b) => Number(/(course|program|stud|degree)/i.test(b)) - Number(/(course|program|stud|degree)/i.test(a))));
      continue;
    }
    for (const u of urls) if (looksLikeProgramUrl(u)) found.add(u);
    if (found.size >= max) break;
  }
  return [...found].slice(0, max);
}

export interface FoundProgram {
  url: string;
  title: string | null;
  level: "master" | "bachelor" | null;
}

/**
 * Best-first crawl of a university website for program pages, confirmed by their content.
 * Stops after `maxPages` fetched pages or `maxMinutes`.
 */
export async function crawlForPrograms(
  website: string,
  { maxPages = 400, maxMinutes = 40, today = new Date().toISOString().slice(0, 10), seeds = [] as string[] } = {},
): Promise<{ programs: FoundProgram[]; fetched: number }> {
  const site = registrable(new URL(website).hostname);
  const seen = new Set<string>();
  const frontier: { url: string; score: number; depth: number }[] = [];
  const push = (url: string, text: string, depth: number, bonus = 0) => {
    let u: URL;
    try {
      u = new URL(url);
    } catch {
      return;
    }
    if (registrable(u.hostname) !== site || u.search.length > 60) return;
    u.hash = "";
    const key = u.toString().replace(/\/$/, "");
    if (seen.has(key) || NOT_PROGRAM.test(u.pathname)) return;
    seen.add(key);
    const hay = `${u.hostname} ${u.pathname} ${text}`;
    const score = bonus + (PROMISING.test(hay) ? 5 : 0) + (DEGREE_SLUG.test(u.pathname) ? 4 : 0) + (/\/en(\/|$)|english/i.test(hay) ? 2 : 0) - (UNPROMISING.test(hay) ? 6 : 0) - depth;
    frontier.push({ url: u.toString(), score, depth });
  };
  push(website, "", 0, 10);
  push(new URL("/en/", website).toString(), "english", 0, 8);
  for (const s of seeds) push(s, "", 1, 6);

  const programs = new Map<string, FoundProgram>();
  const deadline = Date.now() + maxMinutes * 60_000;
  let fetched = 0;
  while (frontier.length && fetched < maxPages && Date.now() < deadline) {
    frontier.sort((a, b) => b.score - a.score);
    const next = frontier.shift()!;
    if (next.score < -4) break; // only unpromising pages left
    const page = await body(next.url);
    fetched++;
    if (!page || !/<html|<body/i.test(page.html)) continue;
    const meta = pageMeta(page.html);
    const text = htmlToText(page.html);
    const facts = readFacts([{ url: page.finalUrl, text, meta }], today);
    const isProgram = facts.is_program_page && !NOT_A_DEGREE.test(`${page.finalUrl} ${facts.title ?? ""}`);
    if (isProgram) {
      // Watch the English version when the page lists one.
      const url = meta.lang !== "en" && meta.english ? meta.english : page.finalUrl;
      programs.set(url.replace(/\/$/, ""), { url, title: facts.title, level: facts.degree_level?.value ?? levelOf(url) });
    }
    if (next.depth >= 5) continue;
    // Program pages rarely lead to other programs; listing pages do.
    const bonus = isProgram ? -3 : LISTING.test(lastSegment(page.finalUrl)) ? 3 : 0;
    for (const l of extractLinks(page.html, page.finalUrl)) push(l.url, l.text, next.depth + 1, bonus);
  }
  return { programs: [...programs.values()], fetched };
}

/** Sitemap first; if that finds fewer than 10 program-shaped URLs, crawl. */
export async function discoverPrograms(website: string, options: { maxPages?: number; maxMinutes?: number } = {}): Promise<{ programs: FoundProgram[]; method: "sitemap" | "crawl"; fetched: number }> {
  // Ten or more program-shaped URLs in a sitemap (TU Munich has 180) are trusted as a list; the daily
  // check still reads each one and drops pages that turn out not to be programs.
  const fromSitemap = await sitemapPrograms(website);
  if (fromSitemap.length >= 10) return { programs: fromSitemap.map((url) => ({ url, title: null, level: levelOf(url) })), method: "sitemap", fetched: 0 };
  // A few sitemap guesses aren't trusted on their own (they were thesis and project pages at Debrecen):
  // the crawl starts from them, and only pages whose content confirms them count.
  const crawl = await crawlForPrograms(website, { ...options, seeds: fromSitemap });
  return { programs: crawl.programs, method: "crawl", fetched: crawl.fetched };
}

/** Kept for tests and the sitemap path: URL-shaped program pages from a list. */
export function pickProgramPages(candidates: { url: string; text: string }[]): { url: string; level: "master" | "bachelor" | null }[] {
  const byParent = new Map<string, number>();
  const parentOf = (u: string) => u.replace(/\/[^/]*\/?$/, "");
  for (const c of candidates) byParent.set(parentOf(c.url), (byParent.get(parentOf(c.url)) ?? 0) + 1);
  return candidates
    .filter((c) => !new URL(c.url).search)
    .filter((c) => looksLikeProgramUrl(c.url, c.text) || (/\/(detail|details)\//.test(c.url) && (byParent.get(parentOf(c.url)) ?? 0) >= 3 && !LISTING.test(lastSegment(c.url)) && !NOT_A_DEGREE.test(c.url)))
    .map((c) => ({ url: c.url, level: levelOf(`${lastSegment(c.url)} ${c.text}`) }));
}
