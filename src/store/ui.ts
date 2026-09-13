import { create } from "zustand";
import type { Action } from "../lib/api";

interface UiStore {
  settingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
  toggleSettings: () => void;
  /** Panel listing the buttons the connected Launchpad has no pad for. */
  outsideOpen: boolean;
  openOutside: () => void;
  closeOutside: () => void;
  /** Actions copied from a list (a marker brings its whole block), ready to paste into any button or fader. */
  actionClipboard: Action[] | null;
  copyActions: (actions: Action[]) => void;
}

/** Window-level UI state that several components need (settings dialog visibility). */
export const useUiStore = create<UiStore>((set) => ({
  settingsOpen: false,
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
  toggleSettings: () => set((s) => ({ settingsOpen: !s.settingsOpen })),
  outsideOpen: false,
  openOutside: () => set({ outsideOpen: true }),
  closeOutside: () => set({ outsideOpen: false }),
  actionClipboard: null,
  copyActions: (actions) => set({ actionClipboard: structuredClone(actions) }),
}));
