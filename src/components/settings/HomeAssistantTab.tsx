import { useTranslation } from "react-i18next";
import { useMediaStore } from "../../store/media";
import { useSettingsStore } from "../../store/settings";
import { Button, Toggle } from "../ui";
import { fieldCls, Section } from "./SettingsDialog";

const DEFAULTS = { enabled: false, url: "http://homeassistant.local:8123", token: "", ignoreTlsErrors: false };

export function HomeAssistantTab() {
  const { t } = useTranslation();
  const settings = useSettingsStore((s) => s.settings);
  const setHomeAssistant = useSettingsStore((s) => s.setHomeAssistant);
  const state = useMediaStore((s) => s.homeAssistant);
  const refresh = useMediaStore((s) => s.homeAssistantRefresh);
  const ha = settings?.homeAssistant ?? DEFAULTS;

  return (
    <>
      <Section description={t("settings.haEnableHint")}>
        <Toggle checked={ha.enabled} onChange={(enabled) => void setHomeAssistant({ ...ha, enabled })} label={t("settings.haEnable")} />
      </Section>

      {ha.enabled && (
        <>
          <Section title={t("settings.obsConnection")}>
            <div className="flex max-w-lg flex-col gap-3 text-xs text-stage-400">
              <label className="flex flex-col gap-1">
                {t("settings.haUrl")}
                <input value={ha.url} onChange={(e) => void setHomeAssistant({ ...ha, url: e.target.value })} className={fieldCls} spellCheck={false} placeholder={DEFAULTS.url} />
              </label>
              <label className="flex flex-col gap-1">
                {t("settings.haToken")}
                <input type="password" value={ha.token} onChange={(e) => void setHomeAssistant({ ...ha, token: e.target.value })} className={fieldCls} />
                <span className="text-stage-500">{t("settings.haTokenHint")}</span>
              </label>
            </div>
            <Toggle checked={ha.ignoreTlsErrors} onChange={(ignoreTlsErrors) => void setHomeAssistant({ ...ha, ignoreTlsErrors })} label={t("settings.haIgnoreTls")} />
          </Section>

          <Section title={t("settings.obsStatus")}>
            <div className="flex max-w-lg items-center gap-3 text-sm">
              <span className={"h-2.5 w-2.5 rounded-full " + (state?.connected ? "bg-ok shadow-[0_0_8px_var(--color-ok)]" : "bg-stage-500")} />
              <span className="flex-1 text-stage-300">
                {state?.connected
                  ? t("settings.haStatusConnected", { version: state.version ?? "?", location: state.location ?? "", count: state.entities.length })
                  : state?.error
                    ? t("settings.obsStatusError", { error: state.error })
                    : t("settings.obsStatusDisconnected")}
              </span>
              <Button size="sm" onClick={() => void refresh()}>
                {t("settings.haRefresh")}
              </Button>
            </div>
          </Section>
        </>
      )}
    </>
  );
}
