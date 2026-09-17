import { PlaceholderField } from "./PlaceholderField";
import { useVariableSuggestions } from "./VariableFields";
import { useTranslation } from "react-i18next";
import type { Action, Button, ButtonRef, ButtonTrigger, Layout, Page } from "../../lib/api";
import { ColorField } from "../ColorField";
import { Select } from "../Select";
import { clampTarget } from "./actionUtils";
import { HotkeyEditor } from "./HotkeyEditor";
import { HttpEditor } from "./HttpEditor";
import { AddToVariableEditor, BranchEditor, ScriptEditor, SetVariableEditor } from "./VariableEditors";
import { LaunchEditor } from "./LaunchEditor";
import { DebugEditor } from "./DebugEditor";
import { GetScreenEditor, GetWindowEditor, MouseEditor, MousePositionEditor, SetWindowEditor } from "./DesktopEditors";
import { HomeAssistantServiceEditor, HomeAssistantTurnEditor, HomeAssistantValueEditor } from "./HomeAssistantEditors";
import { ObsEditor } from "./ObsEditors";
import { SoundEditor } from "./SoundEditor";
import { SpeechEditor } from "./SpeechEditor";
import { SystemVolumeEditor } from "./SystemVolumeEditor";
import { SetFaderEditor } from "./SetFaderEditor";
import { AudioDeviceEditor } from "./AudioDeviceEditor";

interface Props {
  action: Action;
  onChange: (next: Action) => void;
  pages: Page[];
  layout: Layout | null;
  button: Button;
}

const inputCls =
  "rounded-md bg-stage-800 px-2.5 py-1.5 text-sm text-stage-100 outline-none focus:ring-1 focus:ring-accent-400";

/** Text field that only accepts whole numbers (no native spinner). */
function NumberInput({ value, min, max, onChange, className }: { value: number; min: number; max?: number; onChange: (n: number) => void; className?: string }) {
  return (
    <input
      type="text"
      inputMode="numeric"
      value={value}
      onChange={(e) => {
        const n = parseInt(e.target.value.replace(/[^\d-]/g, ""), 10);
        if (Number.isNaN(n)) return onChange(min);
        onChange(Math.max(min, max === undefined ? n : Math.min(max, n)));
      }}
      className={inputCls + " " + (className ?? "")}
    />
  );
}

/** Body of an action pill: the fields of one action type. */
export function ActionEditor({ action, onChange, pages, layout, button }: Props) {
  const { t } = useTranslation();

  switch (action.type) {
    case "delay":
      return <DelayEditor action={action} onChange={onChange} button={button} />;
    case "getWindow":
      return <GetWindowEditor action={action} onChange={onChange} button={button} />;
    case "setWindow":
      return <SetWindowEditor action={action} onChange={onChange} button={button} />;
    case "mouse":
      return <MouseEditor action={action} onChange={onChange} button={button} />;
    case "mousePosition":
      return <MousePositionEditor action={action} onChange={onChange} button={button} />;
    case "getScreen":
      return <GetScreenEditor action={action} onChange={onChange} button={button} />;
    case "debug":
      return <DebugEditor action={action} onChange={onChange} button={button} />;

    case "switchPage":
      return (
        <label className="flex items-center gap-2 text-xs text-stage-400">
          {t("actions.fields.page")}
          <Select
            size="sm"
            value={action.pageId}
            options={[
              ...(pages.some((p) => p.id === action.pageId) ? [] : [{ value: action.pageId, label: t("actions.summary.unknownPage") }]),
              ...pages.map((p) => ({ value: p.id, label: p.name })),
            ]}
            onChange={(pageId) => onChange({ ...action, pageId })}
          />
        </label>
      );

    case "setColor":
      return (
        <div className="flex flex-col gap-3">
          <div className="max-w-xs">
            <ColorField label={t("actions.fields.colour")} value={action.color} onChange={(color) => onChange({ ...action, color })} limited={layout?.limitedColor} />
          </div>
          <TargetPicker
            target={action.target}
            allowThis
            pages={pages}
            layout={layout}
            onChange={(target) => onChange({ ...action, target })}
          />
        </div>
      );

    case "runButton":
      return (
        <div className="flex flex-col gap-3">
          <TargetPicker target={action.target} pages={pages} layout={layout} onChange={(target) => onChange({ ...action, target: target ?? { pageId: null, x: 0, y: 0 } })} />
          <label className="flex items-center gap-2 text-xs text-stage-400">
            {t("actions.fields.trigger")}
            <Select<ButtonTrigger>
              size="sm"
              value={action.trigger}
              options={[
                { value: "press", label: t("actions.fields.triggerPress") },
                { value: "release", label: t("actions.fields.triggerRelease") },
                { value: "tap", label: t("actions.fields.triggerTap") },
                { value: "hold", label: t("actions.fields.triggerHold") },
              ]}
              onChange={(trigger) => onChange({ ...action, trigger })}
            />
          </label>
        </div>
      );

    case "playSound":
      return <SoundEditor action={action} onChange={onChange} button={button} />;
    case "textToSpeech":
      return <SpeechEditor action={action} onChange={onChange} button={button} />;
    case "setSystemVolume":
      return <SystemVolumeEditor action={action} onChange={onChange} button={button} />;
    case "setAudioDevice":
      return <AudioDeviceEditor action={action} onChange={onChange} />;
    case "launchApplication":
      return <LaunchEditor action={action} onChange={onChange} button={button} />;
    case "hotkey":
      return <HotkeyEditor action={action} onChange={onChange} button={button} />;
    case "httpRequest":
      return <HttpEditor action={action} onChange={onChange} button={button} />;
    case "setFader":
      return <SetFaderEditor action={action} onChange={onChange} button={button} />;
    case "setVariable":
      return <SetVariableEditor action={action} onChange={onChange} button={button} />;
    case "addToVariable":
      return <AddToVariableEditor action={action} onChange={onChange} button={button} />;
    case "runScript":
      return <ScriptEditor action={action} onChange={onChange} button={button} />;
    case "ifStart":
      return <BranchEditor action={action} onChange={onChange} button={button} />;
    case "obsSwitchScene":
    case "obsToggleSource":
    case "obsSetAudio":
    case "obsToggleFilter":
    case "obsStream":
    case "obsStudioMode":
    case "obsTriggerHotkey":
    case "slobsSwitchScene":
    case "slobsToggleSource":
    case "slobsSetAudio":
    case "slobsToggleFilter":
    case "slobsStream":
    case "slobsStudioMode":
      return <ObsEditor action={action} onChange={onChange} button={button} />;
    case "homeAssistantTurn":
      return <HomeAssistantTurnEditor action={action} onChange={onChange} />;
    case "homeAssistantSetValue":
      return <HomeAssistantValueEditor action={action} onChange={onChange} button={button} />;
    case "homeAssistantCallService":
      return <HomeAssistantServiceEditor action={action} onChange={onChange} button={button} />;
    default:
      return null;
  }
}

