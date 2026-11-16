import * as Haptics from "expo-haptics";
import type { ReactElement, ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type RefreshControlProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EFFORT_LABEL } from "../program/catalog";
import type { Effort } from "../program/types";
import { colors, fonts, radius } from "../theme";

/** Tab screen: scrolls under a canvas-coloured status-bar strip so content never runs into the clock. */
export function Screen({
  children,
  refreshControl,
}: {
  children: ReactNode;
  refreshControl?: ReactElement<RefreshControlProps>;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.screen}
        refreshControl={refreshControl}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 96 }]}
      >
        {children}
      </ScrollView>
      <View pointerEvents="none" style={[styles.statusScrim, { height: insets.top }]} />
    </View>
  );
}

export function PageTitle({ eyebrow, title }: { eyebrow?: string; title: string }) {
  return (
    <View style={{ gap: 8 }}>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <Text style={styles.pageTitle} accessibilityRole="header">
        {title}
      </Text>
      <PixelStair />
    </View>
  );
}

/** Decorative Action Blue segment with a pixel stair, as under the portal's page titles. */
export function PixelStair({ color = colors.accent }: { color?: string }) {
  return (
    <View style={styles.stair} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.stairBar, { backgroundColor: color }]} />
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={[styles.stairPixel, { backgroundColor: color, opacity: 1 - i * 0.3, marginBottom: i * 3 }]}
        />
      ))}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Eyebrow({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.eyebrow, style]}>{children}</Text>;
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
  /** `onHero` is the white button used inside the cobalt brand panel. */
  variant?: "primary" | "secondary" | "ghost" | "danger" | "onHero";
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={() => {
        void Haptics.selectionAsync().catch(() => undefined);
        onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        variant === "primary" && styles.buttonPrimary,
        (variant === "secondary" || variant === "danger") && styles.buttonSecondary,
        variant === "onHero" && styles.buttonOnHero,
        pressed && { transform: [{ scale: 0.98 }], opacity: 0.88 },
        disabled && { opacity: 0.4 },
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          variant === "primary" && { color: colors.onAccent },
          variant === "ghost" && { color: colors.muted },
          variant === "danger" && { color: colors.danger },
          variant === "onHero" && { color: colors.hero },
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
  label,
  min = 0,
  max = 999,
  step = 1,
  suffix,
}: {
  value: number;
  onChange: (n: number) => void;
  /** What the stepper changes, read by VoiceOver as "Færre <label>" / "Flere <label>". */
  label: string;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  const change = (n: number) => {
    const next = Math.min(max, Math.max(min, n));
    if (next !== value) {
      void Haptics.selectionAsync().catch(() => undefined);
      onChange(next);
    }
  };
  return (
    <View style={styles.stepper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Færre, ${label}`}
        accessibilityState={{ disabled: value <= min }}
        onPress={() => change(value - step)}
        style={({ pressed }) => [styles.stepperButton, pressed && { backgroundColor: colors.accentSoft }]}
      >
        <Text style={styles.stepperSign}>−</Text>
      </Pressable>
      <Text style={styles.stepperValue} accessibilityLabel={`${label}: ${value}${suffix ? ` ${suffix}` : ""}`}>
        {value}
        {suffix ? <Text style={styles.stepperSuffix}> {suffix}</Text> : null}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Flere, ${label}`}
        accessibilityState={{ disabled: value >= max }}
        onPress={() => change(value + step)}
        style={({ pressed }) => [styles.stepperButton, pressed && { backgroundColor: colors.accentSoft }]}
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
              void Haptics.selectionAsync().catch(() => undefined);
              onChange(e);
            }}
            style={[styles.effort, selected && styles.effortSelected]}
          >
            <Text style={[styles.effortTitle, selected && { color: colors.onAccent }]}>
              {EFFORT_LABEL[e].title}
            </Text>
            <Text style={[styles.effortDetail, selected && { color: colors.heroLead }]}>
              {EFFORT_LABEL[e].detail}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 16, paddingBottom: 48, gap: 16 },
  statusScrim: { position: "absolute", top: 0, left: 0, right: 0, backgroundColor: colors.bg },
  pageTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 32, lineHeight: 36, letterSpacing: -0.8 },
  stair: { flexDirection: "row", alignItems: "flex-end", gap: 3, height: 12 },
  stairBar: { width: 40, height: 3 },
  stairPixel: { width: 3, height: 3 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius.container,
    padding: 16,
    gap: 12,
    shadowColor: "#11131A",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  eyebrow: {
    color: colors.muted,
    fontFamily: fonts.mono,
    fontSize: 12,
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  title: { color: colors.text, fontFamily: fonts.bold, fontSize: 24, lineHeight: 28, letterSpacing: -0.4 },
  body: { color: colors.muted, fontFamily: fonts.regular, fontSize: 16, lineHeight: 24 },
  strong: { color: colors.text, fontFamily: fonts.bold, fontSize: 16, lineHeight: 24 },
  button: {
    minHeight: 52,
    paddingHorizontal: 20,
    borderRadius: radius.control,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPrimary: { backgroundColor: colors.accent },
  buttonSecondary: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  buttonOnHero: { backgroundColor: colors.heroText },
  buttonText: { color: colors.text, fontFamily: fonts.bold, fontSize: 16 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 6 },
  stepperButton: {
    width: 44,
    height: 44,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperSign: { color: colors.accent, fontFamily: fonts.bold, fontSize: 22 },
  stepperValue: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 22,
    minWidth: 48,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  stepperSuffix: { color: colors.muted, fontFamily: fonts.regular, fontSize: 14 },
  effortRow: { flexDirection: "row", gap: 8 },
  effort: {
    flex: 1,
    minHeight: 56,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  effortSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  effortTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 15 },
  effortDetail: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12 },
});
