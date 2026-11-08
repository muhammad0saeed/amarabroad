// The scholarships robot: major official scholarships open to Bangladeshi students, each checked on its
// own official pages every shift (rules, no AI). It reads where the round stands:
//   open      a deadline ahead, with the sentence it came from (or "open now" with no date)
//   closed    the page says applications are closed (plus last round's closing date, when stated)
//   varies    the deadline is set per university or per course
//   unknown   the page doesn't say (yet)
// Every scholarship is shown, with its status and its usual timeline, written by hand from the official
// pages (checked 2026-11-09), so a closed or not-yet-announced round still tells students when to get ready.
// What each scholarship covers rarely changes and is also written here by hand.

import { db } from "./db.ts";
import { fetchPage } from "./pipeline.ts";
import { datesIn, resolveYear } from "./rules.ts";

export interface ScholarshipSeed {
  slug: string;
  name: string;
  provider: string;
  type: "merit" | "need" | "mixed";
  levels: ("bachelor" | "master")[];
  countries: string[];
  /** Where students apply / read more (shown on the site). */
  url: string;
  /** Pages the robot reads for the round's status and dates; the first is usually `url`. */
  pages: string[];
  /** The deadline is set per university or per course. */
  varies?: boolean;
  /** The usual yearly timeline, from the official pages. */
  cycle_en: string;
  cycle_bn: string;
  coverage: { tuition: "full" | "partial" | "none"; stipend: { amount: number; currency: string; per: "month" | "year" } | null; summary_en: string; summary_bn: string };
  eligibility_en: string;
  eligibility_bn: string;
  evaluates: string[];
}

