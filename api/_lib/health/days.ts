/** Pure day math on local calendar day keys (`YYYY-MM-DD`). No time zones involved. */

const DAY_MS = 86_400_000;
const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Days since 1970-01-01 for a valid key, or NaN. */
export function dayNumber(key: string): number {
  const m = DAY_KEY.exec(key);
  if (!m) return Number.NaN;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ms = Date.UTC(y, mo - 1, d);
  const back = new Date(ms);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) {
    return Number.NaN;
  }
  return ms / DAY_MS;
}

export function isDayKey(key: unknown): key is string {
  return typeof key === "string" && Number.isFinite(dayNumber(key));
}

export function fromDayNumber(n: number): string {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}

export function addDays(key: string, days: number): string {
  return fromDayNumber(dayNumber(key) + days);
}

/** Whole days from `a` to `b` (positive when b is later). */
export function diffDays(a: string, b: string): number {
  return dayNumber(b) - dayNumber(a);
}

/** Monday of the week containing `key`. */
export function weekStart(key: string): string {
  const n = dayNumber(key);
  // 1970-01-01 was a Thursday; shift so Monday = 0.
  const weekday = (((n + 3) % 7) + 7) % 7;
  return fromDayNumber(n - weekday);
}
