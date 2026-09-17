import { Reorder, useDragControls } from "framer-motion";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "../../icons/Icon";
import { api, SCREEN_PICKS, TITLE_MATCHES, WINDOW_OPS, type Action, type Button as ButtonModel, type MouseButton, type MouseStep, type ScreenInfo, type TitleMatch, type WindowInfo, type WindowTarget } from "../../lib/api";
import { Select } from "../Select";
import { Tooltip } from "../Tooltip";
import { Button, Segmented, Toggle } from "../ui";
import { PlaceholderField } from "./PlaceholderField";
import { SaveToFields, useVariableSuggestions } from "./VariableFields";

type GetWindowAction = Extract<Action, { type: "getWindow" }>;
type SetWindowAction = Extract<Action, { type: "setWindow" }>;
type MouseAction = Extract<Action, { type: "mouse" }>;
type MousePositionAction = Extract<Action, { type: "mousePosition" }>;
type GetScreenAction = Extract<Action, { type: "getScreen" }>;
type StepKind = MouseStep["type"];

const MOUSE_BUTTONS: MouseButton[] = ["left", "right", "middle"];
const STEP_KINDS: StepKind[] = ["move", "click", "press", "release", "scroll", "drag", "delay"];
const labelCls = "flex flex-col gap-1 text-xs text-stage-400";
const inputCls = "rounded-md bg-stage-800 px-2.5 py-1.5 text-sm text-stage-100 outline-none focus:ring-1 focus:ring-accent-400";

/** A number or a placeholder, narrow. */
function Coordinate({ label, value, onChange, suggestions, width = "w-40" }: { label: string; value: string; onChange: (v: string) => void; suggestions: string[]; width?: string }) {
  return (
    <label className={labelCls}>
      {label}
      <div className={`flex ${width}`}>
        <PlaceholderField mono value={value} onChange={onChange} suggestions={suggestions} placeholder="0" ariaLabel={label} />
      </div>
    </label>
  );
}

/** Which window: the one in front, or a title search with a list of the open windows to pick from. */
interface WindowChoice {
  target: WindowTarget;
  title: string;
  matching: TitleMatch;
  app: string;
}

function WindowChoiceFields({ value, onChange, suggestions }: { value: WindowChoice; onChange: (next: WindowChoice) => void; suggestions: string[] }) {
  const { t } = useTranslation();
  const [windows, setWindows] = useState<WindowInfo[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const load = async () => {
    try {
      setWindows(await api.listWindows());
      setProblem(null);
    } catch (e) {
      setWindows([]);
      setProblem(String(e));
    }
  };
  useEffect(() => {
    void load();
  }, []);

  return (
    <>
      <Segmented<WindowTarget>
        value={value.target}
        options={[
          { value: "foreground", label: t("window.foreground") },
          { value: "title", label: t("window.byTitle") },
        ]}
        onChange={(target) => onChange({ ...value, target })}
      />
      {value.target === "title" && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={labelCls}>
              {t("window.title")}
              <PlaceholderField mono value={value.title} onChange={(title) => onChange({ ...value, title })} suggestions={suggestions} placeholder={t("window.titlePlaceholder")} ariaLabel={t("window.title")} />
            </label>
            <div className={labelCls}>
              {t("window.pick")}
              <div className="flex gap-1">
                <Select<string>
                  size="sm"
                  className="min-w-0 flex-1"
                  value={null}
                  placeholder={windows.length ? t("window.pickPlaceholder") : t("window.none")}
                  options={windows.map((w) => ({ value: w.handle, label: w.title || w.app, hint: w.screen ? t("window.pickHint", { app: w.app, screen: w.screen }) : w.app }))}
                  onChange={(handle) => {
                    const w = windows.find((x) => x.handle === handle);
                    if (w) onChange({ ...value, title: w.title, app: w.app, matching: "exact" });
                  }}
                  ariaLabel={t("window.pick")}
                />
                <Tooltip content={t("window.refresh")}>
                  <Button size="sm" onClick={() => void load()} aria-label={t("window.refresh")}>
                    <Icon name="RefreshCw" />
                  </Button>
                </Tooltip>
              </div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={labelCls}>
              {t("window.matching")}
              <Select value={value.matching} options={TITLE_MATCHES.map((m) => ({ value: m, label: t(`window.match.${m}`) }))} onChange={(matching) => onChange({ ...value, matching })} ariaLabel={t("window.matching")} />
            </label>
            <label className={labelCls}>
              {t("window.app")}
              <PlaceholderField value={value.app} onChange={(app) => onChange({ ...value, app })} suggestions={suggestions} placeholder={t("window.appPlaceholder")} ariaLabel={t("window.app")} />
            </label>
          </div>
        </>
      )}
      {problem && <p className="text-xs text-danger">{problem}</p>}
    </>
  );
}

