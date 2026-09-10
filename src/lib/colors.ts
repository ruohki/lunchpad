import type { PadColor } from "./api";
import { NOVATION_PALETTE } from "./palette";

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function paletteRgb(index: number): Rgb {
  return hexToRgb(NOVATION_PALETTE[Math.max(0, Math.min(127, index))]);
}

export function hexToRgb(hex: string): Rgb {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const v = parseInt(h, 16);
  if (Number.isNaN(v)) return { r: 0, g: 0, b: 0 };
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  return "#" + [r, g, b].map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, "0")).join("");
}

/** Main colour of a pad colour (first colour for flashing). */
export function padColorRgb(color: PadColor): Rgb {
  switch (color.mode) {
    case "rgb":
      return { r: color.r, g: color.g, b: color.b };
    default:
      return paletteRgb(color.index);
  }
}

/** Second colour of a flashing pad, or the main colour otherwise. */
export function padColorAltRgb(color: PadColor): Rgb {
  return color.mode === "flashing" ? paletteRgb(color.alt) : padColorRgb(color);
}

/**
 * What a red/green Launchpad (S, Mini MK1/MK2, MK1) makes of a colour: red and
 * green in four levels each, blue dropped. Mirrors `velocity()` in the Rust
 * legacy driver so the screen shows what the LEDs show.
 */
export function limitedRgb({ r, g }: Rgb): Rgb {
  const level = (v: number) => Math.min(3, Math.floor((v + 42) / 85)) * 85;
  return { r: level(r), g: level(g), b: 0 };
}

export function isOff(color: PadColor): boolean {
  const { r, g, b } = padColorRgb(color);
  return r === 0 && g === 0 && b === 0;
}

export function luminance({ r, g, b }: Rgb): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/**
 * CSS colour for drawing a pad on screen. Very dark LED colours are lifted so
 * the button stays visible, like the legacy app did.
 */
export function padCss(rgb: Rgb): string {
  const l = luminance(rgb);
  if (l >= 0.08) return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
  const lift = 36 * (1 - l / 0.08);
  return `rgb(${Math.min(255, rgb.r + lift)}, ${Math.min(255, rgb.g + lift)}, ${Math.min(255, rgb.b + lift)})`;
}

/** Text colour that stays readable on the given background. */
export function contrastText(rgb: Rgb): string {
  return luminance(rgb) > 0.55 ? "#101014" : "#f4f4f8";
}

export function describePadColor(color: PadColor): string {
  switch (color.mode) {
    case "palette":
      return `Palette ${color.index}`;
    case "flashing":
      return `Flashing ${color.index} / ${color.alt}`;
    case "pulsing":
      return `Pulsing ${color.index}`;
    case "rgb":
      return rgbToHex(color).toUpperCase();
  }
}

/** Font stacks for the face keys stored in a text look (labels: `t(\`faces.\${key}\`)`). */
export const FACES: { key: string; css: string }[] = [
  { key: "sans", css: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
  { key: "condensed", css: "'Avenir Next Condensed', 'Arial Narrow', 'Roboto Condensed', system-ui, sans-serif" },
  { key: "serif", css: "ui-serif, Georgia, 'Times New Roman', serif" },
  { key: "mono", css: "ui-monospace, 'JetBrains Mono', Menlo, monospace" },
  { key: "rounded", css: "ui-rounded, 'SF Pro Rounded', 'Nunito', system-ui, sans-serif" },
];

export function faceCss(key: string): string {
  return FACES.find((f) => f.key === key)?.css ?? `'${key}', ${FACES[0].css}`;
}

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return { h: h * 360, s, l };
}

/** Palette index → hue family key (translate with `t(\`hue.\${key}\`)`). */
export function hueKey(index: number): string {
  const { h, s, l } = rgbToHsl(paletteRgb(index));
  if (l < 0.04) return "off";
  if (s < 0.15) return l > 0.85 ? "white" : "grey";
  const names = ["red", "orange", "yellow", "lime", "green", "mint", "cyan", "azure", "blue", "violet", "magenta", "pink"];
  return names[Math.round(h / 30) % 12];
}

let sortedCache: number[] | null = null;

/**
 * Palette indices ordered by shade: off and greys first (dark to light),
 * then colours grouped by hue with the brightest shade first. Rendered in
 * rows this reads as bands of one hue each.
 */
export function paletteByShade(): number[] {
  if (sortedCache) return sortedCache;
  const entries = NOVATION_PALETTE.map((hex, i) => ({ i, ...rgbToHsl(hexToRgb(hex)) }));
  const greys = entries.filter((e) => e.s < 0.15).sort((a, b) => a.l - b.l);
  const colours = entries
    .filter((e) => e.s >= 0.15)
    .sort((a, b) => {
      const ba = Math.floor(a.h / 15);
      const bb = Math.floor(b.h / 15);
      if (ba !== bb) return ba - bb;
      return b.l - a.l;
    });
  sortedCache = [...greys, ...colours].map((e) => e.i);
  return sortedCache;
}

export interface Hsv {
  h: number;
  s: number;
  v: number;
}

export function rgbToHsv({ r, g, b }: Rgb): Hsv {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
    else if (max === gn) h = ((bn - rn) / d + 2) / 6;
    else h = ((rn - gn) / d + 4) / 6;
  }
  return { h: h * 360, s: max === 0 ? 0 : d / max, v: max };
}

export function hsvToRgb({ h, s, v }: Hsv): Rgb {
  const c = v * s;
  const hp = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let [r, g, b] = [0, 0, 0];
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = v - c;
  return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) };
}
