import type { TFunction } from "i18next";
import { BUILTIN_VARIABLES, newActionId, type Action, type ActionKind, type ActionType, type Layout, type Page } from "../../lib/api";
import type { IconName } from "../../icons/icons";

/** Icon per action type; the legacy app's choices where it had the action. */
export const ACTION_ICONS: Record<ActionType, IconName> = {
  delay: "Stopwatch",
  switchPage: "PageOpen",
  setColor: "Light",
  runButton: "ButtonDown",
  setFader: "Light",
  stopAllMacros: "Stop",
  stopThisMacro: "Stop",
  restartThisMacro: "Stop",
  pushToTalkStart: "ButtonDownUp",
  pushToTalkEnd: "ButtonUp",
  flipFlopStart: "FlipFlop",
  flipFlopMiddle: "FlipFlop",
  flipFlopEnd: "FlipFlop",
  ifStart: "Branch",
  ifElse: "Branch",
  ifEnd: "Branch",
  playSound: "Sound",
  textToSpeech: "TTS",
  setSystemVolume: "Sound",
  stopAllSounds: "Stop",
  setAudioDevice: "Sound",
  addToVariable: "Variable",
  launchApplication: "Shell",
  hotkey: "Keyboard",
  httpRequest: "Globe",
  setVariable: "Variable",
  runScript: "Code",
  obsSwitchScene: "OBS",
  obsToggleSource: "OBS",
  obsSetAudio: "OBS",
  obsToggleFilter: "OBS",
  obsStream: "OBS",
  obsSaveReplay: "OBS",
  obsStudioMode: "OBS",
  slobsSwitchScene: "Streamlabs",
  slobsToggleSource: "Streamlabs",
  slobsSetAudio: "Streamlabs",
  slobsToggleFilter: "Streamlabs",
  slobsStream: "Streamlabs",
  slobsSaveReplay: "Streamlabs",
  slobsStudioMode: "Streamlabs",
  homeAssistantTurn: "Home",
  homeAssistantSetValue: "Home",
  homeAssistantCallService: "Home",
};

export const GROUP_ICONS: Record<string, IconName> = {
  media: "Sound",
  system: "Keyboard",
  general: "PageOpen",
  flow: "FlipFlop",
  stop: "Stop",
  obs: "OBS",
  slobs: "Streamlabs",
  homeAssistant: "Home",
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
      default:
        return true;
    }
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
      return [make({ type: "delay", ms: 500 })];
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
      return [make({ type: "setSystemVolume", target: "output", mode: "set", volume: 50, volumeFrom: null })];
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
        }),
      ];
    case "setVariable":
      return [make({ type: "setVariable", name: "", value: "", scope: "local" })];
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
  return ["runButton", "playSound", "textToSpeech", "launchApplication", "hotkey", "httpRequest", "runScript"].includes(type);
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
    }
    if (a.type === "runScript" && a.saveTo) names.add(a.saveTo);
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

export function summarize(t: TFunction, action: Action, pages: Page[]): string {
  switch (action.type) {
    case "delay":
      return t("actions.summary.delay", { ms: action.ms });
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
      const device = t(`volume.targets.${action.target}`);
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
    case "ifStart":
      return action.variable ? `${action.variable} ${t(`branch.opsShort.${action.op}`)} ${["isEmpty", "isNotEmpty"].includes(action.op) ? "" : action.value}`.trim() : "";
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
