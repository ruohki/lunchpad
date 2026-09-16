/** `{{name}}`, the thing the engine replaces. */
export const PLACEHOLDER = /\{\{[^{}\s]*\}\}/g;

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
