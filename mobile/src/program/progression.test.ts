import { describe, expect, it } from "vitest";
import { addDays, dayKey, fromDayKey, programWeek, weekdayIndex } from "./dates";
import {
  adjustDailyTarget,
  currentPrescription,
  dailyTargetForWeek,
  nextPrescription,
  startingPrescription,
  todayPlan,
} from "./progression";
import type { AppData, Prescription, SessionLog } from "./types";

// 2026-11-16 is a Monday.
const MONDAY = "2026-11-16";

function data(partial: Partial<AppData> = {}): AppData {
  return {
    version: 1,
    startDay: MONDAY,
    quickAdd: [5, 10, 20],
    pushEntries: [],
    dailyEffort: {},
    sessions: [],
    levelOverrides: {},
    dailyTargetOverride: null,
    ...partial,
  };
}

function entryOn(day: string, count: number, i = 0) {
  return { id: `${day}-${i}`, count, at: fromDayKey(day).toISOString() };
}

describe("dates", () => {
  it("treats Monday as the first weekday", () => {
    expect(weekdayIndex(MONDAY)).toBe(0);
    expect(weekdayIndex(addDays(MONDAY, 6))).toBe(6);
  });

  it("counts programme weeks from the Monday of the start week", () => {
    const start = addDays(MONDAY, 3); // Thursday
    expect(programWeek(start, MONDAY)).toBe(0);
    expect(programWeek(start, addDays(MONDAY, 7))).toBe(1);
    expect(programWeek(start, addDays(MONDAY, -1))).toBe(-1);
  });

  it("round-trips day keys", () => {
    expect(dayKey(fromDayKey("2027-03-28"))).toBe("2027-03-28");
  });
});

describe("nextPrescription", () => {
  const push: Prescription = { kind: "push", levelIndex: 1, sets: 3, reps: 5 };

  it("moves the push session to a harder variant after a clean 3 × 5 with a rep left", () => {
    expect(nextPrescription(push, [5, 5, 5], "good")).toEqual({ ...push, levelIndex: 2 });
  });

  it("holds the push variant when the sets were taken to failure", () => {
    expect(nextPrescription(push, [5, 5, 5], "empty")).toEqual(push);
  });

  it("holds the push variant when a set came up a little short", () => {
    expect(nextPrescription(push, [5, 5, 4], "empty")).toEqual(push);
  });

  it("steps back a variant when the session was clearly too hard", () => {
    expect(nextPrescription(push, [3, 2, 1], "empty")).toEqual({ ...push, levelIndex: 0 });
  });

  it("adds a rep within the squat rep range, two when it felt easy", () => {
    const squat: Prescription = { kind: "squat", levelIndex: 0, sets: 3, reps: 10 };
    expect(nextPrescription(squat, [10, 10, 10], "good").reps).toBe(11);
    expect(nextPrescription(squat, [10, 10, 10], "easy").reps).toBe(12);
  });

  it("starts the next squat variant at its minimum after the top of the range", () => {
    const squat: Prescription = { kind: "squat", levelIndex: 0, sets: 3, reps: 20 };
    expect(nextPrescription(squat, [20, 20, 20], "good")).toEqual({ ...squat, levelIndex: 1, reps: 8 });
  });

  it("keeps adding reps on the final dragon squat level", () => {
    const dragon: Prescription = { kind: "squat", levelIndex: 7, sets: 3, reps: 10 };
    expect(nextPrescription(dragon, [10, 10, 10], "good")).toEqual({ ...dragon, reps: 11 });
  });

  it("removes a rep when well short, but not below the range", () => {
    const core: Prescription = { kind: "core", levelIndex: 0, sets: 3, reps: 14 };
    expect(nextPrescription(core, [14, 8, 7], "empty").reps).toBe(13);
    const atMin = { ...core, reps: 10 };
    expect(nextPrescription(atMin, [10, 5, 5], "empty").reps).toBe(10);
  });
});

