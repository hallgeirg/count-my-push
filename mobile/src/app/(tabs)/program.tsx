import { router } from "expo-router";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { describeDays } from "../../components/pickers";
import { Button, Card, Eyebrow, PageTitle, Screen, styles as ui } from "../../components/ui";
import { EFFORT_LABEL, LADDERS, SHORT_NAME, UNIT_RULES } from "../../program/catalog";
import { WEEKDAY_SHORT, daysOfProgramWeek, fromDayKey } from "../../program/dates";
import { currentPrescription, describePrescription, formatAmount, todayPlan } from "../../program/progression";
import type { WorkoutKind } from "../../program/types";
import { useAppData } from "../../store/AppDataProvider";
import { colors, fonts, radius } from "../../theme";

export default function ProgramScreen() {
  const { data, deleteSession } = useAppData();
  if (!data) return null;
  const today = todayPlan(data);
  const days = daysOfProgramWeek(data.startDay, today.week);
  const history = data.sessions.slice().sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 12);

  return (
    <Screen>
      <PageTitle eyebrow={`Uke ${today.week + 1}`} title="Program" />

      <Card>
        <Eyebrow>Denne uka</Eyebrow>
        <View style={s.week}>
          {days.map((day, i) => {
            const workout = data.schedule[i] ?? null;
            const done = workout
              ? data.sessions.some((x) => x.day === day && x.prescription.kind === workout)
              : false;
            const isToday = day === today.day;
            return (
              <View key={day} style={[s.day, isToday && s.dayToday]}>
                <Text style={[s.dayName, isToday && { color: colors.onAccent }]}>{WEEKDAY_SHORT[i]}</Text>
                <Text style={[s.dayWorkout, isToday && { color: colors.onAccent }]} numberOfLines={1}>
                  {workout ? SHORT_NAME[workout] : "Fri"}
                </Text>
                <Text style={[s.dayMark, isToday && { color: colors.onAccent }]} accessibilityLabel={done ? "fullført" : undefined}>
                  {done ? "✓" : " "}
                </Text>
              </View>
            );
          })}
        </View>
        <Button label="Endre ukeplan" variant="secondary" onPress={() => router.push("/schedule")} />
      </Card>

      <Card>
        <Eyebrow>Daglige mål denne uka</Eyebrow>
        {today.goals.length === 0 ? <Text style={ui.body}>Ingen daglige mål.</Text> : null}
        {today.goals.map(({ goal, target }) => (
          <Pressable
            key={goal.id}
            accessibilityRole="button"
            accessibilityLabel={`${goal.name}, ${target} ${UNIT_RULES[goal.unit].label}, ${describeDays(goal.days)}. Endre`}
            onPress={() => router.push(`/goal/${goal.id}`)}
            style={({ pressed }) => [s.goalRow, pressed && { backgroundColor: colors.surfaceSubtle }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={s.historyName}>{goal.name}</Text>
              <Text style={s.historyMeta}>
                {describeDays(goal.days)}
                {goal.adaptive ? " · justeres hver uke" : ""}
              </Text>
            </View>
            <Text style={s.goalTarget}>{formatAmount(target, goal.unit)}</Text>
          </Pressable>
        ))}
        <Text style={[ui.body, { fontSize: 14, lineHeight: 20 }]}>
          Mål som justeres automatisk, vurderes hver mandag. Når du nådde målet minst 80 % av dagene, går det
          opp ett hakk, eller to hakk om det mest var lett. Var en dag helt tom, holdes målet. Bommet du på
          mer enn halvparten, går det ned ett hakk.
        </Text>
        <Button label="Legg til mål" variant="secondary" onPress={() => router.push("/goal/new")} />
      </Card>

      {(Object.keys(LADDERS) as WorkoutKind[]).map((kind) => {
        const ladder = LADDERS[kind];
        const p = currentPrescription(data, kind);
        return (
          <Card key={kind}>
            <Eyebrow>{ladder.title}</Eyebrow>
            <Text style={ui.body}>{ladder.goal}</Text>
            <View style={{ gap: 2 }}>
              {ladder.levels.map((level, i) => {
                const current = i === p.levelIndex;
                const passed = i < p.levelIndex;
                return (
                  <View key={level.name} style={[s.level, current && s.levelCurrent]}>
                    <Text
                      style={[
                        s.levelName,
                        passed && { color: colors.muted },
                        current && { color: colors.onAccent },
                      ]}
                    >
                      {passed ? "✓ " : `${i + 1}. `}
                      {level.name}
                    </Text>
                    {current ? <Text style={s.levelReps}>{describePrescription(p)}</Text> : null}
                  </View>
                );
              })}
            </View>
            <Button
              label={`Start ${ladder.title.toLowerCase()}`}
              variant="secondary"
              onPress={() => router.push(`/session/${kind}`)}
            />
          </Card>
        );
      })}

      <Card>
        <Eyebrow>Slik går du videre</Eyebrow>
        <Text style={ui.body}>
          Etter hver økt velger du hvordan siste sett kjentes. Klarte du alle settene med litt igjen, går
          appen opp én rep (to om det var lett). Når toppen av rep-området er nådd, får du neste variant.
          Push-økta er alltid 3 × 5 nesten tomt – der går du rett til neste variant når 3 × 5 sitter. Helt
          tomt holder nivået; en klart bommet økt tar deg ett hakk ned.
        </Text>
      </Card>

      {history.length > 0 ? (
        <Card>
          <Eyebrow>Siste økter</Eyebrow>
          {history.map((h) => {
            const level = LADDERS[h.prescription.kind].levels[h.prescription.levelIndex]!;
            return (
              <View key={h.id} style={s.history}>
                <Text style={s.historyDate}>
                  {fromDayKey(h.day).toLocaleDateString("nb-NO", { day: "numeric", month: "short" })}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.historyName}>{level.name}</Text>
                  <Text style={s.historyMeta}>
                    {h.sets.join(" · ")} · {EFFORT_LABEL[h.effort].title}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Slett økta ${level.name}`}
                  hitSlop={8}
                  onPress={() =>
                    Alert.alert("Slette økta?", "Neste økt beregnes på nytt ut fra økta før denne.", [
                      { text: "Avbryt", style: "cancel" },
                      { text: "Slett", style: "destructive", onPress: () => deleteSession(h.id) },
                    ])
                  }
                  style={({ pressed }) => [s.delete, pressed && { backgroundColor: colors.surfaceSubtle }]}
                >
                  <Text style={s.deleteText}>Slett</Text>
                </Pressable>
              </View>
            );
          })}
        </Card>
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  week: { flexDirection: "row", gap: 4 },
  day: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: radius.control, gap: 2 },
  dayToday: { backgroundColor: colors.accent },
  dayName: { color: colors.muted, fontFamily: fonts.mono, fontSize: 12 },
  dayWorkout: { color: colors.text, fontFamily: fonts.bold, fontSize: 11 },
  dayMark: { color: colors.good, fontFamily: fonts.bold, fontSize: 14 },
  level: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 40,
    paddingHorizontal: 10,
    borderRadius: radius.control,
  },
  levelCurrent: { backgroundColor: colors.accent },
  levelName: { color: colors.text, fontFamily: fonts.regular, fontSize: 16, flexShrink: 1 },
  levelReps: { color: colors.onAccent, fontFamily: fonts.bold, fontSize: 15, fontVariant: ["tabular-nums"] },
  history: { flexDirection: "row", gap: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.line },
  historyDate: { color: colors.muted, fontFamily: fonts.mono, fontSize: 13, width: 64, paddingTop: 2 },
  historyName: { color: colors.text, fontFamily: fonts.bold, fontSize: 16 },
  goalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 8,
    borderRadius: radius.control,
  },
  goalTarget: { color: colors.text, fontFamily: fonts.bold, fontSize: 20, fontVariant: ["tabular-nums"] },
  delete: {
    alignSelf: "center",
    minHeight: 36,
    paddingHorizontal: 12,
    justifyContent: "center",
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.line,
  },
  deleteText: { color: colors.danger, fontFamily: fonts.bold, fontSize: 14 },
  historyMeta: { color: colors.muted, fontFamily: fonts.regular, fontSize: 14 },
});
