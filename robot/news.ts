// The news robot: headlines about student visas, universities and scholarships, from official and
// education-news feeds (RSS/Atom), every shift. Rules, no AI. Only the headline and link are kept, so
// students read the article on its own site. Removal rules (Said, 2026-11-08):
//   the headline states a deadline       -> removed after that date
//   guides, tips, "no deadline" items     -> kept
//   other news                            -> removed 4 months after it was published
//   links that stop working               -> removed
// (supabase/15_news.sql)

import { db } from "./db.ts";
import { politeFetch } from "./fetch.ts";
import { datesIn, resolveYear } from "./rules.ts";

export interface Feed {
  name: string;
  url: string;
  /** A government or official body (shown with a badge). */
  official: boolean;
  /** Only for this country (official national feeds). */
  country?: string;
}

export const FEEDS: Feed[] = [
  { name: "GOV.UK: UK Visas and Immigration", url: "https://www.gov.uk/search/news-and-communications.atom?organisations%5B%5D=uk-visas-and-immigration", official: true, country: "united-kingdom" },
  { name: "Nuffic (Dutch organisation for international education)", url: "https://www.nuffic.nl/en/rss.xml", official: true, country: "netherlands" },
  { name: "ICEF Monitor", url: "https://monitor.icef.com/feed/", official: false },
  { name: "The PIE News", url: "https://thepienews.com/feed/", official: false },
];

/** Time-bound news stays this long after it was published. */
export const NEWS_DAYS = 120;
/** Links are re-checked this often; a dead one is removed. */
const RECHECK_DAYS = 7;

export interface FeedItem {
  title: string;
  url: string;
  published: string | null;
  summary: string;
}

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tag = (xml: string, name: string) => xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"))?.[1] ?? "";

