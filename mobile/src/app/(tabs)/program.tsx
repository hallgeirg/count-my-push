import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Button, Card, Eyebrow, styles as ui } from "../../components/ui";
import { EFFORT_LABEL, LADDERS, WEEK_PLAN } from "../../program/catalog";
import { WEEKDAY_SHORT, daysOfProgramWeek, fromDayKey } from "../../program/dates";
import { currentPrescription, describePrescription, todayPlan } from "../../program/progression";
import type { WorkoutKind } from "../../program/types";
import { useAppData } from "../../store/AppDataProvider";
import { colors } from "../../theme";

const SHORT_NAME: Record<WorkoutKind, string> = { push: "Push", squat: "Knebøy", core: "Situps" };

export default function ProgramScreen() {
  const { data } = useAppData();
  if (!data) return null;
  const today = todayPlan(data);
  const days = daysOfProgramWeek(data.startDay, today.week);
  const history = data.sessions.slice().sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 12);

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content} contentInsetAdjustmentBehavior="automatic">
      <View style={{ gap: 4 }}>
        <Eyebrow>Uke {today.week + 1}</Eyebrow>
        <Text style={s.heading}>Program</Text>
      </View>

      <Card>
        <Eyebrow>Denne uka</Eyebrow>
        <View style={s.week}>
          {days.map((day, i) => {
            const plan = WEEK_PLAN[i]!;
            const done = plan.workout
              ? data.sessions.some((x) => x.day === day && x.prescription.kind === plan.workout)
              : false;
            const isToday = day === today.day;
            return (
              <View key={day} style={[s.day, isToday && s.dayToday]}>
                <Text style={[s.dayName, isToday && { color: colors.onAccent }]}>{WEEKDAY_SHORT[i]}</Text>
                <Text style={[s.dayWorkout, isToday && { color: colors.onAccent }]} numberOfLines={1}>
                  {plan.workout ? SHORT_NAME[plan.workout] : "Hvile"}
                </Text>
                <Text style={[s.dayMark, isToday && { color: colors.onAccent }]}>{done ? "✓" : " "}</Text>
              </View>
            );
          })}
        </View>
        <Text style={[ui.body, { fontSize: 13 }]}>
          Daglige pushups alle dager unntatt push-dagen. Situps på dagene uten push eller knebøy.
        </Text>
      </Card>

      <Card>
        <Eyebrow>Daglige pushups</Eyebrow>
        <Text style={ui.title}>{today.dailyTarget} per dag denne uka</Text>
        <Text style={ui.body}>
          Startet på 10. Hver mandag ser appen på forrige uke: nådde du målet minst 5 av 6 dager går det
          opp 2 (opp 4 om det mest var lett). Var en dag helt tom, holdes målet. Bommet du mer enn halvparten,
          går det ned 2.
        </Text>
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
                        passed && { color: colors.faint },
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
              </View>
            );
          })}
        </Card>
      ) : null}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  heading: { color: colors.text, fontSize: 30, fontWeight: "800", letterSpacing: -1 },
  week: { flexDirection: "row", gap: 4 },
  day: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 12, gap: 2 },
  dayToday: { backgroundColor: colors.accent },
  dayName: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  dayWorkout: { color: colors.text, fontSize: 10, fontWeight: "700" },
  dayMark: { color: colors.accent, fontSize: 14, fontWeight: "800" },
  level: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  levelCurrent: { backgroundColor: colors.accent },
  levelName: { color: colors.text, fontSize: 15, fontWeight: "600", flexShrink: 1 },
  levelReps: { color: colors.onAccent, fontWeight: "800", fontSize: 13 },
  history: { flexDirection: "row", gap: 12, paddingVertical: 6 },
  historyDate: { color: colors.muted, width: 56, fontVariant: ["tabular-nums"] },
  historyName: { color: colors.text, fontWeight: "700" },
  historyMeta: { color: colors.muted, fontSize: 13 },
});
