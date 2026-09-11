import { create } from "zustand";
import { api, events, type AudioDevices, type HaState, type ObsState, type SlobsState, type VoiceInfo } from "../lib/api";

interface MediaStore {
  audioDevices: AudioDevices | null;
  voices: VoiceInfo[] | null;
  obs: ObsState | null;
  /** OBS filters per source name */
  filters: Record<string, string[]>;
  slobs: SlobsState | null;
  homeAssistant: HaState | null;
  /** Streamlabs filters per source name */
  slobsFilters: Record<string, string[]>;
  init: () => Promise<() => void>;
  loadAudioDevices: () => Promise<AudioDevices>;
  loadVoices: () => Promise<VoiceInfo[]>;
  loadObs: () => Promise<void>;
  obsConnect: () => Promise<void>;
  obsDisconnect: () => Promise<void>;
  obsRefresh: () => Promise<void>;
  loadFilters: (source: string) => Promise<string[]>;
  loadSlobs: () => Promise<void>;
  slobsConnect: () => Promise<void>;
  slobsDisconnect: () => Promise<void>;
  slobsRefresh: () => Promise<void>;
  loadSlobsFilters: (source: string) => Promise<string[]>;
  loadHomeAssistant: () => Promise<void>;
  homeAssistantRefresh: () => Promise<void>;
}

export const useMediaStore = create<MediaStore>((set, get) => ({
  audioDevices: null,
  voices: null,
  obs: null,
  filters: {},
  slobs: null,
  homeAssistant: null,
  slobsFilters: {},

  init: async () => {
    const unlisten = await Promise.all([
      events.onObsState((obs) => set({ obs })),
      events.onSlobsState((slobs) => set({ slobs })),
      events.onHomeAssistantState((homeAssistant) => set({ homeAssistant })),
    ]);
    void get().loadObs();
    void get().loadSlobs();
    void get().loadHomeAssistant();
    return () => unlisten.forEach((fn) => fn());
  },

  loadAudioDevices: async () => {
    const audioDevices = await api.listAudioDevices();
    set({ audioDevices });
    return audioDevices;
  },

  loadVoices: async () => {
    const voices = await api.listVoices();
    set({ voices });
    return voices;
  },

  loadObs: async () => {
    try {
      set({ obs: await api.obsState() });
    } catch {
      // backend not ready yet
    }
  },

  obsConnect: async () => {
    try {
      set({ obs: await api.obsConnect() });
    } catch {
      await get().loadObs();
    }
  },
  obsDisconnect: async () => {
    set({ obs: await api.obsDisconnect() });
  },
  obsRefresh: async () => {
    try {
      set({ obs: await api.obsRefresh() });
    } catch {
      await get().loadObs();
    }
  },

  loadFilters: async (source) => {
    try {
      const list = await api.obsFilters(source);
      set((s) => ({ filters: { ...s.filters, [source]: list } }));
      return list;
    } catch {
      return get().filters[source] ?? [];
    }
  },

  loadSlobs: async () => {
    try {
      set({ slobs: await api.slobsState() });
    } catch {
      // backend not ready yet
    }
  },

  slobsConnect: async () => {
    try {
      set({ slobs: await api.slobsConnect() });
    } catch {
      await get().loadSlobs();
    }
  },
  slobsDisconnect: async () => {
    set({ slobs: await api.slobsDisconnect() });
  },
  slobsRefresh: async () => {
    try {
      set({ slobs: await api.slobsRefresh() });
    } catch {
      await get().loadSlobs();
    }
  },

  loadHomeAssistant: async () => {
    try {
      set({ homeAssistant: await api.homeAssistantState() });
    } catch {
      // not fatal: the editors fall back to typing an entity id
    }
  },
  homeAssistantRefresh: async () => {
    try {
      set({ homeAssistant: await api.homeAssistantRefresh() });
    } catch {
      await get().loadHomeAssistant();
    }
  },
  loadSlobsFilters: async (source) => {
    try {
      const list = await api.slobsFilters(source);
      set((s) => ({ slobsFilters: { ...s.slobsFilters, [source]: list } }));
      return list;
    } catch {
      return get().slobsFilters[source] ?? [];
    }
  },
}));
