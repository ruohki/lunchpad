import { clsx } from "clsx";
import { AnimatePresence, Reorder, motion, useDragControls, type PanInfo } from "framer-motion";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AVAILABLE_ACTIONS, type Action, type ActionType, type Button, type Layout, type Page } from "../../lib/api";
import { ContextMenu, type MenuEntry, type MenuState } from "../ContextMenu";
import { Toggle } from "../ui";
import { ActionEditor } from "./ActionEditors";
import { Icon } from "../../icons/Icon";
import { ACTION_ICONS, blockOf, cloneActions, createActions, GROUP_ICONS, hasWait, isMarker, markersOrdered, removeAction, summarize } from "./actionUtils";
import { Tooltip } from "../Tooltip";
import { useSettingsStore } from "../../store/settings";
import { useUiStore } from "../../store/ui";

interface Props {
  button: Button;
  onChange: (next: Button) => void;
  pages: Page[];
  layout: Layout | null;
  /** Which lists to show (default: pressed, released, held). */
  lists?: ListKey[];
  /** Titles per list, translation keys. */
  labels?: Partial<Record<ListKey, string>>;
  hideLoop?: boolean;
  /** The list belongs to a fader: value actions start out reading the fader's own level. */
  faderContext?: boolean;
  /** The lists are just lists: no hold time, no tap hints (a strip's touch / move / release). */
  plain?: boolean;
}

type ListKey = "down" | "up" | "hold";

const LIST_TITLES: Record<ListKey, string> = { down: "actions.pressed", up: "actions.released", hold: "actions.held" };
const holdInputCls = "w-16 rounded-md bg-stage-800 px-2 py-1 text-right text-xs text-stage-100 outline-none focus:ring-1 focus:ring-accent-400";

/** Actions without settings of their own. */
const NO_BODY: ReadonlySet<ActionType> = new Set<ActionType>(["stopAllMacros", "stopThisMacro", "restartThisMacro", "obsSaveReplay", "slobsSaveReplay", "stopAllSounds"]);
/** Markers that carry settings of their own (shown expanded like normal actions). */
const MARKERS_WITH_BODY: ReadonlySet<ActionType> = new Set<ActionType>(["ifStart"]);

/** `submenu` groups fold into a nested menu; the others stay inline under a heading. */
const MENU_GROUPS: { group: string; types: ActionType[]; submenu?: boolean }[] = [
  { group: "media", types: ["playSound", "textToSpeech", "setSystemVolume", "setAudioDevice", "stopAllSounds"], submenu: true },
  { group: "general", types: ["delay", "switchPage", "runButton", "setColor", "setFader"], submenu: true },
  { group: "flow", types: ["ifStart", "flipFlopStart", "pushToTalkStart"], submenu: true },
  { group: "system", types: ["hotkey", "launchApplication", "httpRequest", "runScript", "setVariable", "addToVariable"], submenu: true },
  { group: "stop", types: ["stopThisMacro", "restartThisMacro", "stopAllMacros"], submenu: true },
  { group: "obs", types: ["obsSwitchScene", "obsToggleSource", "obsSetAudio", "obsToggleFilter", "obsStream", "obsSaveReplay", "obsStudioMode"], submenu: true },
  { group: "slobs", types: ["slobsSwitchScene", "slobsToggleSource", "slobsSetAudio", "slobsToggleFilter", "slobsStream", "slobsSaveReplay", "slobsStudioMode"], submenu: true },
  { group: "homeAssistant", types: ["homeAssistantTurn", "homeAssistantSetValue", "homeAssistantCallService"], submenu: true },
];

/** Inside a fader, a value action should follow the fader: `value` is its level as a local variable. */
function readFaderValue(action: Action): Action {
  if ("valueFrom" in action && action.valueFrom === null) return { ...action, valueFrom: "value" };
  if ("volumeFrom" in action && action.volumeFrom === null) return { ...action, volumeFrom: "value" };
  return action;
}

