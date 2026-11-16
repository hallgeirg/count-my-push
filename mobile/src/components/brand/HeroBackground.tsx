import { useState } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Defs, G, Line, LinearGradient, Mask, RadialGradient, Rect, Stop } from "react-native-svg";
import { colors } from "../../theme";

const GRID = 32;

/**
 * The brand panel's surface, as in the portal's `.agency-hero`: hero blue into Action Blue, a violet glow from the
 * top right and a 32 px construction grid that fades in towards the right.
 */
export function HeroBackground() {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const { w, h } = size;
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {w > 0 ? (
        <Svg width={w} height={h}>
          <Defs>
            <LinearGradient id="hero-base" x1="0" y1="0.4" x2="1" y2="0.6">
              <Stop offset="0.3" stopColor={colors.hero} />
              <Stop offset="0.75" stopColor={colors.accent} />
            </LinearGradient>
            <RadialGradient id="hero-violet" cx={w} cy={0} rx={w * 1.2} ry={h * 1.4} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor="#7C5CFF" stopOpacity="0.55" />
              <Stop offset="0.55" stopColor="#7C5CFF" stopOpacity="0" />
            </RadialGradient>
            <LinearGradient id="hero-grid-fade" x1="0" y1="0.4" x2="1" y2="0.6">
              <Stop offset="0.2" stopColor="#FFFFFF" stopOpacity="0" />
              <Stop offset="0.7" stopColor="#FFFFFF" stopOpacity="1" />
            </LinearGradient>
            <Mask id="hero-grid-mask">
              <Rect width={w} height={h} fill="url(#hero-grid-fade)" />
            </Mask>
          </Defs>
          <Rect width={w} height={h} fill="url(#hero-base)" />
          <Rect width={w} height={h} fill="url(#hero-violet)" />
          <G mask="url(#hero-grid-mask)" stroke="rgba(255,255,255,0.06)" strokeWidth={1}>
            {Array.from({ length: Math.ceil(w / GRID) }, (_, i) => (
              <Line key={"x" + i} x1={i * GRID + 0.5} y1={0} x2={i * GRID + 0.5} y2={h} />
            ))}
            {Array.from({ length: Math.ceil(h / GRID) }, (_, i) => (
              <Line key={"y" + i} x1={0} y1={i * GRID + 0.5} x2={w} y2={i * GRID + 0.5} />
            ))}
          </G>
        </Svg>
      ) : null}
    </View>
  );
}
