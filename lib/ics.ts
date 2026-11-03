// "Add to calendar": a standards-compliant .ics file (RFC 5545) for one all-day deadline,
// with reminders a week and a day before. Built in the browser; nothing is sent anywhere.

import type { ISODate } from "@/types";
import { addDays } from "./dates";

export interface CalendarEvent {
  /** Stable id, e.g. "scholarship-<slug>@amarabroad". */
  uid: string;
  title: string;
  description?: string;
  url?: string;
  /** All-day event date. */
  date: ISODate;
  /** Days before the date to remind; default 7 and 1. */
  remindDaysBefore?: number[];
}

/** Escapes text values: backslash, semicolon, comma and newlines. */
export function escapeICS(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Folds lines longer than 75 bytes (continuation lines start with a space). */
export function foldLine(line: string): string {
  const bytes = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  for (const char of line) {
    const limit = parts.length === 0 ? 75 : 74;
    if (bytes.encode(current + char).length > limit) {
      parts.push(current);
      current = char;
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts.join("\r\n ");
}

const compactDate = (iso: ISODate) => iso.replace(/-/g, "");
const stamp = (now: Date) => now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export function buildICS(event: CalendarEvent, now: Date = new Date()): string {
  const reminders = event.remindDaysBefore ?? [7, 1];
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//amarAbroad//Deadlines//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART;VALUE=DATE:${compactDate(event.date)}`,
    `DTEND;VALUE=DATE:${compactDate(addDays(event.date, 1))}`,
    `SUMMARY:${escapeICS(event.title)}`,
    ...(event.description ? [`DESCRIPTION:${escapeICS(event.description)}`] : []),
    ...(event.url ? [`URL:${event.url}`] : []),
    "TRANSP:TRANSPARENT",
    ...reminders.flatMap((days) => [
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeICS(event.title)}`,
      `TRIGGER:-P${days}D`,
      "END:VALARM",
    ]),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/** "sample-milan-excellence-scholarship-deadline.ics" */
export function icsFileName(slug: string): string {
  return `${slug}-deadline.ics`;
}