/** The "Actions" tab of the button editor: pressed and released lists. */
export function ActionsTab({ button, onChange, pages, layout, lists = ["down", "up", "hold"], labels, hideLoop = false, faderContext = false, plain = false }: Props) {
  const { t } = useTranslation();
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const obsEnabled = useSettingsStore((s) => s.settings?.obs.enabled ?? false);
  const slobsEnabled = useSettingsStore((s) => s.settings?.slobs.enabled ?? false);
  const haEnabled = useSettingsStore((s) => s.settings?.homeAssistant?.enabled ?? false);
  const clipboard = useUiStore((s) => s.actionClipboard);
  const copyActions = useUiStore((s) => s.copyActions);

  const root = useRef<HTMLDivElement>(null);
  /** The list a dragged row is over while it is outside its own list. */
  const [dropList, setDropList] = useState<ListKey | null>(null);

  const setList = (key: ListKey, list: Action[]) => onChange({ ...button, [key]: list });

  /** The list section under a viewport point, if any. */
  const listAt = (x: number, y: number): { key: ListKey; element: HTMLElement } | null => {
    for (const element of root.current?.querySelectorAll<HTMLElement>("[data-list]") ?? []) {
      const r = element.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return { key: element.dataset.list as ListKey, element };
    }
    return null;
  };

  const dragOver = (from: ListKey, x: number, y: number) => {
    const over = listAt(x, y);
    const next = over && over.key !== from ? over.key : null;
    setDropList((prev) => (prev === next ? prev : next));
  };

  /** Drop a row (a marker with its block) into another list, at the row under the pointer. */
  const dropInto = (from: ListKey, action: Action, x: number, y: number) => {
    setDropList(null);
    const target = listAt(x, y);
    if (!target || target.key === from) return;
    const source = button[from];
    const block = blockOf(source, action);
    const moving = new Set(block.map((a) => a.id));
    const dest = button[target.key];
    // Before the first row whose middle is below the pointer, else at the end.
    const rows = [...target.element.querySelectorAll<HTMLElement>("[data-action-id]")];
    const before = rows.find((row) => {
      const r = row.getBoundingClientRect();
      return y < r.top + r.height / 2;
    });
    const index = before ? dest.findIndex((a) => a.id === before.dataset.actionId) : -1;
    const at = index < 0 ? dest.length : index;
    onChange({ ...button, [from]: source.filter((a) => !moving.has(a.id)), [target.key]: [...dest.slice(0, at), ...block, ...dest.slice(at)] });
  };

  /** Insert copies of `actions` into a list after position `at` (`-1` = at the end). */
  const insertClones = (key: ListKey, actions: Action[], at: number) => {
    const clones = cloneActions(actions);
    const list = button[key];
    const index = at < 0 ? list.length : at + 1;
    setList(key, [...list.slice(0, index), ...clones, ...list.slice(index)]);
  };

  /** Right-click on an action: copy it (a marker with its block), duplicate, paste after it, remove. */
  const openRowMenu = (e: React.MouseEvent, key: ListKey, action: Action) => {
    e.preventDefault();
    const list = button[key];
    const block = blockOf(list, action);
    const blockEnd = list.findIndex((a) => a.id === block[block.length - 1].id);
    const items: MenuEntry[] = [
      { label: t(isMarker(action) ? "actions.copyBlock" : "actions.copy"), onSelect: () => copyActions(block) },
      { label: t("actions.duplicate"), onSelect: () => insertClones(key, block, blockEnd) },
      { label: clipboard ? t("actions.pasteAfter", { count: clipboard.length }) : t("actions.pasteAfter", { count: 0 }), disabled: !clipboard, onSelect: () => clipboard && insertClones(key, clipboard, list.findIndex((a) => a.id === action.id)) },
      "divider",
      { label: t("actions.remove"), danger: true, onSelect: () => setList(key, removeAction(list, action.id)) },
    ];
    setMenu({ x: e.clientX, y: e.clientY, items });
  };

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const openAddMenu = (e: React.MouseEvent, key: ListKey) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const entry = (type: ActionType) => ({
      label: t(`actions.types.${type}.name`),
      icon: <Icon name={ACTION_ICONS[type]} />,
      onSelect: () => {
        const created = createActions(type).map((a) => (faderContext ? readFaderValue(a) : a));
        setList(key, [...button[key], ...created]);
        // A new action opens expanded; everything else stays folded.
        setExpanded((prev) => new Set([...prev, ...created.filter((a) => !isMarker(a)).map((a) => a.id)]));
      },
    });
    const items: MenuEntry[] = [];
    if (clipboard) {
      items.push({ label: t("actions.paste", { count: clipboard.length }), onSelect: () => insertClones(key, clipboard, -1) }, "divider");
    }
    // Integrations that are switched off in the settings stay out of the menu.
    const groups = MENU_GROUPS.filter((g) => (g.group === "obs" ? obsEnabled : g.group === "slobs" ? slobsEnabled : g.group === "homeAssistant" ? haEnabled : true));
    groups.forEach((g, gi) => {
      const label = t(`actions.groups.${g.group}`);
      if (g.submenu) {
        // Large groups fold into a submenu so the top level stays short.
        items.push({ submenu: label, items: g.types.map(entry), icon: <Icon name={GROUP_ICONS[g.group]} /> });
      } else {
        if (gi > 0 && !(typeof items[items.length - 1] === "object" && "submenu" in (items[items.length - 1] as object))) items.push("divider");
        items.push({ heading: label });
        g.types.forEach((type) => items.push(entry(type)));
      }
    });
    setMenu({ x: rect.left, y: rect.bottom + 4, items });
  };

  const setLoop = (loop: boolean) => {
    // Looping needs a way out: legacy added "stop this macro" on release.
    const up = loop && !button.up.some((a) => a.type === "stopThisMacro") ? [...button.up, ...createActions("stopThisMacro")] : button.up;
    onChange({ ...button, loop, up });
  };

  return (
    <div ref={root} className="flex flex-col gap-5">
      {!hideLoop && <Toggle checked={button.loop} onChange={setLoop} label={t("actions.loop")} hint={t("actions.loopHint")} />}

      {lists.map((key) => (
        <section
          key={key}
          data-list={key}
          className={clsx("flex flex-col gap-2 rounded-lg outline-offset-4 transition-[outline-color]", dropList === key ? "outline outline-2 outline-accent-400/70" : "outline-transparent")}
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium text-stage-100">
              {t(labels?.[key] ?? LIST_TITLES[key])}
              <span className="ml-2 text-xs font-normal text-stage-500">{button[key].length || ""}</span>
            </h3>
            <div className="flex items-center gap-3">
              {key === "hold" && !plain && (
                <label className="flex items-center gap-1.5 text-xs text-stage-400">
                  {t("actions.holdTime")}
                  <input
                    type="text"
                    inputMode="numeric"
                    value={button.holdMs}
                    onChange={(e) => {
                      const n = parseInt(e.target.value.replace(/[^\d]/g, ""), 10);
                      onChange({ ...button, holdMs: Number.isNaN(n) ? 100 : Math.max(100, Math.min(5000, n)) });
                    }}
                    className={holdInputCls}
                  />
                  ms
                </label>
              )}
              <button
                type="button"
                onClick={(e) => openAddMenu(e, key)}
                className="rounded-md bg-stage-700 px-2.5 py-1 text-xs font-medium text-stage-100 hover:bg-stage-600"
              >
                + {t("actions.add")}
              </button>
            </div>
          </div>
          {key === "down" && !plain && lists.includes("hold") && button.hold.length > 0 && (
            <p className="text-xs text-stage-500">{button.holdWait ? t("actions.tapHint") : t("actions.tapHintImmediate")}</p>
          )}
          {key === "hold" && !plain && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-stage-500">{button.hold.length > 0 ? t("actions.heldHint", { ms: button.holdMs }) : t("actions.heldEmptyHint", { ms: button.holdMs })}</p>
              {button.hold.length > 0 && (
                <Toggle checked={button.holdWait} onChange={(holdWait) => onChange({ ...button, holdWait })} label={t("actions.holdWait")} hint={t("actions.holdWaitHint")} />
              )}
            </div>
          )}

          {button[key].length === 0 ? (
            <p className="rounded-lg border border-dashed border-stage-700 px-3 py-3 text-xs text-stage-500">{t("actions.empty")}</p>
          ) : (
            <Reorder.Group
              axis="y"
              values={button[key]}
              onReorder={(next: Action[]) => {
                if (markersOrdered(next)) setList(key, next);
              }}
              className="flex flex-col gap-1.5"
            >
              <AnimatePresence initial={false}>
                {button[key].map((action, i) => (
                  <ActionRow
                    key={action.id}
                    action={action}
                    depth={depths(button[key])[i]}
                    pages={pages}
                    layout={layout}
                    button={button}
                    expanded={expanded.has(action.id)}
                    onToggle={() => toggle(action.id)}
                    onRemove={() => setList(key, removeAction(button[key], action.id))}
                    onChange={(next) => setList(key, button[key].map((a) => (a.id === next.id ? next : a)))}
                    onContextMenu={(e) => openRowMenu(e, key, action)}
                    onDrag={(x, y) => dragOver(key, x, y)}
                    onDragEnd={(x, y) => dropInto(key, action, x, y)}
                  />
                ))}
              </AnimatePresence>
            </Reorder.Group>
          )}
        </section>
      ))}

      <ContextMenu menu={menu} onClose={() => setMenu(null)} />
    </div>
  );
}

