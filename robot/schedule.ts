// When to visit a program page next. Every visit is a database write, and the free database plan has a
// small daily disk allowance (it ran out on 10 Nov and again on 16 Nov), so pages are visited only as often as they need:
//   deadline   every 12 hours  a deadline in the next 45 days (deadlines matter most)
//   changed    every 2 days    changed now or in the last 7 days
//   normal     every 7 days
//   quiet      every 14 days   nothing changed for 90 days and no deadline coming up
// Errors back off separately (1, 2, 4 … days, see db.ts markChecked).

export const HOURS = { deadline: 12, changed: 48, normal: 168, quiet: 336 } as const;
const DAY = 86_400_000;

export function nextCheckHours(o: { changedNow: boolean; lastChangedAt: string | null; deadlines: string[]; now?: Date }): number {
  const now = (o.now ?? new Date()).getTime();
  const daysFromNow = (iso: string) => (Date.parse(iso) - now) / DAY;
  if (o.deadlines.some((d) => daysFromNow(d) >= -1 && daysFromNow(d) <= 45)) return HOURS.deadline;
  if (o.changedNow) return HOURS.changed;
  if (o.lastChangedAt) {
    const ago = -daysFromNow(o.lastChangedAt);
    if (ago <= 7) return HOURS.changed;
    if (ago >= 90) return HOURS.quiet;
  }
  return HOURS.normal;
}

/** "Still the same" is written at most this often: the date shown as "verified on" is then up to 7 days old. */
export const CONFIRM_EVERY_DAYS = 7;

/** True when the program's "verified on" date is old enough to be written again. */
export function confirmDue(lastVerified: string | null | undefined, today: string): boolean {
  if (!lastVerified) return true;
  return (Date.parse(today) - Date.parse(lastVerified)) / DAY >= CONFIRM_EVERY_DAYS;
}