export const SCHOLARSHIPS: ScholarshipSeed[] = [
  {
    slug: "chevening-scholarships",
    name: "Chevening Scholarships",
    provider: "UK government (FCDO)",
    type: "merit",
    levels: ["master"],
    countries: ["united-kingdom"],
    url: "https://www.chevening.org/scholarships/",
    pages: ["https://www.chevening.org/apply/application-timeline/", "https://www.chevening.org/apply/"],
    cycle_en: "Usually opens in early August and closes in early October, for courses starting the next September.",
    cycle_bn: "সাধারণত আগস্টের শুরুতে খোলে এবং অক্টোবরের শুরুতে বন্ধ হয়, পরের সেপ্টেম্বরে শুরু হওয়া কোর্সের জন্য।",
    coverage: { tuition: "full", stipend: null, summary_en: "A one-year master's in the UK: tuition, a monthly living allowance, return flights and visa costs.", summary_bn: "যুক্তরাজ্যে এক বছরের মাস্টার্স: টিউশন, মাসিক জীবনযাত্রা ভাতা, যাওয়া-আসার বিমান ভাড়া ও ভিসা খরচ।" },
    eligibility_en: "Citizens of Chevening countries (Bangladesh included) with an undergraduate degree and at least two years (2,800 hours) of work experience, who return home for two years after the course.",
    eligibility_bn: "শেভেনিং দেশের নাগরিক (বাংলাদেশসহ), স্নাতক ডিগ্রি ও অন্তত দুই বছরের (২,৮০০ ঘণ্টা) কাজের অভিজ্ঞতা, এবং কোর্স শেষে দুই বছর দেশে ফেরার শর্ত।",
    evaluates: ["leadership", "experience", "academics"],
  },
  {
    slug: "commonwealth-masters-scholarships",
    name: "Commonwealth Master's Scholarships",
    provider: "Commonwealth Scholarship Commission in the UK",
    type: "mixed",
    levels: ["master"],
    countries: ["united-kingdom"],
    url: "https://cscuk.fcdo.gov.uk/scholarships/commonwealth-masters-scholarships/",
    pages: ["https://cscuk.fcdo.gov.uk/scholarships/commonwealth-masters-scholarships/"],
    cycle_en: "Usually opens in September and closes in mid-October. Your national nominating agency may set an earlier closing date.",
    cycle_bn: "সাধারণত সেপ্টেম্বরে খোলে এবং অক্টোবরের মাঝামাঝি বন্ধ হয়। জাতীয় মনোনয়ন সংস্থা আরও আগের শেষ তারিখ দিতে পারে।",
    coverage: { tuition: "full", stipend: null, summary_en: "A master's in the UK for development-related subjects: tuition, return flights and a monthly living allowance.", summary_bn: "উন্নয়ন-সংশ্লিষ্ট বিষয়ে যুক্তরাজ্যে মাস্টার্স: টিউশন, যাওয়া-আসার বিমান ভাড়া ও মাসিক জীবনযাত্রা ভাতা।" },
    eligibility_en: "Citizens of eligible Commonwealth countries (Bangladesh included) who couldn't afford UK study otherwise; applications go through the national nominating agency.",
    eligibility_bn: "যোগ্য কমনওয়েলথ দেশের নাগরিক (বাংলাদেশসহ), যাদের পক্ষে অন্যভাবে যুক্তরাজ্যে পড়া সম্ভব নয়; আবেদন জাতীয় মনোনয়ন সংস্থার মাধ্যমে।",
    evaluates: ["academics"],
  },
  {
    slug: "swedish-institute-scholarships-global-professionals",
    name: "Swedish Institute Scholarships for Global Professionals",
    provider: "Swedish Institute",
    type: "merit",
    levels: ["master"],
    countries: ["sweden"],
    url: "https://si.se/en/apply/scholarships/swedish-institute-scholarships-for-global-professionals/",
    pages: ["https://si.se/en/apply/scholarships/swedish-institute-scholarships-for-global-professionals/"],
    cycle_en: "Apply to Swedish master's programmes first (mid-October to mid-January), then the scholarship portal opens for about two weeks in February.",
    cycle_bn: "আগে সুইডিশ মাস্টার্স প্রোগ্রামে আবেদন করুন (অক্টোবরের মাঝামাঝি থেকে জানুয়ারির মাঝামাঝি), তারপর ফেব্রুয়ারিতে প্রায় দুই সপ্তাহের জন্য স্কলারশিপ পোর্টাল খোলে।",
    coverage: { tuition: "full", stipend: { amount: 12000, currency: "SEK", per: "month" }, summary_en: "A master's in Sweden: tuition, SEK 12,000 a month for living costs, a travel grant and insurance.", summary_bn: "সুইডেনে মাস্টার্স: টিউশন, জীবনযাত্রার জন্য মাসে SEK ১২,০০০, ভ্রমণ অনুদান ও বিমা।" },
    eligibility_en: "Citizens of eligible countries (Bangladesh included) with at least 3,000 hours of work experience and leadership experience.",
    eligibility_bn: "যোগ্য দেশের নাগরিক (বাংলাদেশসহ), অন্তত ৩,০০০ ঘণ্টা কাজের অভিজ্ঞতা ও নেতৃত্বের অভিজ্ঞতা।",
    evaluates: ["experience", "leadership"],
  },
  {
    slug: "turkiye-burslari",
    name: "Türkiye Scholarships (Türkiye Bursları)",
    provider: "Government of Türkiye",
    type: "merit",
    levels: ["bachelor", "master"],
    countries: ["turkey"],
    url: "https://www.turkiyeburslari.gov.tr/",
    pages: ["https://www.turkiyeburslari.gov.tr/"],
    cycle_en: "Usually open from 10 January to 20 February, in one round for all countries.",
    cycle_bn: "সাধারণত ১০ জানুয়ারি থেকে ২০ ফেব্রুয়ারি পর্যন্ত খোলা থাকে, সব দেশের জন্য একটি রাউন্ডে।",
    coverage: { tuition: "full", stipend: null, summary_en: "Bachelor's or master's in Türkiye: tuition, a monthly allowance, accommodation, health insurance, flights and a one-year Turkish course.", summary_bn: "তুরস্কে ব্যাচেলর বা মাস্টার্স: টিউশন, মাসিক ভাতা, থাকার ব্যবস্থা, স্বাস্থ্য বিমা, বিমান ভাড়া ও এক বছরের তুর্কি ভাষা কোর্স।" },
    eligibility_en: "Open to all countries, Bangladesh included, with grade minimums and age limits per level (see the official page).",
    eligibility_bn: "বাংলাদেশসহ সব দেশের জন্য খোলা; প্রতিটি স্তরে ন্যূনতম ফল ও বয়সসীমা আছে (অফিসিয়াল পেজ দেখুন)।",
    evaluates: ["academics"],
  },
  {
    slug: "gates-cambridge-scholarship",
    name: "Gates Cambridge Scholarship",
    provider: "Gates Cambridge Trust",
    type: "merit",
    levels: ["master"],
    countries: ["united-kingdom"],
    url: "https://www.gatescambridge.org/apply/",
    pages: ["https://www.postgraduate.study.cam.ac.uk/finance/funding"],
    cycle_en: "You apply through your Cambridge course application, by the course's funding deadline: early December or early January.",
    cycle_bn: "কেমব্রিজের কোর্সে আবেদনের সঙ্গেই আবেদন করতে হয়, কোর্সের ফান্ডিং ডেডলাইনের মধ্যে: ডিসেম্বরের শুরু বা জানুয়ারির শুরু।",
    coverage: { tuition: "full", stipend: null, summary_en: "A full-time postgraduate degree at the University of Cambridge: full cost of study, a maintenance allowance and flights.", summary_bn: "কেমব্রিজ বিশ্ববিদ্যালয়ে পূর্ণকালীন স্নাতকোত্তর ডিগ্রি: পড়ার পুরো খরচ, ভরণপোষণ ভাতা ও বিমান ভাড়া।" },
    eligibility_en: "Citizens of any country outside the UK applying to a full-time postgraduate course at the University of Cambridge.",
    eligibility_bn: "যুক্তরাজ্যের বাইরের যেকোনো দেশের নাগরিক, যারা কেমব্রিজ বিশ্ববিদ্যালয়ে পূর্ণকালীন স্নাতকোত্তর কোর্সে আবেদন করছেন।",
    evaluates: ["academics", "leadership", "research"],
  },
  {
    slug: "nl-scholarship",
    name: "NL Scholarship (formerly Holland Scholarship)",
    provider: "Dutch Ministry of Education and Dutch universities",
    type: "merit",
    levels: ["bachelor", "master"],
    countries: ["netherlands"],
    url: "https://www.studyinnl.org/finances/nl-scholarship",
    pages: ["https://www.studyinnl.org/finances/nl-scholarship"],
    varies: true,
    cycle_en: "Each participating university sets its own deadline, usually between February and May. Apply through the university.",
    cycle_bn: "প্রতিটি অংশগ্রহণকারী বিশ্ববিদ্যালয় নিজের ডেডলাইন ঠিক করে, সাধারণত ফেব্রুয়ারি থেকে মে-র মধ্যে। বিশ্ববিদ্যালয়ের মাধ্যমে আবেদন করুন।",
    coverage: { tuition: "partial", stipend: null, summary_en: "€5,000 once, in the first year of a bachelor's or master's at a participating Dutch university.", summary_bn: "অংশগ্রহণকারী ডাচ বিশ্ববিদ্যালয়ে ব্যাচেলর বা মাস্টার্সের প্রথম বছরে একবার €৫,০০০।" },
    eligibility_en: "Students from outside the EEA who haven't studied in the Netherlands before; apply through the university.",
    eligibility_bn: "ইইএ-র বাইরের শিক্ষার্থী যারা আগে নেদারল্যান্ডসে পড়েননি; বিশ্ববিদ্যালয়ের মাধ্যমে আবেদন।",
    evaluates: ["academics"],
  },
];

