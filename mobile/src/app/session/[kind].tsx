import * as Haptics from "expo-haptics";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button, Card, EffortPicker, Eyebrow, Stepper, styles as ui } from "../../components/ui";
import { LADDERS } from "../../program/catalog";
import { dayKey } from "../../program/dates";
import { currentPrescription, describePrescription, nextPrescription } from "../../program/progression";
import type { Effort, Prescription, WorkoutKind } from "../../program/types";
import { useAppData } from "../../store/AppDataProvider";
import { colors, fonts, radius } from "../../theme";

const KINDS: WorkoutKind[] = ["push", "squat", "core"];

export default function SessionScreen() {
  const params = useLocalSearchParams<{ kind: string }>();
  const kind = KINDS.find((k) => k === params.kind);
  const { data } = useAppData();
  if (!kind || !data) return null;
  return <Session kind={kind} initial={currentPrescription(data, kind)} />;
}

function Session({ kind, initial }: { kind: WorkoutKind; initial: Prescription }) {
  const { saveSession } = useAppData();
  const ladder = LADDERS[kind];
  // Freeze the prescription for the length of the workout.
  const [prescription] = useState(initial);
  const level = ladder.levels[prescription.levelIndex]!;
  const [reps, setReps] = useState<number[]>(() => Array(prescription.sets).fill(prescription.reps));
  const [completed, setCompleted] = useState(0);
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [effort, setEffort] = useState<Effort | null>(null);
  const [saved, setSaved] = useState<Prescription | null>(null);

  const restLeft = restEndsAt ? Math.max(0, Math.ceil((restEndsAt - now) / 1000)) : 0;

  useEffect(() => {
    if (!restEndsAt) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [restEndsAt]);

  useEffect(() => {
    if (restEndsAt && restLeft === 0) {
      setRestEndsAt(null);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    }
  }, [restEndsAt, restLeft]);

  const allDone = completed >= prescription.sets;
  const nearFailure = kind === "push";

  function finishSet() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);
    const next = completed + 1;
    setCompleted(next);
    if (next < prescription.sets) {
      setNow(Date.now());
      setRestEndsAt(Date.now() + ladder.restSeconds * 1000);
    }
  }

  function save() {
    if (!effort) return;
    const done = reps.slice(0, prescription.sets);
    saveSession({
      day: dayKey(new Date()),
      at: new Date().toISOString(),
      prescription,
      sets: done,
      effort,
    });
    setSaved(nextPrescription(prescription, done, effort));
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content} contentInsetAdjustmentBehavior="automatic">
      <Stack.Screen options={{ title: ladder.title }} />

      <View style={{ gap: 6 }}>
        <Eyebrow>{ladder.title}</Eyebrow>
        <Text style={s.heading}>{level.name}</Text>
        <Text style={ui.body}>{level.cue}</Text>
        <Text style={ui.strong}>
          {describePrescription(prescription)} ·{" "}
          {nearFailure ? "nesten tomt – stopp med 1 rep igjen" : "stopp med 1–3 reps igjen"}
        </Text>
      </View>

      {restEndsAt ? (
        <Card style={{ alignItems: "center", backgroundColor: colors.hero, borderColor: colors.hero }}>
          <Eyebrow style={{ color: colors.heroEyebrow }}>Pause</Eyebrow>
          <Text style={s.timer} accessibilityLabel={`${restLeft} sekunder pause igjen`}>
            {Math.floor(restLeft / 60)}:{String(restLeft % 60).padStart(2, "0")}
          </Text>
          <Button label="Hopp over pausen" variant="onHero" onPress={() => setRestEndsAt(null)} />
        </Card>
      ) : null}

      <Card>
        {reps.map((value, i) => {
          const isDone = i < completed;
          const isCurrent = i === completed && !restEndsAt && !saved;
          return (
            <View key={i} style={[s.setRow, isCurrent && s.setRowCurrent]}>
              <Text style={[s.setLabel, isDone && { color: colors.accent }]}>
                {isDone ? "✓ " : ""}Sett {i + 1}
              </Text>
              <Stepper
                value={value}
                label={`sett ${i + 1}`}
                min={0}
                max={200}
                suffix={level.perSide ? "per side" : "reps"}
                onChange={(n) => setReps((r) => r.map((x, j) => (j === i ? n : x)))}
              />
            </View>
          );
        })}
        {!allDone && !restEndsAt ? (
          <Button label={`Sett ${completed + 1} ferdig`} onPress={finishSet} />
        ) : null}
        <Text style={[ui.body, { fontSize: 14, lineHeight: 20 }]}>
          Juster antall om du tok flere eller færre enn planlagt.
        </Text>
      </Card>

      {allDone && !saved ? (
        <Card>
          <Eyebrow>Hvordan kjentes siste sett?</Eyebrow>
          <EffortPicker value={effort} onChange={setEffort} />
          <Button label="Lagre økt" onPress={save} disabled={!effort} />
        </Card>
      ) : null}

      {saved ? (
        <Card style={{ borderColor: colors.good }}>
          <Eyebrow style={{ color: colors.good }}>Lagret</Eyebrow>
          <Text style={ui.title}>Bra jobba!</Text>
          <Text style={ui.body}>
            Neste gang: {ladder.levels[saved.levelIndex]!.name} · {describePrescription(saved)}
          </Text>
          <Button label="Ferdig" onPress={() => router.back()} />
        </Card>
      ) : (
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={{ alignSelf: "center", minHeight: 44, justifyContent: "center", paddingHorizontal: 16 }}>
          <Text style={{ color: colors.muted, fontFamily: fonts.bold, fontSize: 16 }}>Avbryt</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 16, paddingBottom: 48 },
  heading: { color: colors.text, fontFamily: fonts.bold, fontSize: 32, lineHeight: 36, letterSpacing: -0.8 },
  timer: {
    color: colors.heroText,
    fontFamily: fonts.bold,
    fontSize: 72,
    fontVariant: ["tabular-nums"],
    letterSpacing: -2,
  },
  setRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: radius.control,
  },
  setRowCurrent: { backgroundColor: colors.accentSoft },
  setLabel: { color: colors.text, fontFamily: fonts.bold, fontSize: 16 },
});
