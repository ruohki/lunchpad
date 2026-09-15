/**
 * Typed bridge to the Rust backend. Types mirror the serde structs in
 * `src-tauri/src/midi/types.rs`, `manager.rs`, `config.rs` and `commands.rs`.
 */
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export type LaunchpadModel =
  | "LaunchpadMk2"
  | "LaunchpadX"
  | "LaunchpadMiniMk3"
  | "LaunchpadProMk2"
  | "LaunchpadProMk3"
  | "LaunchpadLegacy"
  | "LaunchkeyMiniMk3"
  | "LaunchkeyMiniMk4";

export interface MidiPortInfo {
  index: number;
  name: string;
}

export type IdentificationSource = "deviceInquiry" | "portName";

export interface DiscoveredLaunchpad {
  model: LaunchpadModel;
  modelName: string;
  input: MidiPortInfo;
  output: MidiPortInfo;
  firmware: string | null;
  identifiedBy: IdentificationSource;
  inquiryReply: string | null;
  connected: boolean;
}

export type PadShape = "pad" | "round" | "small" | "logo" | "empty" | "knob" | "strip" | "rect" | "tallRect" | "keyWhite" | "keyBlack";
/** What a control can light: full colour, one white LED (colours become a brightness), or nothing. */
export type LedKind = "rgb" | "white" | "none";
export type PadRegion = "grid" | "top" | "right" | "bottom" | "left" | "bottom2" | "other";

export interface PadSpec {
  x: number;
  y: number;
  shape: PadShape;
  region: PadRegion;
  label: string | null;
  note: number | null;
  cc: boolean;
  led: LedKind;
  /** rows the control spans downwards from y (touch strips); 1 otherwise */
  rows: number;
  /** springs back to the middle when released (a pitch strip): drawn as a bar, not a fill */
  centred: boolean;
}

export interface Layout {
  model: LaunchpadModel;
  modelName: string;
  width: number;
  height: number;
  rowWeights: number[];
  pads: PadSpec[];
  limitedColor: boolean;
  velocitySensitive: boolean;
}

export interface ButtonEvent {
  x: number;
  y: number;
  pressed: boolean;
  note: number;
  cc: boolean;
  value: number;
}

/** Aftertouch while a pad is held (X, Pro, Pro MK3), 0-127. */
export interface PressureEvent {
  x: number;
  y: number;
  value: number;
}

export interface RawMidiEvent {
  timestamp: number;
  bytes: number[];
  hex: string;
}

export type ConnectionStatus = "disconnected" | "connecting" | "connected";

export interface ConnectedDevice {
  model: LaunchpadModel;
  modelName: string;
  inputName: string;
  outputName: string;
  firmware: string | null;
  /** no hardware: the pads on screen drive the macros */
  virtual: boolean;
}

export interface SavedDevice {
  inputName: string;
  outputName: string;
  model: LaunchpadModel;
  firmware: string | null;
  virtual: boolean;
}

export interface Diagnostics {
  appVersion: string;
  tauriVersion: string;
  webviewVersion: string | null;
  os: { name: string; version: string; arch: string };
  configDir: string;
  logDir: string;
  device: {
    status: string;
    model: string | null;
    input: string | null;
    output: string | null;
    firmware: string | null;
    isVirtual: boolean;
    error: string | null;
    autoConnect: boolean;
    remembered: string | null;
  };
  midiInputs: string[];
  midiOutputs: string[];
  midiError: string | null;
  audio: { defaultDevice: string | null; devices: string[]; configured: string | null };
  integrations: { name: string; enabled: boolean; endpoint: string; connected: boolean; error: string | null }[];
  profile: { pages: number; buttons: number; actions: number };
  settings: { developerMode: boolean; pushToTalk: string | null; stayOnTop: boolean; minimizeToTray: boolean; runAtStartup: boolean };
}

export interface DeviceState {
  status: ConnectionStatus;
  device: ConnectedDevice | null;
  layout: Layout | null;
  savedDevice: SavedDevice | null;
  autoConnect: boolean;
  pressFeedback: boolean;
  /** custom press threshold on velocity-sensitive pads; null = model default */
  pressThreshold: number | null;
  pressed: [number, number][];
  error: string | null;
}