const DEADLINE_WORDS = /(deadline|closing date|applications? (close|closes|open|opens|period|window|round)|apply (by|until|before|from)|submit (your )?application|application portal (opens|closes))/i;
/** A line that introduces a list of deadlines ("the main funding deadlines are:"): the next lines are dates. */
const LIST_INTRO = /deadlines? (are|is)\s*:?\s*$/i;
const NOT_DEADLINE = /(results?|interview|announce|notif|start of (classes|course)|arrival|webinar|event|us citizen|offer deadline)/i;
/** Last year's round ("the closing date was 20 October") isn't the next deadline. */
const PAST = /\b(was|were|closed|has closed|have closed|ended)\b/i;
/** Digits split by the page's markup ("8 -2 4 February") would be misread: skip such lines. */
const BROKEN_DIGITS = /\d\s+\d\s+(january|february|march|april|may|june|july|august|september|october|november|december)/i;
const CLOSED = /(applications? (are|is) (now )?closed|(now|currently) closed|closed for applications|applications? (has|have) closed)/i;
const OPEN_NOW = /((application|applications|application period|portal)( for [^.]{0,60})? (is|are) (now |currently )?open\b|now open for applications)/i;
const LAST_CLOSING = /(closing date|deadline)[^.]{0,60}\b(was|were|closed)\b/i;

