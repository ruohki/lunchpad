/**
 * Key names follow the legacy app (robotjs) so imported hotkeys keep working;
 * see src-tauri/src/input/keys.rs for the Rust side of the vocabulary.
 */

export const MODIFIERS = ["control", "alt", "shift", "command"] as const;
export type Modifier = (typeof MODIFIERS)[number];

const isMac = typeof navigator !== "undefined" && navigator.platform.toLowerCase().includes("mac");

const SPECIAL: Record<string, string> = {
  " ": "space",
  Enter: "enter",
  Tab: "tab",
  Escape: "escape",
  Backspace: "backspace",
  Delete: "delete",
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  Home: "home",
  End: "end",
  PageUp: "pageup",
  PageDown: "pagedown",
  Insert: "insert",
  CapsLock: "capslock",
  AudioVolumeMute: "audio_mute",
  AudioVolumeUp: "audio_vol_up",
  AudioVolumeDown: "audio_vol_down",
  MediaPlayPause: "audio_play",
  MediaTrackNext: "audio_next",
  MediaTrackPrevious: "audio_prev",
};

/** Main key of a keyboard event, or null for a bare modifier. */
export function keyFromEvent(e: KeyboardEvent): string | null {
  if (["Control", "Alt", "Shift", "Meta", "AltGraph"].includes(e.key)) return null;
  if (e.code.startsWith("Numpad")) {
    const rest = e.code.slice(6);
    if (/^\d$/.test(rest)) return `numpad_${rest}`;
    const map: Record<string, string> = { Add: "numpad_+", Subtract: "numpad_-", Multiply: "numpad_*", Divide: "numpad_/", Decimal: "numpad_." };
    if (map[rest]) return map[rest];
  }
  if (SPECIAL[e.key]) return SPECIAL[e.key];
  if (/^F\d{1,2}$/.test(e.key)) return e.key.toLowerCase();
  if (e.key.length === 1) return e.key.toLowerCase();
  return null;
}

const MOUSE_BUTTONS: Record<number, string> = { 1: "mouse_middle", 2: "mouse_right", 3: "mouse_back", 4: "mouse_forward" };

/** A mouse button usable like a key (side buttons for push-to-talk); the left button is never captured. */
export function mouseFromEvent(e: MouseEvent): string | null {
  return MOUSE_BUTTONS[e.button] ?? null;
}

export function isMouseKey(key: string): boolean {
  return key.startsWith("mouse_");
}

export function modifiersFromEvent(e: { ctrlKey: boolean; altKey: boolean; shiftKey: boolean; metaKey: boolean }): Modifier[] {
  const mods: Modifier[] = [];
  if (e.ctrlKey) mods.push("control");
  if (e.altKey) mods.push("alt");
  if (e.shiftKey) mods.push("shift");
  if (e.metaKey) mods.push("command");
  return mods;
}

export function formatModifier(m: string): string {
  switch (m) {
    case "control":
      return isMac ? "⌃" : "Ctrl";
    case "alt":
      return isMac ? "⌥" : "Alt";
    case "shift":
      return isMac ? "⇧" : "Shift";
    case "command":
      return isMac ? "⌘" : "Win";
    default:
      return m;
  }
}

export function formatKey(key: string): string {
  if (!key) return "";
  if (key.length === 1) return key.toUpperCase();
  if (/^f\d{1,2}$/.test(key)) return key.toUpperCase();
  const names: Record<string, string> = {
    space: "Space",
    enter: "Enter",
    tab: "Tab",
    escape: "Esc",
    backspace: "Backspace",
    delete: "Delete",
    up: "↑",
    down: "↓",
    left: "←",
    right: "→",
    home: "Home",
    end: "End",
    pageup: "Page Up",
    pagedown: "Page Down",
    insert: "Insert",
    capslock: "Caps Lock",
  };
  if (names[key]) return names[key];
  if (key.startsWith("mouse_")) {
    const which: Record<string, string> = { left: "left", right: "right", middle: "middle", back: "back", forward: "forward", "4": "back", "5": "forward" };
    return `Mouse ${which[key.slice(6)] ?? key.slice(6)}`;
  }
  if (key.startsWith("numpad_")) return `Num ${key.slice(7)}`;
  if (key.startsWith("audio_")) return key.slice(6).replace("_", " ");
  return key;
}

export function formatCombo(key: string, modifiers: string[]): string {
  const parts = modifiers.map(formatModifier);
  if (key) parts.push(formatKey(key));
  return parts.join(isMac ? "" : " + ");
}
