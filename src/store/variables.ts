import { create } from "zustand";
import { api, events } from "../lib/api";

interface VariablesStore {
  globals: Record<string, string>;
  /** Provided values that never change while the app runs (app version, machine, folders). */
  info: Record<string, string>;
  /** Extra names offered by completion while a context provides them (fader editor). */
  hints: string[];
  init: () => Promise<() => void>;
  setHints: (hints: string[]) => void;
  remove: (names: string[]) => Promise<void>;
  setVariable: (name: string, value: string) => Promise<void>;
  clear: () => Promise<void>;
  pruneFaders: () => Promise<number>;
}

export const useVariablesStore = create<VariablesStore>((set) => ({
  globals: {},
  info: {},
  hints: [],
  init: async () => {
    const unlisten = await events.onVariables((globals) => set({ globals }));
    api
      .builtinInfo()
      .then((info) => set({ info }))
      .catch(() => {});
    try {
      set({ globals: await api.getVariables() });
    } catch {
      // not ready yet
    }
    return unlisten;
  },
  setHints: (hints) => set({ hints }),
  remove: async (names) => set({ globals: await api.deleteVariables(names) }),
  setVariable: async (name, value) => set({ globals: await api.setVariable(name, value) }),
  clear: async () => set({ globals: await api.clearVariables() }),
  pruneFaders: async () => {
    const count = await api.pruneFaderVariables();
    set({ globals: await api.getVariables() });
    return count;
  },
}));