/** The next application deadline a scholarship page states, with its sentence (null when none ahead). */
export function nextDeadline(text: string, today: string): { date: string; quote: string } | null {
  const found: { date: string; quote: string }[] = [];
  let listLeft = 0;
  let intro = "";
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue; // Blank lines between a list's intro and its items.
    const inList = listLeft > 0 && /^[•\-*]/.test(line);
    if (LIST_INTRO.test(line) && !NOT_DEADLINE.test(line)) {
      listLeft = 4;
      intro = line;
    } else listLeft = inList ? listLeft - 1 : 0;
    if ((!DEADLINE_WORDS.test(line) && !inList) || NOT_DEADLINE.test(line) || PAST.test(line) || BROKEN_DIGITS.test(line)) continue;
    // Only dates that state their year: a guessed year turned last round's dates into next year's.
    for (const hit of datesIn(line).filter((h) => h.year !== null)) {
      const date = resolveYear(hit, today);
      const days = (Date.parse(date) - Date.parse(today)) / 86_400_000;
      // Ahead, and within about 15 months (further dates are usually next cycles or typos).
      if (days >= 0 && days <= 460) found.push({ date, quote: (inList ? `${intro} ${line.replace(/^[•\-*]\s*/, "")}` : line).slice(0, 300) });
    }
  }
  // The latest date in the same sentence is usually the closing date ("opens 5 August, closes 7 October").
  found.sort((a, b) => (a.date < b.date ? -1 : 1));
  if (!found.length) return null;
  const sameSentence = found.filter((f) => f.quote === found[0]!.quote);
  return sameSentence.at(-1)!;
}

/** Last round's closing date ("The closing date for applications was 20 October"): the latest such date in the past year. */
export function lastClosing(text: string, today: string): string | null {
  let best: string | null = null;
  for (const raw of text.split("\n")) {
    if (!LAST_CLOSING.test(raw) || BROKEN_DIGITS.test(raw)) continue;
    for (const hit of datesIn(raw)) {
      // Without a year, the most recent past date with that day and month.
      const y = Number(today.slice(0, 4));
      const iso = (yr: number) => `${yr}-${String(hit.month).padStart(2, "0")}-${String(hit.day).padStart(2, "0")}`;
      const date = hit.year ? iso(hit.year) : iso(y) <= today ? iso(y) : iso(y - 1);
      const days = (Date.parse(today) - Date.parse(date)) / 86_400_000;
      if (days >= 0 && days <= 366 && (!best || date > best)) best = date;
    }
  }
  return best;
}

export type RoundStatus = "open" | "closed" | "varies" | "unknown";
export interface Round {
  status: RoundStatus;
  deadline: string | null;
  /** The sentence the deadline or status came from. */
  quote: string | null;
  last_deadline: string | null;
  source_url: string | null;
}

