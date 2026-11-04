// Program chat without any AI service. Answers come only from that program's own data:
// 1) match the question to a data field (tuition, deadline, IELTS, …),
// 2) otherwise fuzzy-search the program overview with Fuse.js,
// 3) otherwise "Not in our data yet" plus a prompt the student can copy into another AI.
// Load this module with a dynamic import so Fuse.js only downloads when someone opens the chat.

import Fuse from "fuse.js";
import type { ProgramContext } from "@/types";
import { formatMoney } from "./money";

export type ChatIntent =
  | "application_fee"
  | "moi"
  | "three_year"
  | "provisional"
  | "ects"
  | "ranking"
  | "seats"
  | "documents"
  | "english"
  | "grade"
  | "deadline"
  | "intake"
  | "duration"
  | "living_cost"
  | "tuition"
  | "total_cost"
  | "scholarships"
  | "careers"
  | "work"
  | "language"
  | "verified";

/** Checked in this order; the first intent with a matching keyword wins (specific before general). */
const KEYWORDS: [ChatIntent, string[]][] = [
  ["application_fee", ["application fee", "apply fee", "আবেদন ফি"]],
  ["moi", ["moi", "medium of instruction", "without ielts", "no ielts", "এমওআই", "আইইএলটিএস ছাড়া"]],
  ["three_year", ["3 year", "3-year", "three year", "three-year", "pass course", "৩ বছর", "তিন বছর", "পাস কোর্স"]],
  ["provisional", ["provisional", "session jam", "প্রভিশনাল", "সেশনজট"]],
  ["ects", ["ects", "credit", "credits", "ক্রেডিট"]],
  ["ranking", ["ranking", "rank", "ranked", "র‍্যাঙ্কিং", "র‌্যাংকিং"]],
  ["seats", ["seat", "seats", "places", "quota", "how many students", "আসন", "সিট"]],
  ["documents", ["document", "documents", "papers", "checklist", "কাগজ", "ডকুমেন্ট"]],
  ["english", ["ielts", "toefl", "pte", "duolingo", "english test", "english requirement", "english score", "আইইএলটিএস", "ইংরেজি"]],
  ["grade", ["cgpa", "gpa", "grade", "grades", "result", "marks", "minimum cgpa", "সিজিপিএ", "জিপিএ", "রেজাল্ট", "ফলাফল"]],
  ["deadline", ["deadline", "last date", "apply by", "closing date", "শেষ তারিখ", "ডেডলাইন"]],
  ["intake", ["intake", "start", "starts", "begin", "begins", "শুরু", "ইনটেক", "সেশন"]],
  ["duration", ["duration", "how long", "how many years", "how many months", "কত বছর", "কত মাস", "মেয়াদ"]],
  ["living_cost", ["living", "rent", "accommodation", "housing", "food", "বাসা", "ভাড়া", "থাকা", "খাওয়া", "জীবনযাত্রা"]],
  ["tuition", ["tuition", "fee", "fees", "টিউশন", "ফি"]],
  ["total_cost", ["total cost", "total", "cost", "budget", "how much", "expensive", "খরচ", "বাজেট", "মোট", "কত টাকা"]],
  ["scholarships", ["scholarship", "scholarships", "funding", "grant", "waiver", "স্কলারশিপ", "বৃত্তি", "অনুদান"]],
  ["careers", ["career", "careers", "job after", "jobs after", "after graduation", "salary", "ক্যারিয়ার", "চাকরি"]],
  ["work", ["part time", "part-time", "work", "hours", "minimum wage", "কাজ", "পার্টটাইম"]],
  ["language", ["taught in", "language", "german", "italian", "hungarian", "ভাষা"]],
  ["verified", ["verified", "up to date", "updated", "official", "source", "যাচাই", "অফিসিয়াল"]],
];

const isLatin = (keyword: string) => /^[\x00-\x7F]+$/.test(keyword);
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The data field a question asks about, or null. */
export function matchIntent(question: string): ChatIntent | null {
  const q = question.toLowerCase();
  for (const [intent, keywords] of KEYWORDS) {
    for (const keyword of keywords) {
      const hit = isLatin(keyword) ? new RegExp(`\\b${escape(keyword)}\\b`).test(q) : q.includes(keyword);
      if (hit) return intent;
    }
  }
  return null;
}

/** Suggested question chips, in the order they're shown. */
export const SUGGESTED_INTENTS: ChatIntent[] = ["tuition", "deadline", "english", "three_year", "moi", "seats", "documents", "scholarships"];

export type ChatAnswer =
  | { type: "field"; intent: ChatIntent }
  | { type: "search"; sentences: string[] }
  | { type: "none" };

/** Intents that have nothing to say for this program fall through to search. */
function hasData(intent: ChatIntent, { university }: ProgramContext, scholarshipCount: number): boolean {
  if (intent === "ranking") return university.ranking !== null;
  if (intent === "scholarships") return scholarshipCount > 0;
  return true;
}

