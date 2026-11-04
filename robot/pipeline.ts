// Reads one program: fetches its page plus a few linked pages (fees, deadlines, requirements),
// reads the facts with the rules in rules.ts, and throws out any fact whose quote isn't on those pages
// (a safety net against rule bugs). No AI and no outside service involved.

import { cleanUrl, contentHash, extractLinks, htmlToText, pageMeta, type PageLink, type PageMeta } from "./clean.ts";
import { verifyFacts, type Dropped } from "./checks.ts";
import type { ProgramFacts } from "./facts.ts";
import { politeFetch, RobotsDisallowed } from "./fetch.ts";
import { readFacts } from "./rules.ts";

export interface FetchedPage {
  url: string;
  status: number;
  text: string;
  hash: string;
  links: PageLink[];
  meta: PageMeta;
  etag: string | null;
  lastModified: string | null;
}

const RELATED = /(fee|tuition|cost|deadline|dates|apply|application|admission|requirement|language|english|entry|eligib|bewerb|gebühr|zulassung|tasse|ammission)/i;

export type FetchOutcome = { page: FetchedPage } | { page: null; status: number | null; reason: string };

/** Fetches and cleans a page, saying why when there's nothing to read. */
export async function fetchPageDetailed(url: string): Promise<FetchOutcome> {
  try {
    const res = await politeFetch(url);
    if (res.status >= 400) return { page: null, status: res.status, reason: `HTTP ${res.status}` };
    if (res.kind !== "html") return { page: null, status: res.status, reason: "not an HTML page" };
    const text = htmlToText(res.body);
    const meta = pageMeta(res.body);
    // Use the page's own clean address when it gives one on the same site (drops ?cHash=… and similar).
    const canonical = cleanUrl(meta.canonical && new URL(meta.canonical).hostname === new URL(res.finalUrl).hostname ? meta.canonical : res.finalUrl);
    return {
      page: { url: canonical, status: res.status, text, hash: contentHash(text), links: extractLinks(res.body, res.finalUrl), meta, etag: res.etag, lastModified: res.lastModified },
    };
  } catch (e) {
    if (e instanceof RobotsDisallowed) return { page: null, status: null, reason: e.message };
    return { page: null, status: null, reason: e instanceof Error ? e.message : String(e) };
  }
}

export async function fetchPage(url: string): Promise<FetchedPage | null> {
  return (await fetchPageDetailed(url)).page;
}

/** Up to `max` linked pages that look like fees / deadlines / requirements pages for this program. */
export function relatedCandidates(main: FetchedPage, max = 4): string[] {
  const here = new URL(main.url);
  const scored = main.links
    .filter((l) => l.url !== main.url && RELATED.test(`${l.text} ${new URL(l.url).pathname}`) && !/\.(pdf|jpe?g|png|zip|docx?)$/i.test(l.url))
    .map((l) => {
      const path = new URL(l.url).pathname;
      // Prefer pages under the program's own path, then links whose text names fees or deadlines.
      const shared = here.pathname.split("/").filter((seg, i) => seg && path.split("/")[i] === seg).length;
      return { url: l.url, score: shared * 2 + (/(fee|tuition|deadline|application|dates)/i.test(l.text) ? 3 : 0) };
    })
    .sort((a, b) => b.score - a.score);
  return [...new Set(scored.map((s) => s.url))].slice(0, max);
}

export interface ProgramRead {
  /** What the rules found, before the safety net. */
  raw: ProgramFacts;
  /** Only facts whose quote really is on the pages. */
  facts: ProgramFacts;
  dropped: Dropped[];
  pages: FetchedPage[];
}

/** Switches to the page's English version when it lists one and isn't English itself. */
export async function preferEnglish(page: FetchedPage): Promise<FetchedPage> {
  if (page.meta.lang === "en" || !page.meta.english || page.meta.english === page.url) return page;
  return (await fetchPage(page.meta.english)) ?? page;
}

/** Fetches the program page (English version if there is one) and a few likely related pages, then reads them. */
export async function readProgram(mainUrl: string, today: string): Promise<ProgramRead | null> {
  const first = await fetchPage(mainUrl);
  if (!first) return null;
  const main = await preferEnglish(first);
  const pages = [main];
  for (const url of relatedCandidates(main)) {
    const p = await fetchPage(url);
    if (p && p.text.length > 200) pages.push(p);
  }
  return readPages(pages, today);
}

/** Reads already-fetched pages (the first is the program page). */
export function readPages(pages: FetchedPage[], today: string): ProgramRead {
  const raw = readFacts(pages.map((p) => ({ url: p.url, text: p.text, meta: p.meta })), today);
  const { facts, dropped } = verifyFacts(raw, pages.map((p) => p.text));
  return { raw, facts, dropped, pages };
}
