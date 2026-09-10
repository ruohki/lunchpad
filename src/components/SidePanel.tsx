import { useTranslation } from "react-i18next";
import type { Layout } from "../lib/api";
import { useDeviceStore } from "../store/device";
import { useProfileStore } from "../store/profile";
import { useVariablesStore } from "../store/variables";
import { Button, Field } from "./ui";
import { Tooltip } from "./Tooltip";

interface Props {
  layout: Layout;
}

const isMac = navigator.platform.toLowerCase().includes("mac");

export function SidePanel({ layout }: Props) {
  const { t } = useTranslation();
  const device = useDeviceStore((s) => s.device);
  const preview = device?.virtual ?? false;
  const lastButton = useDeviceStore((s) => s.lastButton);
  const lastPressure = useDeviceStore((s) => s.lastPressure);
  const midiLog = useDeviceStore((s) => s.midiLog);
  const clearLog = useDeviceStore((s) => s.clearLog);
  const disconnect = useDeviceStore((s) => s.disconnect);
  const page = useProfileStore((s) => s.activePage());
  const globals = useVariablesStore((s) => s.globals);
  const globalNames = Object.keys(globals).sort();

  const padCount = layout.pads.filter((p) => p.shape !== "empty" && p.shape !== "logo").length;

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-l border-stage-800">
      <section className="flex flex-col gap-3 p-4">
        <h2 className="text-sm font-semibold text-stage-100">{t(`models.${layout.model}`)}</h2>
        {preview ? (
          <>
            <p className="text-xs text-stage-400">{t("side.previewNote")}</p>
            <Button size="sm" onClick={() => void disconnect()}>
              {t("side.backToDevices")}
            </Button>
          </>
        ) : (
          <>
            <Field label={t("side.firmware")}>{device?.firmware ?? t("side.unknown")}</Field>
            <Field label={t("side.ports")}>
              {device?.inputName === device?.outputName ? device?.inputName : `${device?.inputName} → ${device?.outputName}`}
            </Field>
          </>
        )}
        <Field label={t("side.buttons")}>
          {t("side.gridSummary", { count: padCount, width: layout.width, height: layout.height })},{" "}
          {layout.limitedColor ? t("side.redGreenLeds") : t("side.rgbLeds")}
        </Field>
        {page && (
          <Field label={t("side.thisPage")}>
            {t("side.configured", { buttons: t("common.button", { count: page.buttons.length }) })}
          </Field>
        )}
      </section>

      <section className="border-t border-stage-800 p-4 text-xs text-stage-400">
        <p>{t("side.hintEdit")}</p>
        <p className="mt-1">{t("side.hintDrag", { move: isMac ? "⌘" : "Ctrl", copy: isMac ? "⇧" : "Shift" })}</p>
      </section>

      {globalNames.length > 0 && (
        <section className="border-t border-stage-800 p-4">
          <h3 className="text-xs text-stage-400">{t("side.variables")}</h3>
          <ul className="mt-1 max-h-32 overflow-y-auto font-mono text-[11px]">
            {globalNames.map((name) => (
              <li key={name} className="flex justify-between gap-3 py-0.5">
                <span className="text-stage-300">{name}</span>
                <Tooltip content={globals[name]}>
                  <span className="truncate text-stage-500">{globals[name]}</span>
                </Tooltip>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!preview && (
        <>
          <section className="border-t border-stage-800 p-4">
            <h3 className="text-xs text-stage-400">{t("side.lastPress")}</h3>
            {lastButton ? (
              <p className="mt-1 text-sm text-stage-100">
                {t("side.atPosition", {
                  state: lastButton.pressed ? t("side.down") : t("side.up"),
                  column: lastButton.x + 1,
                  row: lastButton.y + 1,
                })}
                <span className="ml-2 font-mono text-xs text-stage-400">
                  {lastButton.cc ? "CC" : "Note"} {lastButton.note}
                  {lastPressure && lastPressure.x === lastButton.x && lastPressure.y === lastButton.y && ` · ${t("side.pressure", { value: lastPressure.value })}`}
                  {lastButton.pressed && lastButton.value < 127 ? ` ${t("side.velocity", { value: lastButton.value })}` : ""}
                </span>
              </p>
            ) : (
              <p className="mt-1 text-sm text-stage-400">{t("side.pressHint")}</p>
            )}
          </section>

          <section className="flex min-h-0 flex-1 flex-col border-t border-stage-800">
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
              <h3 className="text-xs text-stage-400">{t("side.midiMonitor")}</h3>
              <Button size="sm" onClick={clearLog} disabled={midiLog.length === 0}>
                {t("common.clear")}
              </Button>
            </div>
            <ul className="min-h-0 flex-1 overflow-y-auto px-4 pb-3 font-mono text-[11px]">
              {midiLog.length === 0 && <li className="text-stage-500">{t("side.nothingReceived")}</li>}
              {midiLog.map((entry) => (
                <li key={entry.id} className="flex justify-between gap-3 py-0.5">
                  <span className="truncate text-stage-300">{entry.description}</span>
                  <span className="shrink-0 text-stage-500">{entry.hex}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </aside>
  );
}
