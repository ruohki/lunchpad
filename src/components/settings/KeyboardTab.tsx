import { useTranslation } from "react-i18next";
import { formatModifier, MODIFIERS } from "../../lib/keys";
import { useSettingsStore } from "../../store/settings";
import { KeyCapture } from "../KeyCapture";
import { Button, Toggle } from "../ui";
import { Section } from "./SettingsDialog";

export function KeyboardTab() {
  const { t } = useTranslation();
  const settings = useSettingsStore((s) => s.settings);
  const setPushToTalk = useSettingsStore((s) => s.setPushToTalk);
  const checkKeyboardAccess = useSettingsStore((s) => s.checkKeyboardAccess);
  const ptt = settings?.pushToTalk ?? { enabled: false, key: "", modifiers: [] };

  return (
    <>
      <Section title={t("settings.pushToTalk")} description={t("settings.pttHint")}>
        <Toggle checked={ptt.enabled} onChange={(enabled) => void setPushToTalk({ ...ptt, enabled })} label={t("settings.pttEnable")} />
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1 text-xs text-stage-400">
            {t("settings.pttKey")}
            <KeyCapture value={{ key: ptt.key, modifiers: ptt.modifiers }} onChange={(next) => void setPushToTalk({ ...ptt, ...next })} />
          </div>
          <div className="flex flex-col gap-1 text-xs text-stage-400">
            {t("settings.pttModifiers")}
            <div className="flex gap-1">
              {MODIFIERS.map((m) => {
                const on = ptt.modifiers.includes(m);
                return (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={on}
                    onClick={() => void setPushToTalk({ ...ptt, modifiers: on ? ptt.modifiers.filter((x) => x !== m) : [...ptt.modifiers, m] })}
                    className={"min-w-9 rounded-md px-2 py-2 font-mono text-sm transition-colors " + (on ? "bg-accent-500 text-stage-950" : "bg-stage-800 text-stage-300 hover:bg-stage-700")}
                  >
                    {formatModifier(m)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Section>

      <Section title={t("settings.checkKeyboard")} description={t("settings.checkKeyboardHint")}>
        <div>
          <Button size="sm" onClick={() => void checkKeyboardAccess()}>
            {t("settings.checkKeyboard")}
          </Button>
        </div>
      </Section>
    </>
  );
}
