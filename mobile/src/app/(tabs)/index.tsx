import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { BrandMark } from "../../components/brand/BrandMark";
import { HeroBackground } from "../../components/brand/HeroBackground";
import { DayGoals } from "../../components/DayGoals";
import { Button, Card, Eyebrow, Screen, styles as ui } from "../../components/ui";
import { randomMilestoneLine, randomSuccessLine } from "../../lib/delight";
import { LADDERS } from "../../program/catalog";
import { WEEKDAY_LONG, dayKey } from "../../program/dates";
import { currentPrescription, describePrescription, todayPlan } from "../../program/progression";
import type { WorkoutKind } from "../../program/types";
import { useAppData } from "../../store/AppDataProvider";
import { colors, fonts, radius } from "../../theme";

/** With nothing planned today the mark rests part-way, as in the portal's still image. */
const REST_DAY_PROGRESS = 0.4;

export default function TodayScreen() {
  const { data } = useAppData();
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
  const planned = today.goals.filter((g) => g.scheduled);
  const reached = planned.filter((g) => g.done >= g.target).length;
  const logged = data.entries.filter((e) => dayKey(new Date(e.at)) === today.day).length;
  const parts = [...planned.map((g) => Math.min(1, g.target ? g.done / g.target : 1))];
  if (today.workout) parts.push(today.workoutDone ? 1 : 0);
  const progress = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : REST_DAY_PROGRESS;

  function onLogged(reachedGoal: boolean) {
    setMessage(reachedGoal ? randomMilestoneLine() : randomSuccessLine());
    if (messageTimer.current) clearTimeout(messageTimer.current);
    messageTimer.current = setTimeout(() => setMessage(null), 2400);
  }

  const openSession = (kind: WorkoutKind) => router.push(`/session/${kind}`);
  const workoutLine = today.workout
    ? `${LADDERS[today.workout].title}${today.workoutDone ? " er gjort" : " står på planen"}`
    : "Ingen økt i dag";
  const goalLine = planned.length
    ? `${reached} av ${planned.length} dagsmål nådd`
    : "Ingen dagsmål i dag";

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
            <BrandMark width={heroWidth} progress={progress} />
          </View>
        ) : null}
        <Text style={s.heroLead}>
          {goalLine}. {workoutLine}.
        </Text>
        <View style={s.stats}>
          <Stat
            value={planned.length ? `${reached}/${planned.length}` : "–"}
            label="Mål nådd"
            active={planned.length > 0 && reached === planned.length}
            spoken={goalLine}
          />
          <Stat
            value={today.workout ? (today.workoutDone ? "✓" : "–") : "Fri"}
            label="Økt"
            active={today.workoutDone}
            spoken={workoutLine}
          />
          <Stat value={logged} label="Logget" active={logged > 0} spoken={`${logged} logginger i dag`} />
        </View>
        <Text style={s.message} accessibilityLiveRegion="polite">
          {message ?? " "}
        </Text>
      </View>

      <DayGoals day={today.day} goals={today.goals} onLogged={onLogged} />

      {data.goals.length === 0 ? (
        <Card>
          <Eyebrow>Daglige mål</Eyebrow>
          <Text style={ui.body}>Du har ingen daglige mål ennå. Legg til pushups, planke eller en egen øvelse.</Text>
          <Button label="Legg til mål" onPress={() => router.push("/goal/new")} />
        </Card>
      ) : null}

      {today.workout ? (
        <WorkoutCard
          kind={today.workout}
          done={today.workoutDone}
          onStart={() => openSession(today.workout!)}
          prescriptionText={describe(data, today.workout)}
        />
      ) : (
        <Card>
          <Eyebrow>Ingen økt i dag</Eyebrow>
          <Text style={ui.body}>
            {planned.length ? "Bare dagsmålene. La kroppen hente seg inn." : "Fridag. La kroppen hente seg inn."}
          </Text>
        </Card>
      )}

      {today.catchUp.map((kind) => (
        <Card key={kind} style={{ borderColor: colors.accent }}>
          <Eyebrow style={{ color: colors.accent }}>Glemt økt denne uka</Eyebrow>
          <Text style={ui.body}>
            {LADDERS[kind].title} sto på planen tidligere i uka. Ta den igjen når det passer.
          </Text>
          <Button label={`Start ${LADDERS[kind].title.toLowerCase()}`} variant="secondary" onPress={() => openSession(kind)} />
        </Card>
      ))}

      <View style={{ gap: 8 }}>
        {data.goals.length > 0 ? (
          <Button label="Logg for i går" variant="secondary" onPress={() => router.push("/yesterday")} />
        ) : null}
        {data.goals.length > 0 ? (
          <Button label="Legg til mål" variant="ghost" onPress={() => router.push("/goal/new")} />
        ) : null}
      </View>
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
  message: { color: colors.heroEyebrow, fontFamily: fonts.regular, textAlign: "center", fontSize: 14, minHeight: 20, marginTop: -6, marginBottom: -8 },
  done: {
    alignSelf: "flex-start",
    backgroundColor: colors.goodSoft,
    borderRadius: radius.control,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  doneText: { color: colors.good, fontFamily: fonts.bold, fontSize: 15 },
});
