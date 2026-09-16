import { BUILTIN_VARIABLES } from "./api";

/** `{{name}}`, the thing the engine replaces. */
export const PLACEHOLDER = /\{\{[^{}\s]*\}\}/g;

const BUILTINS = new Set<string>(BUILTIN_VARIABLES);
/** The provided names that change with the clock. */
export const CLOCK_VARIABLES = ["date", "time", "datetime", "timestamp", "weekday", "year", "month", "day", "hour", "minute", "second"] as const;
const CLOCK = new RegExp(`\\{\\{(?:${CLOCK_VARIABLES.join("|")})\\}\\}`);
/** Alternation of every provided name, for grammars that colour them. */
export const BUILTIN_ALTERNATION = BUILTIN_VARIABLES.join("|");

/** Provided by Lunchpad: readable everywhere, never written by an action. */
export function isBuiltinVariable(name: string): boolean {
  return BUILTINS.has(name);
}

/** Whether the text shows a value that moves with the clock. */
export function usesClock(text: string): boolean {
  return CLOCK.test(text);
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * The provided values the interface can compute itself, in the engine's
 * formats: the clock, and the page and caption when known. Press values
 * (velocity, pressure, x, y) exist only while a macro runs.
 */
export function builtinValues(now: Date, page?: { id: string; name: string } | null, caption?: string): Record<string, string> {
  const two = (n: number) => String(n).padStart(2, "0");
  const date = `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`;
  const time = `${two(now.getHours())}:${two(now.getMinutes())}`;
  return {
    ...(page ? { pageId: page.id, pageName: page.name } : {}),
    ...(caption !== undefined ? { caption } : {}),
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