function TargetPicker({
  target,
  allowThis,
  pages,
  layout,
  onChange,
}: {
  target: ButtonRef | null;
  allowThis?: boolean;
  pages: Page[];
  layout: Layout | null;
  onChange: (t: ButtonRef | null) => void;
}) {
  const { t } = useTranslation();
  const current = target ?? { pageId: null, x: 0, y: 0 };

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-stage-400">
      {allowThis && (
        <div className="flex gap-1 rounded-lg bg-stage-800 p-1">
          <button
            type="button"
            onClick={() => onChange(null)}
            className={"rounded-md px-2 py-1 font-medium " + (target === null ? "bg-stage-600 text-stage-100" : "text-stage-400 hover:text-stage-200")}
          >
            {t("actions.fields.thisButton")}
          </button>
          <button
            type="button"
            onClick={() => onChange(current)}
            className={"rounded-md px-2 py-1 font-medium " + (target !== null ? "bg-stage-600 text-stage-100" : "text-stage-400 hover:text-stage-200")}
          >
            {t("actions.fields.anotherButton")}
          </button>
        </div>
      )}
      {(!allowThis || target !== null) && (
        <>
          <label className="flex items-center gap-1">
            {t("actions.fields.page")}
            <Select
              size="sm"
              value={current.pageId ?? "__same__"}
              options={[{ value: "__same__", label: t("actions.fields.samePage") }, ...pages.map((p) => ({ value: p.id, label: p.name }))]}
              onChange={(v) => onChange({ ...current, pageId: v === "__same__" ? null : v })}
            />
          </label>
          <label className="flex items-center gap-1">
            {t("actions.fields.column")}
            <NumberInput
              value={current.x + 1}
              min={1}
              max={layout?.width ?? 9}
              onChange={(n) => onChange({ ...current, ...clampTarget(n - 1, current.y, layout) })}
              className="w-16"
            />
          </label>
          <label className="flex items-center gap-1">
            {t("actions.fields.row")}
            <NumberInput
              value={current.y + 1}
              min={1}
              max={layout?.height ?? 9}
              onChange={(n) => onChange({ ...current, ...clampTarget(current.x, n - 1, layout) })}
              className="w-16"
            />
          </label>
        </>
      )}
    </div>
  );
}

/** Milliseconds to wait: a number, or a `{{variable}}` expression evaluated when the action runs. */
function DelayEditor({ action, onChange, button }: { action: Extract<Action, { type: "delay" }>; onChange: (action: Action) => void; button?: Parameters<typeof useVariableSuggestions>[0] }) {
  const { t } = useTranslation();
  const suggestions = useVariableSuggestions(button);
  const text = action.msFrom ?? String(action.ms);
  const set = (value: string) => {
    const trimmed = value.trim();
    // A plain number is the number; anything else is an expression, with the last number as the fallback.
    if (/^\d+$/.test(trimmed)) onChange({ ...action, ms: parseInt(trimmed, 10), msFrom: null });
    else onChange({ ...action, msFrom: value });
  };
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-xs text-stage-400">
        {t("actions.fields.ms")}
        <div className="flex w-72">
          <PlaceholderField mono value={text} onChange={set} suggestions={suggestions} placeholder="500" ariaLabel={t("actions.fields.ms")} />
        </div>
      </label>
      <p className="text-xs text-stage-500">{t("actions.fields.msFromHint")}</p>
    </div>
  );
}