export interface ModelInfo {
  model: LaunchpadModel;
  name: string;
}

export interface PushToTalkSettings {
  enabled: boolean;
  /** key name in the app vocabulary (src/lib/keys.ts) */
  key: string;
  modifiers: string[];
}

export interface AudioSettings {
  /** null = system default device */
  outputDevice: string | null;
}

export interface ObsSettings {
  enabled: boolean;
  host: string;
  port: number;
  password: string;
  autoConnect: boolean;
}

export interface SlobsSettings {
  enabled: boolean;
  host: string;
  port: number;
  /** API token from Streamlabs' Remote Control settings; only needed for a remote host */
  token: string;
  autoConnect: boolean;
}

export interface HomeAssistantSettings {
  enabled: boolean;
  /** Base URL of the instance, e.g. http://homeassistant.local:8123 */
  url: string;
  /** Long-lived access token from the profile page */
  token: string;
  ignoreTlsErrors: boolean;
}

export interface HaEntity {
  entityId: string;
  name: string;
  domain: string;
  state: string;
}

export interface HaState {
  connected: boolean;
  error: string | null;
  version: string | null;
  location: string | null;
  entities: HaEntity[];
}

export type HaPower = "on" | "off" | "toggle";
export const HA_POWER_MODES: readonly HaPower[] = ["on", "off", "toggle"];
export type HaValueKind = "brightness" | "colorTemperature" | "position" | "fanSpeed" | "volume" | "number" | "temperature";
export const HA_VALUE_KINDS: readonly HaValueKind[] = ["brightness", "colorTemperature", "position", "fanSpeed", "volume", "number", "temperature"];

export interface WindowSettings {
  stayOnTop: boolean;
  /** closing the window hides it; the tray icon brings it back */
  minimizeToTray: boolean;
  runAtStartup: boolean;
  /** open in the tray only */
  startHidden: boolean;
}

/** Translated texts for the tray menu (built in Rust, which has no i18n). */
export interface TrayLabels {
  discord: string;
  show: string;
  stayOnTop: string;
  minimizeToTray: string;
  runAtStartup: string;
  stopAll: string;
  quit: string;
}

export interface Settings {
  version: number;
  device: SavedDevice | null;
  autoConnect: boolean;
  pressFeedback: boolean;
  pushToTalk: PushToTalkSettings;
  audio: AudioSettings;
  obs: ObsSettings;
  slobs: SlobsSettings;
  homeAssistant: HomeAssistantSettings;
  window: WindowSettings;
  developerMode: boolean;
  /** Names of the user's secrets, used as `{{secret.<name>}}`; the values stay in the credential store. */
  secrets: string[];
}

export interface AudioDevices {
  default: string | null;
  devices: string[];
}

export interface AudioInfo {
  durationSecs: number;
  peaks: number[];
}

export interface VoiceInfo {
  id: string;
  name: string;
  language: string;
}

export interface ObsState {
  connected: boolean;
  error: string | null;
  collections: string[];
  currentCollection: string | null;
  scenes: string[];
  currentScene: string | null;
  inputs: string[];
  /** [scene, source] pairs whose scene item is enabled */
  visible: [string, string][];
  muted: string[];
  streaming: boolean;
  recording: boolean;
  replayBuffer: boolean;
}

export interface SlobsState {
  connected: boolean;
  error: string | null;
  collections: string[];
  currentCollection: string | null;
  scenes: string[];
  currentScene: string | null;
  /** every source of the active collection */
  sources: string[];
  /** sources with an audio track (the mixer) */
  audioSources: string[];
  /** [scene, source] pairs whose scene item is visible */
  visible: [string, string][];
  muted: string[];
  studioMode: boolean;
  /** offline, starting, live, ending, reconnecting */
  streaming: string;
  /** offline, starting, recording, stopping */
  recording: string;
  /** offline, running, stopping, saving */
  replayBuffer: string;
}

