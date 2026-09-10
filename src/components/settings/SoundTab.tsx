import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useMediaStore } from "../../store/media";
import { useSettingsStore } from "../../store/settings";
import { Select } from "../Select";
import { Button } from "../ui";
import { Section } from "./SettingsDialog";

const SYSTEM_DEFAULT = "__system__";

export function SoundTab() {
  const { t } = useTranslation();
  const settings = useSettingsStore((s) => s.settings);
  const setAudio = useSettingsStore((s) => s.setAudio);
  const audioDevices = useMediaStore((s) => s.audioDevices);
  const loadAudioDevices = useMediaStore((s) => s.loadAudioDevices);

  useEffect(() => {
    void loadAudioDevices().catch(() => undefined);
  }, [loadAudioDevices]);

  return (
    <Section title={t("settings.audioDevice")} description={t("settings.audioDeviceHint")}>
      <div className="flex max-w-lg items-center gap-2">
        <Select
          className="flex-1"
          value={settings?.audio.outputDevice ?? SYSTEM_DEFAULT}
          options={[
            { value: SYSTEM_DEFAULT, label: audioDevices?.default ? `${t("settings.systemDefaultDevice")} (${audioDevices.default})` : t("settings.systemDefaultDevice") },
            ...(audioDevices?.devices ?? []).map((d) => ({ value: d, label: d })),
          ]}
          onChange={(v) => void setAudio({ outputDevice: v === SYSTEM_DEFAULT ? null : v })}
        />
        <Button size="sm" onClick={() => void loadAudioDevices()}>
          {t("settings.refreshDevices")}
        </Button>
      </div>
    </Section>
  );
}
