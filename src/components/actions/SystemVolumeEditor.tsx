import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, SYSTEM_VOLUME_MODES, type Action, type Button, type SystemVolumeMode, type SystemVolumeTarget } from "../../lib/api";
import { Select } from "../Select";
import { Slider } from "../Slider";
import { useVariableSuggestions } from "./VariableFields";
import { VariableNameField } from "./VariableNameField";

/** Volume or mute of the speakers or the microphone: a level, a step, or a mute, fixed or from a variable. */
export function SystemVolumeEditor({ action, onChange, button }: { action: Action; onChange: (next: Action) => void; button: Button }) {
  const { t } = useTranslation();
  const suggestions = useVariableSuggestions(button);
  const target = action.type === "setSystemVolume" ? action.target : "output";
  const [devices, setDevices] = useState<string[]>([]);
  useEffect(() => {
    let live = true;
    api
      .listSystemAudioDevices(target)
      .then((list) => {
        if (live) setDevices(list);
      })
      .catch(() => {
        if (live) setDevices([]);
      });
    return () => {
      live = false;
    };
  }, [target]);
  if (action.type !== "setSystemVolume") return null;
  const withLevel = action.mode === "set" || action.mode === "adjust";
  const chosen = action.device ?? "";
  const deviceOptions = [
    { value: "", label: t("volume.defaultDevice") },
    ...devices.map((d) => ({ value: d, label: d })),
    ...(chosen && !devices.includes(chosen) ? [{ value: chosen, label: t("sound.missingDevice", { name: chosen }) }] : []),
  ];
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1 text-xs text-stage-400">
          {t("volume.target")}
          <Select<SystemVolumeTarget>
            size="sm"
            value={action.target}
            options={[
              { value: "output", label: t("volume.targets.output") },
              { value: "input", label: t("volume.targets.input") },
            ]}
            onChange={(target) => onChange({ ...action, target, device: null })}
          />
        </div>
        <div className="flex flex-col gap-1 text-xs text-stage-400">
          {t("volume.device")}
          <Select size="sm" value={chosen} options={deviceOptions} onChange={(device) => onChange({ ...action, device: device || null })} />
        </div>
        <div className="flex flex-col gap-1 text-xs text-stage-400">
          {t("volume.mode")}
          <Select<SystemVolumeMode>
            size="sm"
            value={action.mode}
            options={SYSTEM_VOLUME_MODES.map((m) => ({ value: m, label: t(`volume.modes.${m}`) }))}
            onChange={(mode) => onChange({ ...action, mode, volume: mode === "adjust" ? Math.max(-100, Math.min(100, action.volume > 50 ? 5 : action.volume)) : Math.max(0, action.volume) })}
          />
        </div>
      </div>
      {withLevel && (
        <>
          <div className="grid grid-cols-[1fr_auto] items-end gap-3">
            <div className={"flex flex-col gap-1 text-xs text-stage-400 " + (action.volumeFrom ? "opacity-50" : "")}>
              {action.mode === "adjust" ? t("volume.step") : t("volume.level")}
              {action.mode === "adjust" ? (
                <Slider value={Math.round(action.volume)} min={-50} max={50} onChange={(volume) => onChange({ ...action, volume })} format={(v) => `${v >= 0 ? "+" : ""}${v} %`} ariaLabel={t("volume.step")} />
              ) : (
                <Slider value={Math.round(action.volume)} min={0} max={100} onChange={(volume) => onChange({ ...action, volume })} format={(v) => `${v} %`} ariaLabel={t("volume.level")} />
              )}
            </div>
            <div className="flex w-48 flex-col gap-1 text-xs text-stage-400">
              {t("volume.fromVariable")}
              <VariableNameField value={action.volumeFrom ?? ""} onChange={(v) => onChange({ ...action, volumeFrom: v || null })} suggestions={suggestions} placeholder={t("volume.fromPlaceholder")} />
            </div>
          </div>
          <p className="text-xs text-stage-500">{action.mode === "adjust" ? t("volume.adjustHint") : t("volume.hint")}</p>
        </>
      )}
      {!withLevel && <p className="text-xs text-stage-500">{t("volume.muteHint")}</p>}
    </div>
  );
}
