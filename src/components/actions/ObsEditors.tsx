import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { Action, ActionType, Button, MuteMode, ObsMode, ObsTarget, StudioMode, VisibilityMode, VolumeUnit } from "../../lib/api";
import { useVariableSuggestions } from "./VariableFields";
import { VariableNameField } from "./VariableNameField";
import { useMediaStore } from "../../store/media";
import { Select } from "../Select";
import { Slider } from "../Slider";
import { Toggle } from "../ui";

const CURRENT = "__current__";
const inputCls = "rounded-md bg-stage-800 px-2.5 py-1.5 text-sm text-stage-100 outline-none placeholder:text-stage-500 focus:ring-1 focus:ring-accent-400";

/** The streaming app an action talks to: OBS Studio or Streamlabs Desktop. */
export type Provider = "obs" | "slobs";

export const providerOf = (type: ActionType): Provider => (type.startsWith("slobs") ? "slobs" : "obs");

/** One shape over both integrations' cached lists, so the editors do not care which app it is. */
export interface ProviderView {
  name: string;
  loaded: boolean;
  connected: boolean;
  collections: string[];
  scenes: string[];
  /** everything a scene can show */
  sources: string[];
  /** what the mixer shows */
  audioSources: string[];
  /** what can carry filters */
  filterable: string[];
  filters: Record<string, string[]>;
  load: () => Promise<void>;
  refresh: () => Promise<void>;
  loadFilters: (source: string) => Promise<string[]>;
}

const NONE: string[] = [];

export function useProviderView(provider: Provider): ProviderView {
  const { t } = useTranslation();
  const obs = useMediaStore((s) => s.obs);
  const slobs = useMediaStore((s) => s.slobs);
  const filters = useMediaStore((s) => s.filters);
  const slobsFilters = useMediaStore((s) => s.slobsFilters);
  const loadObs = useMediaStore((s) => s.loadObs);
  const loadSlobs = useMediaStore((s) => s.loadSlobs);
  const obsRefresh = useMediaStore((s) => s.obsRefresh);
  const slobsRefresh = useMediaStore((s) => s.slobsRefresh);
  const loadFilters = useMediaStore((s) => s.loadFilters);
  const loadSlobsFilters = useMediaStore((s) => s.loadSlobsFilters);

  if (provider === "slobs") {
    return {
      name: t("integrations.slobs"),
      loaded: slobs !== null,
      connected: !!slobs?.connected,
      collections: slobs?.collections ?? NONE,
      scenes: slobs?.scenes ?? NONE,
      sources: slobs?.sources ?? NONE,
      audioSources: slobs?.audioSources ?? NONE,
      filterable: slobs?.sources ?? NONE,
      filters: slobsFilters,
      load: loadSlobs,
      refresh: slobsRefresh,
      loadFilters: loadSlobsFilters,
    };
  }
  return {
    name: t("integrations.obs"),
    loaded: obs !== null,
    connected: !!obs?.connected,
    collections: obs?.collections ?? NONE,
    scenes: obs?.scenes ?? NONE,
    sources: obs?.inputs ?? NONE,
    audioSources: obs?.inputs ?? NONE,
    filterable: obs ? [...obs.inputs, ...obs.scenes] : NONE,
    filters,
    load: loadObs,
    refresh: obsRefresh,
    loadFilters,
  };
}

/** Select from a list, keeping an unknown saved value selectable, with a text fallback while the app is offline. */
export function NamePicker({ label, value, list, onChange, allowEmpty, view }: { label: string; value: string; list: string[]; onChange: (v: string) => void; allowEmpty?: string; view: ProviderView }) {
  const { t } = useTranslation();
  if (!view.connected && list.length === 0) {
    return (
      <label className="flex flex-col gap-1 text-xs text-stage-400">
        {label}
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={t("obs.offlinePlaceholder", { app: view.name })} className={inputCls} />
      </label>
    );
  }
  const options = [
    ...(allowEmpty ? [{ value: CURRENT, label: allowEmpty }] : []),
    ...list.map((n) => ({ value: n, label: n })),
    ...(value && !list.includes(value) ? [{ value, label: t("obs.missing", { name: value, app: view.name }) }] : []),
  ];
  return (
    <div className="flex flex-col gap-1 text-xs text-stage-400">
      {label}
      <Select size="sm" value={value || (allowEmpty ? CURRENT : null)} options={options} onChange={(v) => onChange(v === CURRENT ? "" : v)} placeholder={t("obs.pick")} />
    </div>
  );
}

