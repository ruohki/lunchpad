import { BUILTIN_VARIABLES, type ConnectedDevice, type ObsState, type SlobsState } from "./api";

/** `{{name}}`, the thing the engine replaces. */
export const PLACEHOLDER = /\{\{[^{}\s]*\}\}/g;

const BUILTINS = new Set<string>(BUILTIN_VARIABLES);
/** Provided names that mean something outside a run, for descriptions: everything but the press. */
export const DESCRIPTION_VARIABLES: readonly string[] = BUILTIN_VARIABLES.filter((n) => !["velocity", "velocity01", "pressure", "pressure01", "x", "y", "trigger", "heldMs"].includes(n));
/** The provided names that change with the clock. */
export const CLOCK_VARIABLES = ["date", "time", "datetime", "timestamp", "weekday", "year", "month", "day", "hour", "minute", "second"] as const;
const CLOCK = new RegExp(`\\{\\{(?:${CLOCK_VARIABLES.join("|")})\\}\\}`);
/** Alternation of every provided name, for grammars that colour `{{name}}`. */
export const BUILTIN_ALTERNATION = BUILTIN_VARIABLES.map((n) => n.replace(/\./g, "\\.")).join("|");
/** The provided names a script can reach as `vars.<name>` (the dotted ones need `vars["obs.scene"]`). */
export const BUILTIN_IDENTIFIERS = BUILTIN_VARIABLES.filter((n) => !n.includes(".")).join("|");

/** Provided by Lunchpad: readable everywhere, never written by an action. */
export function isBuiltinVariable(name: string): boolean {
  return BUILTINS.has(name);
}

/** Whether the text shows a value that moves with the clock. */
export function usesClock(text: string): boolean {
  return CLOCK.test(text);
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** What surrounds the interface: the streaming apps, the device and the static info from the backend. */
export interface BuiltinEnv {
  obs?: ObsState | null;
  slobs?: SlobsState | null;
  device?: ConnectedDevice | null;
  info?: Record<string, string>;
}

const flag = (b: boolean | undefined) => (b ? "true" : "false");

/**
 * The provided values the interface can compute itself, in the engine's
 * formats: the clock, the page and caption when known, and the
 * surroundings. Press values (velocity, pressure, x, y, trigger, heldMs)
 * exist only while a macro runs.
 */
export function builtinValues(now: Date, page?: { id: string; name: string } | null, caption?: string, env?: BuiltinEnv): Record<string, string> {
  const two = (n: number) => String(n).padStart(2, "0");
  const date = `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`;
  const time = `${two(now.getHours())}:${two(now.getMinutes())}`;
  return {
    ...(page ? { pageId: page.id, pageName: page.name } : {}),
    ...(caption !== undefined ? { caption } : {}),
    random: Math.random().toFixed(6),
    "obs.scene": env?.obs?.currentScene ?? "",
    "obs.streaming": flag(env?.obs?.streaming),
    "obs.recording": flag(env?.obs?.recording),
    "obs.connected": flag(env?.obs?.connected),
    "slobs.scene": env?.slobs?.currentScene ?? "",
    "slobs.streaming": flag(env?.slobs?.streaming === "live"),
    "slobs.recording": flag(env?.slobs?.recording === "recording"),
    "slobs.connected": flag(env?.slobs?.connected),
    model: env?.device?.modelName ?? "",
    port: env?.device?.inputName ?? "",
    firmware: env?.device?.firmware ?? "",
    virtual: flag(env?.device?.virtual),
    ...(env?.info ?? {}),
    date,
    time,
    datetime: `${date} ${time}:${two(now.getSeconds())}`,
    timestamp: String(Math.floor(now.getTime() / 1000)),
    weekday: WEEKDAYS[now.getDay()],
    year: String(now.getFullYear()),
    month: two(now.getMonth() + 1),
    day: two(now.getDate()),
    hour: two(now.getHours()),
    minute: two(now.getMinutes()),
    second: two(now.getSeconds()),
  };
}

/**
 * Replace every `{{name}}` whose variable exists. Unknown names stay as
 * written, the way the engine leaves them.
 */
export function expandPlaceholders(text: string, vars: Record<string, string>): string {
  return text.replace(PLACEHOLDER, (m) => {
    const name = m.slice(2, -2);
    return Object.prototype.hasOwnProperty.call(vars, name) ? vars[name] : m;
  });
}
