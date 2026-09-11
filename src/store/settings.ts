import { create } from "zustand";
import { api, events, type AudioSettings, type InputUnavailable, type ObsSettings, type PushToTalkSettings, type Settings, type SlobsSettings, type WindowSettings, type HomeAssistantSettings } from "../lib/api";

interface SettingsStore {
  settings: Settings | null;
  inputProblem: InputUnavailable | null;
  init: () => Promise<() => void>;
  setPushToTalk: (config: PushToTalkSettings) => Promise<void>;
  setAudio: (config: AudioSettings) => Promise<void>;
  setObs: (config: ObsSettings) => Promise<void>;
  setSlobs: (config: SlobsSettings) => Promise<void>;
  setHomeAssistant: (config: HomeAssistantSettings) => Promise<void>;
  setWindow: (config: WindowSettings) => Promise<void>;
  setDeveloperMode: (enabled: boolean) => Promise<void>;
  checkKeyboardAccess: () => Promise<void>;
  dismissInputProblem: () => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: null,
  inputProblem: null,

  init: async () => {
    const unlisten = await Promise.all([
      events.onSettings((settings) => set({ settings })),
      events.onInputUnavailable((problem) => set({ inputProblem: problem })),
    ]);
    set({ settings: await api.getSettings() });
    return () => unlisten.forEach((fn) => fn());
  },

  setPushToTalk: async (config) => {
    const settings = await api.setPushToTalk(config);
    set({ settings });
  },

  setAudio: async (config) => {
    const settings = await api.setAudioSettings(config);
    set({ settings });
  },

  setObs: async (config) => {
    const settings = await api.setObsSettings(config);
    set({ settings });
  },

  setSlobs: async (config) => {
    const settings = await api.setSlobsSettings(config);
    set({ settings });
  },
  setHomeAssistant: async (config) => {
    const settings = await api.setHomeAssistantSettings(config);
    set({ settings });
  },

  setWindow: async (config) => {
    const settings = await api.setWindowSettings(config);
    set({ settings });
  },

  setDeveloperMode: async (enabled) => {
    const settings = await api.setDeveloperMode(enabled);
    set({ settings });
  },

  checkKeyboardAccess: async () => {
    set({ inputProblem: null });
    await api.checkKeyboardAccess();
  },

  dismissInputProblem: () => set({ inputProblem: null }),
}));
