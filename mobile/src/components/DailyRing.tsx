import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { colors, fonts } from "../theme";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
  total: number;
  /** Null when there is no daily target today. */
  goal: number | null;
  size?: number;
};

/** Drawn for the cobalt brand panel: white progress on a translucent track. */
export function DailyRing({ total, goal, size = 200 }: Props) {
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const ratio = goal && goal > 0 ? Math.min(1, total / goal) : 0;
  const progress = useRef(new Animated.Value(ratio)).current;
  const bump = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: ratio,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [ratio, progress]);

  useEffect(() => {
    bump.setValue(1.08);
    Animated.spring(bump, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start();
  }, [total, bump]);

  const dashOffset = progress.interpolate({ inputRange: [0, 1], outputRange: [c, 0] });

  return (
    <View
      style={{ width: size, height: size, alignSelf: "center" }}
      accessible
      accessibilityLabel={goal ? `${total} av ${goal} pushups i dag` : `${total} pushups i dag`}
    >
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.heroLine} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.heroText}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="butt"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <Animated.Text style={[styles.total, { transform: [{ scale: bump }] }]}>
          {total}
          {goal ? <Text style={styles.goal}> / {goal}</Text> : null}
        </Animated.Text>
        <Text style={styles.caption}>{goal && total >= goal ? "Dagens mål nådd" : "I dag"}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  total: {
    color: colors.heroText,
    fontFamily: fonts.bold,
    fontSize: 56,
    letterSpacing: -1.5,
    fontVariant: ["tabular-nums"],
  },
  goal: { color: colors.heroMuted, fontFamily: fonts.regular, fontSize: 20, letterSpacing: 0 },
  caption: {
    color: colors.heroEyebrow,
    fontFamily: fonts.mono,
    fontSize: 12,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    marginTop: 4,
  },
});
