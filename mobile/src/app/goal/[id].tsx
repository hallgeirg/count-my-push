import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { WeekdayPicker } from "../../components/pickers";
import { Button, Card, Chip, Eyebrow, Stepper, styles as ui } from "../../components/ui";
import { GOAL_PRESETS, UNIT_RULES, type GoalPreset } from "../../program/catalog";
import { goalTargetForWeek } from "../../program/progression";
import type { Goal, GoalUnit } from "../../program/types";
import { currentWeek, newId, useAppData } from "../../store/AppDataProvider";
import { goalFromPreset } from "../../store/migrate";
import { colors, fonts, radius } from "../../theme";

const CUSTOM: GoalPreset = { id: "", name: "", unit: "reps", target: 20, quickAdd: [5, 10, 20] };

export default function GoalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useAppData();
  if (!data) return null;
  const existing = data.goals.find((g) => g.id === id);
  if (id !== "new" && !existing) return null;
  const week = currentWeek(data);
  const initial = existing
    ? { ...existing, target: goalTargetForWeek(data, existing, week) }
    : goalFromPreset(GOAL_PRESETS.find((p) => !data.goals.some((g) => g.id === p.id)) ?? CUSTOM, week);
  return <GoalForm key={id} initial={initial} isNew={!existing} takenIds={data.goals.map((g) => g.id)} />;
}

function GoalForm({ initial, isNew, takenIds }: { initial: Goal; isNew: boolean; takenIds: string[] }) {
  const { data, saveGoal, removeGoal } = useAppData();
  const [goal, setGoal] = useState<Goal>(initial);
  const set = (patch: Partial<Goal>) => setGoal((g) => ({ ...g, ...patch }));
  const rules = UNIT_RULES[goal.unit];
  const step = goal.unit === "seconds" ? 5 : 1;
  const name = goal.name.trim();
  const presets = GOAL_PRESETS.filter((p) => !takenIds.includes(p.id));

  function pickPreset(p: GoalPreset) {
    setGoal(goalFromPreset(p, goal.targetWeek, goal.days));
  }

  function setUnit(unit: GoalUnit) {
    if (unit === goal.unit) return;
    const preset = unit === "seconds" ? { target: 60, quickAdd: [30, 45, 60] } : { target: 20, quickAdd: [5, 10, 20] };
    set({ unit, ...preset, adaptive: unit === "reps" });
  }

  function save() {
    if (!data || !name || goal.days.length === 0) return;
    const id = goal.id || newId();
    saveGoal({ ...goal, id, name, targetWeek: currentWeek(data) });
    router.back();
  }

  function confirmRemove() {
    Alert.alert(`Fjerne «${goal.name}»?`, "Målet forsvinner fra I dag. Det du har logget, blir liggende.", [
      { text: "Avbryt", style: "cancel" },
      {
        text: "Fjern",
        style: "destructive",
        onPress: () => {
          removeGoal(goal.id);
          router.back();
        },
      },
    ]);
  }

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={s.content}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <Stack.Screen options={{ title: isNew ? "Nytt mål" : goal.name || "Mål" }} />

      {isNew ? (
        <Card>
          <Eyebrow>Velg øvelse</Eyebrow>
          <View style={s.wrap}>
            {presets.map((p) => (
              <Chip key={p.id} label={p.name} selected={goal.id === p.id} onPress={() => pickPreset(p)} />
            ))}
            <Chip
              label="Egen øvelse"
              selected={goal.id === ""}
              onPress={() => setGoal(goalFromPreset(CUSTOM, goal.targetWeek, goal.days))}
            />
          </View>
        </Card>
      ) : null}

      <Card>
        <Eyebrow>Navn</Eyebrow>
        <TextInput
          value={goal.name}
          onChangeText={(t) => set({ name: t })}
          placeholder="For eksempel utfall eller dips"
          placeholderTextColor={colors.muted}
          maxLength={30}
          accessibilityLabel="Navn på målet"
          style={s.input}
        />
        <Eyebrow>Måles i</Eyebrow>
        <View style={s.wrap}>
          <Chip label="Antall" selected={goal.unit === "reps"} onPress={() => setUnit("reps")} />
          <Chip label="Sekunder" selected={goal.unit === "seconds"} onPress={() => setUnit("seconds")} />
        </View>
      </Card>

      <Card>
        <Eyebrow>Dagsmål</Eyebrow>
        <Stepper
          value={goal.target}
          min={rules.min}
          max={rules.max}
          step={step}
          onChange={(target) => set({ target })}
          label="dagsmål"
          suffix={goal.unit === "seconds" ? "sek" : "per dag"}
        />
        <View style={s.switchRow}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={ui.strong}>Øk målet automatisk</Text>
            <Text style={s.note}>
              Hver mandag ser appen på forrige uke. Når du nådde målet de fleste dagene, går det opp
              {goal.unit === "seconds" ? " 5 sekunder" : " 2"}. Bommet du på mer enn halvparten, går det ned.
            </Text>
          </View>
          <Switch
            value={goal.adaptive}
            onValueChange={(adaptive) => set({ adaptive })}
            trackColor={{ true: colors.accent }}
            accessibilityLabel="Øk målet automatisk"
          />
        </View>
      </Card>

      <Card>
        <Eyebrow>Dager</Eyebrow>
        <WeekdayPicker days={goal.days} onChange={(days) => set({ days })} />
        {goal.days.length === 0 ? <Text style={s.error}>Velg minst én dag.</Text> : null}
      </Card>

      <Card>
        <Eyebrow>Hurtigknapper</Eyebrow>
        {goal.quickAdd.map((n, i) => (
          <View key={i} style={s.row}>
            <Text style={ui.strong}>Knapp {i + 1}</Text>
            <Stepper
              value={n}
              min={1}
              max={rules.max}
              step={step}
              label={`hurtigknapp ${i + 1}`}
              onChange={(v) => set({ quickAdd: goal.quickAdd.map((x, j) => (j === i ? v : x)) })}
            />
          </View>
        ))}
      </Card>

      <Button label={isNew ? "Legg til mål" : "Lagre"} onPress={save} disabled={!name || goal.days.length === 0} />
      {!isNew ? <Button label="Fjern målet" variant="danger" onPress={confirmRemove} /> : null}
      <Button label="Avbryt" variant="ghost" onPress={() => router.back()} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 16, paddingBottom: 48 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  note: { color: colors.muted, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  error: { color: colors.danger, fontFamily: fonts.bold, fontSize: 14 },
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
