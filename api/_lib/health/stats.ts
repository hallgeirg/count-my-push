import { dayNumber, weekStart } from "./days.js";

export type DayTotal = { day: string; pushups: number };

export type Stats = {
  currentStreak: number;
  longestStreak: number;
  weekTotal: number;
  allTimeTotal: number;
  activeToday: boolean;
};

/** Distinct active day numbers on or before `today`, ascending. */
function activeDayNumbers(days: Iterable<string>, today: string): number[] {
  const max = dayNumber(today);
  const set = new Set<number>();
  for (const d of days) {
    const n = dayNumber(d);
    if (Number.isFinite(n) && n <= max) set.add(n);
  }
  return [...set].sort((a, b) => a - b);
}

/** Consecutive active days ending today, or ending yesterday when today is not active yet. */
export function currentStreak(activeDays: Iterable<string>, today: string): number {
  const nums = activeDayNumbers(activeDays, today);
  const set = new Set(nums);
  let cursor = dayNumber(today);
  if (!set.has(cursor)) cursor -= 1;
  let streak = 0;
  while (set.has(cursor)) {
    streak += 1;
    cursor -= 1;
  }
  return streak;
}

/** Longest run of consecutive active days on or before `today`. */
export function longestStreak(activeDays: Iterable<string>, today: string): number {
  const nums = activeDayNumbers(activeDays, today);
  let best = 0;
  let run = 0;
  for (let i = 0; i < nums.length; i++) {
    run = i > 0 && nums[i] === nums[i - 1] + 1 ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best;
}

/** `days` holds one row per active day (pushups may be 0 for squat/core-only days). */
export function computeStats(days: DayTotal[], today: string): Stats {
  const from = weekStart(today);
  let weekTotal = 0;
  let allTimeTotal = 0;
  for (const d of days) {
    allTimeTotal += d.pushups;
    if (d.day >= from && d.day <= today) weekTotal += d.pushups;
  }
  const keys = days.map((d) => d.day);
  return {
    currentStreak: currentStreak(keys, today),
    longestStreak: longestStreak(keys, today),
    weekTotal,
    allTimeTotal,
    activeToday: keys.includes(today),
  };
}
