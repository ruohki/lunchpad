import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type Diagnostics } from "../../lib/api";
import { Button } from "../ui";
import { Section } from "./SettingsDialog";

/** Plain-text report for bug reports; English on purpose so it reads the same everywhere. */
function report(d: Diagnostics): string {
  const yn = (v: boolean) => (v ? "yes" : "no");
  const list = (items: string[]) => (items.length ? items.map((i) => `  - ${i}`).join("\n") : "  (none)");
  const device =
    d.device.status === "connected"
      ? d.device.isVirtual
        ? `on-screen ${d.device.model}`
        : `${d.device.model} (in: ${d.device.input}, out: ${d.device.output}, firmware ${d.device.firmware ?? "unknown"})`
      : `${d.device.status}${d.device.error ? ` (${d.device.error})` : ""}`;
  return [
    `Lunchpad ${d.appVersion} (Tauri ${d.tauriVersion}, WebView ${d.webviewVersion ?? "unknown"})`,
    `OS: ${d.os.name} ${d.os.version} (${d.os.arch})`,
    `Config: ${d.configDir}`,
    `Logs: ${d.logDir || "(none)"}`,
    "",
    `Launchpad: ${device}`,
    `Remembered: ${d.device.remembered ?? "none"}; auto-connect: ${yn(d.device.autoConnect)}`,
    `MIDI inputs:${d.midiError ? ` ${d.midiError}` : ""}`,
    list(d.midiInputs),
    "MIDI outputs:",
    list(d.midiOutputs),
    "",
    `Audio devices (default: ${d.audio.defaultDevice ?? "unknown"}; configured: ${d.audio.configured ?? "system default"}):`,
    list(d.audio.devices),
    "",
    ...d.integrations.map((i) => `${i.name}: ${i.enabled ? "enabled" : "disabled"}, ${i.endpoint}, ${i.connected ? "connected" : "not connected"}${i.error ? ` (${i.error})` : ""}`),
    "",
    `Profile: ${d.profile.pages} pages, ${d.profile.buttons} buttons, ${d.profile.actions} actions`,
    `Settings: developer mode ${yn(d.settings.developerMode)}, push-to-talk ${d.settings.pushToTalk ?? "off"}, stay on top ${yn(d.settings.stayOnTop)}, minimize to tray ${yn(d.settings.minimizeToTray)}, run at startup ${yn(d.settings.runAtStartup)}`,
  ].join("\n");
}

export function DiagnosticsTab() {
  const { t } = useTranslation();
  const [data, setData] = useState<Diagnostics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api.diagnostics());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const text = data ? report(data) : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked: the report below stays selectable.
    }
  };

  return (
    <Section title={t("diagnostics.title")} description={t("diagnostics.hint")}>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => void load()} disabled={loading}>
          {t("diagnostics.refresh")}
        </Button>
        <Button size="sm" variant="primary" onClick={() => void copy()} disabled={!data}>
          {copied ? t("diagnostics.copied") : t("diagnostics.copy")}
        </Button>
        <Button size="sm" onClick={() => void api.openLogDir().catch(() => undefined)} disabled={!data?.logDir}>
          {t("diagnostics.openLogs")}
        </Button>
      </div>
      {error && <p className="text-sm text-danger">{t("diagnostics.failed", { error })}</p>}
      <pre className="max-w-full select-text overflow-x-auto whitespace-pre-wrap rounded-lg bg-stage-950 p-3 font-mono text-[11px] leading-relaxed text-stage-300">
        {loading && !data ? t("diagnostics.loading") : text}
      </pre>
    </Section>
  );
}
