// Dates and months in English or Bangla, built by hand so every device shows the same text.

import type { ISODate } from "@/types";
import { localizeDigits, type AppLocale } from "./localize";

const MONTHS: Record<AppLocale, string[]> = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  bn: ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"],
};
const MONTHS_LONG_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function monthName(month: number, locale: AppLocale, long = false): string {
  if (locale === "en" && long) return MONTHS_LONG_EN[month - 1]!;
  return MONTHS[locale][month - 1]!;
}

/** "25 Nov 2026" / "২৫ নভেম্বর ২০২৬" */
export function formatDate(iso: ISODate, locale: AppLocale): string {
  const [y, m, d] = iso.split("-").map(Number);
  return localizeDigits(`${d} ${monthName(m!, locale)} ${y}`, locale);
}

/** "Sep 2027" / "সেপ্টেম্বর ২০২৭" */
export function formatMonthYear(month: number, year: number, locale: AppLocale): string {
  return localizeDigits(`${monthName(month, locale)} ${year}`, locale);
}
