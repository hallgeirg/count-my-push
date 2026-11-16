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
import { dayKey, programWeek } from "../program/dates";
import type { AppData, DayKey, Effort, SessionLog, WorkoutKind } from "../program/types";

const STORAGE_KEY = "count-my-push:v1";

export function emptyData(today: DayKey = dayKey(new Date())): AppData {
  return {
    version: 1,
    startDay: today,
    quickAdd: [5, 10, 20],
    pushEntries: [],
    dailyEffort: {},
    sessions: [],
    levelOverrides: {},
    dailyTargetOverride: null,
  };
}

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

type Actions = {
  addPush: (count: number) => string;
  removePush: (id: string) => void;
  setDailyEffort: (day: DayKey, effort: Effort | null) => void;
  saveSession: (log: Omit<SessionLog, "id">) => void;
  setQuickAdd: (amounts: number[]) => void;
  setDailyTarget: (target: number) => void;
  setLevel: (kind: WorkoutKind, levelIndex: number) => void;
  restartProgram: () => void;
};

type ContextValue = { data: AppData | null; error: string | null } & Actions;

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
        const parsed = raw ? ({ ...emptyData(), ...JSON.parse(raw) } as AppData) : emptyData();
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
      addPush(count) {
        const id = newId();
        const at = new Date().toISOString();
        update((d) => ({ ...d, pushEntries: [...d.pushEntries, { id, count, at }] }));
        return id;
      },
      removePush(id) {
        update((d) => ({ ...d, pushEntries: d.pushEntries.filter((e) => e.id !== id) }));
      },
      setDailyEffort(day, effort) {
        update((d) => {
          const dailyEffort = { ...d.dailyEffort };
          if (effort) dailyEffort[day] = effort;
          else delete dailyEffort[day];
          return { ...d, dailyEffort };
        });
      },
      saveSession(log) {
        update((d) => ({ ...d, sessions: [...d.sessions, { ...log, id: newId() }] }));
      },
      setQuickAdd(amounts) {
        update((d) => ({ ...d, quickAdd: amounts }));
      },
      setDailyTarget(target) {
        update((d) => {
          const week = Math.max(0, programWeek(d.startDay, dayKey(new Date())));
          return { ...d, dailyTargetOverride: { week, target } };
        });
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
      restartProgram() {
        update((d) => ({ ...emptyData(), quickAdd: d.quickAdd, pushEntries: d.pushEntries }));
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
