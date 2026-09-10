import { useTranslation } from "react-i18next";
import { useMediaStore } from "../../store/media";
import { useSettingsStore } from "../../store/settings";
import { Button, Toggle } from "../ui";
import { fieldCls, Section } from "./SettingsDialog";

export function ObsTab() {
  const { t } = useTranslation();
  const settings = useSettingsStore((s) => s.settings);
  const setObs = useSettingsStore((s) => s.setObs);
  const obsState = useMediaStore((s) => s.obs);
  const obsConnect = useMediaStore((s) => s.obsConnect);
  const obsDisconnect = useMediaStore((s) => s.obsDisconnect);
  const obs = settings?.obs ?? { enabled: false, host: "localhost", port: 4455, password: "", autoConnect: true };

  return (
    <>
      <Section description={t("settings.obsEnableHint")}>
        <Toggle checked={obs.enabled} onChange={(enabled) => void setObs({ ...obs, enabled })} label={t("settings.obsEnable")} />
      </Section>

      {obs.enabled && (
        <>
          <Section title={t("settings.obsConnection")}>
            <div className="grid max-w-lg grid-cols-[1fr_6rem] gap-3 text-xs text-stage-400">
              <label className="flex flex-col gap-1">
                {t("settings.obsHost")}
                <input value={obs.host} onChange={(e) => void setObs({ ...obs, host: e.target.value })} className={fieldCls} spellCheck={false} />
              </label>
              <label className="flex flex-col gap-1">
                {t("settings.obsPort")}
                <input
                  value={obs.port}
                  inputMode="numeric"
                  onChange={(e) => void setObs({ ...obs, port: Math.max(1, Math.min(65535, parseInt(e.target.value.replace(/[^0-9]/g, ""), 10) || 4455)) })}
                  className={fieldCls}
                />
              </label>
              <label className="col-span-2 flex flex-col gap-1">
                {t("settings.obsPassword")}
                <input type="password" value={obs.password} onChange={(e) => void setObs({ ...obs, password: e.target.value })} className={fieldCls} />
              </label>
            </div>
            <Toggle checked={obs.autoConnect} onChange={(autoConnect) => void setObs({ ...obs, autoConnect })} label={t("settings.obsAutoConnect")} />
          </Section>

          <Section title={t("settings.obsStatus")}>
            <div className="flex max-w-lg items-center gap-3 text-sm">
              <span className={"h-2.5 w-2.5 rounded-full " + (obsState?.connected ? "bg-ok shadow-[0_0_8px_var(--color-ok)]" : "bg-stage-500")} />
              <span className="flex-1 text-stage-300">
                {obsState?.connected ? t("settings.obsStatusConnected") : obsState?.error ? t("settings.obsStatusError", { error: obsState.error }) : t("settings.obsStatusDisconnected")}
              </span>
              {obsState?.connected ? (
                <Button size="sm" onClick={() => void obsDisconnect()}>
                  {t("settings.obsDisconnect")}
                </Button>
              ) : (
                <Button size="sm" onClick={() => void obsConnect()}>
                  {t("settings.obsConnect")}
                </Button>
              )}
            </div>
            {obsState?.connected && (
              <p className="text-xs text-stage-500">
                {t("settings.obsSummary", { scenes: obsState.scenes.length, inputs: obsState.inputs.length, collection: obsState.currentCollection ?? "" })}
              </p>
            )}
          </Section>
        </>
      )}
    </>
  );
}
