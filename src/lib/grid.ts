import type { Layout, Page, PadShape, PlacedButton } from "./api";

/** Knobs and touch strips carry a value, not a button. */
export const isControl = (shape: PadShape): boolean => shape === "knob" || shape === "strip";

/** Piano keys: drawn as a keyboard row, a black key at the x of the white key to its left. */
export const isKey = (shape: PadShape): boolean => shape === "keyWhite" || shape === "keyBlack";

/** Outline of a control's face: a circle, a square pad, a wide rounded button or a piano key. */
export type Corners = "round" | "square" | "rect" | "key";

export function cornersOf(shape: PadShape | undefined): Corners {
  switch (shape) {
    case "round":
      return "round";
    // Only the Pro MK3's Shift is "small", and that model's buttons are square.
    case "small":
      return "square";
    case "rect":
    case "tallRect":
      return "rect";
    case "keyWhite":
    case "keyBlack":
      return "key";
    default:
      return "square";
  }
}

/** CSS border radius of a face drawn in a cell `cell` px wide (pixels, so a face that is not square keeps circular corners). */
export function cornerRadius(corners: Corners, cell: number): string {
  switch (corners) {
    case "round":
      return "9999px";
    case "square":
      return `${Math.max(2, cell * 0.14)}px`;
    case "rect":
      return `${Math.max(3, cell * 0.1)}px`;
    case "key": {
      const r = Math.max(2, cell * 0.08);
      return `0 0 ${r}px ${r}px`;
    }
  }
}

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/** Name of a MIDI note the way Novation prints it (60 = C3). */
export const noteName = (note: number): string => `${NOTE_NAMES[note % 12]}${Math.floor(note / 12) - 2}`;

/** Buttons of a page that the connected layout has no pad for (kept, invisible until a bigger Launchpad is used). */
export function buttonsOutside(page: Page, layout: Layout | null): PlacedButton[] {
  if (!layout) return [];
  return page.buttons.filter((b) => {
    const spec = layout.pads.find((p) => p.x === b.x && p.y === b.y);
    return !spec || spec.shape === "empty" || spec.shape === "logo" || isControl(spec.shape);
  });
}