export interface HistoryState {
  undo: number;
  redo: number;
}

export interface InputUnavailable {
  reason: string;
  needsPermission: boolean;
}

// ----- profile ---------------------------------------------------------------

export type PadColor =
  | { mode: "palette"; index: number }
  | { mode: "flashing"; index: number; alt: number }
  | { mode: "pulsing"; index: number }
  | { mode: "rgb"; r: number; g: number; b: number };

export type Look =
  | { type: "text"; caption: string; size: number; face: string; color: string }
  | { type: "image"; uri: string };

export interface ButtonRef {
  /** null = the page of the button running the macro */
  pageId: string | null;
  x: number;
  y: number;
}

export type ButtonTrigger = "press" | "release" | "tap" | "hold";
export type KeyEvent = "down" | "up" | "tap";
export type ObsTarget = "stream" | "record" | "replay";
export type ObsMode = "start" | "stop" | "toggle";
export type StudioMode = "enable" | "disable" | "toggle" | "transition";
export type SystemVolumeTarget = "output" | "input";
export type SystemVolumeMode = "set" | "adjust" | "mute" | "unmute" | "toggleMute";
export const SYSTEM_VOLUME_MODES: SystemVolumeMode[] = ["set", "adjust", "mute", "unmute", "toggleMute"];
/** dB, or percent of the app's own volume scale (OBS: 100 % = 0 dB; Streamlabs: fader position). */
export type VolumeUnit = "db" | "percent";
export type VisibilityMode = "show" | "hide" | "toggle";
export type MuteMode = "mute" | "unmute" | "toggle" | "keep";

export type Keystroke =
  | { type: "key"; event: KeyEvent; key: string; modifiers: string[] }
  | { type: "delay"; ms: number }
  | { type: "text"; text: string; delayMs: number };

/** Mirrors `ActionKind` in src-tauri/src/macros/model.rs (serde tag "type"). */
export type ActionKind =
  | { type: "delay"; ms: number }
  | { type: "switchPage"; pageId: string }
  | { type: "setColor"; color: PadColor; target: ButtonRef | null }
  | { type: "runButton"; target: ButtonRef; trigger: ButtonTrigger }
  | { type: "setFader"; fader: string; value: string; runActions: boolean }
  | { type: "stopAllMacros" }
  | { type: "stopThisMacro" }
  | { type: "restartThisMacro" }
  | { type: "pushToTalkStart"; endId: string }
  | { type: "pushToTalkEnd"; startId: string }
  | { type: "flipFlopStart"; middleId: string; endId: string; isA: boolean }
  | { type: "flipFlopMiddle"; startId: string; endId: string }
  | { type: "flipFlopEnd"; startId: string; middleId: string }
  | { type: "playSound"; file: string; volume: number; start: number; end: number; outputDevice: string | null; volumeFromVelocity: boolean }
  | { type: "textToSpeech"; text: string; voice: string | null; volume: number }
  | { type: "launchApplication"; executable: string; arguments: string; hidden: boolean; killOnStop: boolean; saveOutputTo: string | null; saveScope: VarScope }
  | { type: "hotkey"; keystrokes: Keystroke[]; restoreAllAtEnd: boolean }
  | { type: "obsSwitchScene"; scene: string; collection: string }
  | { type: "obsToggleSource"; scene: string; collection: string; source: string; visible: boolean; mode: VisibilityMode | null }
  | { type: "obsSetAudio"; scene: string; collection: string; source: string; muted: boolean; muteMode: MuteMode | null; volumeDb: number; volumeFrom: string | null; volumeUnit: VolumeUnit; setVolume: boolean }
  | { type: "obsToggleFilter"; source: string; filter: string; enabled: boolean }
  | { type: "obsStream"; target: ObsTarget; mode: ObsMode }
  | { type: "obsSaveReplay" }
  | { type: "obsStudioMode"; mode: StudioMode }
  | { type: "slobsSwitchScene"; scene: string; collection: string }
  | { type: "slobsToggleSource"; scene: string; collection: string; source: string; visible: boolean; mode: VisibilityMode | null }
  | { type: "slobsSetAudio"; scene: string; collection: string; source: string; muted: boolean; muteMode: MuteMode | null; volumeDb: number; volumeFrom: string | null; volumeUnit: VolumeUnit; setVolume: boolean }
  | { type: "setSystemVolume"; target: SystemVolumeTarget; mode: SystemVolumeMode; volume: number; volumeFrom: string | null; device: string | null }
  | { type: "stopAllSounds" }
  | { type: "setAudioDevice"; target: SystemVolumeTarget; device: string }
  | { type: "addToVariable"; name: string; amount: string; scope: VarScope }
  | { type: "slobsToggleFilter"; source: string; filter: string; enabled: boolean }
  | { type: "slobsStream"; target: ObsTarget; mode: ObsMode }
  | { type: "slobsSaveReplay" }
  | { type: "slobsStudioMode"; mode: StudioMode }
  | { type: "homeAssistantTurn"; entity: string; mode: HaPower }
  | { type: "homeAssistantSetValue"; entity: string; kind: HaValueKind; value: number; valueFrom: string | null }
  | { type: "homeAssistantCallService"; domain: string; service: string; entity: string; data: string }
  | {
      type: "httpRequest";
      method: HttpMethod;
      url: string;
      headers: HttpHeader[];
      contentType: string | null;
      body: string;
      bodyMode: HttpBodyMode;
      bodyFile: string | null;
      files: HttpFilePart[];
      auth: HttpAuth;
      timeoutMs: number;
      ignoreTlsErrors: boolean;
      saveTo: string | null;
      saveScope: VarScope;
      response: HttpResponse;
      responseField: string;
      fileName: string;
      reuse: boolean;
    }
  | { type: "ifStart"; variable: string; op: CompareOp; value: string; elseId: string; endId: string }
  | { type: "ifElse"; startId: string; endId: string }
  | { type: "ifEnd"; startId: string; elseId: string }
  | { type: "setVariable"; name: string; value: string; scope: VarScope }
  | { type: "runScript"; code: string; saveTo: string | null; saveScope: VarScope };

