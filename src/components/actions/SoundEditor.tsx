import { open } from "@tauri-apps/plugin-dialog";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type Action, type AudioInfo, type Button as ButtonModel } from "../../lib/api";
import { useDeviceStore } from "../../store/device";
import { useMediaStore } from "../../store/media";
import { Select } from "../Select";
import { Slider } from "../Slider";
import { Button, Toggle } from "../ui";
import { Tooltip } from "../Tooltip";
import { useProfileStore } from "../../store/profile";
import { PlaceholderField } from "./PlaceholderField";
import { useVariableSuggestions } from "./VariableFields";

type SoundAction = Extract<Action, { type: "playSound" }>;

const DEFAULT_DEVICE = "__default__";

export function SoundEditor({ action, onChange, button }: { action: SoundAction; onChange: (next: Action) => void; button?: ButtonModel }) {
  const { t } = useTranslation();
  const suggestions = useVariableSuggestions(button);
  const isMissing = useProfileStore((s) => !!action.file && s.missingFiles.includes(action.file));
  const velocitySensitive = useDeviceStore((s) => s.layout?.velocitySensitive ?? false);
  const audioDevices = useMediaStore((s) => s.audioDevices);
  const loadAudioDevices = useMediaStore((s) => s.loadAudioDevices);
  const [info, setInfo] = useState<AudioInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState<number | null>(null);
  const [name, setName] = useState("");
  // The path comes from a variable (an HTTP request's file, say): no waveform, trim or preview.
  const [manual, setManual] = useState(false);
  const dynamic = manual || action.file.includes("{{");

  useEffect(() => {
    if (!audioDevices) void loadAudioDevices().catch(() => undefined);
  }, [audioDevices, loadAudioDevices]);

  useEffect(() => {
    let cancelled = false;
    setInfo(null);
    setError(null);
    if (!action.file || dynamic) {
      setName("");
      return;
    }
    void api.fileName(action.file).then((n) => !cancelled && setName(n));
    api
      .analyzeAudio(action.file, 160)
      .then((i) => !cancelled && setInfo(i))
      .catch((e) => !cancelled && setError(String(e)));
    return () => {
      cancelled = true;
    };
  }, [action.file, dynamic]);

  const pickFile = async () => {
    const path = await open({
      multiple: false,
      directory: false,
      filters: [{ name: t("sound.files"), extensions: ["mp3", "wav", "flac", "ogg", "oga", "m4a", "aac", "aiff", "aif"] }],
    });
    if (typeof path === "string") {
      setManual(false);
      onChange({ ...action, file: path, start: 0, end: 1 });
    }
  };

  const useVariable = () => {
    setManual(true);
    onChange({ ...action, file: "", start: 0, end: 1 });
  };

  const preview = async () => {
    if (playing !== null) {
      await api.stopSound(playing).catch(() => undefined);
      setPlaying(null);
      return;
    }
    try {
      const id = await api.previewSound({ file: action.file, outputDevice: action.outputDevice, volume: action.volume, start: action.start, end: action.end });
      setPlaying(id);
      const secs = info ? info.durationSecs * (action.end - action.start) : 3;
      window.setTimeout(() => setPlaying((p) => (p === id ? null : p)), secs * 1000 + 200);
    } catch (e) {
      setError(String(e));
    }
  };

  const deviceOptions = [
    { value: DEFAULT_DEVICE, label: t("sound.defaultDevice") },
    ...(audioDevices?.devices ?? []).map((d) => ({ value: d, label: d === audioDevices?.default ? t("sound.systemDefault", { name: d }) : d })),
    ...(action.outputDevice && !(audioDevices?.devices ?? []).includes(action.outputDevice)
      ? [{ value: action.outputDevice, label: t("sound.missingDevice", { name: action.outputDevice }) }]
      : []),
  ];

  return (
    <div className="flex flex-col gap-3">
      {dynamic ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <PlaceholderField mono value={action.file} onChange={(file) => onChange({ ...action, file })} suggestions={suggestions} placeholder="{{tts.file}}" ariaLabel={t("sound.path")} />
            <Button size="sm" onClick={() => void pickFile()}>
              {t("sound.choose")}
            </Button>
          </div>
          <p className="text-xs text-stage-500">{t("sound.usePlaceholderHint")}</p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => void pickFile()}>
            {t("sound.choose")}
          </Button>
          <Button size="sm" onClick={useVariable}>
            {t("sound.usePlaceholder")}
          </Button>
          <Tooltip content={action.file}>
            <span className={"min-w-0 flex-1 truncate text-sm " + (isMissing ? "text-danger" : "text-stage-200")}>
              {name || t("sound.noFile")}
              {isMissing && <span className="ml-2 text-xs">{t("sound.missing")}</span>}
            </span>
          </Tooltip>
          <Button size="sm" onClick={() => void preview()} disabled={!action.file}>
            {playing !== null ? t("sound.stop") : t("sound.preview")}
          </Button>
        </div>
      )}

      {error && <p className="text-xs text-danger">{error}</p>}

      {action.file && !dynamic && (
        <Trimmer
          info={info}
          start={action.start}
          end={action.end}
          onChange={(start, end) => onChange({ ...action, start, end })}
        />
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1 text-xs text-stage-400">
          {t("sound.device")}
          <Select
            size="sm"
            value={action.outputDevice ?? DEFAULT_DEVICE}
            options={deviceOptions}
            onChange={(v) => onChange({ ...action, outputDevice: v === DEFAULT_DEVICE ? null : v })}
          />
        </div>
        <div className="flex flex-col gap-1 text-xs text-stage-400">
          {t("sound.volume")}
          <Slider
            value={Math.round(action.volume * 100)}
            min={0}
            max={200}
            onChange={(v) => onChange({ ...action, volume: v / 100 })}
            format={(v) => `${v}%`}
            ariaLabel={t("sound.volume")}
          />
        </div>
      </div>

      {velocitySensitive && (
        <Toggle
          checked={action.volumeFromVelocity}
          onChange={(volumeFromVelocity) => onChange({ ...action, volumeFromVelocity })}
          label={t("sound.velocity")}
          hint={t("sound.velocityHint")}
        />
      )}
    </div>
  );
}

