// The action contract: what the docs site and the community hub know about
// every action, generated from this checkout so nothing is written twice.
//
//   bun tools/actions-contract.ts                JSON to stdout
//   bun tools/actions-contract.ts --out FILE     write it to a file
//   bun tools/actions-contract.ts --check        generate, report what is missing, exit 1 if anything is
//
// (`node` 22.18 or newer runs it too.) Every release attaches the result as
// `actions.json`; the docs and the hub sync from it. It reads:
//
//   src/lib/api.ts                      the action types the app ships (AVAILABLE_ACTIONS)
//   src/components/actions/ActionsTab.tsx   the "Add action" menu and its groups
//   src/components/actions/actionUtils.ts   icon names, marker sets, the Wait switch
//   src/i18n/en.json                    names and descriptions
//   src-tauri/src/macros/model.rs …     the JSON each action is, field by field, as serde reads it
//   node_modules/lucide-static/icons    the icon drawings, by the same names lucide-react uses
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

interface ActionInfo {
  name: string;
  desc: string;
  group: string;
  icon: string;
  /** false for the markers that come with a menu entry (Otherwise, End condition, …) */
  menu: boolean;
  /** the action row has a Wait switch */
  wait: boolean;
  /** the menu entry a marker belongs to */
  partOf?: string;
}
/** One field of an action's JSON, as serde reads it. */
interface FieldInfo {
  name: string;
  /** "text", "number", "true or false", or the name of an entry in `types` */
  type: string;
  /** `Option<T>`: null is allowed */
  nullable?: boolean;
  /** `Vec<T>`: a list of `type` */
  list?: boolean;
  /** has a `#[serde(default)]`, so a script may leave it out */
  optional?: boolean;
  doc?: string;
}
interface PayloadInfo {
  doc?: string;
  fields: FieldInfo[];
}
/** A type an action's field refers to: a set of strings, an object, or a tagged union. */
interface TypeInfo {
  kind: "enum" | "object" | "union";
  doc?: string;
  values?: { value: string; doc?: string; default?: boolean }[];
  fields?: FieldInfo[];
  tag?: string;
  variants?: { value: string; doc?: string; default?: boolean; fields: FieldInfo[] }[];
}

export interface ActionContract {
  /** The Lunchpad version this describes. */
  app: string;
  groups: { id: string; name: string; icon: string; types: string[] }[];
  actions: Record<string, ActionInfo>;
  /** The icon drawings, ready to drop into an `<svg>`, by their Lucide name. */
  icons: Record<string, { viewBox: string; body: string }>;
  /** The JSON each action is, for `Lunchpad.run()` in a script. */
  payloads: Record<string, PayloadInfo>;
  /** The types those payloads refer to. */
  types: Record<string, TypeInfo>;
}

const read = (path: string) => readFileSync(join(ROOT, path), "utf8");
const strings = (list: string) => [...list.matchAll(/"(\w+)"/g)].map((m) => m[1]);

// ----- the JSON an action is, read from the Rust model --------------------------
//
// `Lunchpad.run({ … })` hands the engine exactly the JSON it deserialises into
// `ActionKind`, so this is generated from that enum rather than written by hand:
// the field names as serde renames them, which fields carry a `#[serde(default)]`
// (those a script may leave out), and the doc comments as their description.

/** Types the action payloads refer to, and where they live. */
const TYPE_SOURCES: Record<string, string> = {
  "src-tauri/src/macros/model.rs":
    "CompareOp VarScope HttpMethod HttpResponse HttpHeader HttpBodyMode HttpFilePart HttpAuth ButtonRef ButtonTrigger Keystroke KeyEvent ObsTarget ObsMode VisibilityMode MuteMode VolumeUnit SystemVolumeMode SystemVolumeTarget StudioMode WindowTarget WindowOp ObsHotkeyBy ScreenPick MouseStep ScrollAxis LoopMode LoopCheck",
  "src-tauri/src/profile/model.rs": "PadColor",
  "src-tauri/src/desktop/mod.rs": "TitleMatch",
  "src-tauri/src/input/mod.rs": "MouseButton",
  "src-tauri/src/homeassistant/mod.rs": "HaPower HaValueKind",
};

const camel = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const snakeToCamel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

