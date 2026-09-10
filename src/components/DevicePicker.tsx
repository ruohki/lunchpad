import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDeviceStore } from "../store/device";
import { api, type DiscoveredLaunchpad, type LaunchpadModel, type ModelInfo } from "../lib/api";
import { Select } from "./Select";
import { Button, IconRefresh, Spinner, Toggle } from "./ui";

export function DevicePicker() {
  const { t } = useTranslation();
  const discovered = useDeviceStore((s) => s.discovered);
  const scanning = useDeviceStore((s) => s.scanning);
  const scanError = useDeviceStore((s) => s.scanError);
  const error = useDeviceStore((s) => s.error);
  const busy = useDeviceStore((s) => s.busy);
  const status = useDeviceStore((s) => s.status);
  const savedDevice = useDeviceStore((s) => s.savedDevice);
  const autoConnect = useDeviceStore((s) => s.autoConnect);
  const scan = useDeviceStore((s) => s.scan);
  const connect = useDeviceStore((s) => s.connect);
  const setAutoConnect = useDeviceStore((s) => s.setAutoConnect);
  const connectVirtual = useDeviceStore((s) => s.connectVirtual);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [virtualModel, setVirtualModel] = useState<LaunchpadModel>(savedDevice?.model ?? "LaunchpadMk2");

  useEffect(() => {
    api
      .listModels()
      .then(setModels)
      .catch(() => setModels([]));
  }, []);

  const connecting = status === "connecting" || busy;

  return (
    <div className="flex h-full items-center justify-center overflow-y-auto p-8">
      <div className="w-full max-w-xl">
        <h1 className="text-2xl font-semibold tracking-tight text-stage-100">{t("picker.title")}</h1>
        <p className="mt-1 max-w-md text-sm text-stage-400">{t("picker.intro")}</p>

        <div className="mt-6 flex items-center justify-between">
          <span className="text-sm text-stage-300">
            {scanning
              ? t("picker.scanning")
              : discovered.length === 0
                ? t("picker.foundNone")
                : t("picker.found", { count: discovered.length })}
          </span>
          <Button size="sm" onClick={() => void scan()} disabled={scanning}>
            {scanning ? <Spinner /> : <IconRefresh />}
            {t("picker.scanAgain")}
          </Button>
        </div>

        <ul className="mt-3 flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {discovered.map((d, i) => (
              <motion.li
                key={`${d.input.name}|${d.output.name}`}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0, transition: { delay: i * 0.05 } }}
                exit={{ opacity: 0, y: -8 }}
              >
                <DeviceRow
                  device={d}
                  remembered={savedDevice?.inputName === d.input.name && savedDevice?.outputName === d.output.name}
                  disabled={connecting}
                  onConnect={() =>
                    void connect({ inputName: d.input.name, outputName: d.output.name, model: d.model, firmware: d.firmware })
                  }
                />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>

        {!scanning && discovered.length === 0 && (
          <div className="mt-3 rounded-xl border border-dashed border-stage-700 p-5 text-sm text-stage-400">
            <p className="text-stage-200">{t("picker.emptyTitle")}</p>
            <p className="mt-2">{t("picker.emptyHint")}</p>
          </div>
        )}

        {(scanError || error) && <p className="mt-3 text-sm text-danger">{scanError ?? error}</p>}

        <div className="mt-4 rounded-xl bg-stage-900/60 px-4 py-3">
          <p className="text-sm text-stage-200">{t("picker.virtualTitle")}</p>
          <p className="mt-1 text-xs text-stage-400">{t("picker.virtualHint")}</p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="flex min-w-48 flex-col gap-1 text-xs text-stage-400">
              {t("picker.virtualLayout")}
              <Select<LaunchpadModel>
                size="sm"
                value={virtualModel}
                options={models.map((m) => ({ value: m.model, label: t(`models.${m.model}`) }))}
                onChange={setVirtualModel}
              />
            </label>
            <Button size="sm" variant="primary" onClick={() => void connectVirtual(virtualModel)} disabled={connecting || models.length === 0}>
              {t("picker.virtualStart")}
            </Button>
          </div>
        </div>

        <div className="mt-8 border-t border-stage-800 pt-5">
          <Toggle
            checked={autoConnect}
            onChange={(v) => void setAutoConnect(v)}
            label={t("picker.autoConnect")}
            hint={
              savedDevice
                ? savedDevice.virtual
                  ? t("picker.autoConnectHintVirtual", { model: t(`models.${savedDevice.model}`) })
                  : t("picker.autoConnectHintSaved", { model: t(`models.${savedDevice.model}`), port: savedDevice.inputName })
                : t("picker.autoConnectHintNew")
            }
          />
        </div>
      </div>
    </div>
  );
}

