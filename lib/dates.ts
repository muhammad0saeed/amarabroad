// Date-only arithmetic on "YYYY-MM-DD" strings, done in UTC so time zones never shift a day.

import type { ISODate } from "@/types";

const DAY_MS = 86_400_000;

export function parseISODate(iso: ISODate): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

export function toISODate(date: Date): ISODate {
  return date.toISOString().slice(0, 10);
}

/** Today's date on this device (its own time zone). */
export function todayISO(now: Date = new Date()): ISODate {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function addDays(iso: ISODate, days: number): ISODate {
  return toISODate(new Date(parseISODate(iso).getTime() + days * DAY_MS));
}

/** Adds calendar months, clamping the day to the end of the month (31 Jan + 1 month → 28/29 Feb). */
export function addMonths(iso: ISODate, months: number): ISODate {
  const date = parseISODate(iso);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return toISODate(date);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: ISODate, to: ISODate): number {
  return Math.round((parseISODate(to).getTime() - parseISODate(from).getTime()) / DAY_MS);
}

/** First day of an intake month: (9, 2027) → "2027-09-01". */
export function monthStart(month: number, year: number): ISODate {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

export function minDate(...dates: ISODate[]): ISODate {
  return dates.reduce((a, b) => (b < a ? b : a));
}

export function maxDate(...dates: ISODate[]): ISODate {
  return dates.reduce((a, b) => (b > a ? b : a));
}
