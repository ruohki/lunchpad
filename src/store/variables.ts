import { create } from "zustand";
import { api, events } from "../lib/api";

interface VariablesStore {
  globals: Record<string, string>;
  /** Extra names offered by completion while a context provides them (fader editor). */
  hints: string[];
  init: () => Promise<() => void>;
  setHints: (hints: string[]) => void;
}

export const useVariablesStore = create<VariablesStore>((set) => ({
  globals: {},
  hints: [],
  init: async () => {
    const unlisten = await events.onVariables((globals) => set({ globals }));
    try {
      set({ globals: await api.getVariables() });
    } catch {
      // not ready yet
    }
    return unlisten;
  },
  setHints: (hints) => set({ hints }),
}));
