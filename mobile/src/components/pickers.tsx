import { StyleSheet, Text, View } from "react-native";
import { LADDERS, SHORT_NAME } from "../program/catalog";
import { WEEKDAY_LONG, WEEKDAY_SHORT } from "../program/dates";
import type { WorkoutKind } from "../program/types";
import { colors, fonts } from "../theme";
import { Chip } from "./ui";

/** "Alle dager", "Hverdager" or "Man, Ons, Fre". */
export function describeDays(days: number[]): string {
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.length === 7) return "Alle dager";
  if (sorted.length === 0) return "Ingen dager";
  if (sorted.join() === "0,1,2,3,4") return "Hverdager";
  if (sorted.join() === "5,6") return "Helg";
  return sorted.map((d) => WEEKDAY_SHORT[d]).join(", ");
}

/** Seven weekday toggles, Monday first. */
export function WeekdayPicker({ days, onChange }: { days: number[]; onChange: (days: number[]) => void }) {
  return (
    <View style={s.row}>
      {WEEKDAY_SHORT.map((label, i) => {
        const on = days.includes(i);
        return (
          <View key={label} style={{ flex: 1 }}>
            <Chip
              label={label}
              accessibilityLabel={WEEKDAY_LONG[i]}
              selected={on}
              onPress={() => onChange(on ? days.filter((d) => d !== i) : [...days, i].sort((a, b) => a - b))}
            />
          </View>
        );
      })}
    </View>
  );
}

const CHOICES: (WorkoutKind | null)[] = [...(Object.keys(LADDERS) as WorkoutKind[]), null];

/** One row per weekday with a choice of workout or none. */
export function ScheduleEditor({
  schedule,
  onChange,
}: {
  schedule: (WorkoutKind | null)[];
  onChange: (schedule: (WorkoutKind | null)[]) => void;
}) {
  return (
    <View style={{ gap: 10 }}>
      {WEEKDAY_LONG.map((day, i) => (
        <View key={day} style={s.scheduleRow}>
          <Text style={s.day}>{WEEKDAY_SHORT[i]}</Text>
          <View style={[s.row, { flex: 1 }]}>
            {CHOICES.map((kind) => (
              <View key={kind ?? "rest"} style={{ flex: 1 }}>
                <Chip
                  label={kind ? SHORT_NAME[kind] : "Ingen"}
                  accessibilityLabel={`${day}: ${kind ? LADDERS[kind].title : "ingen økt"}`}
                  selected={(schedule[i] ?? null) === kind}
                  onPress={() => onChange(schedule.map((k, j) => (j === i ? kind : (k ?? null))))}
                />
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", gap: 4 },
  scheduleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  day: { color: colors.muted, fontFamily: fonts.mono, fontSize: 13, width: 32 },
});