/** Find a window and remember it in a variable. */
export function GetWindowEditor({ action, onChange, button }: { action: GetWindowAction; onChange: (next: Action) => void; button?: ButtonModel }) {
  const { t } = useTranslation();
  const suggestions = useVariableSuggestions(button);
  return (
    <div className="flex flex-col gap-3">
      <WindowChoiceFields value={action} onChange={(choice) => onChange({ ...action, ...choice })} suggestions={suggestions} />
      <SaveToFields name={action.saveTo || null} scope={action.saveScope} onChange={(saveTo, saveScope) => onChange({ ...action, saveTo: saveTo ?? "", saveScope })} label={t("window.saveTo")} button={button} />
      <p className="text-xs text-stage-500">{t("window.getHint", { name: action.saveTo.trim() || "name", ref: `{{${action.saveTo.trim() || "name"}}}` })}</p>
    </div>
  );
}

/** Find a window and change it. */
export function SetWindowEditor({ action, onChange, button }: { action: SetWindowAction; onChange: (next: Action) => void; button?: ButtonModel }) {
  const { t } = useTranslation();
  const suggestions = useVariableSuggestions(button);
  return (
    <div className="flex flex-col gap-3">
      <WindowChoiceFields value={action} onChange={(choice) => onChange({ ...action, ...choice })} suggestions={suggestions} />
      <div className="flex flex-wrap items-end gap-3">
        <label className={labelCls}>
          {t("window.op")}
          <div className="w-56">
            <Select value={action.op} options={WINDOW_OPS.map((op) => ({ value: op, label: t(`window.ops.${op}`) }))} onChange={(op) => onChange({ ...action, op })} ariaLabel={t("window.op")} />
          </div>
        </label>
        {(action.op === "move" || action.op === "bounds") && (
          <>
            <Coordinate label={t("mouse.x")} value={action.x} onChange={(x) => onChange({ ...action, x })} suggestions={suggestions} width="w-32" />
            <Coordinate label={t("mouse.y")} value={action.y} onChange={(y) => onChange({ ...action, y })} suggestions={suggestions} width="w-32" />
          </>
        )}
        {(action.op === "resize" || action.op === "bounds") && (
          <>
            <Coordinate label={t("window.width")} value={action.width} onChange={(width) => onChange({ ...action, width })} suggestions={suggestions} width="w-32" />
            <Coordinate label={t("window.height")} value={action.height} onChange={(height) => onChange({ ...action, height })} suggestions={suggestions} width="w-32" />
          </>
        )}
        {(action.op === "move" || action.op === "bounds" || action.op === "center" || action.op === "screen") && (
          <label className={labelCls}>
            {t("window.screen")}
            <div className="flex w-28">
              <PlaceholderField mono value={action.screen} onChange={(screen) => onChange({ ...action, screen })} suggestions={suggestions} placeholder={action.op === "screen" ? "1" : t("window.screenOwn")} ariaLabel={t("window.screen")} />
            </div>
          </label>
        )}
      </div>
      <p className="text-xs text-stage-500">{t("window.setHint")}</p>
    </div>
  );
}

