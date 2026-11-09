// The gap-filler: many universities state tuition, English scores, deadlines and the documents to send
// once, on general pages ("Fees for international students", "How to apply"), not on every program page.
// This finds those pages and keeps what they say, each fact with the sentence it came from, so a program
// page with a gap can show "the university's general page says …" with the link.
//
// These facts are shown separately and labelled; they are never copied into a program's own fields,
// because one general page often covers many programs and levels. Same rules, same quote check as
// program pages (rules.ts, checks.ts). No AI.

import { extractLinks, htmlToText, pageMeta, registrable, type PageLink } from "./clean.ts";
import { politeFetch } from "./fetch.ts";
import { fetchPage, readPages, type FetchedPage } from "./pipeline.ts";
import { amountsIn } from "./rules.ts";

export type InfoKind = "fees" | "deadlines" | "english" | "documents";
export type InfoField = "tuition" | "application_fee" | "english" | "deadline" | "document";

export interface InfoFact {
  field: InfoField;
  /** bachelor / master when the page is clearly about one level, otherwise null (applies to both). */
  level: "bachelor" | "master" | null;
  value: Record<string, unknown>;
  quote: string;
  source_url: string;
}

const KIND: Record<InfoKind, RegExp> = {
  fees: /(tuition|fees?\b|cost of study|study costs|studiengebühr|gebühren|tasse|tuition-fees)/i,
  deadlines: /(deadline|application (dates|period|timeline|windows?)|key dates|important dates|when to apply|bewerbungsfrist|bewerbungszeitraum|scadenz)/i,
  english: /(english (language )?(requirement|proficiency|test)|language requirement|ielts|toefl|sprachnachweis|requisiti linguistici)/i,
  documents: /(how to apply|application (documents|checklist|requirements|process|guide)|required documents|documents (required|needed)|bewerbungsunterlagen|unterlagen|documenti)/i,
};
const INTERNATIONAL = /(international|overseas|non-eu|non-eea|foreign|global|third-country|drittstaat)/i;
/** Pages that lead to the info pages: International, Admissions, How to apply. */
const HUB = /(international|admission|apply|prospective|future-students|study-with-us|studying-at|study-at|application|bewerbung|ammission)/i;
const AVOID = /(news|event|press|blog|staff|people|research|alumni|job|vacanc|login|intranet|library|shop|\.(pdf|jpe?g|png|docx?|zip)$)/i;

/** How well a link fits one kind of info page (0 = not at all). */
export function linkScore(link: Pick<PageLink, "url" | "text">, kind: InfoKind): number {
  let path: string;
  try {
    path = decodeURIComponent(new URL(link.url).pathname);
  } catch {
    return 0;
  }
  // Addresses join words with hyphens ("english-language-requirements"): read them as words.
  const hay = `${link.text} ${path} ${path.replace(/[-_/]+/g, " ")}`;
  if (AVOID.test(path) || !KIND[kind].test(hay)) return 0;
  return 5 + (INTERNATIONAL.test(hay) ? 3 : 0) + (KIND[kind].test(link.text) ? 2 : 0) - Math.max(0, path.split("/").filter(Boolean).length - 4);
}

/** bachelor / master when the page is clearly about one level. */
export function pageLevel(text: string): "bachelor" | "master" | null {
  // "graduate study" only as its own word: "Undergraduate study" is the opposite.
  const master = /(postgraduate|post-graduate|master'?s?\b|(?<![a-z])graduate (study|studies|programs?|admissions?)|msc\b|mba\b)/i.test(text);
  const bachelor = /(undergraduate|bachelor'?s?\b|bsc\b)/i.test(text);
  return master && !bachelor ? "master" : bachelor && !master ? "bachelor" : null;
}

async function page(url: string): Promise<{ html: string; finalUrl: string } | null> {
  try {
    const res = await politeFetch(url);
    return res.status < 400 && res.kind === "html" && res.body ? { html: res.body, finalUrl: res.finalUrl } : null;
  } catch {
    return null;
  }
}

/** Sitemap files that list study and admissions pages; news, events and people archives are skipped. */
const SITEMAP_SKIP = /(news|event|blog|press|people|person|staff|profile|research|publication|story|stories|media|image|video)/i;
const SITEMAP_PREFER = /(international|admission|study|apply|page|course|future)/i;

/**
 * Page addresses from the site's sitemaps (a few files, at most 8 fetches): deep pages such as
 * ".../english-language-requirements" or ".../key-dates" that no menu on the homepage links to.
 */
export async function sitemapPages(website: string, maxFiles = 8): Promise<PageLink[]> {
  const origin = new URL(website).origin;
  let robots = "";
  try {
    const r = await politeFetch(`${origin}/robots.txt`, {}, "text/plain,*/*;q=0.5");
    robots = r.status < 400 ? (r.body ?? "") : "";
  } catch {
    robots = "";
  }
  const queue = [...robots.matchAll(/^sitemap:\s*(\S+)/gim)].map((m) => m[1]!).slice(0, 3);
  if (!queue.length) queue.push(`${origin}/sitemap.xml`);
  const out: PageLink[] = [];
  for (let read = 0; queue.length && read < maxFiles; read++) {
    let xml = "";
    try {
      const r = await politeFetch(queue.shift()!, {}, "application/xml,text/xml;q=0.9,*/*;q=0.5");
      xml = r.status < 400 ? (r.body ?? "") : "";
    } catch {
      continue;
    }
    const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]!.replace(/&amp;/g, "&"));
    if (/<sitemapindex/i.test(xml)) {
      queue.push(...locs.filter((u) => !SITEMAP_SKIP.test(u)).sort((a, b) => Number(SITEMAP_PREFER.test(b)) - Number(SITEMAP_PREFER.test(a))));
      continue;
    }
    // Sitemap pages have no link text: the address is all there is to judge them by.
    for (const url of locs) out.push({ url, text: "" });
  }
  return out;
}