const STOP_WORDS = new Set(
  "the and for are you can does this that with what when how about there have has will from into your which program programme course study do is it of to in a an i me my any".split(" "),
);

function sentencesOf(ctx: ProgramContext): string[] {
  const texts = [ctx.program.overview_en, ctx.program.overview_bn ?? ""];
  return texts.flatMap((t) => t.split(/(?<=[.!?।])\s+/)).map((s) => s.trim()).filter(Boolean);
}

/** Fuzzy search over the program overview: sentences matching the most question words. */
export function searchOverview(question: string, ctx: ProgramContext, limit = 2): string[] {
  const tokens = question
    .toLowerCase()
    // \p{M} keeps Bangla vowel signs (ি, া, …) inside words.
    .split(/[^\p{L}\p{M}\p{N}]+/u)
    .filter((t) => t.length >= 3 && !STOP_WORDS.has(t));
  if (tokens.length === 0) return [];

  const sentences = sentencesOf(ctx);
  const fuse = new Fuse(sentences.map((text, index) => ({ text, index })), {
    keys: ["text"],
    includeScore: true,
    ignoreLocation: true,
    threshold: 0.3,
    minMatchCharLength: 3,
  });

  const hits = new Map<number, { count: number; score: number }>();
  for (const token of tokens) {
    for (const result of fuse.search(token)) {
      const hit = hits.get(result.item.index) ?? { count: 0, score: 0 };
      hits.set(result.item.index, { count: hit.count + 1, score: hit.score + (result.score ?? 1) });
    }
  }
  return [...hits.entries()]
    .sort(([, a], [, b]) => b.count - a.count || a.score / a.count - b.score / b.count)
    .slice(0, limit)
    .map(([index]) => sentences[index]!);
}

export function answerQuestion(question: string, ctx: ProgramContext, scholarshipCount = 0): ChatAnswer {
  const intent = matchIntent(question);
  if (intent && hasData(intent, ctx, scholarshipCount)) return { type: "field", intent };
  const sentences = searchOverview(question, ctx);
  return sentences.length > 0 ? { type: "search", sentences } : { type: "none" };
}

const TEST_NAMES = { ielts: "IELTS", toefl_ibt: "TOEFL iBT", pte: "PTE Academic", duolingo: "Duolingo English Test" } as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const yesNo = (value: boolean | null) => (value === null ? "not stated on the official page" : value ? "yes" : "no");

/** Text for "Copy question with program details", to paste into ChatGPT or Gemini. Always English. */
export function copyPrompt(question: string, { program, university, city, country }: ProgramContext, siteName: string): string {
  const NOT_FOUND = "not found on the official page";
  const tuition =
    program.tuition_per_year === null || program.currency === null
      ? NOT_FOUND
      : program.tuition_per_year === 0
        ? "none (tuition-free)"
        : `${formatMoney(program.tuition_per_year, program.currency)} per year`;
  const intakes = program.intakes
    .map((i) => `${MONTHS[i.month - 1]} ${i.year} intake, deadline ${i.deadline}`)
    .join("; ");
  const english =
    program.english_tests.length > 0
      ? program.english_tests.map((t) => `${TEST_NAMES[t.test]} ${t.min_score}`).join(", ")
      : (program.language_requirement_en ?? "not listed");
  const req = program.min_gpa_requirement;
  const grade = req ? `${req.value} out of ${req.scale}${req.local_note_en ? ` (${req.local_note_en})` : ""}` : NOT_FOUND;

  return [
    "I'm a student from Bangladesh. Please answer my question about this study program.",
    "If you're not sure, say so and point me to the official program page.",
    "",
    `Question: ${question.trim()}`,
    "",
    `Program: ${program.title} (${program.degree_level === "master" ? "master's" : "bachelor's"}, ${program.duration_months ?? "?"} months, ${program.ects_credits ?? "?"} ECTS)`,
    `University: ${university.name} (${university.type}), ${city.name_en}, ${country.name_en}`,
    `Tuition: ${tuition}${program.other_fees_per_year ? `; other fees ${formatMoney(program.other_fees_per_year, program.currency ?? country.currency)} per year` : ""}`,
    `Intakes: ${intakes || NOT_FOUND}`,
    `Minimum grade: ${grade}`,
    `English: ${english}; MOI accepted: ${yesNo(program.accepts_moi)}`,
    `3-year bachelor's accepted: ${yesNo(program.accepts_3yr_bachelor)}; provisional certificate accepted: ${yesNo(program.accepts_provisional)}`,
    `Official page: ${program.official_url}`,
    "",
    `These details come from ${siteName}${program.is_sample ? " sample data and are invented" : ` and were last verified on ${program.last_verified}`}.`,
  ].join("\n");
}