export type VarScope = "local" | "global";
export type CompareOp = "equals" | "notEquals" | "contains" | "startsWith" | "endsWith" | "greaterThan" | "lessThan" | "isEmpty" | "isNotEmpty" | "matches";
export const COMPARE_OPS: CompareOp[] = ["equals", "notEquals", "contains", "startsWith", "endsWith", "greaterThan", "lessThan", "isEmpty", "isNotEmpty", "matches"];
/** Placeholder names every macro can read. */
export const BUILTIN_VARIABLES = ["velocity", "velocity01", "pressure", "pressure01", "x", "y", "pageId"] as const;
export type HttpMethod = "get" | "post" | "put" | "patch" | "delete" | "head";
export type HttpBodyMode = "text" | "file" | "multipart";
/** What an HTTP action does with the response: keep the text, or save a file from the body, a base64 field or a URL in a field. */
export type HttpResponse = "text" | "file" | "base64Field" | "urlField";
export interface HttpFilePart {
  field: string;
  path: string;
  filename: string | null;
  contentType: string | null;
}
export interface HttpHeader {
  name: string;
  value: string;
}
export type HttpAuth = { type: "none" } | { type: "basic"; username: string; password: string } | { type: "bearer"; token: string };

export interface HttpOutcome {
  status: number;
  ok: boolean;
  elapsedMs: number;
  bodyPreview: string;
  bytes: number;
  /** The file the response was saved to */
  file: string | null;
  /** The file existed already and no request was sent */
  cached: boolean;
  /** The server answered but the response could not be turned into a file */
  error: string | null;
}
export interface DownloadCacheInfo {
  path: string;
  files: number;
  bytes: number;
}

export interface ScriptOutcome {
  result: string;
  locals: Record<string, string>;
  globals: Record<string, string>;
  elapsedMs: number;
}

export type ActionType = ActionKind["type"];

export type Action = { id: string; wait: boolean } & ActionKind;