export function ProviderStatus({ view }: { view: ProviderView }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2 text-xs text-stage-500">
      <span className={"h-2 w-2 rounded-full " + (view.connected ? "bg-ok" : "bg-stage-500")} />
      {view.connected ? t("obs.connected", { app: view.name }) : t("obs.notConnected", { app: view.name })}
      {view.connected && (
        <button type="button" onClick={() => void view.refresh()} className="rounded px-1.5 py-0.5 text-stage-400 hover:bg-stage-700 hover:text-stage-100">
          {t("obs.reload")}
        </button>
      )}
    </div>
  );
}

/** Editor for the OBS Studio and Streamlabs Desktop actions (same fields, different lists). */
export function ObsEditor({ action, onChange, button }: { action: Action; onChange: (next: Action) => void; button?: Button }) {
  const { t } = useTranslation();
  const suggestions = useVariableSuggestions(button);
  const view = useProviderView(providerOf(action.type));
  const { loaded, connected, filters, load, loadFilters } = view;

  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  const source = action.type === "obsToggleFilter" || action.type === "slobsToggleFilter" ? action.source : "";
  useEffect(() => {
    if (source && connected && !filters[source]) void loadFilters(source);
  }, [source, connected, filters, loadFilters]);

  let body: React.ReactNode = null;
  switch (action.type) {
    case "obsSwitchScene":
    case "slobsSwitchScene":
      body = (
        <div className="grid grid-cols-2 gap-3">
          <NamePicker view={view} label={t("obs.collection")} value={action.collection} list={view.collections} onChange={(collection) => onChange({ ...action, collection })} allowEmpty={t("obs.currentCollection")} />
          <NamePicker view={view} label={t("obs.scene")} value={action.scene} list={view.scenes} onChange={(scene) => onChange({ ...action, scene })} />
        </div>
      );
      break;
    case "obsToggleSource":
    case "slobsToggleSource":
      body = (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <NamePicker view={view} label={t("obs.scene")} value={action.scene} list={view.scenes} onChange={(scene) => onChange({ ...action, scene })} />
            <NamePicker view={view} label={t("obs.source")} value={action.source} list={view.sources} onChange={(source) => onChange({ ...action, source })} />
          </div>
          <div className="flex max-w-xs flex-col gap-1 text-xs text-stage-400">
            {t("obs.visibility")}
            <Select<VisibilityMode>
              size="sm"
              value={action.mode ?? (action.visible ? "show" : "hide")}
              options={[
                { value: "show", label: t("obs.visibilityModes.show") },
                { value: "hide", label: t("obs.visibilityModes.hide") },
                { value: "toggle", label: t("obs.visibilityModes.toggle") },
              ]}
              onChange={(mode) => onChange({ ...action, mode, visible: mode !== "hide" })}
            />
          </div>
        </div>
      );
      break;
    case "obsSetAudio":
    case "slobsSetAudio":
      body = (
        <div className="flex flex-col gap-3">
          <NamePicker view={view} label={t("obs.source")} value={action.source} list={view.audioSources} onChange={(source) => onChange({ ...action, source })} />
          <div className="grid grid-cols-[10rem_8rem_1fr] items-end gap-4">
            <div className="flex flex-col gap-1 text-xs text-stage-400">
              {t("obs.muted")}
              <Select<MuteMode>
                size="sm"
                value={action.muteMode ?? (action.muted ? "mute" : "unmute")}
                options={[
                  { value: "keep", label: t("obs.muteModes.keep") },
                  { value: "mute", label: t("obs.muteModes.mute") },
                  { value: "unmute", label: t("obs.muteModes.unmute") },
                  { value: "toggle", label: t("obs.muteModes.toggle") },
                ]}
                onChange={(muteMode) => onChange({ ...action, muteMode, muted: muteMode === "mute" })}
              />
            </div>
            <div className={"flex flex-col gap-1 text-xs text-stage-400 " + (action.setVolume ? "" : "opacity-40")}>
              {t("obs.volumeUnit")}
              <Select<VolumeUnit>
                size="sm"
                value={action.volumeUnit ?? "db"}
                options={[
                  { value: "db", label: t("obs.units.db") },
                  { value: "percent", label: t("obs.units.percent") },
                ]}
                onChange={(volumeUnit) =>
                  onChange({
                    ...action,
                    volumeUnit,
                    // Keep the same loudness when switching the scale.
                    volumeDb: volumeUnit === "percent" ? Math.round(100 * Math.pow(10, Math.min(0, action.volumeDb) / 20)) : Math.max(-100, Math.round(20 * Math.log10(Math.max(0.01, action.volumeDb) / 100))),
                  })
                }
              />
            </div>
            <div className={"flex flex-col gap-1 text-xs text-stage-400 " + (action.volumeFrom || !action.setVolume ? "opacity-50" : "")}>
              {t("obs.volumeDb")}
              {action.volumeUnit === "percent" ? (
                <Slider value={Math.round(action.volumeDb)} min={0} max={100} onChange={(volumeDb) => onChange({ ...action, volumeDb })} format={(v) => `${v} %`} />
              ) : (
                <Slider value={Math.round(action.volumeDb)} min={-100} max={0} onChange={(volumeDb) => onChange({ ...action, volumeDb })} format={(v) => `${v} dB`} />
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <Toggle checked={action.setVolume} onChange={(setVolume) => onChange({ ...action, setVolume })} label={t("obs.setVolume")} />
            {action.setVolume && (
              <div className="flex w-64 flex-col gap-1 text-xs text-stage-400">
                {t("obs.volumeFrom", { unit: action.volumeUnit === "percent" ? "%" : "dB" })}
                <VariableNameField value={action.volumeFrom ?? ""} onChange={(v) => onChange({ ...action, volumeFrom: v || null })} suggestions={suggestions} placeholder={t("volume.fromPlaceholder")} />
              </div>
            )}
          </div>
          <p className="text-xs text-stage-500">{action.type === "obsSetAudio" ? t("obs.unitHintObs") : t("obs.unitHintSlobs")}</p>
        </div>
      );
      break;
    case "obsToggleFilter":
    case "slobsToggleFilter":
      body = (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <NamePicker view={view} label={t("obs.source")} value={action.source} list={view.filterable} onChange={(source) => onChange({ ...action, source, filter: "" })} />
            <NamePicker view={view} label={t("obs.filter")} value={action.filter} list={filters[action.source] ?? NONE} onChange={(filter) => onChange({ ...action, filter })} />
          </div>
          <Toggle checked={action.enabled} onChange={(enabled) => onChange({ ...action, enabled })} label={t("obs.filterEnabled")} />
        </div>
      );
      break;
    case "obsStream":
    case "slobsStream":
      body = (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1 text-xs text-stage-400">
            {t("obs.target")}
            <Select<ObsTarget>
              size="sm"
              value={action.target}
              options={[
                { value: "stream", label: t("obs.targets.stream") },
                { value: "record", label: t("obs.targets.record") },
                { value: "replay", label: t("obs.targets.replay") },
              ]}
              onChange={(target) => onChange({ ...action, target })}
            />
          </div>
          <div className="flex flex-col gap-1 text-xs text-stage-400">
            {t("obs.mode")}
            <Select<ObsMode>
              size="sm"
              value={action.mode}
              options={[
                { value: "start", label: t("obs.modes.start") },
                { value: "stop", label: t("obs.modes.stop") },
                { value: "toggle", label: t("obs.modes.toggle") },
              ]}
              onChange={(mode) => onChange({ ...action, mode })}
            />
          </div>
        </div>
      );
      break;
    case "obsStudioMode":
    case "slobsStudioMode":
      body = (
        <div className="flex flex-col gap-1 text-xs text-stage-400">
          {t("obs.studio.label")}
          <div className="max-w-xs">
            <Select<StudioMode>
              size="sm"
              value={action.mode}
              options={[
                { value: "enable", label: t("obs.studio.enable") },
                { value: "disable", label: t("obs.studio.disable") },
                { value: "toggle", label: t("obs.studio.toggle") },
                { value: "transition", label: t("obs.studio.transition") },
              ]}
              onChange={(mode) => onChange({ ...action, mode })}
            />
          </div>
          <p className="text-xs text-stage-500">{t("obs.studio.hint")}</p>
        </div>
      );
      break;
    default:
      body = null;
  }

  return (
    <div className="flex flex-col gap-3">
      {body}
      <ProviderStatus view={view} />
    </div>
  );
}
