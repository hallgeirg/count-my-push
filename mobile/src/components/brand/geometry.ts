/**
 * Geometry for the Make More construction drawing, ported from the portal's `BrandField` (MM-web-saas
 * src/components/BrandField.tsx, `hero` tone). Computed once at module load, in a 640 × 360 canvas.
 *
 * The portal draws the symbol as a fixed drawing that a scan line resolves into pixels. Here every cell of the
 * symbol gets a pixel, so the app can move the scan line with the day's progress and reveal as much as it likes.
 */
import { colors } from "../../theme";

export const W = 640;
export const H = 360;

/** The symbol's path (same as the portal's `BrandSymbol`), in local units 0–127 × 0–97. */
export const symbolPath =
  "M121.501,35.453C117.878,33.356 112.541,35.208 107.285,39.701C103.363,20.365 94.512,-0.005 81.794,-0.005C61.614,-0.005 67.496,61.189 55.35,61.189C37.566,61.189 48.759,1.383 48.759,1.383L21.553,1.383L0.011,96.729L26.945,96.729L39.881,39.02C39.881,39.02 28.797,89.294 54.533,89.294C77.028,89.294 76.32,40.6 76.32,40.6C76.32,66.336 87.622,81.995 97.508,81.995C99.114,81.995 100.476,81.723 101.702,81.233C107.394,79.517 114.229,73.28 119.322,64.457C126.566,51.929 127.546,38.939 121.501,35.453";

export type Pt = [number, number];

function flatten(d: string): Pt[] {
  const tokens = d.match(/[MCL]|-?\d*\.?\d+/g) ?? [];
  const points: Pt[] = [];
  let i = 0;
  let command = "M";
  const num = () => Number(tokens[i++]);
  while (i < tokens.length) {
    if (/[MCL]/.test(tokens[i]!)) command = tokens[i++]!;
    if (command === "C") {
      const [x0, y0] = points[points.length - 1]!;
      const c = [num(), num(), num(), num(), num(), num()] as const;
      for (let s = 1; s <= 12; s++) {
        const t = s / 12;
        const u = 1 - t;
        points.push([
          u * u * u * x0 + 3 * u * u * t * c[0] + 3 * u * t * t * c[2] + t * t * t * c[4],
          u * u * u * y0 + 3 * u * u * t * c[1] + 3 * u * t * t * c[3] + t * t * t * c[5],
        ]);
      }
    } else points.push([num(), num()]);
  }
  return points;
}

const polygon = flatten(symbolPath);
const inside = ([x, y]: Pt) => {
  let hit = false;
  for (let a = 0, b = polygon.length - 1; a < polygon.length; b = a++) {
    const [xa, ya] = polygon[a]!;
    const [xb, yb] = polygon[b]!;
    if (ya > y !== yb > y && x < ((xb - xa) * (y - ya)) / (yb - ya) + xa) hit = !hit;
  }
  return hit;
};