/** Every action the engine can run. Kept as a set so a future action can ship its data model before its runtime. */
export const AVAILABLE_ACTIONS: ReadonlySet<ActionType> = new Set<ActionType>([
  "delay",
  "switchPage",
  "setColor",
  "runButton",
  "setFader",
  "stopAllMacros",
  "stopThisMacro",
  "restartThisMacro",
  "pushToTalkStart",
  "pushToTalkEnd",
  "flipFlopStart",
  "flipFlopMiddle",
  "flipFlopEnd",
  "playSound",
  "textToSpeech",
  "setSystemVolume",
  "stopAllSounds",
  "setAudioDevice",
  "addToVariable",
  "launchApplication",
  "hotkey",
  "obsSwitchScene",
  "obsToggleSource",
  "obsSetAudio",
  "obsToggleFilter",
  "obsStream",
  "obsSaveReplay",
  "obsStudioMode",
  "slobsSwitchScene",
  "slobsToggleSource",
  "slobsSetAudio",
  "slobsToggleFilter",
  "slobsStream",
  "slobsSaveReplay",
  "slobsStudioMode",
  "homeAssistantTurn",
  "homeAssistantSetValue",
  "homeAssistantCallService",
  "httpRequest",
  "setVariable",
  "runScript",
  "ifStart",
  "ifElse",
  "ifEnd",
]);

export function newActionId(): string {
  return crypto.randomUUID();
}

export interface RunningMacro {
  id: string;
  pageId: string;
  x: number;
  y: number;
  list: "down" | "up" | "hold" | "fader";
  startedAtMs: number;
}

export type LinkProvider = "obs" | "slobs";
export type LinkKind = "scene" | "sourceVisible" | "sourceMuted" | "streaming" | "recording" | "replayBuffer";
export const LINK_KINDS: LinkKind[] = ["scene", "sourceVisible", "sourceMuted", "streaming", "recording", "replayBuffer"];

/** "Active while …": the button shows its active colour while a streaming app is in this state. */
export interface StateLink {
  provider: LinkProvider;
  kind: LinkKind;
  /** empty = the live scene (for sourceVisible) */
  scene: string;
  source: string;
}

export interface Button {
  look: Look;
  color: PadColor;
  activeColor: PadColor | null;
  loop: boolean;
  down: Action[];
  up: Action[];
  /** long-press actions; with any set, `down` runs when a short press is released */
  hold: Action[];
  holdMs: number;
  /** pressed actions wait until the press is known to be a tap (true) or run at once (false) */
  holdWait: boolean;
  stateLink: StateLink | null;
}

export interface PlacedButton extends Button {
  x: number;
  y: number;
}

export type FaderDirection = "up" | "right" | "down" | "left";

/** A run of pads acting as one fader; pressing a pad sets the level by position. */
export interface Fader {
  id: string;
  name: string;
  /** what macros read the level as (`fader.<variable>`); empty = derived from the name */
  variable: string;
  /** first pad (the minimum) */
  x: number;
  y: number;
  direction: FaderDirection;
  length: number;
  colorA: [number, number, number];
  colorB: [number, number, number];
  /** brightness (percent) of pads above the level */
  dim: number;
  min: number;
  max: number;
  unit: string;
  decimals: number;
  value: number;
  /** show the level on another scale, e.g. -100..26 dB as 0..100 % */
  display: { min: number; max: number; unit: string; decimals: number } | null;
  onChange: Action[];
}

/** Variables the fader's actions receive. */
export const FADER_VARIABLES = ["value", "percent", "fraction", "step", "steps", "display"] as const;

export interface Page {
  id: string;
  name: string;
  buttons: PlacedButton[];
  faders: Fader[];
}

export interface Profile {
  version: number;
  activePage: string;
  pages: Page[];
}

export interface ImportReport {
  pages: number;
  buttons: number;
  actions: number;
  warnings: string[];
}

export type ImportMode = "append" | "replace";

export const DEFAULT_PAGE_ID = "default";

