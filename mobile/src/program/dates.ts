import type { DayKey } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");

/** Local calendar day of a date. */
export function dayKey(date: Date): DayKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Local noon of a day key; noon keeps arithmetic clear of DST shifts. */
export function fromDayKey(key: DayKey): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y!, m! - 1, d!, 12);
}

export function addDays(key: DayKey, days: number): DayKey {
  const d = fromDayKey(key);
  d.setDate(d.getDate() + days);
  return dayKey(d);
}

/** Whole days from `a` to `b` (positive when `b` is later). */
export function daysBetween(a: DayKey, b: DayKey): number {
  return Math.round((fromDayKey(b).getTime() - fromDayKey(a).getTime()) / 86_400_000);
}

/** Monday = 0 … Sunday = 6. */
export function weekdayIndex(key: DayKey): number {
  return (fromDayKey(key).getDay() + 6) % 7;
}

export function mondayOf(key: DayKey): DayKey {
  return addDays(key, -weekdayIndex(key));
}

/** Programme week of a day, where week 0 contains the start day. Negative before the start. */
export function programWeek(startDay: DayKey, key: DayKey): number {
  return Math.floor(daysBetween(mondayOf(startDay), key) / 7);
}

/** The seven days (Monday first) of a programme week. */
export function daysOfProgramWeek(startDay: DayKey, week: number): DayKey[] {
  const monday = addDays(mondayOf(startDay), week * 7);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export const WEEKDAY_SHORT = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"] as const;
export const WEEKDAY_LONG = [
  "Mandag",
  "Tirsdag",
  "Onsdag",
  "Torsdag",
  "Fredag",
  "Lørdag",
  "Søndag",
] as const;