/**
 * Nesting depth of each row: a block's start marker sits at its parent's depth
 * and everything up to its end marker one level in; middle and end markers sit
 * at the block's own depth.
 */
function depths(list: Action[]): number[] {
  let depth = 0;
  return list.map((a) => {
    switch (a.type) {
      case "ifStart":
      case "flipFlopStart":
      case "pushToTalkStart": {
        const at = depth;
        depth += 1;
        return at;
      }
      case "ifElse":
      case "flipFlopMiddle":
        return Math.max(0, depth - 1);
      case "ifEnd":
      case "flipFlopEnd":
      case "pushToTalkEnd":
        depth = Math.max(0, depth - 1);
        return depth;
      default:
        return depth;
    }
  });
}

function ActionRow({
  action,
  depth,
  pages,
  layout,
  button,
  expanded,
  onToggle,
  onRemove,
  onChange,
  onContextMenu,
  onDrag,
  onDragEnd,
}: {
  action: Action;
  /** How many blocks (branch, flip-flop, push-to-talk) the row sits in; each one indents it. */
  depth: number;
  pages: Page[];
  layout: Layout | null;
  button: Button;
  expanded: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onChange: (next: Action) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  /** The pointer's viewport position while the row is dragged, and where it was let go. */
  onDrag: (x: number, y: number) => void;
  onDragEnd: (x: number, y: number) => void;
}) {
  const { t } = useTranslation();
  const controls = useDragControls();
  const marker = isMarker(action);
  const available = AVAILABLE_ACTIONS.has(action.type);
  const summary = summarize(t, action, pages);
  const hasBody = available && (!marker || MARKERS_WITH_BODY.has(action.type)) && !NO_BODY.has(action.type);

  return (
    <Reorder.Item
      value={action}
      data-action-id={action.id}
      dragListener={false}
      dragControls={controls}
      onDrag={(e: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
        const [x, y] = clientPoint(e, info);
        onDrag(x, y);
      }}
      onDragEnd={(e: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
        const [x, y] = clientPoint(e, info);
        onDragEnd(x, y);
      }}
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 12 }}
      transition={{ type: "spring", stiffness: 500, damping: 40 }}
      whileDrag={{ scale: 1.01, boxShadow: "0 12px 30px -10px rgba(0,0,0,0.8)" }}
      style={{ marginLeft: depth * 18 }}
      onContextMenu={(e: React.MouseEvent) => {
        // The editors' own fields keep the browser menu (paste into a text field, say).
        const target = e.target as HTMLElement;
        if (target.closest("input, textarea, [contenteditable]")) return;
        onContextMenu(e);
      }}
      className={clsx(
        "rounded-lg border",
        marker ? "border-dashed border-stage-600 bg-stage-900/60" : "border-stage-700 bg-stage-800/70",
        !available && "opacity-80",
      )}
    >
      <div className="flex items-center gap-2 px-2 py-2">
        <Tooltip content={t("actions.dragHandle")}>
          <button
            type="button"
            aria-label={t("actions.dragHandle")}
            onPointerDown={(e) => controls.start(e)}
            className="cursor-grab touch-none select-none rounded px-1 py-1 text-stage-500 hover:bg-stage-700 hover:text-stage-200 active:cursor-grabbing"
          >
            ⋮⋮
          </button>
        </Tooltip>

        <button
          type="button"
          onClick={hasBody ? onToggle : undefined}
          aria-expanded={hasBody ? expanded : undefined}
          className={clsx("min-w-0 flex-1 text-left", hasBody && "cursor-pointer")}
        >
          <div className="flex items-center gap-2">
            {hasBody && (
              <span aria-hidden className={clsx("w-3 shrink-0 text-center text-[10px] leading-none text-stage-500 transition-transform", expanded && "rotate-90")}>
                ▶
              </span>
            )}
            <Icon name={ACTION_ICONS[action.type]} className="shrink-0 text-base text-stage-400" />
            <span className="flex min-w-0 items-baseline gap-2">
              <span className="shrink-0 text-sm font-medium text-stage-100">{t(`actions.types.${action.type}.name`)}</span>
              {summary && <span className="truncate text-xs text-stage-400">{summary}</span>}
            </span>
          </div>
          {(expanded || marker || !available) && (
            <div className={clsx("text-xs text-stage-500", hasBody && "pl-5")}>
              {available ? t(`actions.types.${action.type}.desc`) : t("actions.notAvailable")}
            </div>
          )}
        </button>

        {hasWait(action.type) && (
          <Tooltip content={t("actions.waitHint")}>
            <div className="shrink-0">
              <Toggle checked={action.wait} onChange={(wait) => onChange({ ...action, wait })} label={t("actions.wait")} />
            </div>
          </Tooltip>
        )}

        <Tooltip content={t("actions.remove")}>
          <button
            type="button"
            aria-label={t("actions.remove")}
            onClick={onRemove}
            className="rounded-md px-1.5 py-1 text-[10px] leading-none text-stage-400 hover:bg-danger/15 hover:text-danger"
          >
            ✕
          </button>
        </Tooltip>
      </div>

      <AnimatePresence initial={false}>
        {hasBody && expanded && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="border-t border-stage-700/60 px-3 pb-3 pt-2">
              <ActionEditor action={action} onChange={onChange} pages={pages} layout={layout} button={button} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Reorder.Item>
  );
}

/** Where a drag event's pointer is in the viewport (framer's point is relative to the page). */
function clientPoint(e: PointerEvent | MouseEvent | TouchEvent, info: PanInfo): [number, number] {
  if ("clientX" in e) return [e.clientX, e.clientY];
  const touch = e.changedTouches?.[0];
  if (touch) return [touch.clientX, touch.clientY];
  return [info.point.x - window.scrollX, info.point.y - window.scrollY];
}
