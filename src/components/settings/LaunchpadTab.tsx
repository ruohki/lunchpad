import { useTranslation } from "react-i18next";
import { api } from "../../lib/api";
import { useDeviceStore } from "../../store/device";
import { Button, Field, Toggle } from "../ui";
import { Section } from "./SettingsDialog";
import { Slider } from "../Slider";

export function LaunchpadTab() {
  const { t } = useTranslation();
  const status = useDeviceStore((s) => s.status);
  const device = useDeviceStore((s) => s.device);
  const savedDevice = useDeviceStore((s) => s.savedDevice);
  const autoConnect = useDeviceStore((s) => s.autoConnect);
  const pressFeedback = useDeviceStore((s) => s.pressFeedback);
  const setAutoConnect = useDeviceStore((s) => s.setAutoConnect);
  const setPressFeedback = useDeviceStore((s) => s.setPressFeedback);
  const pressThreshold = useDeviceStore((s) => s.pressThreshold);
  const setPressThreshold = useDeviceStore((s) => s.setPressThreshold);
  const velocitySensitive = useDeviceStore((s) => s.layout?.velocitySensitive ?? false);
  const disconnect = useDeviceStore((s) => s.disconnect);
  const forget = useDeviceStore((s) => s.forget);

  return (
    <>
      <Section title={t("settings.deviceTitle")}>
        {device?.virtual ? (
          <p className="text-sm text-stage-300">{t("settings.virtualDevice", { model: t(`models.${device.model}`) })}</p>
        ) : device ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("side.ports")}>{device.inputName === device.outputName ? device.inputName : `${device.inputName} → ${device.outputName}`}</Field>
            <Field label={t("side.firmware")}>{device.firmware ?? t("side.unknown")}</Field>
          </div>
        ) : savedDevice ? (
          <p className="text-sm text-stage-300">
            {savedDevice.virtual
              ? t("settings.rememberedVirtual", { model: t(`models.${savedDevice.model}`) })
              : t("settings.rememberedOnly", { model: t(`models.${savedDevice.model}`), port: savedDevice.inputName })}
          </p>
        ) : (
          <p className="text-sm text-stage-400">{t("status.disconnected")}</p>
        )}
        <div className="flex flex-wrap gap-2">
          {status === "connected" && (
            <>
              <Button size="sm" onClick={() => void api.resetLeds()}>
                {t("settings.repaint")}
              </Button>
              <Button size="sm" onClick={() => void disconnect()}>
                {t("settings.disconnect")}
              </Button>
            </>
          )}
          {savedDevice && (
            <Button size="sm" variant="danger" onClick={() => void forget()}>
              {t("settings.forget")}
            </Button>
          )}
        </div>
      </Section>

      <Section title={t("settings.behaviourTitle")}>
        <Toggle checked={autoConnect} onChange={(v) => void setAutoConnect(v)} label={t("settings.autoConnect")} hint={t("settings.autoConnectHint")} />
        <Toggle checked={pressFeedback} onChange={(v) => void setPressFeedback(v)} label={t("settings.pressFeedback")} hint={t("settings.pressFeedbackHint")} />
        {velocitySensitive && (
          <div className="flex flex-col gap-3">
            <Toggle checked={pressThreshold !== null} onChange={(v) => void setPressThreshold(v ? 25 : null)} label={t("settings.pressThreshold")} hint={t("settings.pressThresholdHint")} />
            {pressThreshold !== null && (
              <div className="max-w-sm">
                <Slider value={pressThreshold} min={1} max={127} onChange={(v) => void setPressThreshold(v)} format={(v) => `${v}`} ariaLabel={t("settings.pressThreshold")} />
              </div>
            )}
          </div>
        )}
      </Section>
    </>
  );
}
