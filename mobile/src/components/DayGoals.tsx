import * as Haptics from "expo-haptics";
import { dayKey } from "../program/dates";
import type { GoalProgress } from "../program/progression";
import type { DayKey } from "../program/types";
import { useAppData } from "../store/AppDataProvider";
import { GoalCard } from "./GoalCard";

/** Goal cards for one day, wired to the log. `onLogged` reports whether a goal was just reached. */
export function DayGoals({
  day,
  goals,
  onLogged,
}: {
  day: DayKey;
  goals: GoalProgress[];
  onLogged?: (reachedGoal: boolean) => void;
}) {
  const { data, addEntry, removeEntry, setDailyEffort } = useAppData();
  if (!data) return null;

  return (
    <>
      {goals.map((p) => {
        const entries = data.entries
          .filter((e) => e.goalId === p.goal.id && dayKey(new Date(e.at)) === day)
          .reverse();
        return (
          <GoalCard
            key={p.goal.id}
            progress={p}
            entries={entries}
            effort={data.dailyEffort[p.goal.id]?.[day] ?? null}
            onAdd={(n) => {
              const reached = p.scheduled && p.done < p.target && p.done + n >= p.target;
              addEntry(p.goal.id, n, day);
              void (reached
                ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
              ).catch(() => undefined);
              onLogged?.(reached);
            }}
            onUndo={removeEntry}
            onEffort={(e) => setDailyEffort(p.goal.id, day, e)}
          />
        );
      })}
    </>
  );
}
