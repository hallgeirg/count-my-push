import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { BrandMark } from "../../components/brand/BrandMark";
import { HeroBackground } from "../../components/brand/HeroBackground";
import { Button, Card, EffortPicker, Eyebrow, Screen, styles as ui } from "../../components/ui";
import { randomMilestoneLine, randomSuccessLine } from "../../lib/delight";
import { LADDERS } from "../../program/catalog";
import { WEEKDAY_LONG, dayKey } from "../../program/dates";
import { currentPrescription, describePrescription, todayPlan } from "../../program/progression";
import type { WorkoutKind } from "../../program/types";
import { useAppData } from "../../store/AppDataProvider";
import { colors, fonts, radius } from "../../theme";

/** Push-only days have no daily target; the mark then rests part-way, as in the portal's still image. */
const REST_DAY_PROGRESS = 0.4;

export default function TodayScreen() {
  const { data, addPush, removePush, setDailyEffort } = useAppData();
  const [message, setMessage] = useState<string | null>(null);
  const [heroWidth, setHeroWidth] = useState(0);
  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (messageTimer.current) clearTimeout(messageTimer.current);
    },
    [],
  );

  if (!data) {
    return (
      <View style={[ui.screen, { alignItems: "center", justifyContent: "center" }]}>
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
    <Screen>
      <View style={s.hero} onLayout={(e) => setHeroWidth(e.nativeEvent.layout.width)}>
        <HeroBackground />
        <View style={{ gap: 10 }}>
          <View style={s.eyebrowRow}>
            <View style={s.eyebrowPixel} />
            <Eyebrow style={{ color: colors.heroEyebrow }}>
              Uke {today.week + 1} · {WEEKDAY_LONG[today.weekday]}
            </Eyebrow>
          </View>
          <Text style={s.heroTitle} accessibilityRole="header">
            Make More Health
          </Text>
        </View>
        {heroWidth > 0 ? (
          <View style={s.mark}>
            <BrandMark width={heroWidth} progress={goal ? today.dailyDone / goal : REST_DAY_PROGRESS} />
          </View>
        ) : null}
        <Text style={s.heroLead}>
          {today.plan.dailyPushups
            ? `Dagens pushups: ${today.dailyTarget}, gjerne fordelt på flere sett. Stopp hvert sett med 2–3 reps igjen.`
            : "Push-dag: de daglige pushupsene hviler. Logg gjerne likevel."}
        </Text>
        <View style={s.stats}>
          <Stat value={today.dailyDone} label="I dag" active={today.dailyDone > 0} spoken={`${today.dailyDone} pushups i dag`} />
          <Stat
            value={todaysEntries.length}
            label="Sett"
            active={todaysEntries.length > 0}
            spoken={`${todaysEntries.length} sett i dag`}
          />
          <Stat
            value={goal ?? "–"}
            label={goal != null && today.dailyDone >= goal ? "Mål nådd" : "Mål"}
            active={goal != null && today.dailyDone >= goal}
            spoken={goal != null ? `Dagsmål ${goal}` : "Ingen dagsmål i dag"}
          />
        </View>
        <View style={s.quickRow}>
          {data.quickAdd.map((n) => (
            <Pressable
              key={n}
              accessibilityRole="button"
              accessibilityLabel={`Legg til ${n} pushups`}
              onPress={() => onAdd(n)}
              style={({ pressed }) => [s.quick, pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 }]}
            >
              <Text style={s.quickText}>+{n}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={s.message} accessibilityLiveRegion="polite">
          {message ?? " "}
        </Text>
      </View>

      {goal != null && today.dailyDone >= goal ? (
        <Card>
          <Text style={ui.strong}>Hvordan kjentes dagens pushups?</Text>
          <EffortPicker
            value={data.dailyEffort[today.day] ?? null}
            onChange={(e) => setDailyEffort(today.day, e)}
          />
          <Text style={[ui.body, { fontSize: 14, lineHeight: 20 }]}>
            Brukes til å justere dagsmålet hver uke. Lett gir raskere økning, helt tomt holder målet.
          </Text>
        </Card>
      ) : null}

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
        <Card style={{ borderColor: colors.accent }}>
          <Eyebrow style={{ color: colors.accent }}>Ukas push-økt mangler</Eyebrow>
          <Text style={ui.body}>
            Du har ikke tatt den tunge push-økta denne uka. Ta den i dag i stedet for dagens pushups.
          </Text>
          <Button label="Start push-økt" variant="secondary" onPress={() => openSession("push")} />
        </Card>
      ) : null}

      {todaysEntries.length > 0 ? (
        <Card style={{ gap: 4 }}>
          <Eyebrow>Logget i dag</Eyebrow>
          {todaysEntries.map((e, i) => (
            <View key={e.id} style={[s.entry, i > 0 && s.entryDivider]}>
              <Text style={s.entryCount}>{e.count}</Text>
              <Text style={s.entryTime}>
                {new Date(e.at).toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" })}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Angre ${e.count} pushups`}
                hitSlop={8}
                onPress={() => removePush(e.id)}
                style={({ pressed }) => [s.undo, pressed && { backgroundColor: colors.surfaceSubtle }]}
              >
                <Text style={s.undoText}>Angre</Text>
              </Pressable>
            </View>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

/** One number in the hero's instrument row; a white pixel glows next to the label when it counts. */
function Stat({ value, label, active, spoken }: { value: number | string; label: string; active: boolean; spoken: string }) {
  return (
    <View style={s.stat} accessible accessibilityLabel={spoken}>
      <Text style={[s.statValue, active && s.statValueActive]}>{value}</Text>
      <View style={s.statLabelRow}>
        <View style={[s.statPixel, active && s.statPixelActive]} />
        <Text style={s.statLabel}>{label}</Text>
      </View>
    </View>
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
      <Text style={ui.strong}>{prescriptionText}</Text>
      {done ? (
        <View style={s.done}>
          <Text style={s.doneText}>✓ Fullført i dag</Text>
        </View>
      ) : (
        <Button label="Start økt" onPress={onStart} />
      )}
    </Card>
  );
}

const s = StyleSheet.create({
  hero: {
    backgroundColor: colors.hero,
    borderRadius: radius.container,
    padding: 20,
    gap: 14,
    overflow: "hidden",
    shadowColor: colors.hero,
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
  },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  eyebrowPixel: { width: 6, height: 6, backgroundColor: colors.heroEyebrow },
  heroTitle: { color: colors.heroText, fontFamily: fonts.bold, fontSize: 36, lineHeight: 38, letterSpacing: -1.4 },
  mark: { marginHorizontal: -20, marginVertical: -8 },
  heroLead: { color: colors.heroLead, fontFamily: fonts.regular, fontSize: 16, lineHeight: 24 },
  stats: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.18)" },
  stat: { flex: 1, gap: 4, paddingTop: 12 },
  statValue: { color: colors.heroMuted, fontFamily: fonts.mono, fontSize: 28, letterSpacing: -1, fontVariant: ["tabular-nums"] },
  statValueActive: { color: colors.heroText },
  statLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  statPixel: { width: 5, height: 5, backgroundColor: "rgba(255,255,255,0.35)" },
  statPixelActive: {
    backgroundColor: colors.heroText,
    shadowColor: "#A8BEFF",
    shadowOpacity: 0.9,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
  },
  statLabel: { color: colors.heroEyebrow, fontFamily: fonts.mono, fontSize: 12, letterSpacing: 0.6, textTransform: "uppercase" },
  quickRow: { flexDirection: "row", gap: 8 },
  quick: {
    flex: 1,
    minHeight: 56,
    borderRadius: radius.control,
    backgroundColor: colors.heroText,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0A0C12",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
  quickText: { color: colors.hero, fontFamily: fonts.bold, fontSize: 20, fontVariant: ["tabular-nums"] },
  message: { color: colors.heroEyebrow, fontFamily: fonts.regular, textAlign: "center", fontSize: 14, minHeight: 20, marginTop: -6, marginBottom: -8 },
  done: {
    alignSelf: "flex-start",
    backgroundColor: colors.goodSoft,
    borderRadius: radius.control,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  doneText: { color: colors.good, fontFamily: fonts.bold, fontSize: 15 },
  entry: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52 },
  entryDivider: { borderTopWidth: 1, borderTopColor: colors.line },
  entryCount: { color: colors.text, fontFamily: fonts.bold, fontSize: 20, minWidth: 40, fontVariant: ["tabular-nums"] },
  entryTime: { color: colors.muted, fontFamily: fonts.mono, fontSize: 13, flex: 1 },
  undo: {
    minHeight: 36,
    paddingHorizontal: 12,
    justifyContent: "center",
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.line,
  },
  undoText: { color: colors.text, fontFamily: fonts.bold, fontSize: 14 },
});