/** Waveform with two draggable handles that pick the part of the file to play. */
function Trimmer({ info, start, end, onChange }: { info: AudioInfo | null; start: number; end: number; onChange: (s: number, e: number) => void }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef<"start" | "end" | null>(null);

  const fraction = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width));
  };
  const move = (clientX: number) => {
    const f = fraction(clientX);
    if (dragging.current === "start") onChange(Math.min(f, end - 0.01), end);
    else if (dragging.current === "end") onChange(start, Math.max(f, start + 0.01));
  };

  const peaks = info?.peaks ?? Array.from({ length: 160 }, () => 0.15);
  const seconds = (f: number) => (info ? (info.durationSecs * f).toFixed(2) : "–");

  return (
    <div className="flex flex-col gap-1">
      <div
        ref={ref}
        className="relative h-20 select-none overflow-hidden rounded-lg bg-stage-950"
        onPointerDown={(e) => {
          const f = fraction(e.clientX);
          dragging.current = Math.abs(f - start) <= Math.abs(f - end) ? "start" : "end";
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          move(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.buttons & 1) move(e.clientX);
        }}
        onPointerUp={() => (dragging.current = null)}
      >
        <svg viewBox={`0 0 ${peaks.length} 100`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          {peaks.map((p, i) => {
            const inside = i / peaks.length >= start && i / peaks.length <= end;
            const h = Math.max(2, p * 92);
            return <rect key={i} x={i + 0.15} y={50 - h / 2} width={0.7} height={h} className={inside ? "fill-accent-400" : "fill-stage-600"} />;
          })}
        </svg>
        <div className="pointer-events-none absolute inset-y-0 left-0 bg-stage-950/60" style={{ width: `${start * 100}%` }} />
        <div className="pointer-events-none absolute inset-y-0 right-0 bg-stage-950/60" style={{ width: `${(1 - end) * 100}%` }} />
        {[start, end].map((f, i) => (
          <div
            key={i}
            className="pointer-events-none absolute inset-y-0 w-0.5 bg-stage-100"
            style={{ left: `calc(${f * 100}% - 1px)` }}
          >
            <span className="absolute top-1 h-3 w-3 -translate-x-[5px] rounded-full bg-stage-100" />
          </div>
        ))}
        {!info && <div className="absolute inset-0 flex items-center justify-center text-xs text-stage-500">{t("sound.analyzing")}</div>}
      </div>
      <div className="flex justify-between font-mono text-[11px] text-stage-400">
        <span>{seconds(start)} s</span>
        <span>{info ? t("sound.length", { seconds: info.durationSecs.toFixed(1) }) : ""}</span>
        <span>{seconds(end)} s</span>
      </div>
    </div>
  );
}
