import { create } from "zustand";
import type { Action, HubSharedItem, HubShareTarget } from "../lib/api";

/** The share dialog: a fresh share of a target, or an update of something shared before. */
export type ShareIntent = { mode: "share"; target: HubShareTarget } | { mode: "update"; target: HubShareTarget; item: HubSharedItem };

export type SettingsTabId = "launchpad" | "sound" | "keyboard" | "interface" | "obs" | "slobs" | "homeAssistant" | "hub" | "pages" | "variables" | "secrets" | "about" | "diagnostics";

interface UiStore {
  settingsOpen: boolean;
  /** A tab the settings dialog should show when it opens next (consumed by the dialog). */
  settingsTab: SettingsTabId | null;
  openSettings: (tab?: SettingsTabId) => void;
  takeSettingsTab: () => SettingsTabId | null;
  /** What the share dialog is about; null while closed. */
  shareIntent: ShareIntent | null;
  openShare: (target: HubShareTarget) => void;
  openUpdate: (item: HubSharedItem, target: HubShareTarget) => void;
  closeShare: () => void;
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
export const useUiStore = create<UiStore>((set, get) => ({
  settingsOpen: false,
  settingsTab: null,
  openSettings: (tab) => set({ settingsOpen: true, settingsTab: tab ?? null }),
  takeSettingsTab: () => {
    const tab = get().settingsTab;
    if (tab) set({ settingsTab: null });
    return tab;
  },
  shareIntent: null,
  openShare: (target) => set({ shareIntent: { mode: "share", target } }),
  openUpdate: (item, target) => set({ shareIntent: { mode: "update", target, item } }),
  closeShare: () => set({ shareIntent: null }),
  closeSettings: () => set({ settingsOpen: false }),
  toggleSettings: () => set((s) => ({ settingsOpen: !s.settingsOpen })),
  outsideOpen: false,
  openOutside: () => set({ outsideOpen: true }),
  closeOutside: () => set({ outsideOpen: false }),
  actionClipboard: null,
  copyActions: (actions) => set({ actionClipboard: structuredClone(actions) }),
}));
