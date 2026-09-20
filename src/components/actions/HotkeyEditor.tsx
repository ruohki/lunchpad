import { clsx } from "clsx";
import { Reorder, useDragControls } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Icon } from "../../icons/Icon";
import type { Action, Button, KeyEvent, Keystroke } from "../../lib/api";
import { PlaceholderField } from "./PlaceholderField";
import { useVariableSuggestions } from "./VariableFields";
import { formatModifier, MODIFIERS } from "../../lib/keys";
import { KeyCapture } from "../KeyCapture";
import { NumberInput } from "../NumberInput";
import { Select } from "../Select";
import { Toggle } from "../ui";

type HotkeyAction = Extract<Action, { type: "hotkey" }>;
type StepKind = "tap" | "down" | "up" | "delay" | "text";

/** Keystrokes carry no id in the profile; key rows by position wrapped in a stable object. */
interface Row {
  id: number;
  stroke: Keystroke;
}

const inputCls = "rounded-md bg-stage-800 px-2.5 py-1.5 text-sm text-stage-100 outline-none focus:ring-1 focus:ring-accent-400";

let rowSeq = 1;
const rowIds = new WeakMap<Keystroke, number>();
function rowOf(stroke: Keystroke): Row {
  let id = rowIds.get(stroke);
  if (!id) {
    id = rowSeq++;
    rowIds.set(stroke, id);
  }
  return { id, stroke };
}

export function HotkeyEditor({ action, onChange, button }: { action: HotkeyAction; onChange: (next: Action) => void; button?: Button }) {
  const { t } = useTranslation();
  const suggestions = useVariableSuggestions(button);
  const rows = action.keystrokes.map(rowOf);

  const setStrokes = (strokes: Keystroke[]) => onChange({ ...action, keystrokes: strokes });
  const replace = (index: number, stroke: Keystroke) => setStrokes(action.keystrokes.map((s, i) => (i === index ? stroke : s)));
  const remove = (index: number) => setStrokes(action.keystrokes.filter((_, i) => i !== index));
  const add = (kind: StepKind) => setStrokes([...action.keystrokes, blank(kind)]);

  return (
    <div className="flex flex-col gap-3">
      <Reorder.Group axis="y" values={rows} onReorder={(next: Row[]) => setStrokes(next.map((r) => r.stroke))} className="flex flex-col gap-1.5">
        {rows.map((row, index) => (
          <StepRow key={row.id} row={row} suggestions={suggestions} onChange={(s) => replace(index, s)} onRemove={() => remove(index)} />
        ))}
      </Reorder.Group>
      <div className="flex flex-wrap gap-1.5">
        {(["tap", "down", "up", "delay", "text"] as StepKind[]).map((k) => (
          <button key={k} type="button" onClick={() => add(k)} className="rounded-md bg-stage-700 px-2 py-1 text-xs text-stage-100 hover:bg-stage-600">
            + {t(`hotkey.kinds.${k}`)}
          </button>
        ))}
      </div>
      <Toggle checked={action.restoreAllAtEnd} onChange={(restoreAllAtEnd) => onChange({ ...action, restoreAllAtEnd })} label={t("hotkey.restore")} hint={t("hotkey.restoreHint")} />
    </div>
  );
}

function kindOf(stroke: Keystroke): StepKind {
  if (stroke.type === "key") return stroke.event;
  return stroke.type;
}

function blank(kind: StepKind): Keystroke {
  switch (kind) {
    case "delay":
      return { type: "delay", ms: 100 };
    case "text":
      return { type: "text", text: "", delayMs: 0 };
    default:
      return { type: "key", event: kind, key: "", modifiers: [] };
  }
}

function StepRow({ row, suggestions, onChange, onRemove }: { row: Row; suggestions: string[]; onChange: (s: Keystroke) => void; onRemove: () => void }) {
  const { t } = useTranslation();
  const controls = useDragControls();
  const stroke = row.stroke;
  const kind = kindOf(stroke);

  const setKind = (next: StepKind) => {
    if (next === kind) return;
    if (stroke.type === "key" && (next === "tap" || next === "down" || next === "up")) onChange({ ...stroke, event: next as KeyEvent });
    else onChange(blank(next));
  };

  return (
    <Reorder.Item value={row} dragListener={false} dragControls={controls} className="flex flex-wrap items-center gap-2 rounded-lg border border-stage-700 bg-stage-800/60 px-2 py-1.5">
      <button type="button" aria-label={t("actions.dragHandle")} onPointerDown={(e) => controls.start(e)} className="cursor-grab touch-none px-1 text-stage-500 hover:text-stage-200">
        <Icon name="GripVertical" />
      </button>
      <Select<StepKind>
        size="sm"
        value={kind}
        options={(["tap", "down", "up", "delay", "text"] as StepKind[]).map((k) => ({ value: k, label: t(`hotkey.kinds.${k}`) }))}
        onChange={setKind}
        className="w-32"
      />
      {stroke.type === "key" && (
        <>
          <KeyCapture value={{ key: stroke.key, modifiers: stroke.modifiers }} onChange={(v) => onChange({ ...stroke, key: v.key, modifiers: v.modifiers })} />
          <div className="flex gap-1">
            {MODIFIERS.map((m) => {
              const on = stroke.modifiers.includes(m);
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onChange({ ...stroke, modifiers: on ? stroke.modifiers.filter((x) => x !== m) : [...stroke.modifiers, m] })}
                  className={clsx("min-w-8 rounded-md px-1.5 py-1 font-mono text-xs", on ? "bg-accent-500 text-stage-950" : "bg-stage-800 text-stage-300 hover:bg-stage-700")}
                >
                  {formatModifier(m)}
                </button>
              );
            })}
          </div>
        </>
      )}
      {stroke.type === "delay" && (
        <label className="flex items-center gap-2 text-xs text-stage-400">
          <NumberInput value={stroke.ms} min={0} max={5000} onChange={(ms) => onChange({ ...stroke, ms })} className={inputCls + " w-20"} />
          ms
        </label>
      )}
      {stroke.type === "text" && (
        <>
          <PlaceholderField value={stroke.text} onChange={(text) => onChange({ ...stroke, text })} suggestions={suggestions} placeholder={t("hotkey.textPlaceholder")} className="min-w-40" spellCheck ariaLabel={t("hotkey.textPlaceholder")} />
          <label className="flex items-center gap-2 text-xs text-stage-400">
            {t("hotkey.perChar")}
            <NumberInput value={stroke.delayMs} min={0} max={5000} onChange={(delayMs) => onChange({ ...stroke, delayMs })} className={inputCls + " w-16"} />
            ms
          </label>
        </>
      )}
      <button type="button" aria-label={t("actions.remove")} onClick={onRemove} className="ml-auto rounded-md px-1.5 py-1 text-xs text-stage-400 hover:bg-danger/15 hover:text-danger">
        <Icon name="X" />
      </button>
    </Reorder.Item>
  );
}