describe("currentPrescription", () => {
  it("starts gently", () => {
    expect(currentPrescription(data(), "push")).toEqual(startingPrescription("push"));
    expect(startingPrescription("push").reps).toBe(5);
    expect(startingPrescription("core").reps).toBe(10);
  });

  it("follows the latest session", () => {
    const s = (at: string, reps: number): SessionLog => ({
      id: at,
      day: at.slice(0, 10),
      at,
      prescription: { kind: "core", levelIndex: 0, sets: 3, reps },
      sets: [reps, reps, reps],
      effort: "good",
    });
    const d = data({ sessions: [s("2026-11-19T10:00:00.000Z", 12), s("2026-11-17T10:00:00.000Z", 10)] });
    expect(currentPrescription(d, "core").reps).toBe(13);
  });

  it("lets a newer manual override win over the computed level", () => {
    const d = data({ levelOverrides: { squat: { levelIndex: 3, reps: 6, at: "2026-11-20T00:00:00.000Z" } } });
    expect(currentPrescription(d, "squat")).toEqual({ kind: "squat", levelIndex: 3, sets: 3, reps: 6 });
  });
});

describe("daily pushup target", () => {
  it("starts at ten", () => {
    expect(dailyTargetForWeek(data(), 0)).toBe(10);
  });

  it("goes up by two after a solid week", () => {
    const days = [1, 2, 3, 4, 5, 6].map((i) => addDays(MONDAY, i));
    const d = data({ pushEntries: days.map((day) => entryOn(day, 10)) });
    expect(dailyTargetForWeek(d, 1)).toBe(12);
  });

  it("goes up faster when most days felt easy, and holds when a day was empty", () => {
    const days = [1, 2, 3, 4, 5, 6].map((i) => addDays(MONDAY, i));
    const entries = days.map((day) => entryOn(day, 10));
    const easy = Object.fromEntries(days.map((day) => [day, "easy" as const]));
    expect(dailyTargetForWeek(data({ pushEntries: entries, dailyEffort: easy }), 1)).toBe(14);
    const withEmpty = { ...easy, [days[0]!]: "empty" as const };
    expect(dailyTargetForWeek(data({ pushEntries: entries, dailyEffort: withEmpty }), 1)).toBe(10);
  });

  it("eases off after a week mostly missed, never below five", () => {
    expect(dailyTargetForWeek(data(), 1)).toBe(8);
    expect(dailyTargetForWeek(data(), 10)).toBe(5);
  });

  it("only reviews the days after the programme started", () => {
    const thursday = addDays(MONDAY, 3);
    const days = [3, 4, 5, 6].map((i) => addDays(MONDAY, i));
    const d = data({ startDay: thursday, pushEntries: days.map((day) => entryOn(day, 10)) });
    expect(dailyTargetForWeek(d, 1)).toBe(12);
  });

  it("applies a manual target from its week onwards", () => {
    const d = data({ dailyTargetOverride: { week: 2, target: 30 } });
    expect(dailyTargetForWeek(d, 1)).toBe(8);
    expect(dailyTargetForWeek(d, 2)).toBe(30);
  });

  it("adjustDailyTarget ignores weeks with nothing scheduled", () => {
    expect(adjustDailyTarget(20, { scheduled: 0, hit: 0, efforts: [] })).toBe(20);
  });
});

describe("todayPlan", () => {
  it("puts the heavy push session on Monday without daily pushups", () => {
    const plan = todayPlan(data(), fromDayKey(MONDAY));
    expect(plan.plan).toEqual({ workout: "push", dailyPushups: false });
    expect(plan.pushPending).toBe(false);
  });

  it("flags a missed weekly push session later in the week", () => {
    const wednesday = fromDayKey(addDays(MONDAY, 2));
    expect(todayPlan(data(), wednesday).plan.workout).toBe("squat");
    expect(todayPlan(data(), wednesday).pushPending).toBe(true);
    const done: SessionLog = {
      id: "p",
      day: MONDAY,
      at: fromDayKey(MONDAY).toISOString(),
      prescription: startingPrescription("push"),
      sets: [5, 5, 5],
      effort: "good",
    };
    expect(todayPlan(data({ sessions: [done] }), wednesday).pushPending).toBe(false);
  });

  it("schedules situps on the days without push or squats, and rest on Sunday", () => {
    const kinds = [0, 1, 2, 3, 4, 5, 6].map(
      (i) => todayPlan(data(), fromDayKey(addDays(MONDAY, i))).plan.workout,
    );
    expect(kinds).toEqual(["push", "core", "squat", "core", "squat", "core", null]);
  });
});
