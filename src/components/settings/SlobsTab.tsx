import { useTranslation } from "react-i18next";
import { useMediaStore } from "../../store/media";
import { useSettingsStore } from "../../store/settings";
import { NumberInput } from "../NumberInput";
import { Button, Toggle } from "../ui";
import { fieldCls, Section } from "./SettingsDialog";

const DEFAULTS = { enabled: false, host: "127.0.0.1", port: 28194, token: "", autoConnect: true };

export function SlobsTab() {
  const { t } = useTranslation();
  const settings = useSettingsStore((s) => s.settings);
  const setSlobs = useSettingsStore((s) => s.setSlobs);
  const state = useMediaStore((s) => s.slobs);
  const connect = useMediaStore((s) => s.slobsConnect);
  const disconnect = useMediaStore((s) => s.slobsDisconnect);
  const slobs = settings?.slobs ?? DEFAULTS;
  const status = (value: string) => t(`slobs.status.${value}`, { defaultValue: value });

  return (
    <>
      <Section description={t("settings.slobsEnableHint")}>
        <Toggle checked={slobs.enabled} onChange={(enabled) => void setSlobs({ ...slobs, enabled })} label={t("settings.slobsEnable")} />
      </Section>

      {slobs.enabled && (
        <>
          <Section title={t("settings.obsConnection")}>
            <div className="grid max-w-lg grid-cols-[1fr_6rem] gap-3 text-xs text-stage-400">
              <label className="flex flex-col gap-1">
                {t("settings.obsHost")}
                <input value={slobs.host} onChange={(e) => void setSlobs({ ...slobs, host: e.target.value })} className={fieldCls} spellCheck={false} />
              </label>
              <label className="flex flex-col gap-1">
                {t("settings.obsPort")}
                <NumberInput value={slobs.port} min={1} max={65535} onChange={(port) => void setSlobs({ ...slobs, port })} className={fieldCls} />
              </label>
              <label className="col-span-2 flex flex-col gap-1">
                {t("settings.slobsToken")}
                <input type="password" value={slobs.token} onChange={(e) => void setSlobs({ ...slobs, token: e.target.value })} className={fieldCls} />
                <span className="text-stage-500">{t("settings.slobsTokenHint")}</span>
              </label>
            </div>
            <Toggle checked={slobs.autoConnect} onChange={(autoConnect) => void setSlobs({ ...slobs, autoConnect })} label={t("settings.obsAutoConnect")} />
          </Section>

          <Section title={t("settings.obsStatus")}>
            <div className="flex max-w-lg items-center gap-3 text-sm">
              <span className={"h-2.5 w-2.5 rounded-full " + (state?.connected ? "bg-ok shadow-[0_0_8px_var(--color-ok)]" : "bg-stage-500")} />
              <span className="flex-1 text-stage-300">
                {state?.connected ? t("settings.obsStatusConnected") : state?.error ? t("settings.obsStatusError", { error: state.error }) : t("settings.obsStatusDisconnected")}
              </span>
              {state?.connected ? (
                <Button size="sm" onClick={() => void disconnect()}>
                  {t("settings.obsDisconnect")}
                </Button>
              ) : (
                <Button size="sm" onClick={() => void connect()}>
                  {t("settings.obsConnect")}
                </Button>
              )}
            </div>
            {state?.connected && (
              <div className="flex flex-col gap-1 text-xs text-stage-500">
                <p>{t("settings.slobsSummary", { scenes: state.scenes.length, sources: state.sources.length, collection: state.currentCollection ?? "" })}</p>
                <p>
                  {t("settings.slobsStatusLine", {
                    streaming: status(state.streaming),
                    recording: status(state.recording),
                    replay: status(state.replayBuffer),
                    studio: state.studioMode ? t("slobs.status.on") : t("slobs.status.off"),
                  })}
                </p>
              </div>
            )}
          </Section>
        </>
      )}
    </>
  );
}
