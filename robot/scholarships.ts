// The scholarships robot: a short list of major official scholarships open to Bangladeshi students, each
// checked on its own official page for the next application deadline (rules, no AI). A scholarship shows
// on the site only with a deadline read from its page, with the sentence it came from.
//
// What each scholarship covers rarely changes and is written here by hand from the official pages
// (checked 2026-11-09); the deadline changes every year, so the robot reads it. Scholarships whose
// deadline differs per program (Erasmus Mundus, DAAD) aren't on this list: they need their own handling.

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
  url: string;
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
    coverage: { tuition: "full", stipend: null, summary_en: "A full-time postgraduate degree at the University of Cambridge: full cost of study, a maintenance allowance and flights.", summary_bn: "কেমব্রিজ বিশ্ববিদ্যালয়ে পূর্ণকালীন স্নাতকোত্তর ডিগ্রি: পড়ার পুরো খরচ, ভরণপোষণ ভাতা ও বিমান ভাড়া।" },
    eligibility_en: "Citizens of any country outside the UK applying to a full-time postgraduate course at the University of Cambridge.",
    eligibility_bn: "যুক্তরাজ্যের বাইরের যেকোনো দেশের নাগরিক, যারা কেমব্রিজ বিশ্ববিদ্যালয়ে পূর্ণকালীন স্নাতকোত্তর কোর্সে আবেদন করছেন।",
    evaluates: ["academics", "leadership", "research"],
  },
  {
    slug: "holland-scholarship",
    name: "Holland Scholarship",
    provider: "Dutch Ministry of Education and Dutch universities",
    type: "merit",
    levels: ["bachelor", "master"],
    countries: ["netherlands"],
    url: "https://www.studyinnl.org/finances/holland-scholarship",
    coverage: { tuition: "partial", stipend: null, summary_en: "€5,000 once, in the first year of a bachelor's or master's at a participating Dutch university.", summary_bn: "অংশগ্রহণকারী ডাচ বিশ্ববিদ্যালয়ে ব্যাচেলর বা মাস্টার্সের প্রথম বছরে একবার €৫,০০০।" },
    eligibility_en: "Students from outside the EEA who haven't studied in the Netherlands before; apply through the university.",
    eligibility_bn: "ইইএ-র বাইরের শিক্ষার্থী যারা আগে নেদারল্যান্ডসে পড়েননি; বিশ্ববিদ্যালয়ের মাধ্যমে আবেদন।",
    evaluates: ["academics"],
  },
];

const DEADLINE_WORDS = /(deadline|closing date|applications? (close|closes|open|opens|period|window|round)|apply (by|until|before|from)|submit (your )?application|application portal (opens|closes))/i;
const NOT_DEADLINE = /(results?|interview|announce|notif|start of (classes|course)|arrival|webinar|event)/i;
/** Last year's round ("the closing date was 20 October") isn't the next deadline. */
const PAST = /\b(was|were|closed|has closed|have closed|ended)\b/i;
/** Digits split by the page's markup ("8 -2 4 February") would be misread: skip such lines. */
const BROKEN_DIGITS = /\d\s+\d\s+(january|february|march|april|may|june|july|august|september|october|november|december)/i;

/** The next application deadline a scholarship page states, with its sentence (null when none ahead). */
export function nextDeadline(text: string, today: string): { date: string; quote: string } | null {
  const found: { date: string; quote: string }[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!DEADLINE_WORDS.test(line) || NOT_DEADLINE.test(line) || PAST.test(line) || BROKEN_DIGITS.test(line)) continue;
    // Only dates that state their year: a guessed year turned last round's dates into next year's.
    for (const hit of datesIn(line).filter((h) => h.year !== null)) {
      const date = resolveYear(hit, today);
      const days = (Date.parse(date) - Date.parse(today)) / 86_400_000;
      // Ahead, and within about 15 months (further dates are usually next cycles or typos).
      if (days >= 0 && days <= 460) found.push({ date, quote: line.slice(0, 300) });
    }
  }
  // The latest date in the same sentence is usually the closing date ("opens 5 August, closes 7 October").
  found.sort((a, b) => (a.date < b.date ? -1 : 1));
  if (!found.length) return null;
  const sameSentence = found.filter((f) => f.quote === found[0]!.quote);
  return sameSentence.at(-1)!;
}

/** Checks every scholarship's official page; publishes the ones with a deadline ahead. */
export async function checkScholarships(log: (line: string) => void, today = new Date().toISOString().slice(0, 10)) {
  for (const s of SCHOLARSHIPS) {
    const page = await fetchPage(s.url);
    const deadline = page ? nextDeadline(page.text, today) : null;
    const row = {
      slug: s.slug, name: s.name, provider: s.provider, type: s.type, bd_eligible: true, levels: s.levels,
      coverage: { tuition: s.coverage.tuition, stipend: s.coverage.stipend, summary_en: s.coverage.summary_en, summary_bn: s.coverage.summary_bn },
      eligibility_summary_en: s.eligibility_en, eligibility_summary_bn: s.eligibility_bn, evaluates: s.evaluates,
      official_url: s.url, countries: s.countries, source_url: page?.url ?? s.url, is_sample: false, origin: "robot",
      ...(deadline ? { deadline: deadline.date, last_verified: today, published: true } : { published: false }),
    };
    const { error } = await db().from("scholarships").upsert(row, { onConflict: "slug" });
    if (error) {
      log(`  ${s.slug}: ${error.message}`);
      continue;
    }
    if (deadline) {
      await db().from("field_changes").insert({
        entity_type: "scholarship", entity_slug: s.slug, field: "deadline", old_value: null, new_value: deadline.date,
        evidence: deadline.quote, source_url: page!.url, extraction: null, status: "applied", decided_by: "robot", decided_at: new Date().toISOString(),
      });
    }
    log(`  ${s.slug}: ${deadline ? `deadline ${deadline.date} ("${deadline.quote.slice(0, 90)}")` : page ? "no deadline ahead on the page (hidden until one is announced)" : "page didn't load"}`);
  }
}