/** Where a scholarship's round stands, from its pages' texts (first page that says something wins per item). */
export function readRound(pages: { url: string; text: string }[], today: string, varies = false): Round {
  for (const p of pages) {
    const d = nextDeadline(p.text, today);
    if (d) return { status: "open", deadline: d.date, quote: d.quote, last_deadline: null, source_url: p.url };
  }
  let last: string | null = null;
  for (const p of pages) last ??= lastClosing(p.text, today);
  const lineOf = (re: RegExp) => {
    for (const p of pages) {
      const line = p.text.split("\n").find((l) => re.test(l));
      if (line) return { quote: line.trim().slice(0, 300), url: p.url };
    }
    return null;
  };
  const closed = lineOf(CLOSED);
  if (closed && !varies) return { status: "closed", deadline: null, quote: closed.quote, last_deadline: last, source_url: closed.url };
  if (varies) {
    const open = lineOf(OPEN_NOW);
    return { status: "varies", deadline: null, quote: open?.quote ?? null, last_deadline: last, source_url: open?.url ?? null };
  }
  const open = lineOf(OPEN_NOW);
  if (open) return { status: "open", deadline: null, quote: open.quote, last_deadline: last, source_url: open.url };
  return { status: "unknown", deadline: null, quote: null, last_deadline: last, source_url: null };
}

/** Checks every scholarship's official pages and saves where its round stands. */
export async function checkScholarships(log: (line: string) => void, today = new Date().toISOString().slice(0, 10)) {
  for (const s of SCHOLARSHIPS) {
    const pages: { url: string; text: string }[] = [];
    for (const url of s.pages) {
      const page = await fetchPage(url);
      if (page) pages.push({ url: page.url, text: page.text });
    }
    const round = readRound(pages, today, s.varies);
    const { data: before } = await db().from("scholarships").select("deadline, round_status").eq("slug", s.slug).maybeSingle();
    const row = {
      slug: s.slug, name: s.name, provider: s.provider, type: s.type, bd_eligible: true, levels: s.levels,
      coverage: { tuition: s.coverage.tuition, stipend: s.coverage.stipend, summary_en: s.coverage.summary_en, summary_bn: s.coverage.summary_bn },
      eligibility_summary_en: s.eligibility_en, eligibility_summary_bn: s.eligibility_bn, evaluates: s.evaluates,
      official_url: s.url, countries: s.countries, is_sample: false, origin: "robot",
      cycle_en: s.cycle_en, cycle_bn: s.cycle_bn,
      round_status: round.status, deadline: round.deadline, deadline_quote: round.quote, last_deadline: round.last_deadline,
      source_url: round.source_url ?? s.pages[0] ?? s.url,
      last_verified: pages.length ? today : null,
      // Shown once one of its pages has been read.
      published: pages.length > 0,
    };
    if (!pages.length && before) {
      log(`  ${s.slug}: pages didn't load; kept what was read before`);
      continue;
    }
    const { error } = await db().from("scholarships").upsert(row, { onConflict: "slug" });
    if (error) {
      log(`  ${s.slug}: ${error.message}`);
      continue;
    }
    const prev = before as { deadline: string | null; round_status: string | null } | null;
    if (round.deadline && prev?.deadline !== round.deadline) {
      await db().from("field_changes").insert({
        entity_type: "scholarship", entity_slug: s.slug, field: "deadline", old_value: prev?.deadline ?? null, new_value: round.deadline,
        evidence: round.quote, source_url: round.source_url, extraction: null, status: "applied", decided_by: "robot", decided_at: new Date().toISOString(),
      });
    }
    const said = round.quote ? ` ("${round.quote.slice(0, 90)}")` : "";
    log(`  ${s.slug}: ${round.status}${round.deadline ? ` until ${round.deadline}` : ""}${round.last_deadline ? `, last round closed ${round.last_deadline}` : ""}${said}${pages.length < s.pages.length ? ` (${s.pages.length - pages.length} page(s) didn't load)` : ""}`);
  }
}