/**
 * The best general pages on a university's site for each kind of info (at most `perKind` each), from
 * its homepage, up to three hub pages (International, Admissions, How to apply) and its sitemap.
 */
export async function findInfoPages(website: string, perKind = 2): Promise<{ url: string; kind: InfoKind }[]> {
  const site = registrable(new URL(website).hostname);
  const home = await page(website);
  if (!home) return [];
  const meta = pageMeta(home.html);
  // An English version of the homepage leads to the English pages.
  const start = meta.lang !== "en" && meta.english ? ((await page(meta.english)) ?? home) : home;
  const links: PageLink[] = extractLinks(start.html, start.finalUrl);
  const hubs = [...new Set(links.filter((l) => HUB.test(`${l.text} ${l.url}`) && !AVOID.test(l.url)).map((l) => l.url))].slice(0, 3);
  for (const hub of hubs) {
    const h = await page(hub);
    if (h) links.push(...extractLinks(h.html, h.finalUrl));
  }
  links.push(...(await sitemapPages(start.finalUrl)));
  const sameSite = links.filter((l) => {
    try {
      return registrable(new URL(l.url).hostname) === site;
    } catch {
      return false;
    }
  });
  const picked: { url: string; kind: InfoKind }[] = [];
  const used = new Set<string>();
  for (const kind of Object.keys(KIND) as InfoKind[]) {
    const best = sameSite
      .map((l) => ({ url: l.url.replace(/#.*$/, ""), score: linkScore(l, kind) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);
    let n = 0;
    for (const b of best) {
      if (n >= perKind) break;
      if (used.has(b.url)) continue;
      used.add(b.url);
      picked.push({ url: b.url, kind });
      n++;
    }
  }
  return picked;
}

// General pages mention many amounts and dates; a fact is kept only when its sentence clearly is about
// that fact. (The program-page rules can be looser: there, the whole page is about one program.)
const TUITION_SAYS = /(tuition|study fee|programme fee|program fee|course fee|studiengebühr|tasse)/i;
const TUITION_NOT = /(application fee|per (credit|hour|unit|module|course)|\/\s*(hour|credit)|credit hour|prep(aratory)? school|deposit|housing|accommodation|insurance|late fee|payment deadline|instal+ment|semester contribution|student union|earning|income|famil(y|ies)|household|graduation|evidence|maintenance|living costs?|visa|bank|funds|award|scholarship|remission|discount|waiver|bursar)/i;
const DEADLINE_SAYS = /(deadline|closing date|apply by|apply until|applications? (close|closes|open|opens|period|window|must be (submitted|received))|submit (your )?application|application round)/i;
const DEADLINE_NOT = /(exchange (student|program|semester)|study abroad semester|payment|\bpay\b|tuition|\bfees?\b|instal+ment|semester (start|begins)|classes (start|begin)|lectures|orientation|arrival|re-?enrol|national joint application|submit (official )?(initial )?transcripts|transfer success|(taught )?in (finnish|swedish|norwegian|danish|dutch|estonian)\b)/i;
const ENGLISH_SAYS = /(minimum|at least|overall|score|band|require|proof|equivalent)/i;
/** Research degrees (PhD, MPhil) often ask for other scores. */
const ENGLISH_NOT = /(phd|doctor|mphil|research degree)/i;
const APPLICATION_FEE_NOT = /(late|graduation|transcript|re-?submission)/i;
const DOCUMENT_NOT = /(\bpay|\bfee|tuition|research|position|vacanc|\bjobs?\b|staff|teaching portfolio|career)/i;
/** Pages about other things: research jobs, exchange, PhD admissions. */
const OFF_TOPIC_PAGE = /(research|researcher|positions?|vacanc|jobs?|career|staff|exchange|erasmus|phd|doctoral|summer-school)/i;
const MIN_TUITION = 500;

/** True per kind when the page names two or more different overall IELTS scores or tuition amounts. */
export function variesOnPage(text: string): { tuition: boolean; english: boolean } {
  const ielts = new Set<number>();
  for (const m of text.matchAll(/IELTS[^\d\n]{0,40}(\d(?:\.\d)?)/gi)) {
    const n = Number(m[1]);
    if (n >= 4 && n <= 9) ielts.add(n);
  }
  const fees = new Set<number>();
  for (const line of text.split("\n")) {
    if (!TUITION_SAYS.test(line) && !/(fee|cost)/i.test(line)) continue;
    for (const a of amountsIn(line)) if (a.amount >= MIN_TUITION) fees.add(Math.round(a.amount));
  }
  return { tuition: fees.size >= 2, english: ielts.size >= 2 };
}

/** What one general page says, each fact with its sentence (only facts whose quote is really on the page and clearly about it). */
export function factsFromPage(p: FetchedPage, today: string, kind?: InfoKind): InfoFact[] {
  let path = "";
  try {
    path = new URL(p.url).pathname;
  } catch {
    return [];
  }
  if (OFF_TOPIC_PAGE.test(path)) return [];
  const f = readPages([p], today).facts;
  const pageLvl = pageLevel(`${p.url} ${p.meta.title ?? ""} ${p.meta.h1 ?? ""}`);
  const out: InfoFact[] = [];
  // The sentence's own level words ("for Bachelor's programs: 2,300 euros") beat the page's.
  const add = (field: InfoField, value: Record<string, unknown>, quote: string) =>
    out.push({ field, level: pageLevel(quote) ?? pageLvl, value, quote: quote.slice(0, 400), source_url: p.url });
  // A page listing several different fees or IELTS scores (by subject or course) has no single rule:
  // its sentences are still shown to students, but the cross-checker doesn't compare with them.
  const varies = variesOnPage(p.text);
  if (f.tuition && f.tuition.amount_per_year >= MIN_TUITION && TUITION_SAYS.test(f.tuition.quote) && !TUITION_NOT.test(f.tuition.quote)) {
    add("tuition", { amount_per_year: f.tuition.amount_per_year, currency: f.tuition.currency, applies_to: f.tuition.applies_to, ...(varies.tuition ? { varies: true } : {}) }, f.tuition.quote);
  }
  if (f.application_fee && /application fee/i.test(f.application_fee.quote) && !APPLICATION_FEE_NOT.test(f.application_fee.quote)) add("application_fee", { amount: f.application_fee.amount, currency: f.application_fee.currency }, f.application_fee.quote);
  for (const t of f.english_tests) if (ENGLISH_SAYS.test(t.quote) && !ENGLISH_NOT.test(t.quote)) add("english", { test: t.test, min_score: t.min_score, ...(varies.english ? { varies: true } : {}) }, t.quote);
  for (const i of f.intakes) {
    if (i.deadline && DEADLINE_SAYS.test(i.quote) && !DEADLINE_NOT.test(i.quote)) add("deadline", { deadline: i.deadline, start_month: i.start_month, start_year: i.start_year, for: i.deadline_for }, i.quote);
  }
  // Documents only from an application page that lists several of them (a list, not a passing mention).
  const docs = f.required_documents.filter((d) => !DOCUMENT_NOT.test(d.quote));
  const docPage = kind === "documents" || KIND.documents.test(`${path} ${p.meta.title ?? ""}`);
  if (docPage && new Set(docs.map((d) => d.key)).size >= 3) for (const d of docs) add("document", { key: d.key }, d.quote);
  return out;
}

/** Finds and reads a university's general pages. */
export async function readUniversityInfo(website: string, today: string): Promise<{ facts: InfoFact[]; pages: number }> {
  const found = await findInfoPages(website);
  const facts: InfoFact[] = [];
  const seen = new Set<string>();
  for (const { url, kind } of found) {
    const p = await fetchPage(url);
    if (!p || p.text.length < 200) continue;
    for (const fact of factsFromPage(p, today, kind)) {
      const key = `${fact.field}|${fact.level}|${JSON.stringify(fact.value)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      facts.push(fact);
    }
  }
  return { facts, pages: found.length };
}

/** For tests: plain text in, page out. */
export function pageFromHtml(url: string, html: string): FetchedPage {
  return { url, status: 200, text: htmlToText(html), hash: "", links: extractLinks(html, url), meta: pageMeta(html), etag: null, lastModified: null };
}
