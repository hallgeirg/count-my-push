import * as Haptics from "expo-haptics";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { EFFORT_LABEL } from "../program/catalog";
import type { Effort } from "../program/types";
import { colors, radius } from "../theme";

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <Text style={styles.eyebrow}>{children}</Text>;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        variant === "primary" && styles.buttonPrimary,
        variant === "secondary" && styles.buttonSecondary,
        variant === "danger" && styles.buttonDanger,
        (pressed || disabled) && { opacity: disabled ? 0.4 : 0.75 },
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          variant === "primary" && { color: colors.onAccent },
          variant === "ghost" && { color: colors.muted },
          variant === "danger" && { color: colors.danger },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 999,
  step = 1,
  suffix,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  const change = (n: number) => {
    const next = Math.min(max, Math.max(min, n));
    if (next !== value) {
      void Haptics.selectionAsync();
      onChange(next);
    }
  };
  return (
    <View style={styles.stepper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Færre"
        onPress={() => change(value - step)}
        style={styles.stepperButton}
      >
        <Text style={styles.stepperSign}>−</Text>
      </Pressable>
      <Text style={styles.stepperValue}>
        {value}
        {suffix ? <Text style={styles.stepperSuffix}> {suffix}</Text> : null}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Flere"
        onPress={() => change(value + step)}
        style={styles.stepperButton}
      >
        <Text style={styles.stepperSign}>+</Text>
      </Pressable>
    </View>
  );
}

export function EffortPicker({
  value,
  onChange,
}: {
  value: Effort | null;
  onChange: (e: Effort) => void;
}) {
  return (
    <View style={styles.effortRow} accessibilityRole="radiogroup">
      {(Object.keys(EFFORT_LABEL) as Effort[]).map((e) => {
        const selected = value === e;
        return (
          <Pressable
            key={e}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => {
              void Haptics.selectionAsync();
              onChange(e);
            }}
            style={[styles.effort, selected && styles.effortSelected]}
          >
            <Text style={[styles.effortTitle, selected && { color: colors.onAccent }]}>
              {EFFORT_LABEL[e].title}
            </Text>
            <Text style={[styles.effortDetail, selected && { color: colors.onAccent }]}>
              {EFFORT_LABEL[e].detail}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.card,
    borderCurve: "continuous",
    padding: 16,
    gap: 10,
  },
  eyebrow: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  title: { color: colors.text, fontSize: 20, fontWeight: "800", letterSpacing: -0.4 },
  body: { color: colors.muted, fontSize: 15, lineHeight: 21 },
  button: {
    minHeight: 48,
    paddingHorizontal: 18,
    borderRadius: radius.button,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPrimary: { backgroundColor: colors.accent },
  buttonSecondary: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  buttonDanger: { borderWidth: 1, borderColor: "rgba(255,92,92,0.4)" },
  buttonText: { color: colors.text, fontSize: 16, fontWeight: "800" },
  stepper: { flexDirection: "row", alignItems: "center", gap: 6 },
  stepperButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperSign: { color: colors.text, fontSize: 22, fontWeight: "700" },
  stepperValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
    minWidth: 48,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  stepperSuffix: { color: colors.muted, fontSize: 13, fontWeight: "600" },
  effortRow: { flexDirection: "row", gap: 8 },
  effort: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: "center",
    gap: 2,
  },
  effortSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  effortTitle: { color: colors.text, fontWeight: "800", fontSize: 15 },
  effortDetail: { color: colors.muted, fontSize: 11, fontWeight: "600" },
});
