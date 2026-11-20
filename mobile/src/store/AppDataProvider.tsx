import Storage from "expo-sqlite/kv-store";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { LADDERS } from "../program/catalog";
import { dayKey, fromDayKey, programWeek } from "../program/dates";
import type { AppData, DayKey, Effort, Goal, SessionLog, WorkoutKind } from "../program/types";
import { emptyData, migrate, newId } from "./migrate";

/** Kept from the first release; `migrate` upgrades what is stored under it. */
const STORAGE_KEY = "count-my-push:v1";

export { emptyData, newId };

type Actions = {
  /** Logs an amount for a goal, today unless a past `day` is given. */
  addEntry: (goalId: string, count: number, day?: DayKey) => string;
  removeEntry: (id: string) => void;
  setDailyEffort: (goalId: string, day: DayKey, effort: Effort | null) => void;
  saveSession: (log: Omit<SessionLog, "id">) => void;
  deleteSession: (id: string) => void;
  saveGoal: (goal: Goal) => void;
  removeGoal: (id: string) => void;
  setSchedule: (schedule: (WorkoutKind | null)[]) => void;
  setLevel: (kind: WorkoutKind, levelIndex: number) => void;
  completeSetup: (setup: Pick<AppData, "goals" | "schedule" | "levelOverrides">) => void;
  /** Keeps goals and the log, clears levels and sessions, and opens setup again. */
  restartProgram: () => void;
};

type ContextValue = { data: AppData | null; error: string | null } & Actions;

/** The current programme week, never negative. */
export function currentWeek(data: Pick<AppData, "startDay">): number {
  return Math.max(0, programWeek(data.startDay, dayKey(new Date())));
}

const AppDataContext = createContext<ContextValue | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    let cancelled = false;
    Storage.getItemAsync(STORAGE_KEY)
      .then((raw) => {
        if (cancelled) return;
        const parsed = migrate(raw ? JSON.parse(raw) : null);
        loaded.current = true;
        setData(parsed);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Kunne ikke lese lagrede data.");
        loaded.current = true;
        setData(emptyData());
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loaded.current || !data) return;
    Storage.setItemAsync(STORAGE_KEY, JSON.stringify(data)).catch((e: unknown) => {
      setError(e instanceof Error ? e.message : "Kunne ikke lagre.");
    });
  }, [data]);

  const update = useCallback((fn: (prev: AppData) => AppData) => {
    setData((prev) => (prev ? fn(prev) : prev));
  }, []);

  const actions = useMemo<Actions>(
    () => ({
      addEntry(goalId, count, day) {
        const id = newId();
        const at = day && day !== dayKey(new Date()) ? fromDayKey(day).toISOString() : new Date().toISOString();
        update((d) => ({ ...d, entries: [...d.entries, { id, goalId, count, at }] }));
        return id;
      },
      removeEntry(id) {
        update((d) => ({ ...d, entries: d.entries.filter((e) => e.id !== id) }));
      },
      setDailyEffort(goalId, day, effort) {
        update((d) => {
          const forGoal = { ...d.dailyEffort[goalId] };
          if (effort) forGoal[day] = effort;
          else delete forGoal[day];
          return { ...d, dailyEffort: { ...d.dailyEffort, [goalId]: forGoal } };
        });
      },
      saveSession(log) {
        update((d) => ({ ...d, sessions: [...d.sessions, { ...log, id: newId() }] }));
      },
      deleteSession(id) {
        update((d) => ({ ...d, sessions: d.sessions.filter((s) => s.id !== id) }));
      },
      saveGoal(goal) {
        update((d) => ({
          ...d,
          goals: d.goals.some((g) => g.id === goal.id)
            ? d.goals.map((g) => (g.id === goal.id ? goal : g))
            : [...d.goals, goal],
        }));
      },
      removeGoal(id) {
        update((d) => ({ ...d, goals: d.goals.filter((g) => g.id !== id) }));
      },
      setSchedule(schedule) {
        update((d) => ({ ...d, schedule }));
      },
      setLevel(kind, levelIndex) {
        const level = LADDERS[kind].levels[levelIndex];
        if (!level) return;
        update((d) => ({
          ...d,
          levelOverrides: {
            ...d.levelOverrides,
            [kind]: { levelIndex, reps: level.minReps, at: new Date().toISOString() },
          },
        }));
      },
      completeSetup(setup) {
        update((d) => ({ ...d, ...setup, onboarded: true }));
      },
      restartProgram() {
        update((d) => ({
          ...emptyData(),
          goals: d.goals.map((g) => ({ ...g, targetWeek: 0 })),
          entries: d.entries,
          schedule: d.schedule,
        }));
      },
    }),
    [update],
  );

  const value = useMemo(() => ({ data, error, ...actions }), [data, error, actions]);
  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): ContextValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used inside AppDataProvider");
  return ctx;
}
