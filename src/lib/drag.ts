import { create } from "zustand";
import type { Fader } from "./api";
import type { PadRef } from "../store/profile";

/** A button or fader being dragged across the grid; the grid highlights `over` and draws a ghost. */
export interface DragState {
  from: PadRef;
  copy: boolean;
  over: PadRef | null;
  /** Dragging a whole fader by one of its pads (step = which pad was grabbed). */
  fader: { fader: Fader; step: number } | null;
  /** The dragged thing may land where the pointer is. */
  fits: boolean;
}

type Updater = DragState | null | ((current: DragState | null) => DragState | null);

interface DragStore {
  drag: DragState | null;
  setDrag: (next: Updater) => void;
}

/** Shared so the out-of-sight panel can start a drag the grid then finishes. */
export const useDragStore = create<DragStore>((set) => ({
  drag: null,
  setDrag: (next) => set((s) => ({ drag: typeof next === "function" ? next(s.drag) : next })),
}));

export const sameRef = (a: PadRef | null, b: PadRef | null) => a?.x === b?.x && a?.y === b?.y;

/** The pad under a screen point, through the `data-pad` attribute each pad carries. */
export function padAt(x: number, y: number): PadRef | null {
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-pad]");
  const raw = el?.dataset.pad;
  if (!raw) return null;
  const [px, py] = raw.split(",").map(Number);
  return Number.isFinite(px) && Number.isFinite(py) ? { x: px, y: py } : null;
}
