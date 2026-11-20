import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Button, Card, Chip, Eyebrow, Stepper, styles as ui } from "../../components/ui";
import { GOAL_PRESETS, exerciseNoun } from "../../program/catalog";
import { ApiError } from "../../social/api";
import { challengeTitle } from "../../social/challenges";
import { errorMessage, useSocial } from "../../social/SocialProvider";
import type { ChallengeType, NewChallenge } from "../../social/types";
import { colors, fonts, radius } from "../../theme";

export default function NewChallengeScreen() {
  const { me, createChallenge, status } = useSocial();
  const [code, setCode] = useState("");
  const [type, setType] = useState<ChallengeType>("most_in_period");
  const [exercise, setExercise] = useState("pushups");
  const seconds = GOAL_PRESETS.find((p) => p.id === exercise)?.unit === "seconds";
  const [periodDays, setPeriodDays] = useState(7);
  const [target, setTarget] = useState(500);
  const [targetDays, setTargetDays] = useState(30);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const friendCode = code.replace(/[\s-]/g, "").toUpperCase();

  async function send() {
    if (!friendCode || sending) return;
    if (me && friendCode === me.friendCode.toUpperCase()) {
      setError("Det er din egen vennekode.");
      return;
    }
    const input: NewChallenge =
      type === "most_in_period"
        ? { friendCode, exercise, type, days: periodDays }
        : { friendCode, exercise, type, target, days: targetDays };
    setError(null);
    setSending(true);
    try {
      await createChallenge(input);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      router.back();
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 404
          ? "Fant ingen med den vennekoden."
          : errorMessage(e, "Utfordringen ble ikke sendt. Sjekk vennekoden og prøv igjen."),
      );
    } finally {
      setSending(false);
    }
  }

  if (status !== "signedIn") {
    return (
      <View style={s.screen}>
        <View style={s.content}>
          <Text style={ui.body}>Logg inn under «Sammen» for å utfordre venner.</Text>
          <Button label="Lukk" variant="secondary" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={s.content}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <Card>
        <Eyebrow>Vennekode</Eyebrow>
        <TextInput
          value={code}
          onChangeText={setCode}
          placeholder="F.eks. K7M2QX"
          placeholderTextColor={colors.muted}
          autoCapitalize="characters"
          autoCorrect={false}
          autoFocus
          accessibilityLabel="Vennekode"
          returnKeyType="done"
          style={s.input}
        />
      </Card>

      <Card>
        <Eyebrow>Øvelse</Eyebrow>
        <View style={s.chips} accessibilityRole="radiogroup">
          {GOAL_PRESETS.map((p) => (
            <Chip
              key={p.id}
              label={p.name}
              selected={exercise === p.id}
              onPress={() => {
                setExercise(p.id);
                setTarget(p.unit === "seconds" ? 1800 : 500);
              }}
            />
          ))}
        </View>
      </Card>

      <Card>
        <Eyebrow>Type</Eyebrow>
        <View style={{ gap: 8 }} accessibilityRole="radiogroup">
          <Option
            selected={type === "most_in_period"}
            title={challengeTitle({ type: "most_in_period", exercise, target: null, days: periodDays, startsOn: null, endsOn: null })}
            detail="Den som tar flest i perioden, vinner."
            onPress={() => setType("most_in_period")}
          />
          <Option
            selected={type === "first_to_target"}
            title={challengeTitle({ type: "first_to_target", exercise, target, days: targetDays, startsOn: null, endsOn: null })}
            detail="Den som når målet først, vinner."
            onPress={() => setType("first_to_target")}
          />
        </View>
        {type === "most_in_period" ? (
          <Row label="Dager">
            <Stepper value={periodDays} min={1} max={31} onChange={setPeriodDays} label="dager" />
          </Row>
        ) : (
          <>
            <Row label="Mål">
              <Stepper
                value={target}
                min={seconds ? 60 : 50}
                max={10000}
                step={seconds ? 60 : 50}
                onChange={setTarget}
                label={`${exerciseNoun(exercise)} i målet`}
              />
            </Row>
            <Row label="Frist i dager">
              <Stepper value={targetDays} min={1} max={60} onChange={setTargetDays} label="dager frist" />
            </Row>
          </>
        )}
      </Card>

      {error ? (
        <Text style={s.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <Button label={sending ? "Sender …" : "Send"} accessibilityLabel="Send utfordringen" onPress={() => void send()} disabled={!friendCode || sending} />
      <Text style={[ui.body, { fontSize: 14, lineHeight: 20 }]}>
        Utfordringen starter når vennen din godtar den.
      </Text>
    </ScrollView>
  );
}

function Option({
  selected,
  title,
  detail,
  onPress,
}: {
  selected: boolean;
  title: string;
  detail: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${title}. ${detail}`}
      onPress={() => {
        void Haptics.selectionAsync().catch(() => undefined);
        onPress();
      }}
      style={[s.option, selected && s.optionSelected]}
    >
      <Text style={[s.optionTitle, selected && { color: colors.onAccent }]}>
        {selected ? "✓ " : ""}
        {title}
      </Text>
      <Text style={[s.optionDetail, selected && { color: colors.heroLead }]}>{detail}</Text>
    </Pressable>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 16, paddingBottom: 48 },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.control,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    color: colors.text,
    fontFamily: fonts.mono,
    fontSize: 20,
    letterSpacing: 3,
  },
  option: {
    minHeight: 56,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 2,
    justifyContent: "center",
  },
  optionSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  optionTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 16 },
  optionDetail: { color: colors.muted, fontFamily: fonts.regular, fontSize: 14 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  rowLabel: { color: colors.text, fontFamily: fonts.bold, fontSize: 16 },
  error: { color: colors.danger, fontFamily: fonts.bold, fontSize: 15 },
});
