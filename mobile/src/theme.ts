/**
 * Make More design tokens (kundeportal `DESIGN.md`, `design-tokens.ts`; Make More Brand Guide).
 * Light work surfaces, Action Blue for action, and one cobalt brand panel per screen at most.
 */
export const colors = {
  bg: "#F7F9FC",
  surface: "#FCFCFD",
  surfaceSubtle: "#F1F4F8",
  text: "#11131A",
  textSecondary: "#3A3A40",
  muted: "#58606D",
  line: "#E4E4E7",
  accent: "#0051FF",
  accentSoft: "#E8EFFF",
  onAccent: "#FFFFFF",
  good: "#13774E",
  goodSoft: "#E3F3EC",
  danger: "#A52732",
  dangerSoft: "#FCECEF",
  /** Brand panel: Action Blue against the deeper hero blue. */
  hero: "#003EC2",
  heroText: "#FFFFFF",
  heroEyebrow: "#DBE5FF",
  heroLead: "#E8EFFF",
  heroMuted: "#B9CAFF",
  heroLine: "rgba(255,255,255,0.22)",
  heroGlow: "#6193FF",
} as const;

export const radius = { control: 6, container: 8 } as const;

/** Font files are embedded by the expo-font config plugin (app.json); names are PostScript names. */
export const fonts = {
  regular: "MonaSans-Regular",
  bold: "MonaSans-Bold",
  mono: "JetBrainsMono-SemiBold",
} as const;
