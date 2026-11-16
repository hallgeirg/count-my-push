import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { DailyRing } from "../../components/DailyRing";
import { Button, Card, EffortPicker, Eyebrow, styles as ui } from "../../components/ui";
import { randomMilestoneLine, randomSuccessLine } from "../../lib/delight";
import { LADDERS } from "../../program/catalog";
import { WEEKDAY_LONG, dayKey } from "../../program/dates";
import { currentPrescription, describePrescription, todayPlan } from "../../program/progression";
import type { WorkoutKind } from "../../program/types";
import { useAppData } from "../../store/AppDataProvider";
import { colors } from "../../theme";

export default function TodayScreen() {
  const { data, addPush, removePush, setDailyEffort } = useAppData();
  const [message, setMessage] = useState<string | null>(null);
  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (messageTimer.current) clearTimeout(messageTimer.current);
    },
    [],
  );

  if (!data) {
    return (
      <View style={[s.screen, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const today = todayPlan(data);
  const goal = today.plan.dailyPushups ? today.dailyTarget : null;
  const todaysEntries = data.pushEntries
    .filter((e) => dayKey(new Date(e.at)) === today.day)
    .slice()
    .reverse();

  function onAdd(n: number) {
    const before = today.dailyDone;
    addPush(n);
    const milestone = goal != null && before < goal && before + n >= goal;
    void (milestone
      ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    ).catch(() => undefined);
    setMessage(milestone ? randomMilestoneLine() : randomSuccessLine());
    if (messageTimer.current) clearTimeout(messageTimer.current);
    messageTimer.current = setTimeout(() => setMessage(null), 2400);
  }

  const openSession = (kind: WorkoutKind) => router.push(`/session/${kind}`);

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={s.content}
      contentInsetAdjustmentBehavior="automatic"
    >
      <View style={{ gap: 4 }}>
        <Eyebrow>
          Uke {today.week + 1} · {WEEKDAY_LONG[today.weekday]}
        </Eyebrow>
        <Text style={s.heading}>Count My Push</Text>
      </View>

      {today.plan.workout ? (
        <WorkoutCard
          kind={today.plan.workout}
          done={today.workoutDone}
          onStart={() => openSession(today.plan.workout!)}
          prescriptionText={describe(data, today.plan.workout)}
        />
      ) : (
        <Card>
          <Eyebrow>Hviledag</Eyebrow>
          <Text style={ui.title}>Ingen økt i dag</Text>
          <Text style={ui.body}>Bare dagens pushups. La kroppen hente seg inn.</Text>
        </Card>
      )}

      {today.pushPending ? (
        <Card style={{ borderColor: "rgba(200,245,66,0.35)" }}>
          <Eyebrow>Ukas push-økt mangler</Eyebrow>
          <Text style={ui.body}>
            Du har ikke tatt den tunge push-økta denne uka. Ta den i dag i stedet for dagens pushups.
          </Text>
          <Button label="Start push-økt" variant="secondary" onPress={() => openSession("push")} />
        </Card>
      ) : null}

      <Card style={{ alignItems: "stretch" }}>
        <Eyebrow>Dagens pushups</Eyebrow>
        {today.plan.dailyPushups ? (
          <Text style={ui.body}>
            Mål: {today.dailyTarget} vanlige pushups, gjerne fordelt på flere sett. Stopp hvert sett med
            2–3 reps igjen.
          </Text>
        ) : (
          <Text style={ui.body}>Push-dag: de daglige pushupsene hviler. Logg gjerne likevel.</Text>
        )}
        <View style={{ paddingVertical: 8 }}>
          <DailyRing total={today.dailyDone} goal={goal} />
        </View>
        <View style={s.quickRow}>
          {data.quickAdd.map((n) => (
            <Pressable
              key={n}
              accessibilityRole="button"
              accessibilityLabel={`Legg til ${n} pushups`}
              onPress={() => onAdd(n)}
              style={({ pressed }) => [s.quick, pressed && { transform: [{ scale: 0.96 }], opacity: 0.85 }]}
            >
              <Text style={s.quickText}>+{n}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={s.message} accessibilityLiveRegion="polite">
          {message ?? " "}
        </Text>

        {goal != null && today.dailyDone >= goal ? (
          <View style={{ gap: 8 }}>
            <Text style={[ui.body, { color: colors.text, fontWeight: "700" }]}>
              Hvordan kjentes dagens pushups?
            </Text>
            <EffortPicker
              value={data.dailyEffort[today.day] ?? null}
              onChange={(e) => setDailyEffort(today.day, e)}
            />
            <Text style={[ui.body, { fontSize: 13 }]}>
              Brukes til å justere dagsmålet hver uke. Lett gir raskere økning, helt tomt holder målet.
            </Text>
          </View>
        ) : null}
      </Card>

      {todaysEntries.length > 0 ? (
        <Card>
          <Eyebrow>Logget i dag</Eyebrow>
          {todaysEntries.map((e) => (
            <View key={e.id} style={s.entry}>
              <Text style={s.entryCount}>{e.count}</Text>
              <Text style={s.entryTime}>
                {new Date(e.at).toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" })}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Angre ${e.count} pushups`}
                hitSlop={8}
                onPress={() => removePush(e.id)}
                style={s.undo}
              >
                <Text style={s.undoText}>Angre</Text>
              </Pressable>
            </View>
          ))}
        </Card>
      ) : null}
    </ScrollView>
  );
}

function describe(data: NonNullable<ReturnType<typeof useAppData>["data"]>, kind: WorkoutKind) {
  const p = currentPrescription(data, kind);
  return `${LADDERS[kind].levels[p.levelIndex]!.name} · ${describePrescription(p)}`;
}

function WorkoutCard({
  kind,
  done,
  onStart,
  prescriptionText,
}: {
  kind: WorkoutKind;
  done: boolean;
  onStart: () => void;
  prescriptionText: string;
}) {
  const ladder = LADDERS[kind];
  return (
    <Card>
      <Eyebrow>Dagens økt</Eyebrow>
      <Text style={ui.title}>{ladder.title}</Text>
      <Text style={ui.body}>{ladder.goal}</Text>
      <Text style={[ui.body, { color: colors.text, fontWeight: "700" }]}>{prescriptionText}</Text>
      {done ? (
        <Text style={{ color: colors.accent, fontWeight: "800", fontSize: 16 }}>✓ Fullført i dag</Text>
      ) : (
        <Button label="Start økt" onPress={onStart} />
      )}
    </Card>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  heading: { color: colors.text, fontSize: 30, fontWeight: "800", letterSpacing: -1 },
  quickRow: { flexDirection: "row", gap: 10 },
  quick: {
    flex: 1,
    minHeight: 56,
    borderRadius: 16,
    borderCurve: "continuous",
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  quickText: { color: colors.onAccent, fontSize: 20, fontWeight: "800" },
  message: { color: colors.muted, textAlign: "center", fontSize: 13, minHeight: 18 },
  entry: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 40 },
  entryCount: { color: colors.text, fontSize: 18, fontWeight: "800", minWidth: 36, fontVariant: ["tabular-nums"] },
  entryTime: { color: colors.muted, flex: 1, fontVariant: ["tabular-nums"] },
  undo: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.line },
  undoText: { color: colors.muted, fontWeight: "700", fontSize: 13 },
});
