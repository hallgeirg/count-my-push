import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ScheduleEditor } from "../components/pickers";
import { Button, Card, Chip, Eyebrow, PageTitle, Screen, Stepper, styles as ui } from "../components/ui";
import { GOAL_PRESETS, LADDERS, UNIT_RULES } from "../program/catalog";
import { currentPrescription } from "../program/progression";
import type { AppData, Goal, LevelOverride, WorkoutKind } from "../program/types";
import { currentWeek, useAppData } from "../store/AppDataProvider";
import { goalFromPreset } from "../store/migrate";
import { colors, fonts } from "../theme";

/** First-run setup: daily goals, the weekly plan and where each workout starts. */
export default function SetupScreen() {
  const { data } = useAppData();
  if (!data) return null;
  return <Setup d={data} />;
}

function Setup({ d }: { d: AppData }) {
  const { completeSetup } = useAppData();
  const week = currentWeek(d);
  const [goals, setGoals] = useState<Goal[]>(d.goals);
  const [schedule, setSchedule] = useState(d.schedule);
  const [levels, setLevels] = useState(() =>
    Object.fromEntries((Object.keys(LADDERS) as WorkoutKind[]).map((k) => [k, currentPrescription(d, k).levelIndex])),
  );
  const kinds = (Object.keys(LADDERS) as WorkoutKind[]).filter((k) => schedule.includes(k));

  const toggle = (id: string) => {
    const preset = GOAL_PRESETS.find((p) => p.id === id)!;
    setGoals((gs) => (gs.some((g) => g.id === id) ? gs.filter((g) => g.id !== id) : [...gs, goalFromPreset(preset, week)]));
  };

  function finish() {
    const at = new Date().toISOString();
    const levelOverrides: Partial<Record<WorkoutKind, LevelOverride>> = {};
    for (const k of Object.keys(LADDERS) as WorkoutKind[]) {
      const levelIndex = levels[k]!;
      if (levelIndex !== currentPrescription(d, k).levelIndex) {
        levelOverrides[k] = { levelIndex, reps: LADDERS[k].levels[levelIndex]!.minReps, at };
      }
    }
    completeSetup({ goals, schedule, levelOverrides: { ...d.levelOverrides, ...levelOverrides } });
    router.replace("/");
  }

  return (
    <Screen>
      <PageTitle eyebrow="Kom i gang" title="Sett opp treningen" />
      <Text style={ui.body}>Tre valg, så er du i gang. Alt kan endres senere.</Text>

      <Card>
        <Eyebrow>1 · Daglige mål</Eyebrow>
        <Text style={ui.body}>Små mål du logger i løpet av dagen, gjerne fordelt på flere runder.</Text>
        <View style={s.wrap}>
          {GOAL_PRESETS.map((p) => (
            <Chip key={p.id} label={p.name} selected={goals.some((g) => g.id === p.id)} onPress={() => toggle(p.id)} />
          ))}
        </View>
        {goals.map((g) => (
          <View key={g.id} style={s.row}>
            <Text style={[ui.strong, { flex: 1 }]}>{g.name}</Text>
            <Stepper
              value={g.target}
              min={UNIT_RULES[g.unit].min}
              max={UNIT_RULES[g.unit].max}
              step={g.unit === "seconds" ? 5 : 1}
              suffix={g.unit === "seconds" ? "sek" : "per dag"}
              label={`dagsmål ${g.name.toLowerCase()}`}
              onChange={(target) => setGoals((gs) => gs.map((x) => (x.id === g.id ? { ...x, target } : x)))}
            />
          </View>
        ))}
        <Text style={s.note}>Egne øvelser, dager og hurtigknapper legger du til under «I dag» etterpå.</Text>
      </Card>

      <Card>
        <Eyebrow>2 · Ukeplan</Eyebrow>
        <Text style={ui.body}>
          Tre styrkeøkter som går gradvis mot vanskeligere varianter. Velg «Ingen» for dager uten økt.
        </Text>
        <ScheduleEditor schedule={schedule} onChange={setSchedule} />
      </Card>

      {kinds.length > 0 ? (
        <Card>
          <Eyebrow>3 · Startnivå</Eyebrow>
          <Text style={ui.body}>Velg en variant du klarer med god form. Appen justerer etter hver økt.</Text>
          {kinds.map((k) => (
            <View key={k} style={{ gap: 6, paddingVertical: 4 }}>
              <Text style={ui.strong}>{LADDERS[k].title}</Text>
              <View style={s.row}>
                <Text style={[ui.body, { flex: 1 }]} numberOfLines={2}>
                  {LADDERS[k].levels[levels[k]!]!.name}
                </Text>
                <Stepper
                  value={levels[k]! + 1}
                  min={1}
                  max={LADDERS[k].levels.length}
                  label={`nivå ${LADDERS[k].title.toLowerCase()}`}
                  onChange={(n) => setLevels((l) => ({ ...l, [k]: n - 1 }))}
                />
              </View>
            </View>
          ))}
        </Card>
      ) : null}

      <Button label="Kom i gang" onPress={finish} />
    </Screen>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  note: { color: colors.muted, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
});