/** Items of an RSS or Atom feed (title, link, date, short description). */
export function parseFeed(xml: string): FeedItem[] {
  const items: FeedItem[] = [];
  for (const m of xml.matchAll(/<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi)) {
    const body = m[2]!;
    const title = decode(tag(body, "title"));
    // RSS: <link>url</link>; Atom: <link href="url" rel="alternate"/>.
    const link = decode(tag(body, "link")) || body.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"/i)?.[1] || body.match(/<link[^>]*href="([^"]+)"/i)?.[1] || "";
    const date = decode(tag(body, "pubDate") || tag(body, "published") || tag(body, "updated") || tag(body, "dc:date"));
    const parsed = date ? new Date(date) : null;
    // Descriptions are often HTML encoded inside the XML: decode twice.
    const summary = decode(decode(tag(body, "description") || tag(body, "summary"))).slice(0, 600);
    if (title && /^https?:\/\//.test(link)) items.push({ title: title.slice(0, 300), url: link.replace(/&amp;/g, "&"), published: parsed && !isNaN(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : null, summary });
  }
  return items;
}

// What students care about: visas and permits, admissions and fees, scholarships, work after study.
const RELEVANT = /(student visa|study visa|study permit|student route|graduate route|post-study|post study|international students?|foreign students?|overseas students?|scholarship|tuition|university admission|admissions?|visa (fee|rule|change|cap|polic)|work permit|work rights|part-time work|skilled worker|english (test|language requirement)|ielts|toefl|enrol?ment cap|student numbers|study abroad|bangladesh)/i;
// Business-of-recruitment stories (agents, marketing, sector finance) and asylum news aren't for students.
const NOT_FOR_STUDENTS = /(agent survey|recruiters?\b|recruitment (agenc|partner|strateg)|market intelligence|webinar|podcast|sponsored|tne strategy|transnational education|edtech|investor|joins? forces|partners? with|partnership|acquires|acquisition|appoints?\b|appointed|asylum|refugee|small boats|deport|removals?\b|murder|sentence)/i;

export const TOPICS: Record<string, RegExp> = {
  visa: /(visa|permit|immigration|route|border|biometric)/i,
  scholarship: /(scholarship|bursar|grant|funding|stipend)/i,
  university: /(universit|college|admission|enrol|campus|degree|course|programme|program)/i,
  work: /(work|job|employ|graduate route|post-study|skilled)/i,
  cost: /(tuition|fee|cost|living|rent|financial|funds)/i,
};

const COUNTRY_WORDS: Record<string, RegExp> = {
  australia: /\baustralia/i, austria: /\baustria/i, belgium: /\bbelgi/i, canada: /\bcanad/i, china: /\bchin(a|ese)\b/i, cyprus: /\bcypr/i,
  "czech-republic": /\b(czech|czechia)\b/i, denmark: /\b(denmark|danish)\b/i, estonia: /\beston/i, finland: /\b(finland|finnish)\b/i, france: /\b(france|french)\b/i,
  germany: /\b(germany|german)\b/i, hungary: /\bhungar/i, ireland: /\b(ireland|irish)\b/i, italy: /\b(italy|italian)\b/i, japan: /\bjapan/i,
  latvia: /\blatvia/i, lithuania: /\blithuania/i, malaysia: /\bmalaysia/i, malta: /\bmalt(a|ese)\b/i, netherlands: /\b(netherlands|dutch|holland)\b/i,
  norway: /\b(norway|norwegian)\b/i, poland: /\b(poland|polish)\b/i, portugal: /\bportug/i, "south-korea": /\b(south korea|korea|korean)\b/i,
  spain: /\b(spain|spanish)\b/i, sweden: /\b(sweden|swedish)\b/i, turkey: /\b(turkey|türkiye|turkiye|turkish)\b/i,
  "united-kingdom": /\b(UK|U\.K\.|Britain|British|England|Scotland|Wales|Home Office)\b/,
  // Case matters: "us" is also a plain word, and "Latin America" isn't the US.
  "united-states": /\b(US|U\.S\.|USA|United States|American (universit|college|student)\w*|F-1)\b/,
};

export function countriesIn(text: string): string[] {
  return Object.entries(COUNTRY_WORDS)
    .filter(([, re]) => re.test(text))
    .map(([slug]) => slug);
}

export function isForStudents(item: Pick<FeedItem, "title" | "summary">): boolean {
  const text = `${item.title} ${item.summary}`;
  return RELEVANT.test(text) && !NOT_FOR_STUDENTS.test(item.title);
}

const EVERGREEN = /(^why (study|pursue|choose)\b|\bguide\b|how to\b|\btips\b|explained|what you need to know|step[- ]by[- ]step|checklist|faq|everything you need)/i;
const NO_DEADLINE = /(no deadline|apply (any ?time|all year|year-round)|rolling (basis|admissions?|applications?)|open all year)/i;
const DEADLINE_WORDS = /(deadline|apply (by|before|until)|closes? on|closing date|applications? (close|due|open until)|open until)/i;

export interface Classified {
  kind: "news" | "deadline" | "evergreen" | "open";
  deadline: string | null;
  expires_on: string | null;
}

const addDays = (iso: string, days: number) => new Date(Date.parse(iso) + days * 86_400_000).toISOString().slice(0, 10);

/** Which removal rule applies to a headline. */
export function classify(item: Pick<FeedItem, "title" | "summary">, published: string, today: string): Classified {
  const text = `${item.title}. ${item.summary}`;
  // A deadline the headline or its summary states, in a sentence about a deadline, still ahead (or recent).
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    if (!DEADLINE_WORDS.test(sentence)) continue;
    const dates = datesIn(sentence)
      .map((h) => (h.year ? resolveYear(h, today) : resolveYear(h, published)))
      .filter((d) => d >= published && d <= addDays(published, 400));
    if (dates.length) {
      const deadline = dates.sort().at(-1)!;
      return { kind: "deadline", deadline, expires_on: addDays(deadline, 1) };
    }
  }
  if (NO_DEADLINE.test(text)) return { kind: "open", deadline: null, expires_on: null };
  if (EVERGREEN.test(item.title)) return { kind: "evergreen", deadline: null, expires_on: null };
  return { kind: "news", deadline: null, expires_on: addDays(published, NEWS_DAYS) };
}

/** Reads the feeds, adds new student-relevant headlines, removes expired and dead ones. */
export async function checkNews(log: (line: string) => void, today = new Date().toISOString().slice(0, 10)) {
  let added = 0;
  for (const feed of FEEDS) {
    let items: FeedItem[] = [];
    try {
      const res = await politeFetch(feed.url, {}, "application/rss+xml,application/atom+xml,application/xml;q=0.9,text/xml;q=0.8");
      if (res.status >= 400 || !res.body) {
        log(`  ${feed.name}: feed returned ${res.status}`);
        continue;
      }
      items = parseFeed(res.body);
    } catch (e) {
      log(`  ${feed.name}: ${String(e).slice(0, 120)}`);
      continue;
    }
    const rows = items
      .filter((i) => isForStudents(i))
      .map((i) => {
        const published = i.published && i.published <= today ? i.published : today;
        const c = classify(i, published, today);
        const countries = [...new Set([...(feed.country ? [feed.country] : []), ...countriesIn(`${i.title} ${i.summary}`)])];
        const topics = Object.entries(TOPICS).filter(([, re]) => re.test(`${i.title} ${i.summary}`)).map(([t]) => t);
        return { url: i.url, title: i.title, source: feed.name, official: feed.official, published_on: published, countries, topics, ...c };
      })
      // Already expired (an old item still in the feed): not added.
      .filter((r) => !r.expires_on || r.expires_on > today);
    if (rows.length) {
      const { data, error } = await db().from("news_links").upsert(rows, { onConflict: "url", ignoreDuplicates: true }).select("id");
      if (error) log(`  ${feed.name}: ${error.message}`);
      else added += data?.length ?? 0;
    }
    log(`  ${feed.name}: ${items.length} items, ${rows.length} for students`);
  }

  const { count: expired } = await db().from("news_links").delete({ count: "exact" }).lt("expires_on", today);

  // A few links re-checked each shift (oldest first); 404/410 means the article is gone.
  const { data: due } = await db().from("news_links").select("id, url").lt("checked_at", new Date(Date.now() - RECHECK_DAYS * 86_400_000).toISOString()).order("checked_at").limit(15);
  let dead = 0;
  for (const link of (due ?? []) as { id: number; url: string }[]) {
    try {
      const res = await politeFetch(link.url);
      if (res.status === 404 || res.status === 410) {
        await db().from("news_links").delete().eq("id", link.id);
        dead++;
      } else await db().from("news_links").update({ checked_at: new Date().toISOString() }).eq("id", link.id);
    } catch {
      // Unreachable for now: try again next week.
      await db().from("news_links").update({ checked_at: new Date().toISOString() }).eq("id", link.id);
    }
  }
  log(`News: ${added} new links, ${expired ?? 0} expired removed, ${dead} dead links removed.`);
}