/** A Rust type as the contract names it: a primitive, or a type in `types`. */
function fieldType(rust: string): Pick<FieldInfo, "type" | "nullable" | "list"> {
  const option = /^Option<(.+)>$/.exec(rust);
  if (option) return { ...fieldType(option[1]), nullable: true };
  const vec = /^Vec<(.+)>$/.exec(rust);
  if (vec) return { ...fieldType(vec[1]), list: true };
  if (rust === "String") return { type: "text" };
  if (rust === "bool") return { type: "true or false" };
  if (/^(u8|u16|u32|u64|usize|i8|i16|i32|i64|f32|f64)$/.test(rust)) return { type: "number" };
  // `crate::desktop::TitleMatch` is `TitleMatch` in `types`.
  return { type: rust.replace(/^.*::/, "") };
}

/** `name: Type,` lines of a block, with their doc comments and serde defaults. */
function parseFields(block: string): FieldInfo[] {
  const fields: FieldInfo[] = [];
  let doc: string[] = [];
  let defaulted = false;
  for (const raw of block.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("///")) {
      doc.push(line.slice(3).trim());
      continue;
    }
    if (line.startsWith("#[serde(default")) {
      defaulted = true;
      continue;
    }
    if (line.startsWith("#[")) continue;
    const m = /^(?:pub )?([a-z_0-9]+):\s*(.+?),?$/.exec(line);
    if (!m) continue;
    fields.push({
      name: snakeToCamel(m[1]),
      ...fieldType(m[2].replace(/,$/, "").trim()),
      ...(defaulted ? { optional: true } : {}),
      ...(doc.length ? { doc: doc.join(" ") } : {}),
    });
    doc = [];
    defaulted = false;
  }
  return fields;
}

/** Walk an enum body, yielding each variant with its inline or block fields. */
function parseVariants(body: string): { name: string; doc?: string; default?: boolean; fields: FieldInfo[] }[] {
  const out: { name: string; doc?: string; default?: boolean; fields: FieldInfo[] }[] = [];
  const lines = body.split("\n");
  let doc: string[] = [];
  let isDefault = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("///")) {
      doc.push(line.slice(3).trim());
      continue;
    }
    if (line === "#[default]") {
      isDefault = true;
      continue;
    }
    if (line.startsWith("#[")) continue;
    const inline = /^([A-Z][A-Za-z0-9]*)\s*\{(.*)\}\s*,?$/.exec(line);
    const block = /^([A-Z][A-Za-z0-9]*)\s*\{$/.exec(line);
    const bare = /^([A-Z][A-Za-z0-9]*)\s*,$/.exec(line);
    if (!inline && !block && !bare) continue;
    const name = (inline ?? block ?? bare)![1];
    let fields: FieldInfo[] = [];
    if (inline) fields = parseFields(inline[2].split(";").join("\n").replace(/,\s*(?=[a-z_]+:)/g, ",\n"));
    if (block) {
      const collected: string[] = [];
      let depth = 1;
      while (++i < lines.length) {
        const inner = lines[i];
        depth += (inner.match(/\{/g)?.length ?? 0) - (inner.match(/\}/g)?.length ?? 0);
        if (depth === 0) break;
        collected.push(inner);
      }
      fields = parseFields(collected.join("\n"));
    }
    out.push({ name, ...(doc.length ? { doc: doc.join(" ") } : {}), ...(isDefault ? { default: true } : {}), fields });
    doc = [];
    isDefault = false;
  }
  return out;
}

