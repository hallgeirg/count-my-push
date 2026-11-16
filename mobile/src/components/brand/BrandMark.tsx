import { memo, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import {
  H,
  W,
  anchors,
  depthLayers,
  depthStep,
  flowPath,
  heroContours,
  heroPalette as p,
  isoMatrix,
  pixels,
  planePath,
  scanEnd,
  scanStart,
  sparks,
  stair,
  symbolPath as symbolPathRef,
} from "./geometry";

type Props = {
  /** Share of today's goal, 0–1. The scan line moves left as it grows and the M turns into pixels behind it. */
  progress: number;
  width: number;
};

/**
 * The Make More symbol as a construction drawing that a scan line resolves into pixels (the portal's `BrandField`),
 * tied to the day: no pushups is all drawing, the goal reached is all pixels and the pixel stair lights up.
 * Pure decoration, hidden from VoiceOver. Every animation runs on the native driver; reduced motion jumps to the end.
 */
export function BrandMark({ progress, width }: Props) {
  const height = (width * H) / W;
  const target = scanStart - Math.min(1, Math.max(0, progress)) * (scanStart - scanEnd);
  const complete = progress >= 1;

  const scan = useRef(new Animated.Value(W + 24)).current;
  const glow = useRef(new Animated.Value(0.55)).current;
  const twinkle = useRef(new Animated.Value(0.5)).current;
  const steps = useRef(stair.map(() => new Animated.Value(0))).current;
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const introduced = useRef(false);

  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((on) => alive && setReduceMotion(on));
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  // Scan line: slides in from the right on first show, then eases to each new position.
  useEffect(() => {
    if (reduceMotion === null) return;
    if (reduceMotion) {
      scan.setValue(target);
      return;
    }
    const first = !introduced.current;
    introduced.current = true;
    Animated.timing(scan, {
      toValue: target,
      duration: first ? 1900 : 900,
      delay: first ? 150 : 0,
      easing: Easing.bezier(0.2, 0.8, 0.2, 1),
      useNativeDriver: true,
    }).start();
  }, [target, reduceMotion, scan]);

  // Idle life: the glow breathes and the sparks twinkle.
  useEffect(() => {
    if (reduceMotion !== false) return;
    const pulse = (value: Animated.Value, from: number, to: number, duration: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(value, { toValue: to, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(value, { toValue: from, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      );
    const loops = [pulse(glow, 0.35, 0.8, 1400), pulse(twinkle, 0.25, 0.95, 700)];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [reduceMotion, glow, twinkle]);

  // The pixel stair climbs in when the goal is reached.
  useEffect(() => {
    if (reduceMotion === null) return;
    if (reduceMotion) {
      steps.forEach((v) => v.setValue(complete ? 1 : 0));
      return;
    }
    Animated.stagger(
      120,
      steps.map((v) =>
        Animated.spring(v, { toValue: complete ? 1 : 0, useNativeDriver: true, speed: 14, bounciness: 12 }),
      ),
    ).start();
  }, [complete, reduceMotion, steps]);

  const px = (units: number) => (units * width) / W;
  const lineX = scan.interpolate({ inputRange: [0, W], outputRange: [0, width] });
  const neg = (from: number) => scan.interpolate({ inputRange: [0, W], outputRange: [from, from - width] });
  const pos = (from: number) => scan.interpolate({ inputRange: [0, W], outputRange: [from, from + width] });
  const box = { position: "absolute" as const, left: 0, top: 0, width, height };

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width, height }}
    >
      <Backdrop width={width} height={height} />

      {/* Drawing: visible left of the line. The outer view clips, the inner one counter-moves to stay put. */}
      <Animated.View style={[box, { overflow: "hidden", transform: [{ translateX: pos(-width) }] }]}>
        <Animated.View style={[box, { transform: [{ translateX: neg(width) }] }]}>
          <Drawing width={width} height={height} />
        </Animated.View>
      </Animated.View>

      {/* Pixels: visible right of the line. */}
      <Animated.View style={[box, { overflow: "hidden", transform: [{ translateX: lineX }] }]}>
        <Animated.View style={[box, { transform: [{ translateX: neg(0) }] }]}>
          <Pixels width={width} height={height} />
        </Animated.View>
      </Animated.View>

      {/* Sparks and the scan line travel together. */}
      <Animated.View style={[box, { width: px(70), opacity: twinkle, transform: [{ translateX: lineX }] }]}>
        <Svg width={px(70)} height={height} viewBox={`0 0 70 ${H}`}>
          {sparks.map((s, n) => (
            <Rect key={n} x={s.x} y={s.y} width={s.size} height={s.size} fill={s.fill} />
          ))}
        </Svg>
      </Animated.View>
      <Animated.View style={[box, { width: px(40), transform: [{ translateX: lineX }, { translateX: -px(20) }] }]}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: glow }]}>
          <Svg width={px(40)} height={height} viewBox={`0 0 40 ${H}`}>
            <Defs>
              <LinearGradient id="scan-glow" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#A8BEFF" stopOpacity="0" />
                <Stop offset="0.5" stopColor="#A8BEFF" stopOpacity="0.9" />
                <Stop offset="1" stopColor="#A8BEFF" stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Rect x="4" y="18" width="32" height={H - 36} fill="url(#scan-glow)" />
          </Svg>
        </Animated.View>
        <Svg width={px(40)} height={height} viewBox={`0 0 40 ${H}`} style={StyleSheet.absoluteFill}>
          <Rect x="19" y="18" width="2" height={H - 36} rx="1" fill="#FFFFFF" />
        </Svg>
      </Animated.View>

      {stair.map((s, n) => (
        <Animated.View
          key={n}
          style={{
            position: "absolute",
            left: px(s.x),
            top: px(s.y),
            width: px(s.size),
            height: px(s.size),
            backgroundColor: p.stair[n],
            opacity: steps[n],
            transform: [{ scale: steps[n]!.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) }],
          }}
        />
      ))}
    </View>
  );
}

