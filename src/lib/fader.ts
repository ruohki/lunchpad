import { newActionId, type Fader, type FaderDirection, type Layout, type Page } from "./api";
import { isControl } from "./grid";

/** Mirrors `Fader` in src-tauri/src/profile/model.rs. A single-cell fader sits on a knob or strip. */
export function faderSteps(f: Fader): number {
  return Math.max(1, f.length);
}

/** True when the cell at (x, y) is a knob or touch strip of the connected layout. */
export function isControlCell(layout: Layout | null, x: number, y: number): boolean {
  const spec = layout?.pads.find((p) => p.x === x && p.y === y);
  return !!spec && isControl(spec.shape);
}

const DELTA: Record<FaderDirection, [number, number]> = { up: [0, 1], right: [1, 0], down: [0, -1], left: [-1, 0] };

export function faderPads(f: Fader): [number, number][] {
  const [dx, dy] = DELTA[f.direction];
  const pads: [number, number][] = [];
  for (let i = 0; i < faderSteps(f); i++) {
    const x = f.x + dx * i;
    const y = f.y + dy * i;
    if (x < 0 || y < 0) break;
    pads.push([x, y]);
  }
  return pads;
}

export function faderAt(page: Page, x: number, y: number): { fader: Fader; step: number } | null {
  for (const fader of page.faders ?? []) {
    const step = faderPads(fader).findIndex(([px, py]) => px === x && py === y);
    if (step >= 0) return { fader, step };
  }
  return null;
}

/** Mirrors `Fader::variable_key` in Rust: the variable name, else the name with spaces as underscores, else the id. */
export function faderVariable(f: Pick<Fader, "id" | "name" | "variable">): string {
  const clean = (raw: string) => raw.trim().split(/\s+/).filter(Boolean).join("_").replace(/[{}]/g, "");
  return clean(f.variable ?? "") || clean(f.name) || f.id;
}

export function faderFraction(f: Fader): number {
  const span = f.max - f.min;
  if (Math.abs(span) < Number.EPSILON) return 0;
  return Math.min(1, Math.max(0, (f.value - f.min) / span));
}

export function faderLevelStep(f: Fader): number {
  return Math.round(faderFraction(f) * (faderSteps(f) - 1));
}

export function faderValueAtStep(f: Fader, step: number): number {
  const steps = faderSteps(f);
  return steps <= 1 ? f.min : f.min + ((f.max - f.min) * step) / (steps - 1);
}

export function faderColorAt(f: Fader, step: number): [number, number, number] {
  const steps = faderSteps(f);
  const t = steps <= 1 ? 0 : step / (steps - 1);
  const mix = (a: number, b: number) => Math.round(a + (b - a) * t);
  return [mix(f.colorA[0], f.colorB[0]), mix(f.colorA[1], f.colorB[1]), mix(f.colorA[2], f.colorB[2])];
}

/** What a pad shows: its blend up to the level, dimmed above it. */
export function faderPadRgb(f: Fader, step: number): [number, number, number] {
  const c = faderColorAt(f, step);
  if (step <= faderLevelStep(f)) return c;
  const k = Math.min(100, f.dim) / 100;
  return [Math.round(c[0] * k), Math.round(c[1] * k), Math.round(c[2] * k)];
}

/** The pad label: the display scale when set, otherwise the real value with its unit. */
export function formatFaderValue(f: Fader, value = f.value): string {
  if (f.display) {
    const span = f.max - f.min;
    const fraction = Math.abs(span) < Number.EPSILON ? 0 : Math.min(1, Math.max(0, (value - f.min) / span));
    const shown = f.display.min + (f.display.max - f.display.min) * fraction;
    return `${shown.toFixed(Math.max(0, Math.min(3, f.display.decimals)))}${f.display.unit}`;
  }
  return `${value.toFixed(Math.max(0, Math.min(3, f.decimals)))}${f.unit}`;
}

export const rgbToHex = ([r, g, b]: [number, number, number]) => "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("");

export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [0, 0, 0];
}

/** How many pads fit from (x, y) in a direction on this layout. */
export function maxFaderLength(layout: Layout | null, x: number, y: number, direction: FaderDirection): number {
  // A knob or strip holds exactly one fader cell: the hardware supplies the value.
  if (isControlCell(layout, x, y)) return 1;
  const w = layout?.width ?? 9;
  const h = layout?.height ?? 9;
  const [dx, dy] = DELTA[direction];
  let n = 0;
  for (let i = 0; i < Math.max(w, h); i++) {
    const px = x + dx * i;
    const py = y + dy * i;
    if (px < 0 || py < 0 || px >= w || py >= h) break;
    // Only real pads count: skip holes, the shared corner and controls.
    const spec = layout?.pads.find((p) => p.x === px && p.y === py);
    if (layout && (!spec || spec.shape === "empty" || spec.shape === "logo" || isControl(spec.shape))) break;
    n++;
  }
  return Math.max(2, n);
}

export function newFader(x: number, y: number, layout: Layout | null): Fader {
  const control = isControlCell(layout, x, y);
  const direction: FaderDirection = !control && maxFaderLength(layout, x, y, "up") >= 3 ? "up" : "right";
  return {
    id: "",
    name: "",
    variable: "",
    x,
    y,
    direction,
    length: control ? 1 : Math.min(4, maxFaderLength(layout, x, y, direction)),
    colorA: [0, 96, 255],
    colorB: [255, 64, 32],
    dim: 12,
    min: 0,
    max: 100,
    unit: "%",
    decimals: 0,
    value: 0,
    display: null,
    onChange: [],
  };
}

export const faderKey = () => newActionId();

/** Whether a fader can sit with its first pad at (x, y): every pad exists and none holds a button or another fader. */
export function faderFitsAt(fader: Fader, x: number, y: number, page: Page, layout: Layout | null): boolean {
  const moved: Fader = { ...fader, x, y };
  const pads = faderPads(moved);
  if (pads.length < faderSteps(moved)) return false;
  for (const [px, py] of pads) {
    if (layout) {
      const spec = layout.pads.find((p) => p.x === px && p.y === py);
      if (!spec || spec.shape === "empty" || spec.shape === "logo") return false;
      // A knob or strip takes a single-cell fader only; a run cannot cross one.
      if (isControl(spec.shape) && pads.length !== 1) return false;
      if (px >= layout.width || py >= layout.height) return false;
    }
    if (page.buttons.some((b) => b.x === px && b.y === py)) return false;
    if (page.faders.some((other) => other.id !== fader.id && faderPads(other).some(([ox, oy]) => ox === px && oy === py))) return false;
  }
  return true;
}