/** The `ActionKind` variants, and every type their fields refer to. */
function schema(): { payloads: Record<string, PayloadInfo>; types: Record<string, TypeInfo> } {
  const model = read("src-tauri/src/macros/model.rs");
  const body = /pub enum ActionKind \{\n([\s\S]*?)\n\}\n/.exec(model)![1];
  const payloads: Record<string, PayloadInfo> = {};
  for (const variant of parseVariants(body)) {
    payloads[camel(variant.name)] = { ...(variant.doc ? { doc: variant.doc } : {}), fields: variant.fields };
  }

  const types: Record<string, TypeInfo> = {};
  for (const [file, names] of Object.entries(TYPE_SOURCES)) {
    const source = read(file);
    for (const name of names.split(" ")) {
      // The attributes above the definition say how it is tagged.
      const at = new RegExp(`((?:^\\s*(?:///|#\\[).*\\n)*)pub (enum|struct) ${name} \\{\\n([\\s\\S]*?)\\n\\}`, "m").exec(source);
      if (!at) continue;
      const [, attrs, kind, block] = at;
      const doc = [...attrs.matchAll(/^\s*\/\/\/ ?(.*)$/gm)].map((m) => m[1].trim()).join(" ");
      const tag = /#\[serde\([^)]*tag = "(\w+)"/.exec(attrs)?.[1];
      if (kind === "struct") {
        types[name] = { kind: "object", ...(doc ? { doc } : {}), fields: parseFields(block) };
        continue;
      }
      const variants = parseVariants(block);
      if (tag) {
        types[name] = {
          kind: "union",
          ...(doc ? { doc } : {}),
          tag,
          variants: variants.map((v) => ({ value: camel(v.name), ...(v.doc ? { doc: v.doc } : {}), ...(v.default ? { default: true } : {}), fields: v.fields })),
        };
      } else {
        types[name] = {
          kind: "enum",
          ...(doc ? { doc } : {}),
          values: variants.map((v) => ({ value: camel(v.name), ...(v.doc ? { doc: v.doc } : {}), ...(v.default ? { default: true } : {}) })),
        };
      }
    }
  }
  return { payloads, types };
}

// ----- the icons ---------------------------------------------------------------

/** Lucide's SVGs; the app draws the same set with lucide-react, by the same names. */
const LUCIDE = join(ROOT, "node_modules/lucide-static/icons");

/** `MousePointerClick` → `mouse-pointer-click`, `Volume2` → `volume-2`: how Lucide names its files. */
const kebab = (name: string) =>
  name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([a-zA-Z])(\d)/g, "$1-$2")
    .toLowerCase();

/**
 * One icon, ready to drop into an `<svg>`. Lucide draws with strokes and keeps
 * the attributes on its own `<svg>` tag; a consumer that renders only the body
 * into a bare one would draw nothing, so they travel with the body.
 */
function lucideIcon(name: string): { viewBox: string; body: string } {
  const file = join(LUCIDE, `${kebab(name)}.svg`);
  if (!existsSync(file)) {
    throw new Error(`No Lucide icon "${kebab(name)}.svg" for "${name}". actionUtils.ts names icons after lucide-react components; check the spelling, or run "bun install".`);
  }
  const svg = readFileSync(file, "utf8");
  const tag = /<svg[^>]*>/.exec(svg)![0];
  const viewBox = /viewBox="([^"]+)"/.exec(tag)?.[1] ?? "0 0 24 24";
  const body = svg.slice(svg.indexOf(tag) + tag.length).replace("</svg>", "").trim().replace(/\s+/g, " ");
  return { viewBox, body: `<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</g>` };
}

// ----- the contract ------------------------------------------------------------

