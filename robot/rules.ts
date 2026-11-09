// Reads program facts off university pages with plain rules: no AI, no outside service.
// Each rule looks for a keyword ("tuition", "application period", "IELTS"…) and a value close to it
// (an amount with a currency, a date, a score), in English, German, Italian and Hungarian.
// The lines a fact was found in become its `quote`, so every value on the site can show its source.

import { cleanTitle } from "./titles.ts";
import type { PageMeta } from "./clean.ts";
import { EMPTY_FACTS, type Applies, type DocumentKey, type ProgramFacts } from "./facts.ts";

export interface RulePage {
  url: string;
  text: string;
  meta?: PageMeta;
}

// ---------------------------------------------------------------- vocabulary

const MONTHS: Record<string, number> = {};
const MONTH_NAMES = [
  ["january", "jan", "januar", "jänner", "gennaio", "január", "janvier", "enero"],
  ["february", "feb", "februar", "febbraio", "február", "février", "febrero"],
  ["march", "mar", "märz", "maerz", "marzo", "március", "mars"],
  ["april", "apr", "aprile", "április", "avril", "abril"],
  ["may", "mai", "maggio", "május", "mayo"],
  ["june", "jun", "juni", "giugno", "június", "juin", "junio"],
  ["july", "jul", "juli", "luglio", "július", "juillet", "julio"],
  ["august", "aug", "agosto", "augusztus", "août"],
  ["september", "sep", "sept", "settembre", "szeptember", "septembre", "septiembre"],
  ["october", "oct", "oktober", "okt", "ottobre", "október", "octobre", "octubre"],
  ["november", "nov", "novembre", "noviembre"],
  ["december", "dec", "dezember", "dez", "dicembre", "décembre", "diciembre"],
];
MONTH_NAMES.forEach((names, i) => names.forEach((n) => (MONTHS[n] = i + 1)));
const MONTH_RE = `(${Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|")})\\.?`;

const CURRENCIES: [RegExp, string][] = [
  [/€|eur(?:o|os)?\b/i, "EUR"],
  [/huf\b|\bft\b|forint/i, "HUF"],
  [/chf\b/i, "CHF"],
  [/£|gbp\b/i, "GBP"],
  [/sek\b/i, "SEK"],
  [/nok\b/i, "NOK"],
  [/dkk\b/i, "DKK"],
  [/pln\b|zł/i, "PLN"],
  [/czk\b|kč/i, "CZK"],
  [/usd\b|us\$|\$/i, "USD"],
];
const CUR = "€|EUR|euros?|HUF|Ft|forint|CHF|£|GBP|SEK|NOK|DKK|PLN|zł|CZK|Kč|USD|US\\$|\\$";
const NUM = "\\d{1,3}(?:[.,\\s’'\\u00a0]\\d{3})+(?:[.,]\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?";
const AMOUNT = new RegExp(`(?:(${CUR})\\s?(${NUM}))|(?:(${NUM})\\s?(${CUR})(?![a-z]))`, "gi");

const NON_EU = /(non[- ]?eu|non[- ]?eea|international (students|applicants)|third[- ]country|outside (the )?(eu|eea|european union)|non[- ]european|nicht[- ]eu|drittstaat|extra[- ]?ue|nem eu)/i;
const EU_ONLY = /\b(eu|eea|european union)\b.*\b(citizens|students|applicants|nationals)\b/i;
/** Fees for the country's own students (UK "home" fees, US in-state…): never the international fee. */
const HOME = /(\bhome (students?|fees?|applicants?)\b|\buk (students?|applicants?|fees?)\b|\b(uk|home)\/(eu|ireland|irish)\b|\bdomestic\b|\bin-state\b|\bresidents? of\b|\bscottish\b|\bnational students\b)/i;
const PER_SEMESTER = /(per|a|each|every|\/|pro|je)\s*(semester|term|half[- ]year|semestre|félév)|semester fee|semesterbeitrag|a semestre|per semestre|félévente/i;
const PER_YEAR = /(per|a|each|every|\/|pro)\s*(year|annum|academic year|jahr|anno)|annual|yearly|all'anno|annu[oa]|évente|\/év\b/i;

// ---------------------------------------------------------------- small helpers

const lineWindows = (text: string) => text.split("\n").map((l) => l.trim()).filter(Boolean);

/** Joins lines i..j into one quote, as long as it stays short enough to read. */
function quoteOf(lines: string[], i: number, j: number): string {
  const q = lines.slice(i, j + 1).join(" ");
  return q.length <= 220 ? q : lines[j]!.slice(0, 220);
}

