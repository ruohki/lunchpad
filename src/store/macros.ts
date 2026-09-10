import { create } from "zustand";
import { api, events, padKey, type RunningMacro } from "../lib/api";

interface MacroStore {
  running: RunningMacro[];
  /** `${pageId}|${padKey}` for every pad with a running macro; fader runs are not shown. */
  runningPads: Set<string>;
  init: () => Promise<() => void>;
  stopAll: () => Promise<void>;
}

function index(running: RunningMacro[]) {
  return { running, runningPads: new Set(running.filter((r) => r.list !== "fader").map((r) => `${r.pageId}|${padKey(r.x, r.y)}`)) };
}

export const useMacroStore = create<MacroStore>((set) => ({
  running: [],
  runningPads: new Set(),

  init: async () => {
    const unlisten = await events.onRunning((running) => set(index(running)));
    try {
      set(index(await api.getRunningMacros()));
    } catch {
      // engine not ready yet; the event stream will catch up
    }
    return unlisten;
  },

  stopAll: async () => {
    await api.stopAllMacros();
  },
}));