export function contract(): ActionContract {
  const api = read("src/lib/api.ts");
  const available = strings(/AVAILABLE_ACTIONS[^[]*\[([\s\S]*?)\]\s*\)/.exec(api)![1]);

  const tab = read("src/components/actions/ActionsTab.tsx");
  const menuBlock = /MENU_GROUPS[^=]*=\s*\[([\s\S]*?)\n\];/.exec(tab)![1];
  const menu = [...menuBlock.matchAll(/group:\s*"(\w+)",\s*types:\s*\[([^\]]*)\]/g)].map((m) => ({ id: m[1], types: strings(m[2]) }));

  const utils = read("src/components/actions/actionUtils.ts");
  const iconOf = Object.fromEntries([.../ACTION_ICONS[^{]*\{([\s\S]*?)\n\};/.exec(utils)![1].matchAll(/(\w+):\s*"(\w+)"/g)].map((m) => [m[1], m[2]]));
  const groupIcon = Object.fromEntries([.../GROUP_ICONS[^{]*\{([\s\S]*?)\n\};/.exec(utils)![1].matchAll(/(\w+):\s*"(\w+)"/g)].map((m) => [m[1], m[2]]));

  // createActions: `case "a": case "b": case "c": {` builds a set of markers; the one in the menu owns the rest.
  const create = /export function createActions[\s\S]*?\n}\n/.exec(utils)![0];
  const owner: Record<string, string> = {};
  const menuTypes = new Set(menu.flatMap((g) => g.types));
  let run: string[] = [];
  for (const line of create.split("\n")) {
    const c = /^\s*case "(\w+)":\s*(\{)?\s*$/.exec(line);
    if (c) run.push(c[1]);
    if (!c || c[2]) {
      if (run.length > 1) {
        const head = run.find((t) => menuTypes.has(t));
        if (head) run.filter((t) => t !== head).forEach((t) => (owner[t] = head));
      }
      if (!c || c[2]) run = [];
    }
  }

  const waits = new Set(strings(/export function hasWait[\s\S]*?\[([^\]]*)\]/.exec(utils)![1]));

  const en = JSON.parse(read("src/i18n/en.json"));
  const groupOf: Record<string, string> = {};
  menu.forEach((g) => g.types.forEach((t) => (groupOf[t] = g.id)));

  const actions: Record<string, ActionInfo> = {};
  for (const type of available) {
    const partOf = owner[type];
    actions[type] = {
      name: en.actions.types[type]?.name ?? type,
      desc: en.actions.types[type]?.desc ?? "",
      group: groupOf[type] ?? groupOf[partOf] ?? "general",
      icon: iconOf[type] ?? "Circle",
      menu: menuTypes.has(type),
      wait: waits.has(type),
      ...(partOf ? { partOf } : {}),
    };
  }

  const icons: ActionContract["icons"] = {};
  const wanted = new Set([...Object.values(actions).map((a) => a.icon), ...Object.values(groupIcon)]);
  for (const name of [...wanted].sort()) icons[name] = lucideIcon(name);

  const { payloads, types } = schema();
  const app = JSON.parse(read("package.json")).version as string;

  return {
    app,
    groups: menu.map((g) => ({ id: g.id, name: en.actions.groups[g.id] ?? g.id, icon: groupIcon[g.id] ?? "Circle", types: g.types })),
    actions,
    icons,
    payloads,
    types,
  };
}

/** What the contract lacks: an action without a name, a description, or a JSON payload. */
export function problems(data: ActionContract): string[] {
  const out: string[] = [];
  for (const [type, info] of Object.entries(data.actions)) {
    if (info.name === type) out.push(`${type}: no name in src/i18n/en.json (actions.types.${type}.name)`);
    if (!info.desc) out.push(`${type}: no description in src/i18n/en.json (actions.types.${type}.desc)`);
    if (!data.payloads[type]) out.push(`${type}: no ActionKind variant in src-tauri/src/macros/model.rs`);
    if (info.icon === "Circle") out.push(`${type}: no icon in ACTION_ICONS (actionUtils.ts)`);
  }
  for (const [type, payload] of Object.entries(data.payloads)) {
    if (!data.actions[type]) out.push(`${type}: in ActionKind but not in AVAILABLE_ACTIONS (api.ts)`);
    for (const f of payload.fields) {
      const primitive = ["text", "number", "true or false"].includes(f.type);
      if (!primitive && !data.types[f.type]) out.push(`${type}.${f.name}: type ${f.type} is not described (add it to TYPE_SOURCES in tools/actions-contract.ts)`);
    }
  }
  return out;
}

if (import.meta.main ?? process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const data = contract();
  const found = problems(data);
  const out = args.indexOf("--out");
  if (args.includes("--check")) {
    if (found.length) {
      console.error(`The action contract is incomplete:\n  - ${found.join("\n  - ")}`);
      process.exit(1);
    }
    console.log(`${Object.keys(data.actions).length} actions, ${Object.keys(data.payloads).length} payloads, ${Object.keys(data.types).length} types, ${Object.keys(data.icons).length} icons: complete for Lunchpad ${data.app}`);
  } else if (out >= 0) {
    writeFileSync(args[out + 1], JSON.stringify(data, null, 2) + "\n");
    console.error(`wrote the action contract for Lunchpad ${data.app} to ${args[out + 1]}`);
  } else {
    process.stdout.write(JSON.stringify(data, null, 2) + "\n");
  }
  if (found.length && out >= 0) console.error(`incomplete:\n  - ${found.join("\n  - ")}`);
}
