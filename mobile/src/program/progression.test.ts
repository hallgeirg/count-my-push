import { describe, expect, it } from "vitest";
import { addDays, dayKey, fromDayKey, programWeek, weekdayIndex } from "./dates";
import { emptyData, migrate } from "../store/migrate";
import {
  adjustDailyTarget,
  currentPrescription,
  goalTargetForWeek,
  goalTotals,
  nextPrescription,
  startingPrescription,
  todayPlan,
} from "./progression";
import type { AppData, Goal, Prescription, SessionLog } from "./types";

// 2026-11-16 is a Monday.
const MONDAY = "2026-11-16";

function data(partial: Partial<AppData> = {}): AppData {
  return { ...emptyData(MONDAY), onboarded: true, ...partial };
}

function entryOn(day: string, count: number, goalId = "pushups") {
  return { id: `${day}-${goalId}`, goalId, count, at: fromDayKey(day).toISOString() };
}

const pushupTarget = (d: AppData, week: number) => goalTargetForWeek(d, d.goals[0]!, week);

const pushSession = (day: string, sets = [5, 5, 5]): SessionLog => ({
  id: `p-${day}`,
  day,
  at: fromDayKey(day).toISOString(),
  prescription: startingPrescription("push"),
  sets,
  effort: "good",
});

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

describe("daily goal target", () => {
  it("starts pushups at ten", () => {
    expect(pushupTarget(data(), 0)).toBe(10);
  });

  it("goes up by two after a solid week", () => {
    const days = [1, 2, 3, 4, 5, 6].map((i) => addDays(MONDAY, i));
    const d = data({ entries: days.map((day) => entryOn(day, 10)) });
    expect(pushupTarget(d, 1)).toBe(12);
  });

  it("goes up faster when most days felt easy, and holds when a day was empty", () => {
    const days = [1, 2, 3, 4, 5, 6].map((i) => addDays(MONDAY, i));
    const entries = days.map((day) => entryOn(day, 10));
    const easy = Object.fromEntries(days.map((day) => [day, "easy" as const]));
    expect(pushupTarget(data({ entries, dailyEffort: { pushups: easy } }), 1)).toBe(14);
    const withEmpty = { ...easy, [days[0]!]: "empty" as const };
    expect(pushupTarget(data({ entries, dailyEffort: { pushups: withEmpty } }), 1)).toBe(10);
  });

  it("eases off after a week mostly missed, never below five", () => {
    expect(pushupTarget(data(), 1)).toBe(8);
    expect(pushupTarget(data(), 10)).toBe(5);
  });

  it("only reviews the days after the programme started", () => {
    const thursday = addDays(MONDAY, 3);
    const days = [3, 4, 5, 6].map((i) => addDays(MONDAY, i));
    const d = data({ startDay: thursday, entries: days.map((day) => entryOn(day, 10)) });
    expect(pushupTarget(d, 1)).toBe(12);
  });

  it("applies a target set by hand from its week onwards", () => {
    const d = data();
    const goal: Goal = { ...d.goals[0]!, target: 30, targetWeek: 2 };
    expect(goalTargetForWeek(d, goal, 2)).toBe(30);
    expect(goalTargetForWeek(d, goal, 3)).toBe(28);
  });

  it("keeps a fixed goal where it was set", () => {
    const d = data();
    expect(goalTargetForWeek(d, { ...d.goals[0]!, adaptive: false }, 10)).toBe(10);
  });

  it("steps seconds goals by five", () => {
    expect(adjustDailyTarget(60, { scheduled: 7, hit: 7, efforts: [] }, "seconds")).toBe(65);
    expect(adjustDailyTarget(60, { scheduled: 7, hit: 0, efforts: [] }, "seconds")).toBe(55);
  });

  it("adjustDailyTarget ignores weeks with nothing scheduled", () => {
    expect(adjustDailyTarget(20, { scheduled: 0, hit: 0, efforts: [] })).toBe(20);
  });
});

describe("goalTotals", () => {
  it("counts push-session reps as pushups, both sides for per-side variants", () => {
    const archer = { ...pushSession(MONDAY), id: "a", prescription: { kind: "push" as const, levelIndex: 5, sets: 3, reps: 5 } };
    const d = data({ entries: [entryOn(MONDAY, 10), entryOn(MONDAY, 60, "plank")], sessions: [pushSession(MONDAY), archer] });
    expect(goalTotals(d, "pushups").get(MONDAY)).toBe(10 + 15 + 30);
    expect(goalTotals(d, "plank").get(MONDAY)).toBe(60);
  });
});

describe("todayPlan", () => {
  it("follows the default plan and skips pushups on the heavy push day", () => {
    const plan = todayPlan(data(), fromDayKey(MONDAY));
    expect(plan.workout).toBe("push");
    expect(plan.goals[0]!.scheduled).toBe(false);
    expect(plan.catchUp).toEqual([]);
  });

  it("flags any workout missed earlier in the week until it is made up", () => {
    const thursday = fromDayKey(addDays(MONDAY, 3));
    expect(todayPlan(data(), thursday).catchUp).toEqual(["push", "squat", "core"]);
    const d = data({
      sessions: [pushSession(addDays(MONDAY, 3)), { ...pushSession(MONDAY), id: "s", prescription: startingPrescription("squat") }],
    });
    // Thursday's own situps show as today's workout, Tuesday's are still missing.
    expect(todayPlan(d, thursday).catchUp).toEqual(["core"]);
  });

  it("does not count days before the programme started", () => {
    const wednesday = addDays(MONDAY, 2);
    expect(todayPlan(data({ startDay: wednesday }), fromDayKey(wednesday)).catchUp).toEqual([]);
  });

  it("uses the user's own schedule", () => {
    const d = data({ schedule: [null, "squat", null, null, null, null, null] });
    expect(todayPlan(d, fromDayKey(addDays(MONDAY, 1))).workout).toBe("squat");
    expect(todayPlan(d, fromDayKey(MONDAY)).workout).toBe(null);
  });
});

describe("migrate", () => {
  it("turns the pushup-only format into a pushup goal without losing the log", () => {
    const v1 = {
      version: 1,
      startDay: MONDAY,
      quickAdd: [3, 6, 9],
      pushEntries: [{ id: "e", count: 7, at: fromDayKey(MONDAY).toISOString() }],
      dailyEffort: { [MONDAY]: "easy" },
      sessions: [pushSession(MONDAY)],
      levelOverrides: {},
      dailyTargetOverride: { week: 2, target: 30 },
    };
    const d = migrate(v1, MONDAY);
    expect(d.onboarded).toBe(true);
    expect(d.goals).toEqual([
      expect.objectContaining({ id: "pushups", target: 30, targetWeek: 2, quickAdd: [3, 6, 9], days: [1, 2, 3, 4, 5, 6] }),
    ]);
    expect(d.entries).toEqual([{ ...v1.pushEntries[0], goalId: "pushups" }]);
    expect(d.dailyEffort).toEqual({ pushups: { [MONDAY]: "easy" } });
    expect(d.sessions).toHaveLength(1);
  });

  it("starts a fresh install in setup", () => {
    expect(migrate(null, MONDAY).onboarded).toBe(false);
  });
});