export function parseNumber(raw: string): number {
  const s = raw.replace(/[\s’' ]/g, "");
  // "6.000" / "6,000" = thousands; "97.00" / "6,5" = decimals.
  if (/^\d{1,3}([.,]\d{3})+$/.test(s)) return Number(s.replace(/[.,]/g, ""));
  if (/^\d{1,3}([.,]\d{3})+[.,]\d{1,2}$/.test(s)) return Number(s.slice(0, -3).replace(/[.,]/g, "") + "." + s.slice(-2));
  return Number(s.replace(",", "."));
}

function currencyOf(symbol: string): string {
  return CURRENCIES.find(([re]) => re.test(symbol))?.[1] ?? "EUR";
}

interface Amount {
  amount: number;
  currency: string;
  index: number;
}
export function amountsIn(text: string): Amount[] {
  const out: Amount[] = [];
  for (const m of text.matchAll(AMOUNT)) {
    const symbol = m[1] ?? m[4] ?? "";
    const raw = m[2] ?? m[3] ?? "";
    const amount = parseNumber(raw);
    if (Number.isFinite(amount)) out.push({ amount, currency: currencyOf(symbol), index: m.index ?? 0 });
  }
  return out;
}

/** Per semester → ×2, per year → ×1; the period word nearest the amount wins. */
function yearly(amount: number, text: string, at: number): number {
  const near = (re: RegExp) => {
    let best = Infinity;
    for (const m of text.matchAll(new RegExp(re.source, "gi"))) best = Math.min(best, Math.abs((m.index ?? 0) - at));
    return best;
  };
  return near(PER_SEMESTER) < near(PER_YEAR) ? amount * 2 : amount;
}

interface DateHit {
  day: number;
  month: number;
  year: number | null;
  index: number;
}

/** Dates written as 31.05.2027, 31.05., 2027-05-31, 31 May 2027, May 31, 31. Mai, 2027. május 31. */
export function datesIn(text: string): DateHit[] {
  const hits: DateHit[] = [];
  const push = (d: number, m: number, y: string | undefined, index: number) => {
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12) hits.push({ day: d, month: m, year: y ? Number(y.length === 2 ? `20${y}` : y) : null, index });
  };
  for (const m of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) push(Number(m[3]), Number(m[2]), m[1], m.index!);
  for (const m of text.matchAll(/\b(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2}(?!\d))?/g)) push(Number(m[1]), Number(m[2]), m[3], m.index!);
  for (const m of text.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g)) push(Number(m[1]), Number(m[2]), m[3], m.index!);
  for (const m of text.matchAll(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\.?\\s+(?:of\\s+)?${MONTH_RE}(?:,?\\s+(\\d{4}))?`, "gi"))) push(Number(m[1]), MONTHS[m[2]!.toLowerCase()]!, m[3], m.index!);
  for (const m of text.matchAll(new RegExp(`\\b${MONTH_RE}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s+(\\d{4}))?`, "gi"))) push(Number(m[2]), MONTHS[m[1]!.toLowerCase()]!, m[3], m.index!);
  for (const m of text.matchAll(new RegExp(`\\b(\\d{4})\\.\\s*${MONTH_RE}\\s*(\\d{1,2})\\.`, "gi"))) push(Number(m[3]), MONTHS[m[2]!.toLowerCase()]!, m[1], m.index!);
  // Two patterns can match the same date ("2027. február 15." and "február 15"): keep the one with a year.
  hits.sort((a, b) => a.index - b.index || Number(b.year !== null) - Number(a.year !== null));
  return hits.filter((h, i) => !hits.some((o, j) => j !== i && o.day === h.day && o.month === h.month && Math.abs(o.index - h.index) < 15 && (o.year !== null && h.year === null || (o.year === h.year && j < i))));
}

const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** Gives a date without a year the next year in which it's still ahead (a week's grace). */
export function resolveYear(hit: DateHit, today: string): string {
  if (hit.year) return iso(hit.year, hit.month, hit.day);
  const y = Number(today.slice(0, 4));
  const candidate = iso(y, hit.month, hit.day);
  return Date.parse(candidate) >= Date.parse(today) - 7 * 86_400_000 ? candidate : iso(y + 1, hit.month, hit.day);
}

const WORD_NUMBERS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, ten: 10, "one and a half": 1.5 };

// ---------------------------------------------------------------- the rules

const DEGREE = {
  master: /\b(master'?s?|m\.?\s?sc\.?|msc|m\.?\s?a\.?(?=\s|$|\))|m\.?\s?eng\.?|mba|ll\.?\s?m\.?|laurea magistrale|mesterképzés|mester)\b/i,
  bachelor: /\b(bachelor'?s?|b\.?\s?sc\.?|bsc|b\.?\s?a\.?(?=\s|$|\))|b\.?\s?eng\.?|laurea triennale|alapképzés)\b/i,
};

function degreeLevel(pages: RulePage[]): ProgramFacts["degree_level"] {
  const main = pages[0]!;
  const lines = lineWindows(main.text);
  // The heading names the degree on almost every program page; fall back to early lines.
  for (const line of [main.meta?.h1 ?? "", ...lines.slice(0, 40)]) {
    if (!line || !main.text.includes(line)) continue;
    const m = DEGREE.master.test(line) ? "master" : DEGREE.bachelor.test(line) ? "bachelor" : null;
    if (m && !/(phd|doctor)/i.test(line)) return { value: m, quote: line.slice(0, 220) };
  }
  return null;
}

const DURATION = /(\d+(?:[.,]5)?|one and a half|one|two|three|four|five|six)[\s-]*(semesters?|years?|months?|terms?|jahre|semestri|anni|félév|év)\b/i;
const DURATION_KEY = /(duration|length|standard period|standard duration|regelstudienzeit|studiendauer|durata|képzési idő|period of study|program length|programme length)/i;

function duration(lines: string[]): ProgramFacts["duration_months"] {
  for (let i = 0; i < lines.length; i++) {
    if (!DURATION_KEY.test(lines[i]!)) continue;
    for (let j = i; j <= Math.min(i + 4, lines.length - 1); j++) {
      // Pages split "4" and "semesters" over lines (bullets, table cells): read the lines so far as one.
      const joined = lines.slice(i, j + 1).join(" ");
      // German "Regelstudienzeit" / "Standard Duration of Studies" is counted in semesters by law,
      // so TU Munich's bare "4 (fulltime)" means 4 semesters.
      const bare = /(standard duration|regelstudienzeit|standard period of study)/i.test(lines[i]!) ? joined.match(/(?:^|[\s•:])(\d{1,2})\s*(?:\(|$)/) : null;
      if (!joined.match(DURATION) && bare && Number(bare[1]) >= 1 && Number(bare[1]) <= 12) return { value: Number(bare[1]) * 6, quote: quoteOf(lines, i, j) };
      const m = joined.match(DURATION);
      if (!m) continue;
      const n = WORD_NUMBERS[m[1]!.toLowerCase()] ?? Number(m[1]!.replace(",", "."));
      const unit = m[2]!.toLowerCase();
      const months = /^(sem|term|félév)/.test(unit) ? n * 6 : /^(year|jahr|ann|év)/.test(unit) ? n * 12 : n;
      if (months >= 6 && months <= 72) return { value: months, quote: quoteOf(lines, i, j) };
    }
  }
  return null;
}

function ects(lines: string[]): ProgramFacts["ects_credits"] {
  for (const line of lines) {
    const m = line.match(/\b(\d{2,3})\s*(?:ects|ects[- ]credits|credit points|cfu|crediti|kredit)\b/i) ?? line.match(/\b(?:ects|credits)\s*[:\-]?\s*(\d{2,3})\b/i);
    if (m) {
      const v = Number(m[1]);
      if (v >= 60 && v <= 360 && v % 30 === 0) return { value: v, quote: line.slice(0, 220) };
    }
  }
  return null;
}

const LANGS: [RegExp, string][] = [
  [/\b(english|englisch|inglese|angol)\b/i, "en"],
  [/\b(german|deutsch|tedesco|német)\b/i, "de"],
  [/\b(italian|italiano|olasz)\b/i, "it"],
  [/\b(hungarian|ungarisch|magyar)\b/i, "hu"],
  [/\b(french|französisch|francese|français)\b/i, "fr"],
  [/\b(spanish|spanisch|spagnolo|español)\b/i, "es"],
  [/\b(dutch|niederländisch|nederlands)\b/i, "nl"],
];
const LANG_KEY = /(language of instruction|teaching language|instruction language|language of the program|taught (entirely |fully )?in|courses? (are )?(held|taught) in|unterrichtssprache|lehrsprache|lingua (di insegnamento|del corso)|oktatási nyelv|required language proficiency|study language)/i;

/** The teaching language, plus every language named (["de", "en"] for "German and English"). */
function teachingLanguages(lines: string[]): { fact: NonNullable<ProgramFacts["teaching_language"]>; all: string[] } | null {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (/english[- ]taught|taught (entirely |fully )?in english|100 ?% english/i.test(line)) return { fact: { value: "en", quote: line.slice(0, 220) }, all: ["en"] };
    if (!LANG_KEY.test(line)) continue;
    // Lists split over lines ("Required Language Proficiency / • German / • English"): read a few lines together.
    for (let j = i; j <= Math.min(i + 5, lines.length - 1); j++) {
      const window = lines.slice(i, j + 1).join(" ");
      // In the order the page names them.
      const langs = LANGS.map(([re, code]) => ({ code, at: window.search(re) }))
        .filter((x) => x.at >= 0)
        .sort((a, b) => a.at - b.at)
        .map((x) => x.code);
      // Keep reading while one of the next two short lines (bullets in between) names another language.
      const ahead = lines.slice(j + 1, j + 3).filter((l) => l.length < 40).join(" ");
      if (langs.length && !(j < i + 5 && LANGS.some(([re]) => re.test(ahead)))) {
        // Taught partly in another language: that language is what a student must have, so it leads.
        const lead = langs.find((c) => c !== "en") ?? langs[0]!;
        return { fact: { value: lead, quote: quoteOf(lines, i, j) }, all: [...new Set(langs)] };
      }
    }
  }
  return null;
}

const LANGUAGE_NAMES: Record<string, string> = { en: "English", de: "German", it: "Italian", hu: "Hungarian", fr: "French", es: "Spanish", nl: "Dutch" };

/** "English language skills at level C1 (CEFR)", "B2 level of English": a CEFR level for English. */
const ENGLISH_LEVEL = [
  // "Englischkenntnisse": German joins words, so "englisch" may start a longer word.
  /\b(english|englisch\w*)[^\n.;]{0,60}?\b(B2|C1|C2)\b(?![-–]\d)/i,
  /\b(B2|C1|C2)\b(?:\s*(?:level|niveau))?[^\n.;]{0,40}?\b(english|englisch\w*)/i,
];
/** Lines about other languages or about modules/courses, not the entry requirement. */
const NOT_ENGLISH_ENTRY = /(german|deutsch|french|spanish|italian|dutch|finnish|swedish|module|course unit|you will (reach|achieve)|after (the|this) (course|program))/i;

/** The English entry level as CEFR, for English-taught programs that don't name a test score. */
export function englishLevel(lines: string[]): ProgramFacts["language_requirement"] {
  for (const line of lines) {
    if (line.length > 400 || NOT_ENGLISH_ENTRY.test(line)) continue;
    for (const re of ENGLISH_LEVEL) {
      const m = line.match(re);
      if (!m) continue;
      const level = (m[2]!.length === 2 ? m[2]! : m[1]!).toUpperCase();
      return { value: `English ${level} (CEFR)`, quote: line.slice(0, 220) };
    }
  }
  return null;
}

function languageRequirement(lines: string[], lang: string | undefined): ProgramFacts["language_requirement"] {
  // English-taught, or the teaching language isn't stated (most English pages): the English level.
  if (!lang || lang === "en") return englishLevel(lines);
  for (const line of lines) {
    const m = line.match(/\b(german|deutsch|italian|hungarian|french|spanish|dutch)\b[^\n]{0,60}?\b(A1|A2|B1|B2|C1|C2|DSH[- ]?[123]|TestDaF(?:\s*\d)?)\b/i) ?? line.match(/\b(DSH[- ]?[123]|TestDaF(?:\s*\d)?|Goethe[- ]Zertifikat\s*[ABC][12])\b/i);
    if (m) return { value: m[0]!.slice(0, 80), quote: line.slice(0, 220) };
  }
  return null;
}

const TUITION_KEY = /(tuition|studiengebühr|studiengebuehr|tasse universitarie|tassa|retta|tandíj|fees for international|international student fee|programme fee|program fee|course fee)/i;
const OTHER_FEE_KEY = /(semester (contribution|fee)|student (fees?|union|services)|semesterbeitrag|semesterticket|contributo|tassa regionale|administration fee|enrol?ment fee|registration fee|studentenwerk)/i;
const FREE = /(no tuition|tuition[- ]free|free of (tuition|charge)|no tuition fees|keine studiengebühren|without tuition|tuition (fees )?(is|are) (waived|not charged)|nessuna tassa)/i;

function tuition(lines: string[]): ProgramFacts["tuition"] {
  const found: NonNullable<ProgramFacts["tuition"]>[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (!TUITION_KEY.test(line) && !FREE.test(line)) continue;
    if (OTHER_FEE_KEY.test(line) && !TUITION_KEY.test(line)) continue;
    const context = lines.slice(Math.max(0, i - 1), i + 4).join(" ");
    const applies: Applies = NON_EU.test(context) ? "non_eu" : EU_ONLY.test(context) ? "eu" : "all";
    if (FREE.test(line)) found.push({ amount_per_year: 0, currency: "EUR", applies_to: NON_EU.test(line) ? "non_eu" : applies, quote: line.slice(0, 220) });
    for (let j = i; j <= Math.min(i + 3, lines.length - 1); j++) {
      if (j > i && (OTHER_FEE_KEY.test(lines[j]!) || (TUITION_KEY.test(lines[j]!) && j !== i))) break;
      const amounts = amountsIn(lines[j]!).filter((a) => a.amount >= 100);
      if (!amounts.length) continue;
      const a = amounts[0]!;
      const joined = lines.slice(i, j + 1).join(" ");
      const offset = joined.length - lines[j]!.length + a.index;
      // The amount's own line decides first: "UK students: £10,050" next to "International: £20,000"
      // is the home fee, even though "international" is in the nearby lines.
      const own = lines[j]!;
      const ownApplies: Applies | null = NON_EU.test(own) ? "non_eu" : HOME.test(own) || EU_ONLY.test(own) ? "eu" : null;
      found.push({ amount_per_year: Math.round(yearly(a.amount, joined, offset)), currency: a.currency, applies_to: ownApplies ?? applies, quote: quoteOf(lines, i, j) });
      // A home-fee line is often followed by the international one: keep reading this block.
      if (ownApplies !== "eu") break;
    }
  }
  // Non-EU amounts first, then general ones; EU-only amounts only when nothing else was found.
  const rank = (t: NonNullable<ProgramFacts["tuition"]>) => (t.applies_to === "non_eu" ? 0 : t.applies_to === "all" ? 1 : 2) + (t.amount_per_year === 0 ? 0.5 : 0);
  return found.sort((a, b) => rank(a) - rank(b))[0] ?? null;
}

function otherFees(lines: string[]): ProgramFacts["other_fees_per_year"] {
  for (let i = 0; i < lines.length; i++) {
    if (!OTHER_FEE_KEY.test(lines[i]!) && !/^student fees?:?$/i.test(lines[i]!)) continue;
    for (let j = i; j <= Math.min(i + 3, lines.length - 1); j++) {
      const a = amountsIn(lines[j]!).find((x) => x.amount > 0 && x.amount < 2000);
      if (!a) continue;
      const joined = lines.slice(i, j + 1).join(" ");
      // Semester contributions are charged per semester unless the page says otherwise.
      const perYear = PER_YEAR.test(joined) && !PER_SEMESTER.test(joined);
      return { amount: Math.round(perYear ? a.amount : a.amount * 2), currency: a.currency, quote: quoteOf(lines, i, j) };
    }
  }
  return null;
}

function applicationFee(lines: string[]): ProgramFacts["application_fee"] {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (!/(application fee|bewerbungsgebühr|handling fee|uni-assist fee|contributo (di )?(iscrizione|preiscrizione)|jelentkezési díj)/i.test(line)) continue;
    if (/no application fee|application (is )?free of charge|keine bewerbungsgebühr/i.test(line)) return { amount: 0, currency: "EUR", quote: line.slice(0, 220) };
    for (let j = i; j <= Math.min(i + 2, lines.length - 1); j++) {
      const a = amountsIn(lines[j]!).find((x) => x.amount > 0 && x.amount < 1000);
      if (a) return { amount: Math.round(a.amount), currency: a.currency, quote: quoteOf(lines, i, j) };
    }
  }
  return null;
}

const DEADLINE_KEY = /(deadline|application period|application window|application dates|apply (by|until|before|from)|closing date|bewerbungsfrist|bewerbungszeitraum|bewerbungsschluss|scadenza|termine (di|per)|határidő|jelentkezési időszak)/i;
const START_LABELS: [RegExp, number][] = [
  [/winter\s*semester|wintersemester|wise\b|ws\b/i, 10],
  [/summer\s*semester|sommersemester|sose\b|ss\b/i, 4],
  [/\b(fall|autumn)\b/i, 9],
  [/\bspring\b/i, 2],
];
const START_KEY = /(start|begin|beginn|commence|intake|inizio|kezdés)/i;

function startMonthIn(text: string): number | null {
  for (const [re, month] of START_LABELS) if (re.test(text)) return month;
  const m = text.match(new RegExp(`${MONTH_RE}\\s*(intake|start|entry)|(starts?|begins?|commences?|intake)[^\\n]{0,30}?${MONTH_RE}`, "i"));
  const name = m?.[1] ?? m?.[4];
  return name ? MONTHS[name.toLowerCase()] ?? null : null;
}

/** A linked page about applying: its deadlines can stand in when the program page states none. */
const APPLY_PAGE = /(apply|application|admission|deadline|bewerbung|frist|how-to-apply|key-dates|important-dates)/i;

/** Linked pages whose dates are for other kinds of study. */
const NOT_APPLY_PAGE = /(online|doctoral|phd|research-degree|exchange|short-course|summer-school)/i;
/** Dates near a deadline that aren't one: teaching starts, results, accepting an offer, PhD start. */
const NOT_A_DEADLINE = /(teaching (starts|begins)|classes (start|begin)|lectures (start|begin)|(semester|term|course|programme|program|studies) (starts|begins)|orientation|results|informed|notified|accept (only )?(one|the|your) (offer|place)|offer of admission|doctoral|study right starts|enrol?ment (starts|period))/i;

/** A start month stated once for the whole program ("Start: winter semester only"). */
function programStartIn(lines: string[]): number | null {
  for (const line of lines) {
    const m = START_KEY.test(line) ? startMonthIn(line) : null;
    if (m) return m;
  }
  return null;
}

function intakes(lines: string[], today: string, startFrom: number | null = programStartIn(lines)): ProgramFacts["intakes"] {
  const programStart = startFrom;

  const out: ProgramFacts["intakes"] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!DEADLINE_KEY.test(lines[i]!)) continue;
    for (let j = i; j <= Math.min(i + 5, lines.length - 1); j++) {
      if (j > i && DEADLINE_KEY.test(lines[j]!) && datesIn(lines[j]!).length === 0) break;
      // Read only up to "Teaching starts…" / "results by…": the dates after it aren't deadlines.
      const cut = lines[j]!.search(NOT_A_DEADLINE);
      if (cut === 0) continue;
      const text = cut > 0 ? lines[j]!.slice(0, cut) : lines[j]!;
      const dates = datesIn(text);
      if (!dates.length) continue;
      // "Application period opens 7 January": one date that opens the period isn't its deadline.
      if (dates.length === 1 && /\b(opens|opening|open from|starts on)\b/i.test(text) && !/\b(close|closes|closing|deadline|until|by)\b/i.test(text)) continue;
      // A period "01.02. – 31.05." ends on its deadline: the last date on the line.
      const last = dates.at(-1)!;
      const deadline = resolveYear(last, today);
      // Past deadlines (last year's calendar) say nothing about the next intake.
      if (Date.parse(deadline) < Date.parse(today) - 7 * 86_400_000) continue;
      const label = startMonthIn(lines[j]!) ?? startMonthIn(lines[i]!) ?? programStart;
      if (!label) continue;
      const dl = Date.parse(deadline);
      let year = Number(deadline.slice(0, 4));
      if (Date.parse(iso(year, label, 1)) <= dl) year += 1;
      const context = lines.slice(i, j + 1).join(" ");
      out.push({ start_month: label, start_year: year, deadline, deadline_for: NON_EU.test(context) ? "non_eu" : EU_ONLY.test(context) ? "eu" : "all", quote: quoteOf(lines, i === j ? j : i, j).slice(0, 220) });
    }
  }
  // One deadline per start month: non-EU first, then the earliest.
  const best = new Map<number, ProgramFacts["intakes"][number]>();
  const rank = (x: ProgramFacts["intakes"][number]) => (x.deadline_for === "non_eu" ? 0 : x.deadline_for === "all" ? 1 : 2);
  for (const x of out) {
    const cur = best.get(x.start_month);
    if (!cur || rank(x) < rank(cur) || (rank(x) === rank(cur) && x.deadline! < cur.deadline!)) best.set(x.start_month, x);
  }
  return [...best.values()].sort((a, b) => (a.deadline! < b.deadline! ? -1 : 1));
}

const TESTS: { test: ProgramFacts["english_tests"][number]["test"]; re: RegExp; min: number; max: number }[] = [
  { test: "ielts", re: /\bIELTS\b[^0-9\n]{0,40}?(\d(?:[.,]\d)?)\b/i, min: 4.5, max: 9 },
  { test: "toefl_ibt", re: /\bTOEFL\b(?![^0-9\n]{0,20}\b(?:ITP|PBT|paper)\b)[^0-9\n]{0,40}?(\d{2,3})\b/i, min: 50, max: 120 },
  { test: "pte", re: /\bPTE\b[^0-9\n]{0,40}?(\d{2})\b/i, min: 36, max: 90 },
  { test: "duolingo", re: /\b(?:Duolingo|DET)\b[^0-9\n]{0,40}?(\d{2,3})\b/i, min: 80, max: 160 },
];

function englishTests(lines: string[]): ProgramFacts["english_tests"] {
  const out: ProgramFacts["english_tests"] = [];
  for (const t of TESTS) {
    for (let i = 0; i < lines.length; i++) {
      // Score on the same line, or on the next one (tables like "IELTS | 6.5" split across cells).
      const line = lines[i]!;
      const m = line.match(t.re) ?? (/\b(IELTS|TOEFL|PTE|Duolingo)\b\s*:?$/i.test(line) ? `${line} ${lines[i + 1] ?? ""}`.match(t.re) : null);
      if (!m) continue;
      const v = Number(m[1]!.replace(",", "."));
      if (v >= t.min && v <= t.max) {
        out.push({ test: t.test, min_score: v, quote: (m.input === line ? line : `${line} ${lines[i + 1]}`).slice(0, 220) });
        break;
      }
    }
  }
  return out;
}

function yesNo(lines: string[], yes: RegExp, no?: RegExp): { value: boolean; quote: string } | null {
  for (const line of lines) {
    if (no?.test(line)) return { value: false, quote: line.slice(0, 220) };
    if (yes.test(line)) return { value: true, quote: line.slice(0, 220) };
  }
  return null;
}

const DOCS: [DocumentKey, RegExp][] = [
  ["passport", /\bpassport\b|reisepass|passaporto|útlevél/i],
  ["transcript", /transcript of records|transcripts?\b|grade report|notenspiegel|leistungsnachweis/i],
  ["degree_certificate", /(bachelor'?s?|degree|university) (certificate|diploma)|bachelorzeugnis|abschlusszeugnis|degree certificate/i],
  ["hsc_certificate", /(secondary school|high school|school[- ]leaving) (certificate|diploma)|hochschulzugangsberechtigung|abitur/i],
  ["cv", /curriculum vitae|\bcv\b|résumé|\bresume\b|lebenslauf/i],
  ["motivation_letter", /(letter of motivation|motivation letter|statement of purpose|personal statement|motivationsschreiben)/i],
  ["recommendation_letters", /(letters? of recommendation|recommendation letters?|reference letters?|empfehlungsschreiben)/i],
  ["english_certificate", /(proof of (english|language) (proficiency|skills)|english (language )?certificate|language certificate)/i],
  ["portfolio", /\bportfolio\b/i],
  ["course_descriptions", /(module|course) descriptions|modulbeschreibung|module handbook/i],
  ["work_certificate", /(proof of|certificate of) (work|professional) experience|employment certificate|arbeitszeugnis/i],
];

const DOCS_SECTION = /(required documents|application documents|documents (required|to (be )?submit)|what (you need|to submit)|bewerbungsunterlagen|erforderliche unterlagen|documenti (richiesti|necessari)|szükséges dokumentumok|checklist)/i;

function documents(lines: string[]): ProgramFacts["required_documents"] {
  // Read the documents section when the page has one (the line itself and the 15 after it).
  const start = lines.findIndex((l) => DOCS_SECTION.test(l));
  const scope = start >= 0 ? lines.slice(start, start + 16) : lines;
  const out: ProgramFacts["required_documents"] = [];
  // "…before receiving your degree certificate" talks about timing, not a document to send.
  const timing = /(before (receiving|you receive|your)|not yet|submit(ted)? later|after (you|graduation))/i;
  for (const [key, re] of DOCS) {
    const line = scope.find((l) => re.test(l) && l.length < 400 && !timing.test(l));
    if (line) out.push({ key, quote: line.slice(0, 220) });
  }
  return out;
}

/** Title words → our subject list (most specific first). */
// First match wins, so specific subjects come before the broad ones they'd otherwise fall under
// ("Nursing" before Medicine, "Artificial Intelligence" before Data science, "Mechatronics" before Electrical).
export const SUBJECTS: [string, RegExp][] = [
  ["ai", /artificial intelligence|machine learning|deep learning|\bai\b/i],
  ["data-science", /data science|data analytics|data engineering|big data|business analytics/i],
  ["cybersecurity", /cyber ?security|information security|digital forensics|network security/i],
  ["mechatronics-robotics", /mechatroni|robotic/i],
  ["energy-engineering", /(renewable|sustainable|green) energy|energy (systems|engineering|technology|technologies|science|transition)|solar energy|wind energy/i],
  // Electrical before computing ("Electrical Engineering and Information Technology"), and
  // biotechnology before computing ("Bioinformatics").
  ["eee", /electrical|electronic|elektrotechnik|communications? engineering|telecommunication|power engineering|microelectronics|integrated circuit|embedded systems/i],
  ["biotechnology", /biotechnolog|bioengineering|bioinformatics|biomedical engineering|neuroengineering|neuro ?technology/i],
  ["information-systems", /information (technology|systems|management)|\bict\b|business informatics|wirtschaftsinformatik|it management/i],
  ["cse", /computer science|informatics|informatik|informatica|software|computing|computational|computer engineering|information engineering/i],
  ["chemical-engineering", /chemical (and (biological |biomolecular )?)?(process )?engineering|process engineering|verfahrenstechnik/i],
  ["materials-engineering", /materials (science|engineering)|metallurg|nanoscien|nanotechnolog|polymer engineering/i],
  ["civil", /civil engineering|structural|bauingenieur|construction|geotechnic|transport|geodesy|surveying|environmental engineering|water/i],
  ["aerospace-automotive", /aerospace|aeronautic|aviation|automotive|vehicle engineering|space (science|engineering)/i],
  ["industrial-engineering", /industrial engineering|production|manufacturing|operations engineering|wirtschaftsingenieur/i],
  ["mechanical", /mechanical|maschinenbau|engineering science/i],
  ["design", /graphic design|product design|industrial design|fashion|interaction design|ux design|visual communication|game design|\bdesign\b(?! engineering)/i],
  ["textile", /textile/i],
  ["architecture", /architect|urban (planning|design)|landscape|interior design|spatial planning/i],
  ["nursing", /nursing|midwif/i],
  ["dentistry", /dentist|dental|oral health/i],
  ["physiotherapy-rehab", /physiotherap|physical therap|occupational therap|rehabilitat|speech (and language )?therap|podiatr|prosthetic|orthotic/i],
  ["nutrition-dietetics", /nutrition|dietetic/i],
  ["sport-science", /\bsports?\b|exercise science|kinesiolog/i],
  ["public-health", /public health|global health|epidemiolog|occupational health|health and safety|health (management|policy|economics|sciences|studies|care)/i],
  ["pharmacy", /pharma/i],
  ["medicine", /medicine|medical|surgery|clinical|trauma/i],
  ["accounting", /accounting|auditing/i],
  ["finance", /finance|financial|banking|actuarial/i],
  ["economics", /economics|economic|volkswirt|wirtschaftswissenschaft|econometric/i],
  ["marketing", /marketing|advertising|brand management/i],
  ["supply-chain", /logistics|supply chain|operations management|procurement/i],
  ["hospitality-tourism", /hospitality|tourism|hotel|event management/i],
  ["criminology", /criminolog|crime science|criminal justice|policing/i],
  ["law", /\blaws?\b|legal|\bll\.?[mb]\b|jurisprudence|juris/i],
  ["education", /education|teaching|pedagog|teacher/i],
  ["political-science", /politic|international relations|international affairs|european studies|diplomacy|public policy|governance|public administration/i],
  ["development-studies", /development studies|international development|humanitarian|peace|conflict studies/i],
  ["business", /business|management|\bmba\b|entrepreneur|administration|commerce/i],
  ["psychology", /psycholog|behaviou?ral science|cognitive science/i],
  ["environmental-science", /environment|ecolog|biodiversity|sustainab|conservation|climate change/i],
  ["food-science", /food (science|technology|safety|engineering)/i],
  ["microbiology", /microbio|molecular|biology|biolog|life sciences?|neuroscience|biochem|genetics/i],
  ["agriculture", /agricult|agronom|food|forest|horticult|veterinary|animal science|plant (science|biology)/i],
  ["chemistry", /chemi|polymer|cosmetic/i],
  ["geography", /geograph|\bgis\b|geoinformat|urban studies|regional studies/i],
  ["earth-sciences", /geoscien|geolog|earth science|geophysic|meteorolog|climate science|oceanograph/i],
  ["math-physics", /mathemat|physics|statistic|astro|quantum/i],
  ["media-communication", /media|communication|journalism|public relations|film studies/i],
  ["fine-arts", /fine art|music|\bfilm\b|cinema|theat(re|er)|performing arts|dance|photography|animation/i],
  ["history-philosophy", /history|philosoph|theolog|religio|archaeolog|classics/i],
  ["languages-linguistics", /linguistic|languages|translation|interpreting/i],
  ["social-sciences", /responsibility|ethics|society|science and technology studies|sociolog|social|anthropolog|disability|gender studies/i],
  ["english-humanities", /english|literature|language|cultural|humanities|arts|creative writing/i],
];

export function subjectOf(title: string): string | null {
  // The degree's own name says nothing about the subject: "Master of Arts" isn't "arts", "Master of Science" isn't science.
  const subject = title
    .replace(/\b(bachelor|master)'?s?( of| in)? (arts|science|sciences|engineering|education|laws|fine arts|philosophy)\b/gi, " ")
    .replace(/\((m|b)\.?\s?(a|sc|eng|ed)\.?\)|\b(m|b)\.?(sc|a|eng)\.?(?=\s|$)/gi, " ");
  const found = SUBJECTS.find(([, re]) => re.test(subject))?.[0];
  if (found) return found;
  // Titles that are only a degree name still say the subject for these: "Master of Laws", "Master of Education".
  if (/\b(master|bachelor)'?s?( of)? laws\b|juris doctor/i.test(title)) return "law";
  if (/\b(master|bachelor)'?s?( of| in)? education\b/i.test(title)) return "education";
  if (/\b(master|bachelor)'?s?( of)? fine arts\b/i.test(title)) return "fine-arts";
  return null;
}

/** "Bachelor's degree in computer science, electrical engineering or a related field" → [cse, eee]. */
function relatedFields(lines: string[], level: string | undefined): string[] {
  if (level !== "master") return [];
  const out = new Set<string>();
  for (const line of lines) {
    if (!/(bachelor'?s? degree|first degree|undergraduate degree|degree) (in|of)\b|background in|graduates of/i.test(line)) continue;
    for (const [slug, re] of SUBJECTS) if (re.test(line)) out.add(slug);
  }
  return [...out];
}

function isEnglish(text: string): boolean {
  const words = text.toLowerCase().split(/\W+/);
  const common = words.filter((w) => ["the", "and", "of", "in", "to", "you", "your", "with", "for", "is", "are", "program", "programme", "students"].includes(w)).length;
  return words.length > 8 && common / words.length > 0.08;
}

/** "Informatics - Master of Science (M.Sc.) - TUM" → "Informatics – Master of Science (M.Sc.)"; else the page heading. */
export function programTitle(meta: PageMeta | undefined): string | null {
  if (!meta) return null;
  const parts = meta.title.split(/\s+[|–—-]\s+/).map((x) => x.trim()).filter(Boolean);
  // Drop the site name at the end ("TUM", "University of X").
  if (parts.length >= 2 && parts.at(-1)!.length <= 40 && !DEGREE.master.test(parts.at(-1)!) && !DEGREE.bachelor.test(parts.at(-1)!)) parts.pop();
  const fromTitle = cleanTitle(parts.join(" – "));
  if (fromTitle && (DEGREE.master.test(fromTitle) || DEGREE.bachelor.test(fromTitle))) return fromTitle.slice(0, 200);
  return cleanTitle(meta.h1 || fromTitle || "").slice(0, 200) || null;
}

// ---------------------------------------------------------------- putting it together

/** Reads every fact the rules can find on a program's pages (the first page is the program page). */
export function readFacts(pages: RulePage[], today: string): ProgramFacts {
  const lines = pages.flatMap((p) => lineWindows(p.text));
  const main = pages[0]!;
  const f: ProgramFacts = { ...EMPTY_FACTS, intakes: [], english_tests: [], required_documents: [], related_bachelor_fields: [], career_paths_en: [] };

  f.degree_level = degreeLevel(pages);
  f.title = programTitle(main.meta);
  f.duration_months = duration(lines);
  f.ects_credits = ects(lines);
  const languages = teachingLanguages(lines);
  f.teaching_language = languages?.fact ?? null;
  f.language_requirement = languageRequirement(lines, f.teaching_language?.value);
  // "German and English" with no level stated: say so, since the student needs both.
  if (!f.language_requirement && languages && languages.all.length > 1) {
    f.language_requirement = { value: `Taught in ${languages.all.map((c) => LANGUAGE_NAMES[c] ?? c).join(" and ")}`, quote: languages.fact.quote };
  }
  f.tuition = tuition(lines);
  f.other_fees_per_year = otherFees(lines);
  f.application_fee = applicationFee(lines);
  // Deadlines come from the program's own page first. Only when it has none, from the application pages it
  // links to ("How to apply", "Application deadlines"), which many universities use for every program.
  // Other general pages list dates that may not apply (TU Munich's Singapore programs have their own).
  const mainLines = lineWindows(main.text);
  f.intakes = intakes(mainLines, today);
  if (!f.intakes.length) {
    const applyPages = pages.slice(1).filter((p) => APPLY_PAGE.test(p.url) && !NOT_APPLY_PAGE.test(p.url));
    const start = programStartIn(mainLines);
    const found = applyPages.length ? intakes(applyPages.flatMap((p) => lineWindows(p.text)), today, start).filter((x) => !start || x.start_month === start) : [];
    // More than 3 dates: a calendar for many programs or terms, not this program's deadline.
    if (found.length <= 3) f.intakes = found;
  }
  f.english_tests = englishTests(lines);
  f.accepts_moi = yesNo(
    lines,
    /(medium of instruction|language of instruction (of|in) (your|the) (previous )?(degree|studies) (was|is) english|(degree|studies) (completed|taught) (entirely )?in english|english[- ]taught (bachelor|degree|studies))/i,
    /(medium of instruction|moi)[^\n]{0,60}(not (be )?accepted|is not sufficient)/i,
  );
  f.accepts_3yr_bachelor = yesNo(lines, /(at least|minimum( of)?|min\.)\s*180\s*(ects|credits|cp)|three[- ]year bachelor'?s?[^\n]{0,40}(accepted|eligible|sufficient)/i, /(at least|minimum( of)?|min\.)\s*240\s*(ects|credits|cp)|four[- ]year bachelor'?s? (is )?required/i);
  f.accepts_provisional = yesNo(lines, /(before (your )?(graduation|completing your|receiving your|you (have )?graduate)|not yet (graduated|completed|received)|final (transcript|certificate|degree)[^\n]{0,40}(later|after)|provisional (certificate|admission|degree)|conditional admission|in your final (year|semester))/i);
  const seats = lines.map((l) => l.match(/\b(\d{1,4})\s*(study places|places|seats|studienplätze|posti)\b/i)).find(Boolean);
  if (seats && Number(seats[1]) > 0) {
    const line = seats.input!.slice(0, 220);
    if (NON_EU.test(line)) f.seats_non_eu = { value: Number(seats[1]), quote: line };
    else f.seats_total = { value: Number(seats[1]), quote: line };
  }
  f.required_documents = documents(lines);
  f.field_slug = f.title ? subjectOf(f.title) : null;
  f.related_bachelor_fields = relatedFields(lines, f.degree_level?.value);
  const description = main.meta?.description ?? "";
  f.overview_en = description && isEnglish(description) ? description.slice(0, 300) : null;

  // It's a program page when it names a degree and states at least two program facts.
  const signals = [f.duration_months, f.ects_credits, f.tuition, f.intakes.length ? 1 : null, f.english_tests.length ? 1 : null, f.teaching_language].filter(Boolean).length;
  // Events (webinars, thesis defences), news, stories and thesis pages mention degrees but aren't programs.
  f.is_program_page = Boolean(f.degree_level) && signals >= 2 && !NOT_A_PROGRAM_URL.test(main.url);
  return f;
}

/** Page addresses that are never a program's own page (sitemaps list them next to programs). */
export const NOT_A_PROGRAM_URL = /(\/events?\/|\/news\/|\/blogs?\/|\/stories\/|\/press\/|\/podcasts?\/|\/theses\/|webinar|defen[cs]e-of-(the-)?(dissertation|thesis|doctoral)|dissertation-guidelines|thesis-and-dissertation|salary-expectations|testimonial)/i;
