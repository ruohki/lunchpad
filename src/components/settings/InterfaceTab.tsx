import { useTranslation } from "react-i18next";
import { useSettingsStore } from "../../store/settings";
import { Toggle } from "../ui";
import { Section } from "./SettingsDialog";

const WINDOW_DEFAULTS = { stayOnTop: false, minimizeToTray: false, runAtStartup: false, startHidden: false };

export function InterfaceTab() {
  const { t } = useTranslation();
  const settings = useSettingsStore((s) => s.settings);
  const setDeveloperMode = useSettingsStore((s) => s.setDeveloperMode);
  const setWindow = useSettingsStore((s) => s.setWindow);
  const window = settings?.window ?? WINDOW_DEFAULTS;

  return (
    <>
      <Section title={t("settings.windowTitle")} description={t("settings.windowHint")}>
        <Toggle checked={window.stayOnTop} onChange={(stayOnTop) => void setWindow({ ...window, stayOnTop })} label={t("settings.stayOnTop")} />
        <Toggle checked={window.minimizeToTray} onChange={(minimizeToTray) => void setWindow({ ...window, minimizeToTray })} label={t("settings.minimizeToTray")} hint={t("settings.minimizeToTrayHint")} />
        <Toggle checked={window.runAtStartup} onChange={(runAtStartup) => void setWindow({ ...window, runAtStartup })} label={t("settings.runAtStartup")} hint={t("settings.runAtStartupHint")} />
        <Toggle checked={window.startHidden} onChange={(startHidden) => void setWindow({ ...window, startHidden })} label={t("settings.startHidden")} hint={t("settings.startHiddenHint")} />
      </Section>
      <Section title={t("settings.developerTitle")} description={t("settings.developerHint")}>
        <Toggle checked={settings?.developerMode ?? false} onChange={(v) => void setDeveloperMode(v)} label={t("settings.developerMode")} />
      </Section>
    </>
  );
}