export function emptyButton(): Button {
  return {
    look: { type: "text", caption: "", size: 16, face: "sans", color: "#ffffff" },
    color: { mode: "palette", index: 0 },
    activeColor: null,
    hold: [],
    holdMs: 500,
    holdWait: true,
    stateLink: null,
    loop: false,
    down: [],
    up: [],
  };
}

export interface ConnectRequest {
  inputName: string;
  outputName: string;
  model: LaunchpadModel;
  firmware?: string | null;
}

export const api = {
  scanLaunchpads: () => invoke<DiscoveredLaunchpad[]>("scan_launchpads"),
  connect: (request: ConnectRequest) => invoke<DeviceState>("connect_launchpad", { request }),
  connectVirtual: (model: LaunchpadModel) => invoke<DeviceState>("connect_virtual", { model }),
  disconnect: () => invoke<DeviceState>("disconnect_launchpad"),
  getDeviceState: () => invoke<DeviceState>("get_device_state"),
  setAutoConnect: (enabled: boolean) => invoke<DeviceState>("set_auto_connect", { enabled }),
  setPressFeedback: (enabled: boolean) => invoke<DeviceState>("set_press_feedback", { enabled }),
  setPressThreshold: (threshold: number | null) => invoke<DeviceState>("set_press_threshold", { threshold }),
  forgetDevice: () => invoke<DeviceState>("forget_device"),
  getLayout: (model: LaunchpadModel) => invoke<Layout>("get_layout", { model }),
  listModels: () => invoke<ModelInfo[]>("list_models"),
  pressPad: (x: number, y: number, pressed: boolean) => invoke<void>("press_pad", { x, y, pressed }),
  /** A drag on a knob or strip in the UI: `value` runs 0..1 over the control's travel, like a hardware turn. */
  controlPad: (x: number, y: number, value: number) => invoke<void>("control_pad", { x, y, value }),
  resetLeds: () => invoke<void>("reset_leds"),
  sendRawMidi: (bytes: number[]) => invoke<void>("send_raw_midi", { bytes }),

  getProfile: () => invoke<Profile>("get_profile"),
  setActivePage: (pageId: string) => invoke<void>("set_active_page", { pageId }),
  addPage: (name: string) => invoke<Page>("add_page", { name }),
  renamePage: (pageId: string, name: string) => invoke<void>("rename_page", { pageId, name }),
  removePage: (pageId: string) => invoke<void>("remove_page", { pageId }),
  duplicatePage: (pageId: string) => invoke<Page>("duplicate_page", { pageId }),
  movePage: (pageId: string, toIndex: number) => invoke<void>("move_page", { pageId, toIndex }),
  setButton: (pageId: string, x: number, y: number, button: Button) =>
    invoke<void>("set_button", { pageId, x, y, button }),
  clearButton: (pageId: string, x: number, y: number) => invoke<void>("clear_button", { pageId, x, y }),
  setFader: (pageId: string, fader: Fader) => invoke<void>("set_fader", { pageId, fader }),
  removeFader: (pageId: string, faderId: string) => invoke<void>("remove_fader", { pageId, faderId }),
  moveFader: (pageId: string, faderId: string, x: number, y: number) => invoke<void>("move_fader", { pageId, faderId, x, y }),
  undoProfile: () => invoke<boolean>("undo_profile"),
  redoProfile: () => invoke<boolean>("redo_profile"),
  historyState: () => invoke<HistoryState>("history_state"),
  missingSoundFiles: () => invoke<string[]>("missing_sound_files"),
  openLogDir: () => invoke<void>("open_log_dir"),
  moveButton: (pageId: string, from: { x: number; y: number }, to: { x: number; y: number }, copy: boolean) =>
    invoke<void>("move_button", { pageId, from, to, copy }),
  importLegacyJson: (json: string, mode: ImportMode) =>
    invoke<ImportReport>("import_legacy_json", { json, mode }),
  importLegacyFile: (path: string, mode: ImportMode) =>
    invoke<ImportReport>("import_legacy_file", { path, mode }),
  exportPage: (pageId: string) => invoke<string>("export_page", { pageId }),
  exportPageFile: (pageId: string, path: string) => invoke<void>("export_page_file", { pageId, path }),
  importPageJson: (json: string) => invoke<ImportReport>("import_page_json", { json }),
  importPageFile: (path: string) => invoke<ImportReport>("import_page_file", { path }),
  restoreProfileBackup: () => invoke<Profile>("restore_profile_backup"),
  readImageDataUri: (path: string) => invoke<string>("read_image_data_uri", { path }),

  diagnostics: () => invoke<Diagnostics>("diagnostics"),
  getSettings: () => invoke<Settings>("get_settings"),
  setPushToTalk: (config: PushToTalkSettings) => invoke<Settings>("set_push_to_talk", { config }),
  checkKeyboardAccess: () => invoke<void>("check_keyboard_access"),
  setDeveloperMode: (enabled: boolean) => invoke<Settings>("set_developer_mode", { enabled }),
  /** Add or replace a named secret; the value is never read back. */
  setSecret: (name: string, value: string) => invoke<Settings>("set_secret", { name, value }),
  deleteSecret: (name: string) => invoke<Settings>("delete_secret", { name }),
  setWindowSettings: (config: WindowSettings) => invoke<Settings>("set_window_settings", { config }),
  setTrayLabels: (labels: TrayLabels) => invoke<void>("set_tray_labels", { labels }),

  listAudioDevices: () => invoke<AudioDevices>("list_audio_devices"),
  listSystemAudioDevices: (target: SystemVolumeTarget) => invoke<string[]>("list_system_audio_devices", { target }),
  analyzeAudio: (path: string, buckets = 160) => invoke<AudioInfo>("analyze_audio", { path, buckets }),
  previewSound: (request: { file: string; outputDevice: string | null; volume: number; start: number; end: number }) =>
    invoke<number>("preview_sound", { request }),
  stopSound: (id: number) => invoke<void>("stop_sound", { id }),
  stopAllSounds: () => invoke<void>("stop_all_sounds"),
  setAudioSettings: (config: AudioSettings) => invoke<Settings>("set_audio_settings", { config }),
  fileName: (path: string) => invoke<string>("file_name", { path }),
  listVoices: () => invoke<VoiceInfo[]>("list_voices"),
  previewSpeech: (request: { text: string; voice: string | null; volume: number }) => invoke<void>("preview_speech", { request }),
  stopSpeech: () => invoke<void>("stop_speech"),
  obsState: () => invoke<ObsState>("obs_state"),
  obsConnect: () => invoke<ObsState>("obs_connect"),
  obsDisconnect: () => invoke<ObsState>("obs_disconnect"),
  obsRefresh: () => invoke<ObsState>("obs_refresh"),
  obsFilters: (source: string) => invoke<string[]>("obs_filters", { source }),
  setObsSettings: (config: ObsSettings) => invoke<Settings>("set_obs_settings", { config }),
  slobsState: () => invoke<SlobsState>("slobs_state"),
  slobsConnect: () => invoke<SlobsState>("slobs_connect"),
  slobsDisconnect: () => invoke<SlobsState>("slobs_disconnect"),
  slobsRefresh: () => invoke<SlobsState>("slobs_refresh"),
  slobsFilters: (source: string) => invoke<string[]>("slobs_filters", { source }),
  setSlobsSettings: (config: SlobsSettings) => invoke<Settings>("set_slobs_settings", { config }),
  homeAssistantState: () => invoke<HaState>("home_assistant_state"),
  homeAssistantRefresh: () => invoke<HaState>("home_assistant_refresh"),
  setHomeAssistantSettings: (config: HomeAssistantSettings) => invoke<Settings>("set_home_assistant_settings", { config }),

  testHttpRequest: (request: Omit<Extract<ActionKind, { type: "httpRequest" }>, "type" | "saveTo" | "saveScope">) =>
    invoke<HttpOutcome>("test_http_request", { request }),
  testScript: (code: string, locals: Record<string, string> = {}) => invoke<ScriptOutcome>("test_script", { request: { code, locals } }),
  getVariables: () => invoke<Record<string, string>>("get_variables"),
  deleteVariables: (names: string[]) => invoke<Record<string, string>>("delete_variables", { names }),
  clearVariables: () => invoke<Record<string, string>>("clear_variables"),
  /** Drop fader values no fader publishes any more; returns how many went. */
  pruneFaderVariables: () => invoke<number>("prune_fader_variables"),
  /** Files and size of the folder HTTP actions download into. */
  downloadCacheInfo: () => invoke<DownloadCacheInfo>("download_cache_info"),
  /** Remove every downloaded file; returns how many went. */
  clearDownloadCache: () => invoke<number>("clear_download_cache"),
  /** Open the download folder in the file manager. */
  openDownloadFolder: () => invoke<void>("open_download_folder"),

  getRunningMacros: () => invoke<RunningMacro[]>("get_running_macros"),
  stopAllMacros: () => invoke<void>("stop_all_macros"),
  stopMacrosAt: (pageId: string, x: number, y: number) => invoke<void>("stop_macros_at", { pageId, x, y }),
  runButton: (pageId: string, x: number, y: number, trigger: ButtonTrigger, velocity?: number) =>
    invoke<boolean>("run_button", { pageId, x, y, trigger, velocity }),
};

