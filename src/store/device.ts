import { create } from "zustand";
import {
  api,
  events,
  padKey,
  type ButtonEvent,
  type ConnectRequest,
  type DeviceState,
  type DiscoveredLaunchpad,
  type LaunchpadModel,
  type PressureEvent,
  type RawMidiEvent,
} from "../lib/api";

export interface MidiLogEntry {
  id: number;
  timestamp: number;
  hex: string;
  description: string;
}

interface DeviceStore extends DeviceState {
  ready: boolean;
  scanning: boolean;
  discovered: DiscoveredLaunchpad[];
  scanError: string | null;
  busy: boolean;
  pressedSet: Set<string>;
  lastButton: ButtonEvent | null;
  /** latest aftertouch of the last pressed pad */
  lastPressure: PressureEvent | null;
  /** Last known position (0..1) of every knob and strip, by "x,y", bound to a fader or not. */
  controls: Record<string, number>;
  midiLog: MidiLogEntry[];

  init: () => Promise<() => void>;
  scan: () => Promise<void>;
  connect: (request: ConnectRequest) => Promise<void>;
  /** Start a Launchpad-less session with a model's layout. */
  connectVirtual: (model: LaunchpadModel) => Promise<void>;
  disconnect: () => Promise<void>;
  forget: () => Promise<void>;
  setAutoConnect: (enabled: boolean) => Promise<void>;
  setPressFeedback: (enabled: boolean) => Promise<void>;
  setPressThreshold: (threshold: number | null) => Promise<void>;
  clearLog: () => void;
  /** A knob or strip worked with the pointer: remember where it was left. */
  setControlPosition: (x: number, y: number, value: number) => void;
}

const MAX_LOG = 60;
let logId = 0;

function describe(bytes: number[]): string {
  if (bytes.length === 0) return "empty";
  const status = bytes[0] & 0xf0;
  if (bytes[0] === 0xf0) return "SysEx";
  const d1 = bytes[1] ?? 0;
  const d2 = bytes[2] ?? 0;
  switch (status) {
    case 0x90:
      return d2 === 0 ? `Note off ${d1}` : `Note on ${d1} vel ${d2}`;
    case 0x80:
      return `Note off ${d1}`;
    case 0xb0:
      return `CC ${d1} = ${d2}`;
    case 0xa0:
      return `Aftertouch ${d1} = ${d2}`;
    case 0xd0:
      return `Channel pressure ${d1}`;
    default:
      return `Status 0x${bytes[0].toString(16)}`;
  }
}

function applyState(state: DeviceState) {
  return {
    ...state,
    pressedSet: new Set(state.pressed.map(([x, y]) => padKey(x, y))),
  };
}

export const useDeviceStore = create<DeviceStore>((set, get) => ({
  status: "disconnected",
  device: null,
  layout: null,
  savedDevice: null,
  autoConnect: true,
  pressFeedback: true,
  pressThreshold: null,
  pressed: [],
  error: null,

  ready: false,
  scanning: false,
  discovered: [],
  scanError: null,
  busy: false,
  pressedSet: new Set(),
  lastButton: null,
  lastPressure: null,
  controls: {},
  midiLog: [],

  init: async () => {
    const unlisteners = await Promise.all([
      events.onDeviceState((state) => set(applyState(state))),
      events.onButton((event) => {
        set((s) => {
          const pressedSet = new Set(s.pressedSet);
          const key = padKey(event.x, event.y);
          if (event.pressed) pressedSet.add(key);
          else pressedSet.delete(key);
          return { pressedSet, lastButton: event, lastPressure: event.pressed ? s.lastPressure : null };
        });
      }),
      events.onPressure((event) => set({ lastPressure: event })),
      events.onControl((event) => set((s) => ({ controls: { ...s.controls, [padKey(event.x, event.y)]: event.value } }))),
      events.onFirmware((firmware) => set((s) => (s.device ? { device: { ...s.device, firmware } } : {}))),
      events.onRawMidi((raw: RawMidiEvent) => {
        set((s) => {
          const entry: MidiLogEntry = {
            id: ++logId,
            timestamp: raw.timestamp,
            hex: raw.hex,
            description: describe(raw.bytes),
          };
          return { midiLog: [entry, ...s.midiLog].slice(0, MAX_LOG) };
        });
      }),
      events.onPortsChanged(() => {
        // A device was plugged in or removed: refresh the picker if visible.
        if (get().status === "disconnected") void get().scan();
      }),
    ]);

    const state = await api.getDeviceState();
    set({ ...applyState(state), ready: true });
    if (state.status === "disconnected") void get().scan();

    return () => unlisteners.forEach((fn) => fn());
  },

  scan: async () => {
    if (get().scanning) return;
    set({ scanning: true, scanError: null });
    try {
      // With no MIDI ports a scan is over in a millisecond; keep the spinner up briefly so
      // the button visibly reacts instead of inviting a burst of clicks.
      const [discovered] = await Promise.all([api.scanLaunchpads(), new Promise((r) => setTimeout(r, 400))]);
      set({ discovered });
    } catch (e) {
      set({ scanError: String(e) });
    } finally {
      set({ scanning: false });
    }
  },

  connect: async (request) => {
    set({ busy: true });
    try {
      const state = await api.connect(request);
      set(applyState(state));
    } catch (e) {
      set({ error: String(e) });
    } finally {
      set({ busy: false });
    }
  },

  connectVirtual: async (model) => {
    set({ busy: true });
    try {
      const state = await api.connectVirtual(model);
      set(applyState(state));
    } catch (e) {
      set({ error: String(e) });
    } finally {
      set({ busy: false });
    }
  },

  disconnect: async () => {
    set({ busy: true });
    try {
      const state = await api.disconnect();
      set(applyState(state));
    } finally {
      set({ busy: false });
      void get().scan();
    }
  },

  forget: async () => {
    const state = await api.forgetDevice();
    set(applyState(state));
    void get().scan();
  },

  setAutoConnect: async (enabled) => {
    const state = await api.setAutoConnect(enabled);
    set(applyState(state));
  },

  setPressFeedback: async (enabled) => {
    const state = await api.setPressFeedback(enabled);
    set(applyState(state));
  },

  setPressThreshold: async (threshold) => {
    const state = await api.setPressThreshold(threshold);
    set(applyState(state));
  },

  clearLog: () => set({ midiLog: [] }),
  setControlPosition: (x, y, value) => set((s) => ({ controls: { ...s.controls, [padKey(x, y)]: value } })),
}));