/** Which screen, and what a variable will hold; lists the screens as they are right now. */
export function GetScreenEditor({ action, onChange, button }: { action: GetScreenAction; onChange: (next: Action) => void; button?: ButtonModel }) {
  const { t } = useTranslation();
  const suggestions = useVariableSuggestions(button);
  const [screens, setScreens] = useState<ScreenInfo[]>([]);
  useEffect(() => {
    api
      .listScreens()
      .then(setScreens)
      .catch(() => setScreens([]));
  }, []);
  const name = action.saveTo.trim() || "name";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className={labelCls}>
          {t("screen.pick")}
          <div className="w-64">
            <Select value={action.pick} options={SCREEN_PICKS.map((p) => ({ value: p, label: t(`screen.picks.${p}`) }))} onChange={(pick) => onChange({ ...action, pick })} ariaLabel={t("screen.pick")} />
          </div>
        </label>
        {action.pick === "number" && <Coordinate label={t("screen.number")} value={action.number} onChange={(number) => onChange({ ...action, number })} suggestions={suggestions} width="w-28" />}
      </div>
      {screens.length > 0 && (
        <p className="text-xs text-stage-400">
          {t("screen.now")}{" "}
          {screens.map((s) => t("screen.summary", { number: s.number, width: s.width, height: s.height, scale: s.scale, main: s.primary ? t("screen.main") : "" })).join(" · ")}
        </p>
      )}
      <SaveToFields name={action.saveTo || null} scope={action.saveScope} onChange={(saveTo, saveScope) => onChange({ ...action, saveTo: saveTo ?? "", saveScope })} label={t("window.saveTo")} button={button} />
      <p className="text-xs text-stage-500">{t("screen.hint", { name })}</p>
    </div>
  );
}

/** Steps carry no id in the profile; key rows by position wrapped in a stable object. */
interface Row {
  id: number;
  step: MouseStep;
}

let rowSeq = 1;
const rowIds = new WeakMap<MouseStep, number>();
function rowOf(step: MouseStep): Row {
  let id = rowIds.get(step);
  if (!id) {
    id = rowSeq++;
    rowIds.set(step, id);
  }
  return { id, step };
}

function blank(kind: StepKind): MouseStep {
  switch (kind) {
    case "move":
      return { type: "move", x: "", y: "", relative: false };
    case "click":
      return { type: "click", button: "left", clicks: 1 };
    case "press":
      return { type: "press", button: "left" };
    case "release":
      return { type: "release", button: "left" };
    case "scroll":
      return { type: "scroll", amount: "3", axis: "vertical" };
    case "drag":
      return { type: "drag", x: "", y: "", button: "left" };
    case "delay":
      return { type: "delay", ms: 100 };
  }
}

/** A list of mouse steps, like the hotkey sequence's keystrokes. */
export function MouseEditor({ action, onChange, button }: { action: MouseAction; onChange: (next: Action) => void; button?: ButtonModel }) {
  const { t } = useTranslation();
  const suggestions = useVariableSuggestions(button);
  const rows = action.steps.map(rowOf);

  const setSteps = (steps: MouseStep[]) => onChange({ ...action, steps });
  const replace = (index: number, step: MouseStep) => setSteps(action.steps.map((s, i) => (i === index ? step : s)));
  const remove = (index: number) => setSteps(action.steps.filter((_, i) => i !== index));
  const add = (kind: StepKind) => setSteps([...action.steps, blank(kind)]);

  return (
    <div className="flex flex-col gap-3">
      <Reorder.Group axis="y" values={rows} onReorder={(next: Row[]) => setSteps(next.map((r) => r.step))} className="flex flex-col gap-1.5">
        {rows.map((row, index) => (
          <StepRow key={row.id} row={row} suggestions={suggestions} onChange={(s) => replace(index, s)} onRemove={() => remove(index)} />
        ))}
      </Reorder.Group>
      <div className="flex flex-wrap gap-1.5">
        {STEP_KINDS.map((k) => (
          <button key={k} type="button" onClick={() => add(k)} className="rounded-md bg-stage-700 px-2 py-1 text-xs text-stage-100 hover:bg-stage-600">
            + {t(`mouse.steps.${k}`)}
          </button>
        ))}
      </div>
      <p className="text-xs text-stage-500">{t("mouse.hint")}</p>
    </div>
  );
}

function ButtonSelect({ value, onChange }: { value: MouseButton; onChange: (b: MouseButton) => void }) {
  const { t } = useTranslation();
  return <Select size="sm" value={value} options={MOUSE_BUTTONS.map((b) => ({ value: b, label: t(`mouse.buttons.${b}`) }))} onChange={onChange} className="w-28" ariaLabel={t("mouse.button")} />;
}

