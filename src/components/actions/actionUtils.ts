import type { TFunction } from "i18next";
import { BUILTIN_VARIABLES, newActionId, type Action, type ActionKind, type ActionType, type Layout, type MouseStep, type Page, type TitleMatch, type WindowTarget } from "../../lib/api";
import type { IconName } from "../../icons/Icon";

/** Icon per action type; the legacy app's choices where it had the action. */
export const ACTION_ICONS: Record<ActionType, IconName> = {
  delay: "Timer",
  switchPage: "File",
  setColor: "Palette",
  runButton: "MousePointerClick",
  setFader: "SlidersHorizontal",
  stopAllMacros: "CircleStop",
  stopThisMacro: "CircleStop",
  restartThisMacro: "RotateCcw",
  pushToTalkStart: "Mic",
  pushToTalkEnd: "MicOff",
  flipFlopStart: "ArrowLeftRight",
  flipFlopMiddle: "ArrowLeftRight",
  flipFlopEnd: "ArrowLeftRight",
  ifStart: "Split",
  ifElse: "Split",
  ifEnd: "Split",
  loopStart: "RefreshCw",
  loopTimeout: "Timer",
  loopEnd: "RefreshCw",
  playSound: "Volume2",
  textToSpeech: "Speech",
  setSystemVolume: "Volume2",
  stopAllSounds: "CircleStop",
  setAudioDevice: "Volume2",
  addToVariable: "Variable",
  launchApplication: "SquareTerminal",
  getWindow: "AppWindow",
  setWindow: "Maximize2",
  mouse: "MousePointerClick",
  mousePosition: "Crosshair",
  getScreen: "Monitor",
  debug: "Bug",
  hotkey: "Keyboard",
  httpRequest: "Globe",
  setVariable: "Variable",
  runScript: "Code",
  obsSwitchScene: "Video",
  obsToggleSource: "Video",
  obsSetAudio: "Video",
  obsToggleFilter: "Video",
  obsStream: "Video",
  obsSaveReplay: "Video",
  obsStudioMode: "Video",
  obsTriggerHotkey: "Video",
  slobsSwitchScene: "Radio",
  slobsToggleSource: "Radio",
  slobsSetAudio: "Radio",
  slobsToggleFilter: "Radio",
  slobsStream: "Radio",
  slobsSaveReplay: "Radio",
  slobsStudioMode: "Radio",
  homeAssistantTurn: "House",
  homeAssistantSetValue: "House",
  homeAssistantCallService: "House",
};

export const GROUP_ICONS: Record<string, IconName> = {
  media: "Volume2",
  system: "SquareTerminal",
  input: "Keyboard",
  window: "AppWindow",
  general: "LayoutGrid",
  flow: "Workflow",
  stop: "CircleStop",
  obs: "Video",
  slobs: "Radio",
  homeAssistant: "House",
};

/** Ids of the markers that belong together with `action` (flip flop, push-to-talk). */
export function siblingIds(action: Action): string[] {
  switch (action.type) {
    case "flipFlopStart":
      return [action.middleId, action.endId];
    case "flipFlopMiddle":
      return [action.startId, action.endId];
    case "flipFlopEnd":
      return [action.startId, action.middleId];
    case "pushToTalkStart":
      return [action.endId];
    case "pushToTalkEnd":
      return [action.startId];
    case "ifStart":
      return [action.elseId, action.endId];
    case "ifElse":
      return [action.startId, action.endId];
    case "ifEnd":
      return [action.startId, action.elseId];
    case "loopStart":
      return [action.timeoutId, action.endId];
    case "loopTimeout":
      return [action.startId, action.endId];
    case "loopEnd":
      return [action.startId, action.timeoutId];
    default:
      return [];
  }
}

export function isMarker(action: Action): boolean {
  return siblingIds(action).length > 0;
}

export function canMove(list: Action[], index: number, delta: -1 | 1): boolean {
  const target = index + delta;
  if (target < 0 || target >= list.length) return false;
  const a = list[index];
  const b = list[target];
  // Markers keep their order relative to their siblings.
  return !siblingIds(a).includes(b.id) && !siblingIds(b).includes(a.id);
}

