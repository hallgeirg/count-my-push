import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { describeDays } from "../../components/pickers";
import { Button, Card, Eyebrow, PageTitle, Screen, Stepper, styles as ui } from "../../components/ui";
import { LADDERS } from "../../program/catalog";
import { fromDayKey, mondayOf } from "../../program/dates";
import { currentPrescription, formatAmount, goalTotals, todayPlan } from "../../program/progression";
import type { WorkoutKind } from "../../program/types";
import { errorMessage, useSocial } from "../../social/SocialProvider";
import { useAppData } from "../../store/AppDataProvider";
import { colors, fonts, radius } from "../../theme";

export default function SettingsScreen() {
  const { data, error, setLevel, restartProgram } = useAppData();
  const signedIn = useSocial().status === "signedIn";
  if (!data) return null;
  const today = todayPlan(data);

  const monday = mondayOf(today.day);
  const monthPrefix = today.day.slice(0, 7);
  const sums = today.goals.map(({ goal, target }) => {
    let week = 0;
    let month = 0;
    let all = 0;
    for (const [day, n] of goalTotals(data, goal.id)) {
      all += n;
      if (day >= monday && day <= today.day) week += n;
      if (day.startsWith(monthPrefix)) month += n;
    }
    return { goal, target, week, month, all };
  });

  function confirmRestart() {
    Alert.alert(
      "Start programmet på nytt?",
      "Nivåer og økter nullstilles, uke 1 starter i dag, og du går gjennom oppsettet på nytt. Målene og loggen beholdes.",
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
        <Eyebrow>Daglige mål</Eyebrow>
        {sums.length === 0 ? <Text style={ui.body}>Ingen daglige mål ennå.</Text> : null}
        {sums.map(({ goal, target, week, month, all }) => (
          <Pressable
            key={goal.id}
            accessibilityRole="button"
            accessibilityLabel={`${goal.name}, mål ${formatAmount(target, goal.unit)}, ${describeDays(goal.days)}. Denne uka ${week}, denne måneden ${month}, totalt ${all}. Endre`}
            onPress={() => router.push(`/goal/${goal.id}`)}
            style={({ pressed }) => [s.goal, pressed && { backgroundColor: colors.surfaceSubtle }]}
          >
            <View style={s.row}>
              <Text style={[s.rowLabel, { flex: 1 }]}>{goal.name}</Text>
              <Text style={s.note}>
                {formatAmount(target, goal.unit)} · {describeDays(goal.days)} ›
              </Text>
            </View>
            <View style={s.stats}>
              <Stat label="Denne uka" value={formatAmount(week, goal.unit)} />
              <Stat label="Måneden" value={formatAmount(month, goal.unit)} />
              <Stat label="Totalt" value={formatAmount(all, goal.unit)} />
            </View>
          </Pressable>
        ))}
        <Button label="Legg til mål" variant="secondary" onPress={() => router.push("/goal/new")} />
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

      <AccountCard />

      <Card>
        <Eyebrow>Program</Eyebrow>
        <Text style={ui.body}>
          Startet {fromDayKey(data.startDay).toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric" })}
          . {signedIn ? "Loggen lagres på telefonen og synkes til kontoen din." : "Alt lagres bare på denne telefonen."}
        </Text>
        <Button label="Start programmet på nytt" variant="danger" onPress={confirmRestart} />
      </Card>
    </Screen>
  );
}

function AccountCard() {
  const { status, me, syncFailed, updateDisplayName, signOut } = useSocial();
  /** null = not editing. */
  const [name, setName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  if (status === "unconfigured" || status === "loading") return null;

  if (status === "signedOut" || !me) {
    return (
      <Card>
        <Eyebrow>Konto</Eyebrow>
        <Text style={ui.body}>Ikke logget inn. Under «Sammen» kan du logge inn for streaks, toppliste og utfordringer.</Text>
        <Button label="Gå til «Sammen»" variant="secondary" onPress={() => router.navigate("/social")} />
      </Card>
    );
  }

  const trimmed = name?.trim() ?? "";

  async function save() {
    if (!trimmed || trimmed.length > 40) return;
    setSaving(true);
    setNameError(null);
    try {
      await updateDisplayName(trimmed);
      setName(null);
    } catch (e) {
      setNameError(errorMessage(e, "Navnet ble ikke lagret. Bruk 1–40 tegn."));
    } finally {
      setSaving(false);
    }
  }

  function confirmSignOut() {
    Alert.alert("Logge ut?", "Treningsloggen blir liggende på telefonen.", [
      { text: "Avbryt", style: "cancel" },
      { text: "Logg ut", style: "destructive", onPress: () => void signOut() },
    ]);
  }

  return (
    <Card>
      <Eyebrow>Konto</Eyebrow>
      <Text style={ui.body}>
        Logget inn som <Text style={ui.strong}>{me.displayName}</Text>
      </Text>
      {syncFailed ? <Text style={s.note}>Ikke synket ennå</Text> : null}
      {name === null ? (
        <Button label="Endre visningsnavn" variant="secondary" onPress={() => setName(me.displayName)} />
      ) : (
        <View style={{ gap: 8 }}>
          <TextInput
            value={name}
            onChangeText={setName}
            maxLength={40}
            autoFocus
            autoCorrect={false}
            accessibilityLabel="Visningsnavn"
            returnKeyType="done"
            onSubmitEditing={() => void save()}
            style={s.input}
          />
          <Text style={s.note}>Vises på topplisten og i utfordringer.</Text>
          {nameError ? (
            <Text style={s.error} accessibilityRole="alert">
              {nameError}
            </Text>
          ) : null}
          <Button
            label={saving ? "Lagrer …" : "Lagre navn"}
            onPress={() => void save()}
            disabled={saving || !trimmed || trimmed === me.displayName}
          />
          <Button label="Avbryt" variant="ghost" onPress={() => setName(null)} />
        </View>
      )}
      <Button label="Logg ut" variant="danger" onPress={confirmSignOut} />
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
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
  statValue: { color: colors.text, fontFamily: fonts.bold, fontSize: 24, fontVariant: ["tabular-nums"] },
  goal: { gap: 8, paddingVertical: 10, paddingHorizontal: 8, borderRadius: radius.control, borderTopWidth: 1, borderTopColor: colors.line },
  statLabel: { color: colors.muted, fontFamily: fonts.mono, fontSize: 12 },
  note: { color: colors.muted, fontFamily: fonts.regular, fontSize: 14 },
  error: { color: colors.danger, fontFamily: fonts.bold, fontSize: 15 },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.control,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 16,
  },
});