export const events = {
  onDeviceState: (cb: (state: DeviceState) => void): Promise<UnlistenFn> =>
    listen<DeviceState>("device:state", (e) => cb(e.payload)),
  onButton: (cb: (event: ButtonEvent) => void): Promise<UnlistenFn> =>
    listen<ButtonEvent>("device:button", (e) => cb(e.payload)),
  onPressure: (cb: (event: PressureEvent) => void): Promise<UnlistenFn> =>
    listen<PressureEvent>("device:pressure", (e) => cb(e.payload)),
  /** Firmware learned after connecting, for a device that did not answer the scan. */
  onFirmware: (cb: (firmware: string) => void): Promise<UnlistenFn> =>
    listen<{ firmware: string }>("device:firmware", (e) => cb(e.payload.firmware)),
  onRawMidi: (cb: (event: RawMidiEvent) => void): Promise<UnlistenFn> =>
    listen<RawMidiEvent>("midi:raw", (e) => cb(e.payload)),
  onPortsChanged: (cb: () => void): Promise<UnlistenFn> => listen("midi:ports-changed", () => cb()),
  onProfile: (cb: (profile: Profile) => void): Promise<UnlistenFn> =>
    listen<Profile>("profile:changed", (e) => cb(e.payload)),
  onRunning: (cb: (running: RunningMacro[]) => void): Promise<UnlistenFn> =>
    listen<RunningMacro[]>("macro:running", (e) => cb(e.payload)),
  onSettings: (cb: (settings: Settings) => void): Promise<UnlistenFn> =>
    listen<Settings>("settings:changed", (e) => cb(e.payload)),
  onInputUnavailable: (cb: (problem: InputUnavailable) => void): Promise<UnlistenFn> =>
    listen<InputUnavailable>("input:unavailable", (e) => cb(e.payload)),
  onObsState: (cb: (state: ObsState) => void): Promise<UnlistenFn> => listen<ObsState>("obs:state", (e) => cb(e.payload)),
  onSlobsState: (cb: (state: SlobsState) => void): Promise<UnlistenFn> => listen<SlobsState>("slobs:state", (e) => cb(e.payload)),
  onHomeAssistantState: (cb: (state: HaState) => void): Promise<UnlistenFn> => listen<HaState>("homeassistant:state", (e) => cb(e.payload)),
  onHistory: (cb: (state: HistoryState) => void): Promise<UnlistenFn> => listen<HistoryState>("history:changed", (e) => cb(e.payload)),
  onVariables: (cb: (globals: Record<string, string>) => void): Promise<UnlistenFn> =>
    listen<Record<string, string>>("vars:changed", (e) => cb(e.payload)),
};

export const padKey = (x: number, y: number) => `${x},${y}`;
