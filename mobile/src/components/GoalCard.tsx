import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { UNIT_RULES } from "../program/catalog";
import { formatAmount, type GoalProgress } from "../program/progression";
import type { Effort, LogEntry } from "../program/types";
import { colors, fonts, radius } from "../theme";
import { Card, EffortPicker, Eyebrow, styles as ui } from "./ui";

/** One daily goal: progress, quick-add buttons, the day's log with undo, and how it felt. */
export function GoalCard({
  progress,
  entries,
  effort,
  onAdd,
  onUndo,
  onEffort,
}: {
  progress: GoalProgress;
  /** This goal's entries for the day, newest first. */
  entries: LogEntry[];
  effort: Effort | null;
  onAdd: (n: number) => void;
  onUndo: (id: string) => void;
  onEffort: (e: Effort) => void;
}) {
  const { goal, target, done, scheduled } = progress;
  const reached = scheduled && done >= target;
  const unit = UNIT_RULES[goal.unit];
  const share = scheduled && target > 0 ? Math.min(1, done / target) : 0;

  return (
    <Card style={reached ? { borderColor: colors.good } : undefined}>
      <View style={s.header}>
        <View style={{ flex: 1, gap: 2 }}>
          {!scheduled ? <Eyebrow>Ikke planlagt i dag</Eyebrow> : null}
          <Text style={ui.title}>{goal.name}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Endre målet ${goal.name}`}
          hitSlop={8}
          onPress={() => router.push(`/goal/${goal.id}`)}
          style={({ pressed }) => [s.edit, pressed && { backgroundColor: colors.surfaceSubtle }]}
        >
          <Text style={s.editText}>Endre</Text>
        </Pressable>
      </View>

      <View accessible accessibilityLabel={scheduled ? `${done} av ${target} ${unit.label}` : `${done} ${unit.label} i dag`}>
        <Text style={s.count}>
          {formatAmount(done, goal.unit)}
          {scheduled ? <Text style={s.target}> / {formatAmount(target, goal.unit)}</Text> : null}
        </Text>
        {scheduled ? (
          <View style={s.track}>
            <View style={[s.fill, { width: `${share * 100}%` }, reached && { backgroundColor: colors.good }]} />
          </View>
        ) : null}
      </View>

      <View style={s.quickRow}>
        {goal.quickAdd.map((n, i) => (
          <Pressable
            key={i}
            accessibilityRole="button"
            accessibilityLabel={`Legg til ${n} ${unit.label} ${goal.name.toLowerCase()}`}
            onPress={() => onAdd(n)}
            style={({ pressed }) => [s.quick, pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 }]}
          >
            <Text style={s.quickText}>+{formatAmount(n, goal.unit)}</Text>
          </Pressable>
        ))}
      </View>

      {reached && goal.adaptive ? (
        <View style={{ gap: 8 }}>
          <Text style={ui.strong}>Hvordan kjentes det?</Text>
          <EffortPicker value={effort} onChange={onEffort} />
        </View>
      ) : null}

      {entries.length > 0 ? (
        <View>
          {entries.map((e) => (
            <View key={e.id} style={s.entry}>
              <Text style={s.entryCount}>{formatAmount(e.count, goal.unit)}</Text>
              <Text style={s.entryTime}>
                {new Date(e.at).toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" })}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Angre ${e.count} ${unit.label} ${goal.name.toLowerCase()}`}
                hitSlop={8}
                onPress={() => onUndo(e.id)}
                style={({ pressed }) => [s.edit, pressed && { backgroundColor: colors.surfaceSubtle }]}
              >
                <Text style={s.editText}>Angre</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  edit: {
    minHeight: 36,
    paddingHorizontal: 12,
    justifyContent: "center",
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.line,
  },
  editText: { color: colors.text, fontFamily: fonts.bold, fontSize: 14 },
  count: { color: colors.text, fontFamily: fonts.bold, fontSize: 32, letterSpacing: -1, fontVariant: ["tabular-nums"] },
  target: { color: colors.muted, fontFamily: fonts.regular, fontSize: 20 },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceSubtle, overflow: "hidden", marginTop: 6 },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.accent },
  quickRow: { flexDirection: "row", gap: 8 },
  quick: {
    flex: 1,
    minHeight: 52,
    borderRadius: radius.control,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  quickText: { color: colors.onAccent, fontFamily: fonts.bold, fontSize: 18, fontVariant: ["tabular-nums"] },
  entry: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 48,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  entryCount: { color: colors.text, fontFamily: fonts.bold, fontSize: 18, minWidth: 48, fontVariant: ["tabular-nums"] },
  entryTime: { color: colors.muted, fontFamily: fonts.mono, fontSize: 13, flex: 1 },
});