function StepRow({ row, suggestions, onChange, onRemove }: { row: Row; suggestions: string[]; onChange: (s: MouseStep) => void; onRemove: () => void }) {
  const { t } = useTranslation();
  const controls = useDragControls();
  const step = row.step;
  const setKind = (next: StepKind) => {
    if (next === step.type) return;
    const fresh = blank(next);
    // Keep what carries over: the button, the coordinates.
    if ("button" in fresh && "button" in step) fresh.button = step.button;
    if ("x" in fresh && "x" in step) {
      fresh.x = step.x;
      fresh.y = step.y;
    }
    onChange(fresh);
  };
  const narrow = (label: string, value: string, set: (v: string) => void) => (
    <label className="flex items-center gap-1.5 text-xs text-stage-400">
      {label}
      <div className="w-24">
        <PlaceholderField mono value={value} onChange={set} suggestions={suggestions} placeholder="0" ariaLabel={label} />
      </div>
    </label>
  );

  return (
    <Reorder.Item value={row} dragListener={false} dragControls={controls} className="flex flex-wrap items-center gap-2 rounded-lg border border-stage-700 bg-stage-800/60 px-2 py-1.5">
      <button type="button" aria-label={t("actions.dragHandle")} onPointerDown={(e) => controls.start(e)} className="cursor-grab touch-none px-1 text-stage-500 hover:text-stage-200">
        <Icon name="GripVertical" />
      </button>
      <Select<StepKind> size="sm" value={step.type} options={STEP_KINDS.map((k) => ({ value: k, label: t(`mouse.steps.${k}`) }))} onChange={setKind} className="w-32" ariaLabel={t("mouse.steps.move")} />
      {step.type === "move" && (
        <>
          {narrow(t("mouse.x"), step.x, (x) => onChange({ ...step, x }))}
          {narrow(t("mouse.y"), step.y, (y) => onChange({ ...step, y }))}
          <Toggle checked={step.relative} onChange={(relative) => onChange({ ...step, relative })} label={t("mouse.relative")} />
        </>
      )}
      {step.type === "click" && (
        <>
          <ButtonSelect value={step.button} onChange={(button) => onChange({ ...step, button })} />
          <Select<"1" | "2" | "3">
            size="sm"
            value={String(Math.min(3, Math.max(1, step.clicks))) as "1" | "2" | "3"}
            options={(["1", "2", "3"] as const).map((n) => ({ value: n, label: t(`mouse.clickCounts.${n}`) }))}
            onChange={(n) => onChange({ ...step, clicks: Number(n) })}
            className="w-28"
            ariaLabel={t("mouse.clicks")}
          />
        </>
      )}
      {(step.type === "press" || step.type === "release") && <ButtonSelect value={step.button} onChange={(button) => onChange({ ...step, button })} />}
      {step.type === "scroll" && (
        <>
          {narrow(t("mouse.amount"), step.amount, (amount) => onChange({ ...step, amount }))}
          <Select<"vertical" | "horizontal"> size="sm" value={step.axis} options={(["vertical", "horizontal"] as const).map((a) => ({ value: a, label: t(`mouse.axes.${a}`) }))} onChange={(axis) => onChange({ ...step, axis })} className="w-32" ariaLabel={t("mouse.axis")} />
        </>
      )}
      {step.type === "drag" && (
        <>
          {narrow(t("mouse.x"), step.x, (x) => onChange({ ...step, x }))}
          {narrow(t("mouse.y"), step.y, (y) => onChange({ ...step, y }))}
          <ButtonSelect value={step.button} onChange={(button) => onChange({ ...step, button })} />
        </>
      )}
      {step.type === "delay" && (
        <label className="flex items-center gap-2 text-xs text-stage-400">
          <input type="text" inputMode="numeric" value={step.ms} onChange={(e) => onChange({ ...step, ms: Math.max(0, Math.min(5000, parseInt(e.target.value.replace(/\D/g, ""), 10) || 0)) })} className={inputCls + " w-20"} />
          ms
        </label>
      )}
      <button type="button" aria-label={t("actions.remove")} onClick={onRemove} className="ml-auto rounded-md px-1.5 py-1 text-xs text-stage-400 hover:bg-danger/15 hover:text-danger">
        <Icon name="X" />
      </button>
    </Reorder.Item>
  );
}

export function MousePositionEditor({ action, onChange, button }: { action: MousePositionAction; onChange: (next: Action) => void; button?: ButtonModel }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2">
      <SaveToFields name={action.saveTo || null} scope={action.saveScope} onChange={(saveTo, saveScope) => onChange({ ...action, saveTo: saveTo ?? "", saveScope })} label={t("mouse.saveTo")} button={button} />
      <p className="text-xs text-stage-500">{t("mouse.positionHint", { name: action.saveTo.trim() || "name" })}</p>
    </div>
  );
}
