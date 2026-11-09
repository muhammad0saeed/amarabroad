// National application deadlines that apply to many programs at once (one official system for a whole
// country and level), shown on program pages that state no deadline of their own. Written by hand from
// the official source and hidden automatically once the date has passed. Update once a year.

import type { DegreeLevel } from "@/types";

export interface NationalDeadline {
  country: string;
  level: DegreeLevel;
  /** The deadline (YYYY-MM-DD); the entry is hidden after this day. */
  date: string;
  /** For the intake starting in this month/year. */
  start: { month: number; year: number };
  note_en: string;
  note_bn: string;
  source: string;
  url: string;
  checked: string;
}

export const NATIONAL_DEADLINES: NationalDeadline[] = [
  {
    country: "united-kingdom",
    level: "bachelor",
    date: "2027-01-13",
    start: { month: 9, year: 2027 },
    note_en: "UK bachelor's applications go through UCAS. Apply by 13 January 2027, 18:00 UK time, to be considered equally with everyone else (Oxford, Cambridge, medicine, dentistry and veterinary courses closed on 15 October 2026). Many universities still accept applications later if places are left.",
    note_bn: "যুক্তরাজ্যে ব্যাচেলরের আবেদন UCAS-এর মাধ্যমে হয়। সবার সঙ্গে সমানভাবে বিবেচিত হতে ১৩ জানুয়ারি ২০২৭, যুক্তরাজ্য সময় সন্ধ্যা ৬টার মধ্যে আবেদন করুন (অক্সফোর্ড, কেমব্রিজ, মেডিসিন, ডেন্টিস্ট্রি ও ভেটেরিনারি কোর্স ১৫ অক্টোবর ২০২৬ বন্ধ হয়েছে)। আসন খালি থাকলে অনেক বিশ্ববিদ্যালয় পরেও আবেদন নেয়।",
    source: "UCAS",
    url: "https://www.ucas.com/events/2027-entry-deadline-for-all-undergraduate-courses-except-those-with-a-15-october-deadline-475546",
    checked: "2026-11-09",
  },
];

/** The national deadline that applies to a program, if any and still ahead. */
export function nationalDeadline(country: string, level: DegreeLevel, today: string): NationalDeadline | null {
  return NATIONAL_DEADLINES.find((d) => d.country === country && d.level === level && d.date >= today) ?? null;
}