/** Deterministic "randomness", so the drawing is the same every launch. */
const hash = (a: number, b: number, c = 0) => {
  let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(c, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const r1 = (n: number) => Math.round(n * 10) / 10;

function contours(width: number, height: number, count: number, seed: number) {
  return Array.from({ length: count }, (_, line) => {
    const base = ((line + 0.5) / count) * height;
    let d = "";
    for (let x = -16; x <= width + 16; x += 12) {
      const y =
        base +
        18 * Math.sin(x / 140 + line * 0.35 + seed) +
        9 * Math.sin(x / 53 + line * 0.9 + seed * 2) +
        5 * Math.sin(x / 23 - line * 0.6);
      d += (d ? "L" : "M") + r1(x) + "," + r1(y);
    }
    return d;
  });
}

// The symbol lies as a tilted plate seen from above, so it still reads as an M.
const scale = 2.2;
const ux: Pt = [0.95 * scale, 0.3 * scale];
const uy: Pt = [-0.38 * scale, 0.92 * scale];
const origin: Pt = [318, 30];
const iso = ([x, y]: Pt): Pt => [origin[0] + x * ux[0] + y * uy[0], origin[1] + x * ux[1] + y * uy[1]];
export const isoMatrix = `matrix(${ux[0]} ${ux[1]} ${uy[0]} ${uy[1]} ${origin[0]} ${origin[1]})`;
export const depthStep = 2.1;
export const depthLayers = 12;

export const planePath =
  "M" +
  ([[-14, -14], [141, -14], [141, 111], [-14, 111]] as Pt[])
    .map(iso)
    .map(([x, y]) => r1(x) + "," + r1(y))
    .join("L") +
  "Z";

/** Anchor points: corners as squares, curve points as circles with their handles. */
export const anchors = (
  [
    { at: [48.759, 1.383] }, { at: [21.553, 1.383] }, { at: [0.011, 96.729] }, { at: [26.945, 96.729] },
    { at: [39.881, 39.02], handle: [6, 26] }, { at: [54.533, 89.294], handle: [14, 0] },
    { at: [55.35, 61.189], handle: [12, 0] }, { at: [81.794, -0.005], handle: [13, 0] },
    { at: [76.32, 40.6], handle: [0, 14] }, { at: [97.508, 81.995], handle: [9, 0] },
    { at: [121.501, 35.453], handle: [-6, -4] },
  ] as { at: Pt; handle?: Pt }[]
).map(({ at, handle }) => {
  const [x, y] = iso(at);
  if (!handle) return { x: r1(x), y: r1(y) };
  const a = iso([at[0] - handle[0], at[1] - handle[1]]);
  const b = iso([at[0] + handle[0], at[1] + handle[1]]);
  return { x: r1(x), y: r1(y), a: [r1(a[0]), r1(a[1])] as Pt, b: [r1(b[0]), r1(b[1])] as Pt };
});

export type Pixel = { x: number; y: number; size: number; fill: string };

/** Pixel version of the whole symbol, with a stacked edge underneath so it reads as a block. */
const cell = 3.4;
const pixelTones: string[] = [];
const depthTones: string[] = [];
export const pixels: Pixel[] = [];
let minX = Infinity;
let maxX = -Infinity;

export const heroPalette = {
  line: "#FFFFFF",
  faint: "rgba(255,255,255,0.09)",
  plane: "rgba(255,255,255,0.38)",
  fill: "rgba(255,255,255,0.1)",
  node: colors.accent,
  flow: "rgba(214,205,255,0.7)",
  stair: ["#FFFFFF", "#CFC3FF", "#A48DFF", "#7C5CFF"],
};

function mix(hex: string, other: string, amount: number) {
  const parse = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const a = parse(hex);
  const b = parse(other);
  return "#" + a.map((v, i) => Math.round(v * amount + b[i]! * (1 - amount)).toString(16).padStart(2, "0")).join("");
}
pixelTones.push("#FFFFFF", mix(colors.accent, "#FFFFFF", 0.1), mix(colors.accent, "#FFFFFF", 0.28), "#CFC3FF", mix(colors.accent, "#FFFFFF", 0.42));
depthTones.push(...[0.5, 0.63, 0.76, 0.84].map((p) => mix(colors.accent, "#000000", p)));

for (let gx = 0; gx * cell < 128; gx++) {
  for (let gy = 0; gy * cell < 98; gy++) {
    const local: Pt = [gx * cell + cell / 2, gy * cell + cell / 2];
    if (!inside(local)) continue;
    const [x, y] = iso(local);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    // A few cells stay open, like a resolution still in progress.
    if (hash(gx, gy, 7) < 0.07) continue;
    const edge = !inside([local[0], local[1] + cell]) || !inside([local[0] + cell, local[1]]);
    if (edge) {
      for (let k = 1; k <= 3; k++) pixels.push({ x: r1(x), y: r1(y + k * 7), size: 4.6, fill: depthTones[k]! });
    }
    pixels.push({ x: r1(x), y: r1(y), size: r1(3.6 + hash(gx, gy, 3) * 1.6), fill: pixelTones[Math.floor(hash(gx, gy, 5) * 5)]! });
  }
}

/** Scan line positions: at `scanStart` the whole symbol is a drawing, at `scanEnd` it is all pixels. */
export const scanStart = Math.ceil(maxX + 10);
export const scanEnd = Math.floor(minX - 10);

/** Sparks trailing the scan line, relative to it (x is the distance to the right of the line). */
export const sparks: Pixel[] = Array.from({ length: 48 }, (_, n) => ({
  x: r1(4 + Math.pow(hash(n, 1, 11), 1.8) * 60),
  y: r1(40 + hash(n, 2, 11) * 290),
  size: r1(1.6 + hash(n, 3, 11) * 2.4),
  fill: pixelTones[Math.floor(hash(n, 4, 11) * 5)]!,
}));

/** The pixel stair from the illustrations: three to four squares on a diagonal. */
export const stair = [
  { x: 548, y: 54, size: 12 }, { x: 564, y: 38, size: 10 }, { x: 578, y: 24, size: 8 }, { x: 590, y: 12, size: 6 },
];

export const heroContours = contours(W, H, 15, 0.4);
export const flowPath = (() => {
  let d = "";
  for (let x = 260; x <= W + 20; x += 10) d += (d ? "L" : "M") + r1(x) + "," + r1(300 - x * 0.32 + 26 * Math.sin(x / 90));
  return d;
})();
