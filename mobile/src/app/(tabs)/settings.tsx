import { Alert, StyleSheet, Text, View } from "react-native";
import { Button, Card, Eyebrow, PageTitle, Screen, Stepper, styles as ui } from "../../components/ui";
import { LADDERS, MAX_DAILY_TARGET, MIN_DAILY_TARGET } from "../../program/catalog";
import { fromDayKey, mondayOf } from "../../program/dates";
import { currentPrescription, dailyTotals, todayPlan } from "../../program/progression";
import type { WorkoutKind } from "../../program/types";
import { useAppData } from "../../store/AppDataProvider";
import { colors, fonts } from "../../theme";

export default function SettingsScreen() {
  const { data, error, setQuickAdd, setDailyTarget, setLevel, restartProgram } = useAppData();
  if (!data) return null;
  const today = todayPlan(data);

  const totals = dailyTotals(data);
  const monday = mondayOf(today.day);
  const monthPrefix = today.day.slice(0, 7);
  let week = 0;
  let month = 0;
  let all = 0;
  for (const [day, n] of totals) {
    all += n;
    if (day >= monday && day <= today.day) week += n;
    if (day.startsWith(monthPrefix)) month += n;
  }

  function confirmRestart() {
    Alert.alert(
      "Start programmet på nytt?",
      "Nivåer, økter og dagsmål nullstilles og uke 1 starter i dag. Loggede pushups beholdes.",
      [
        { text: "Avbryt", style: "cancel" },
        { text: "Start på nytt", style: "destructive", onPress: restartProgram },
      ],
    );
  }

  return (
    <Screen>
      <PageTitle title="Innstillinger" />

      {error ? (
        <Card style={{ backgroundColor: colors.dangerSoft, borderColor: colors.dangerSoft }}>
          <Text style={{ color: colors.danger, fontFamily: fonts.bold }} accessibilityRole="alert">
            {error}
          </Text>
        </Card>
      ) : null}

      <Card>
        <Eyebrow>Pushups totalt</Eyebrow>
        <View style={s.stats}>
          <Stat label="Denne uka" value={week} />
          <Stat label="Denne måneden" value={month} />
          <Stat label="Totalt" value={all} />
        </View>
      </Card>

      <Card>
        <Eyebrow>Dagsmål pushups</Eyebrow>
        <Text style={ui.body}>
          Justeres automatisk hver uke. Endrer du det her, fortsetter progresjonen fra det nye tallet.
        </Text>
        <Stepper
          value={today.dailyTarget}
          min={MIN_DAILY_TARGET}
          max={MAX_DAILY_TARGET}
          onChange={setDailyTarget}
          label="dagsmål"
          suffix="per dag"
        />
      </Card>

      <Card>
        <Eyebrow>Hurtigknapper</Eyebrow>
        {data.quickAdd.map((n, i) => (
          <View key={i} style={s.row}>
            <Text style={s.rowLabel}>Knapp {i + 1}</Text>
            <Stepper
              value={n}
              min={1}
              max={200}
              label={`hurtigknapp ${i + 1}`}
              onChange={(v) => setQuickAdd(data.quickAdd.map((x, j) => (j === i ? v : x)))}
            />
          </View>
        ))}
      </Card>

      <Card>
        <Eyebrow>Nivå per øvelse</Eyebrow>
        <Text style={ui.body}>
          Treffer startnivået dårlig? Flytt deg opp eller ned. Neste økt starter nederst i rep-området for nivået.
        </Text>
        {(Object.keys(LADDERS) as WorkoutKind[]).map((kind) => {
          const ladder = LADDERS[kind];
          const p = currentPrescription(data, kind);
          return (
            <View key={kind} style={{ gap: 6, paddingVertical: 6 }}>
              <Text style={s.rowLabel}>{ladder.title}</Text>
              <View style={s.row}>
                <Text style={[ui.body, { flex: 1 }]} numberOfLines={2}>
                  {ladder.levels[p.levelIndex]!.name}
                </Text>
                <Stepper
                  value={p.levelIndex + 1}
                  min={1}
                  max={ladder.levels.length}
                  label={`nivå ${ladder.title.toLowerCase()}`}
                  onChange={(n) => setLevel(kind, n - 1)}
                />
              </View>
            </View>
          );
        })}
      </Card>

      <Card>
        <Eyebrow>Program</Eyebrow>
        <Text style={ui.body}>
          Startet {fromDayKey(data.startDay).toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric" })}
          . Alt lagres bare på denne telefonen.
        </Text>
        <Button label="Start programmet på nytt" variant="danger" onPress={confirmRestart} />
      </Card>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  rowLabel: { color: colors.text, fontFamily: fonts.bold, fontSize: 16 },
  stats: { flexDirection: "row", gap: 12 },
  statValue: { color: colors.text, fontFamily: fonts.bold, fontSize: 32, fontVariant: ["tabular-nums"] },
  statLabel: { color: colors.muted, fontFamily: fonts.mono, fontSize: 12 },
});