function DeviceRow({
  device,
  remembered,
  disabled,
  onConnect,
}: {
  device: DiscoveredLaunchpad;
  remembered: boolean;
  disabled: boolean;
  onConnect: () => void;
}) {
  const { t } = useTranslation();
  const identified =
    device.identifiedBy === "deviceInquiry"
      ? device.firmware
        ? t("picker.identifiedByInquiryFirmware", { firmware: device.firmware })
        : t("picker.identifiedByInquiry")
      : t("picker.identifiedByName");

  return (
    <div className="flex items-center gap-4 rounded-xl bg-stage-900 px-4 py-3">
      <ModelGlyph model={device.model} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-stage-100">{t(`models.${device.model}`)}</span>
          {remembered && (
            <span className="rounded-md bg-stage-700 px-1.5 py-0.5 text-[11px] text-stage-200">{t("picker.remembered")}</span>
          )}
        </div>
        <div className="truncate text-xs text-stage-400">
          {device.input.name === device.output.name ? device.input.name : `${device.input.name} → ${device.output.name}`}
        </div>
        <div className="text-xs text-stage-500">{identified}</div>
      </div>
      <Button variant="primary" onClick={onConnect} disabled={disabled}>
        {t("picker.connect")}
      </Button>
    </div>
  );
}

/** Tiny silhouette of the model: a grid with the edge rows the model has. */
function ModelGlyph({ model }: { model: string }) {
  const top = model !== "LaunchpadProMk2";
  const right = true;
  const left = model === "LaunchpadProMk2" || model === "LaunchpadProMk3";
  const bottom = left;
  return (
    <svg viewBox="0 0 40 40" className="h-10 w-10 shrink-0" aria-hidden>
      <rect x="1" y="1" width="38" height="38" rx="5" className="fill-stage-800" />
      {Array.from({ length: 4 }).map((_, r) =>
        Array.from({ length: 4 }).map((_, c) => (
          <rect
            key={`${r}${c}`}
            x={left ? 9 + c * 5.5 : 6 + c * 6}
            y={top ? 10 + r * 5.5 : 6 + r * 6}
            width={left ? 4.5 : 5}
            height={top ? 4.5 : 5}
            rx="1"
            className="fill-stage-500"
          />
        )),
      )}
      {top &&
        Array.from({ length: 4 }).map((_, c) => (
          <circle key={c} cx={(left ? 11.5 : 8.5) + c * (left ? 5.5 : 6)} cy="6" r="1.6" className="fill-stage-600" />
        ))}
      {right &&
        Array.from({ length: 4 }).map((_, r) => (
          <circle key={r} cx="34" cy={(top ? 12.5 : 8.5) + r * (top ? 5.5 : 6)} r="1.6" className="fill-stage-600" />
        ))}
      {left && Array.from({ length: 4 }).map((_, r) => <circle key={r} cx="5" cy={12.5 + r * 5.5} r="1.6" className="fill-stage-600" />)}
      {bottom && Array.from({ length: 4 }).map((_, c) => <circle key={c} cx={11.5 + c * 5.5} cy="35" r="1.6" className="fill-stage-600" />)}
    </svg>
  );
}
