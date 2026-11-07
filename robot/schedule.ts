// When to visit a program page next. Pages that matter right now are visited more often, so the robot's
// time goes where students need fresh facts:
//   hot     every 6 hours   changed in the last 7 days, or a deadline in the next 45 days
//   normal  every day
//   quiet   every 2 days    nothing changed for 90 days and no deadline coming up
// Errors back off separately (1, 2, 4 … days, see db.ts markChecked).

export const HOURS = { hot: 6, normal: 24, quiet: 48 } as const;
const DAY = 86_400_000;

export function nextCheckHours(o: { changedNow: boolean; lastChangedAt: string | null; deadlines: string[]; now?: Date }): number {
  const now = (o.now ?? new Date()).getTime();
  const daysFromNow = (iso: string) => (Date.parse(iso) - now) / DAY;
  if (o.changedNow) return HOURS.hot;
  if (o.deadlines.some((d) => daysFromNow(d) >= -1 && daysFromNow(d) <= 45)) return HOURS.hot;
  if (o.lastChangedAt) {
    const ago = -daysFromNow(o.lastChangedAt);
    if (ago <= 7) return HOURS.hot;
    if (ago >= 90) return HOURS.quiet;
  }
  return HOURS.normal;
}