const Backdrop = memo(function Backdrop({ width, height }: { width: number; height: number }) {
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${W} ${H}`} style={StyleSheet.absoluteFill}>
      <G fill="none" stroke={p.faint} strokeWidth={1}>
        {heroContours.map((d, n) => (
          <Path key={n} d={d} />
        ))}
      </G>
      <Path d={flowPath} fill="none" stroke={p.flow} strokeWidth={1.6} strokeDasharray="2 6" strokeLinecap="round" />
      <Circle cx={290} cy={216} r={9} fill="none" stroke={p.flow} strokeWidth={1.6} />
      <Circle cx={290} cy={216} r={2.6} fill={p.flow} />
      <Path d={planePath} fill="none" stroke={p.plane} strokeWidth={1} strokeDasharray="10 9" />
    </Svg>
  );
});

const Drawing = memo(function Drawing({ width, height }: { width: number; height: number }) {
  // Strokes are drawn in canvas units inside the iso transform, so divide by its scale (≈2.2) to keep them thin.
  const k = 1 / 2.2;
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${W} ${H}`}>
      {Array.from({ length: depthLayers }, (_, n) => (
        <G key={n} transform={`translate(0 ${((depthLayers - n) * depthStep).toFixed(1)})`}>
          <Path
            d={symbolPathRef}
            transform={isoMatrix}
            fill="none"
            stroke={p.line}
            strokeOpacity={0.12 + (n / depthLayers) * 0.22}
            strokeWidth={k}
          />
        </G>
      ))}
      <Path d={symbolPathRef} transform={isoMatrix} fill={p.fill} stroke={p.line} strokeWidth={1.6 * k} strokeLinejoin="round" />
      <G stroke={p.line} strokeWidth={1}>
        {anchors.map((a, n) =>
          a.a && a.b ? (
            <G key={n}>
              <Line x1={a.a[0]} y1={a.a[1]} x2={a.b[0]} y2={a.b[1]} strokeOpacity={0.7} />
              <Rect x={a.a[0] - 2.5} y={a.a[1] - 2.5} width={5} height={5} fill={p.node} />
              <Rect x={a.b[0] - 2.5} y={a.b[1] - 2.5} width={5} height={5} fill={p.node} />
              <Circle cx={a.x} cy={a.y} r={3.6} fill={p.node} />
            </G>
          ) : (
            <Rect key={n} x={a.x - 3} y={a.y - 3} width={6} height={6} fill={p.node} />
          ),
        )}
      </G>
    </Svg>
  );
});

const Pixels = memo(function Pixels({ width, height }: { width: number; height: number }) {
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${W} ${H}`}>
      {pixels.map((px, n) => (
        <Rect key={n} x={px.x} y={px.y} width={px.size} height={px.size} fill={px.fill} />
      ))}
    </Svg>
  );
});

