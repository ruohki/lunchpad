import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type Action, type SystemVolumeTarget } from "../../lib/api";
import { Select } from "../Select";
import { Button } from "../ui";

type DeviceAction = Extract<Action, { type: "setAudioDevice" }>;

/** Make a device the system default: everything the system plays (or records) goes through it. */
export function AudioDeviceEditor({ action, onChange }: { action: DeviceAction; onChange: (next: Action) => void }) {
  const { t } = useTranslation();
  const [devices, setDevices] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = (target: SystemVolumeTarget) => {
    setError(null);
    api
      .listSystemAudioDevices(target)
      .then(setDevices)
      .catch((e) => {
        setDevices([]);
        setError(String(e));
      });
  };
  useEffect(() => load(action.target), [action.target]);

  const list = devices ?? [];
  const options = [...list.map((d) => ({ value: d, label: d })), ...(action.device && !list.includes(action.device) ? [{ value: action.device, label: t("sound.missingDevice", { name: action.device }) }] : [])];

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[10rem_1fr_auto] items-end gap-3">
        <div className="flex flex-col gap-1 text-xs text-stage-400">
          {t("volume.target")}
          <Select<SystemVolumeTarget>
            size="sm"
            value={action.target}
            options={[
              { value: "output", label: t("volume.targets.output") },
              { value: "input", label: t("volume.targets.input") },
            ]}
            onChange={(target) => onChange({ ...action, target, device: "" })}
          />
        </div>
        <div className="flex flex-col gap-1 text-xs text-stage-400">
          {t("audioDevice.device")}
          <Select size="sm" value={action.device || null} options={options} onChange={(device) => onChange({ ...action, device })} placeholder={devices === null ? t("sound.analyzing") : t("audioDevice.pick")} />
        </div>
        <Button size="sm" onClick={() => load(action.target)}>
          {t("settings.refreshDevices")}
        </Button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <p className="text-xs text-stage-500">{t("audioDevice.hint")}</p>
    </div>
  );
}