export function moveAction(list: Action[], index: number, delta: -1 | 1): Action[] {
  if (!canMove(list, index, delta)) return list;
  const next = [...list];
  const [item] = next.splice(index, 1);
  next.splice(index + delta, 0, item);
  return next;
}

/** True when every flip-flop / push-to-talk set keeps its start → middle → end order. */
export function markersOrdered(list: Action[]): boolean {
  const pos = new Map(list.map((a, i) => [a.id, i]));
  return list.every((a) => {
    const at = (id: string) => pos.get(id) ?? -1;
    switch (a.type) {
      case "flipFlopStart":
        return at(a.id) < at(a.middleId) && at(a.middleId) < at(a.endId);
      case "pushToTalkStart":
        return at(a.id) < at(a.endId);
      case "ifStart":
        return at(a.id) < at(a.elseId) && at(a.elseId) < at(a.endId);
      case "loopStart":
        return at(a.id) < at(a.timeoutId) && at(a.timeoutId) < at(a.endId);
      default:
        return true;
    }
  });
}

/**
 * The actions that travel together when one is copied: a plain action alone, a
 * marker with its whole block (start to end, including everything between and
 * any set that overlaps the block).
 */
export function blockOf(list: Action[], action: Action): Action[] {
  const index = list.findIndex((a) => a.id === action.id);
  if (index < 0) return [action];
  if (!isMarker(action)) return [action];
  let from = index;
  let to = index;
  // Widen until every marker inside the range has its siblings inside too.
  for (;;) {
    let changed = false;
    for (let i = from; i <= to; i++) {
      for (const id of siblingIds(list[i])) {
        const at = list.findIndex((a) => a.id === id);
        if (at < 0) continue;
        if (at < from) {
          from = at;
          changed = true;
        }
        if (at > to) {
          to = at;
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
  return list.slice(from, to + 1);
}

/** Copies with fresh ids; marker references are remapped so a copied set links to itself. */
export function cloneActions(actions: Action[]): Action[] {
  const ids = new Map(actions.map((a) => [a.id, newActionId()]));
  const remap = (id: string) => ids.get(id) ?? id;
  return actions.map((a) => {
    const copy = structuredClone(a) as Action & Partial<Record<"startId" | "middleId" | "endId" | "elseId" | "timeoutId", string>>;
    copy.id = remap(a.id);
    for (const key of ["startId", "middleId", "endId", "elseId", "timeoutId"] as const) {
      if (typeof copy[key] === "string") copy[key] = remap(copy[key]);
    }
    return copy as Action;
  });
}

export function removeAction(list: Action[], id: string): Action[] {
  const target = list.find((a) => a.id === id);
  if (!target) return list;
  const gone = new Set([id, ...siblingIds(target)]);
  return list.filter((a) => !gone.has(a.id));
}

/** Build the action(s) to append for a menu choice. Markers come as a set. */
export function createActions(type: ActionType): Action[] {
  const make = (kind: ActionKind, id = newActionId()): Action => ({ id, wait: true, ...kind });
  switch (type) {
    case "delay":
      return [make({ type: "delay", ms: 500, msFrom: null })];
    case "switchPage":
      return [make({ type: "switchPage", pageId: "default" })];
    case "setColor":
      return [make({ type: "setColor", color: { mode: "palette", index: 5 }, target: null })];
    case "runButton":
      return [make({ type: "runButton", target: { pageId: null, x: 0, y: 0 }, trigger: "press" })];
    case "setFader":
      return [make({ type: "setFader", fader: "", value: "", runActions: true })];
    case "stopAllMacros":
      return [make({ type: "stopAllMacros" })];
    case "stopThisMacro":
      return [make({ type: "stopThisMacro" })];
    case "restartThisMacro":
      return [make({ type: "restartThisMacro" })];
    case "flipFlopStart":
    case "flipFlopMiddle":
    case "flipFlopEnd": {
      const [s, m, e] = [newActionId(), newActionId(), newActionId()];
      return [
        make({ type: "flipFlopStart", middleId: m, endId: e, isA: true }, s),
        make({ type: "flipFlopMiddle", startId: s, endId: e }, m),
        make({ type: "flipFlopEnd", startId: s, middleId: m }, e),
      ];
    }
    case "pushToTalkStart":
    case "pushToTalkEnd": {
      const [s, e] = [newActionId(), newActionId()];
      return [make({ type: "pushToTalkStart", endId: e }, s), make({ type: "pushToTalkEnd", startId: s }, e)];
    }
    case "playSound":
      return [make({ type: "playSound", file: "", volume: 1, start: 0, end: 1, outputDevice: null, volumeFromVelocity: false })];
    case "textToSpeech":
      return [make({ type: "textToSpeech", text: "", voice: null, volume: 1 })];
    case "setSystemVolume":
      return [make({ type: "setSystemVolume", target: "output", mode: "set", volume: 50, volumeFrom: null, device: null })];
    case "stopAllSounds":
      return [make({ type: "stopAllSounds" })];
    case "setAudioDevice":
      return [make({ type: "setAudioDevice", target: "output", device: "" })];
    case "addToVariable":
      return [make({ type: "addToVariable", name: "", amount: "1", scope: "global" })];
    case "launchApplication":
      return [make({ type: "launchApplication", executable: "", arguments: "", hidden: false, killOnStop: true, saveOutputTo: null, saveScope: "local" })];
    case "httpRequest":
      return [
        make({
          type: "httpRequest",
          method: "get",
          url: "",
          headers: [],
          contentType: "application/json",
          body: "",
          bodyMode: "text",
          bodyFile: null,
          files: [],
          auth: { type: "none" },
          timeoutMs: 10000,
          ignoreTlsErrors: false,
          saveTo: null,
          saveScope: "local",
          response: "text",
          responseField: "",
          fileName: "",
          reuse: false,
        }),
      ];
    case "setVariable":
      return [make({ type: "setVariable", name: "", value: "", scope: "local" })];
    case "getWindow":
      return [make({ type: "getWindow", target: "foreground", title: "", matching: "contains", app: "", saveTo: "window", saveScope: "local" })];
    case "setWindow":
      return [make({ type: "setWindow", target: "title", title: "", matching: "contains", app: "", op: "focus", x: "", y: "", width: "", height: "", screen: "" })];
    case "mouse":
      return [make({ type: "mouse", steps: [{ type: "click", button: "left", clicks: 1 }] })];
    case "mousePosition":
      return [make({ type: "mousePosition", saveTo: "mouse", saveScope: "local" })];
    case "getScreen":
      return [make({ type: "getScreen", pick: "primary", number: "", saveTo: "screen", saveScope: "local" })];
    case "debug":
      return [make({ type: "debug", title: "Debug", text: "", alwaysOnTop: true })];
    case "ifStart":
    case "ifElse":
    case "ifEnd": {
      const [s, e, n] = [newActionId(), newActionId(), newActionId()];
      return [
        make({ type: "ifStart", variable: "", op: "equals", value: "", elseId: e, endId: n }, s),
        make({ type: "ifElse", startId: s, endId: n }, e),
        make({ type: "ifEnd", startId: s, elseId: e }, n),
      ];
    }
    case "loopStart":
    case "loopTimeout":
    case "loopEnd": {
      const [s, o, n] = [newActionId(), newActionId(), newActionId()];
      return [
        make({ type: "loopStart", mode: "until", variable: "", op: "equals", value: "", check: "head", from: "1", to: "10", step: "1", intervalMs: 100, timeoutMs: 10000, timeoutId: o, endId: n }, s),
        make({ type: "loopTimeout", startId: s, endId: n }, o),
        make({ type: "loopEnd", startId: s, timeoutId: o }, n),
      ];
    }
    case "runScript":
      return [make({ type: "runScript", code: "", saveTo: null, saveScope: "local" })];
    case "hotkey":
      return [make({ type: "hotkey", keystrokes: [{ type: "key", event: "tap", key: "", modifiers: [] }], restoreAllAtEnd: true })];
    case "obsSwitchScene":
      return [make({ type: "obsSwitchScene", scene: "", collection: "" })];
    case "obsToggleSource":
      return [make({ type: "obsToggleSource", scene: "", collection: "", source: "", visible: true, mode: "show" })];
    case "obsSetAudio":
      return [make({ type: "obsSetAudio", scene: "", collection: "", source: "", muted: false, muteMode: "keep", volumeDb: 0, volumeFrom: null, volumeUnit: "db", setVolume: true })];
    case "obsToggleFilter":
      return [make({ type: "obsToggleFilter", source: "", filter: "", enabled: true })];
    case "obsStream":
      return [make({ type: "obsStream", target: "stream", mode: "toggle" })];
    case "obsSaveReplay":
      return [make({ type: "obsSaveReplay" })];
    case "obsStudioMode":
      return [make({ type: "obsStudioMode", mode: "transition" })];
    case "obsTriggerHotkey":
      return [make({ type: "obsTriggerHotkey", by: "name", name: "", context: "", key: "", shift: false, control: false, alt: false, command: false })];
    case "slobsSwitchScene":
      return [make({ type: "slobsSwitchScene", scene: "", collection: "" })];
    case "slobsToggleSource":
      return [make({ type: "slobsToggleSource", scene: "", collection: "", source: "", visible: true, mode: "show" })];
    case "slobsSetAudio":
      return [make({ type: "slobsSetAudio", scene: "", collection: "", source: "", muted: false, muteMode: "keep", volumeDb: 0, volumeFrom: null, volumeUnit: "db", setVolume: true })];
    case "slobsToggleFilter":
      return [make({ type: "slobsToggleFilter", source: "", filter: "", enabled: true })];
    case "slobsStream":
      return [make({ type: "slobsStream", target: "stream", mode: "toggle" })];
    case "slobsSaveReplay":
      return [make({ type: "slobsSaveReplay" })];
    case "slobsStudioMode":
      return [make({ type: "slobsStudioMode", mode: "transition" })];
    case "homeAssistantTurn":
      return [make({ type: "homeAssistantTurn", entity: "", mode: "toggle" })];
    case "homeAssistantSetValue":
      return [make({ type: "homeAssistantSetValue", entity: "", kind: "brightness", value: 50, valueFrom: null })];
    case "homeAssistantCallService":
      return [make({ type: "homeAssistantCallService", domain: "", service: "", entity: "", data: "" })];
    default:
      return [];
  }
}

/** Actions whose `wait` flag is meaningful (they take time). */
export function hasWait(type: ActionType): boolean {
  return ["runButton", "playSound", "textToSpeech", "launchApplication", "hotkey", "mouse", "httpRequest", "runScript"].includes(type);
}

/** Variable names visible to completion: built-ins, live globals, and names this button writes. */
export function knownVariables(button: { down: Action[]; up: Action[]; hold?: Action[] }, globals: Record<string, string>): string[] {
  const names = new Set<string>(BUILTIN_VARIABLES);
  Object.keys(globals).forEach((g) => names.add(g));
  for (const a of [...button.down, ...button.up, ...(button.hold ?? [])]) {
    if (a.type === "setVariable" && a.name) names.add(a.name);
    if (a.type === "addToVariable" && a.name) names.add(a.name);
    if (a.type === "httpRequest" && a.saveTo) {
      names.add(a.saveTo);
      names.add(`${a.saveTo}.status`);
      names.add(`${a.saveTo}.file`);
      names.add(`${a.saveTo}.cached`);
    }
    if (a.type === "runScript" && a.saveTo) names.add(a.saveTo);
    if (a.type === "getWindow" && a.saveTo) for (const field of ["", ".handle", ".title", ".app", ".x", ".y", ".width", ".height", ".screen", ".minimized"]) names.add(a.saveTo + field);
    if (a.type === "mousePosition" && a.saveTo) for (const field of ["", ".x", ".y"]) names.add(a.saveTo + field);
    if (a.type === "getScreen" && a.saveTo) for (const field of ["", ".number", ".x", ".y", ".width", ".height", ".scale", ".dpi", ".primary", ".count"]) names.add(a.saveTo + field);
    if (a.type === "launchApplication" && a.saveOutputTo) names.add(a.saveOutputTo);
  }
  return [...names].sort();
}

export function describeTarget(
  t: TFunction,
  target: { pageId: string | null; x: number; y: number } | null,
  pages: Page[],
): string {
  if (!target) return t("actions.summary.thisButton");
  const button = t("actions.summary.button", { column: target.x + 1, row: target.y + 1 });
  if (!target.pageId) return button;
  const page = pages.find((p) => p.id === target.pageId);
  return t("actions.summary.onPage", { button, page: page?.name ?? t("actions.summary.unknownPage") });
}

/** One mouse step in a few words, for the collapsed row. */
function summarizeMouseStep(step: MouseStep, t: TFunction): string {
  switch (step.type) {
    case "move":
      return t(step.relative ? "mouse.summary.moveBy" : "mouse.summary.moveTo", { x: step.x, y: step.y });
    case "click":
      return t("mouse.summary.click", { count: step.clicks, button: t(`mouse.buttons.${step.button}`) });
    case "press":
      return t("mouse.summary.press", { button: t(`mouse.buttons.${step.button}`) });
    case "release":
      return t("mouse.summary.release", { button: t(`mouse.buttons.${step.button}`) });
    case "scroll":
      return t("mouse.summary.scroll", { amount: step.amount, axis: t(`mouse.axes.${step.axis}`) });
    case "drag":
      return t("mouse.summary.drag", { x: step.x, y: step.y });
    case "delay":
      return t("mouse.summary.delay", { ms: step.ms });
  }
}

/**
 * What a window action looks for, for its row: the title with its match rule, the
 * program when the title is empty (the engine matches a program by "contains" on its
 * own), both when both are set, or any window. A handle or a placeholder stands as is.
 */
function windowWhat(t: TFunction, action: { target: WindowTarget; title: string; matching: TitleMatch; app: string }): string {
  if (action.target === "foreground") return t("window.foregroundShort");
  const title = action.title.trim();
  const app = action.app.trim();
  const literal = title.startsWith("window:") || title.startsWith("{{");
  const titled = !title ? "" : literal ? `“${title}”` : action.matching === "regex" ? t("window.summaryPattern", { pattern: title }) : `${t(`window.match.${action.matching}`)} “${title}”`;
  if (titled && app) return t("window.summaryTitleOf", { title: titled, app });
  if (titled) return titled;
  if (app) return t("window.summaryApp", { app });
  return t("window.summaryAny");
}

export function summarize(t: TFunction, action: Action, pages: Page[]): string {
  switch (action.type) {
    case "delay":
      return action.msFrom?.trim() ? t("actions.summary.delayFrom", { name: action.msFrom.trim() }) : t("actions.summary.delay", { ms: action.ms });
    case "switchPage":
      return t("actions.summary.switchPage", { page: pages.find((p) => p.id === action.pageId)?.name ?? t("actions.summary.unknownPage") });
    case "setColor":
      return describeTarget(t, action.target, pages);
    case "runButton":
      return `${describeTarget(t, action.target, pages)} · ${t(`actions.fields.trigger${cap(action.trigger)}`)}`;
    case "setFader":
      return `${action.fader} = ${action.value}${action.runActions ? "" : ` · ${t("fader.silent")}`}`;
    case "playSound":
      return action.file.split(/[\\/]/).pop() ?? "";
    case "textToSpeech":
      return action.text;
    case "setSystemVolume": {
      const device = action.device || t(`volume.targets.${action.target}`);
      if (action.mode === "set") return `${device} · ${action.volumeFrom ? `{{${action.volumeFrom}}}` : `${Math.round(action.volume)} %`}`;
      if (action.mode === "adjust") return `${device} · ${action.volumeFrom ? `±{{${action.volumeFrom}}}` : `${action.volume >= 0 ? "+" : ""}${Math.round(action.volume)} %`}`;
      return `${device} · ${t(`volume.modes.${action.mode}`)}`;
    }
    case "homeAssistantTurn":
      return `${action.entity || "…"} · ${t(`ha.modes.${action.mode}`)}`;
    case "homeAssistantSetValue": {
      const kind = t(`ha.kinds.${action.kind}`);
      const value = action.valueFrom ? `{{${action.valueFrom}}}` : `${action.value}${action.kind === "number" || action.kind === "temperature" ? "" : action.kind === "colorTemperature" ? " K" : " %"}`;
      return `${action.entity || "…"} · ${kind} ${value}`;
    }
    case "homeAssistantCallService":
      return `${action.domain || "…"}.${action.service || "…"}${action.entity ? ` · ${action.entity}` : ""}`;
    case "launchApplication":
      return action.executable;
    case "hotkey":
      return action.keystrokes
        .map((k) => (k.type === "key" ? [...k.modifiers, k.key].filter(Boolean).join("+") : k.type === "delay" ? `${k.ms} ms` : `“${k.text}”`))
        .join(", ");
    case "obsSwitchScene":
    case "slobsSwitchScene":
      return action.scene;
    case "obsToggleSource":
    case "slobsToggleSource":
      return `${action.source} · ${t(`obs.visibilityModes.${action.mode ?? (action.visible ? "show" : "hide")}`)}`;
    case "obsSetAudio":
    case "slobsSetAudio": {
      const mute = action.muteMode ?? (action.muted ? "mute" : "unmute");
      const parts = [action.source];
      if (mute !== "keep") parts.push(t(`obs.muteModes.${mute}`));
      if (action.setVolume) parts.push(action.volumeFrom ? `{{${action.volumeFrom}}}` : `${Math.round(action.volumeDb)}${action.volumeUnit === "percent" ? " %" : " dB"}`);
      return parts.join(" · ");
    }
    case "setAudioDevice":
      return `${t(`volume.targets.${action.target}`)} → ${action.device}`;
    case "addToVariable":
      return `${action.name} ${action.amount.trim().startsWith("-") ? "−" : "+"} ${action.amount.trim().replace(/^-/, "")}`;
    case "obsToggleFilter":
    case "slobsToggleFilter":
      return `${action.source} / ${action.filter}`;
    case "obsStream":
    case "slobsStream":
      return `${t(`obs.targets.${action.target}`)} · ${t(`obs.modes.${action.mode}`)}`;
    case "obsStudioMode":
    case "slobsStudioMode":
      return t(`obs.studio.${action.mode}`);
    case "httpRequest":
      return `${action.method.toUpperCase()} ${action.url}${action.saveTo ? ` → ${action.saveTo}` : ""}`;
    case "setVariable":
      return `${action.name} = ${action.value}`;
    case "getWindow":
      return t("actions.summary.getWindow", { what: windowWhat(t, action), name: action.saveTo });
    case "setWindow":
      return t("actions.summary.setWindow", { op: t(`window.ops.${action.op}`), what: windowWhat(t, action) });
    case "mouse":
      return action.steps.map((step) => summarizeMouseStep(step, t)).join(", ");
    case "mousePosition":
      return t("actions.summary.mousePosition", { name: action.saveTo });
    case "obsTriggerHotkey":
      return action.by === "name" ? [action.name, action.context].filter(Boolean).join(" · ") : [action.control && "Ctrl", action.alt && "Alt", action.shift && "Shift", action.command && "Cmd", action.key].filter(Boolean).join("+");
    case "getScreen":
      return t("actions.summary.getScreen", { what: action.pick === "number" ? t("screen.numbered", { number: action.number || "?" }) : t(`screen.picks.${action.pick}`), name: action.saveTo });
    case "debug":
      return action.text.split("\n")[0];
    case "ifStart":
      return action.variable ? `${action.variable} ${t(`branch.opsShort.${action.op}`)} ${["isEmpty", "isNotEmpty"].includes(action.op) ? "" : action.value}`.trim() : "";
    case "loopStart": {
      const what =
        action.mode === "count"
          ? t("actions.summary.loopCount", { from: action.from, to: action.to }) + (action.step.trim() === "1" ? "" : ` ${t("actions.summary.loopStep", { step: action.step })}`)
          : action.mode === "forever"
            ? t("actions.summary.loopForever")
            : action.variable
              ? t("actions.summary.loopUntil", { check: `${action.variable} ${t(`branch.opsShort.${action.op}`)} ${["isEmpty", "isNotEmpty"].includes(action.op) ? "" : action.value}`.trim() }) +
                (action.check === "tail" ? ` ${t("actions.summary.loopTail")}` : "")
              : "";
      return [what, t("actions.summary.loopEvery", { ms: action.intervalMs }), action.timeoutMs > 0 && t("actions.summary.loopLimit", { ms: action.timeoutMs })].filter(Boolean).join(" · ");
    }
    case "runScript":
      return action.saveTo ? `→ ${action.saveTo}` : action.code.split("\n")[0].slice(0, 40);
    default:
      return "";
  }
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function clampTarget(x: number, y: number, layout: Layout | null): { x: number; y: number } {
  const w = layout?.width ?? 9;
  const h = layout?.height ?? 9;
  return { x: Math.max(0, Math.min(w - 1, x)), y: Math.max(0, Math.min(h - 1, y)) };
}
