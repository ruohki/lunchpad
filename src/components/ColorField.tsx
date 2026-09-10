import { clsx } from "clsx";
import { useRef, useState } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import type { PadColor } from "../lib/api";
import { hexToRgb, hueKey, padColorAltRgb, padColorRgb, padCss, paletteByShade, rgbToHex } from "../lib/colors";
import { LEGACY_PALETTE, NOVATION_PALETTE } from "../lib/palette";
import { HsvPicker } from "./HsvPicker";
import { Popover } from "./Popover";
import { Tooltip } from "./Tooltip";

type Mode = PadColor["mode"];

interface Props {
  value: PadColor;
  onChange: (next: PadColor) => void;
  /** Red/green devices: only the 16 legacy colours, as RGB. */
  limited?: boolean;
  label?: string;
}

const MODES: { mode: Mode; key: string }[] = [
  { mode: "palette", key: "colour.solid" },
  { mode: "flashing", key: "colour.flashing" },
  { mode: "pulsing", key: "colour.pulsing" },
  { mode: "rgb", key: "colour.custom" },
];

/**
 * Compact colour control: a swatch button that describes the current colour
 * and opens a popover with the mode tabs and the palette sorted by shade.
 */
export function ColorField({ value, onChange, limited, label }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="flex flex-col gap-1">
      {label && <span className="text-xs text-stage-400">{label}</span>}
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          "flex w-full items-center gap-3 rounded-lg bg-stage-800 px-2.5 py-2 text-left text-sm text-stage-100 transition-colors hover:bg-stage-700 focus-visible:outline-2 focus-visible:outline-accent-400",
          open && "ring-1 ring-accent-400",
        )}
      >
        <Swatch color={value} size={26} />
        <span className="flex-1 truncate">{describe(t, value, limited)}</span>
        <span aria-hidden className="text-stage-400">
          ▾
        </span>
      </button>
      <Popover open={open} anchor={triggerRef} onClose={() => setOpen(false)} width={360} className="p-3">
        {limited ? (
          <LimitedPicker value={value} onChange={onChange} />
        ) : (
          <FullPicker value={value} onChange={onChange} />
        )}
      </Popover>
    </div>
  );
}

function describe(t: TFunction, color: PadColor, limited?: boolean): string {
  const hue = (i: number) => t(`hue.${hueKey(i)}`);
  if (limited) return t("colour.limitedLabel", { hex: rgbToHex(padColorRgb(color)).toUpperCase() });
  switch (color.mode) {
    case "palette":
      return color.index === 0 ? t("colour.off") : t("colour.solidLabel", { hue: hue(color.index), index: color.index });
    case "flashing":
      return t("colour.flashingLabel", { a: hue(color.index), b: hue(color.alt) });
    case "pulsing":
      return t("colour.pulsingLabel", { hue: hue(color.index) });
    case "rgb":
      return t("colour.customLabel", { hex: rgbToHex(color).toUpperCase() });
  }
}

/** Small preview of a pad colour, animated for flashing and pulsing. */
export function Swatch({ color, size }: { color: PadColor; size: number }) {
  const rgb = padColorRgb(color);
  const alt = padColorAltRgb(color);
  const off = rgb.r === 0 && rgb.g === 0 && rgb.b === 0;
  const a = off ? "var(--color-stage-600)" : padCss(rgb);
  const b = off ? a : padCss(alt);
  return (
    <span
      aria-hidden
      className={clsx(
        "inline-block shrink-0 rounded-[30%] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]",
        !off && color.mode === "flashing" && "pad-flashing",
        !off && color.mode === "pulsing" && "pad-pulsing",
      )}
      style={{ width: size, height: size, backgroundColor: a, ["--pad-a" as string]: a, ["--pad-b" as string]: b }}
    />
  );
}

function FullPicker({ value, onChange }: { value: PadColor; onChange: (c: PadColor) => void }) {
  const { t } = useTranslation();
  const [slot, setSlot] = useState<"index" | "alt">("index");

  const setMode = (mode: Mode) => {
    if (mode === value.mode) return;
    const index = value.mode === "rgb" ? nearestIndex(value) : value.index;
    switch (mode) {
      case "palette":
        onChange({ mode, index });
        break;
      case "flashing":
        onChange({ mode, index, alt: value.mode === "flashing" ? value.alt : 0 });
        break;
      case "pulsing":
        onChange({ mode, index });
        break;
      case "rgb":
        onChange({ mode, ...padColorRgb(value) });
        break;
    }
  };

  const selected = value.mode === "rgb" ? -1 : value.mode === "flashing" && slot === "alt" ? value.alt : value.index;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 rounded-lg bg-stage-800 p-1">
        {MODES.map((m) => (
          <button
            key={m.mode}
            type="button"
            onClick={() => setMode(m.mode)}
            className={clsx(
              "flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
              value.mode === m.mode ? "bg-stage-600 text-stage-100" : "text-stage-400 hover:text-stage-200",
            )}
          >
            {t(m.key)}
          </button>
        ))}
      </div>

      {value.mode === "rgb" ? (
        <RgbFields value={value} onChange={onChange} />
      ) : (
        <>
          {value.mode === "flashing" && (
            <div className="flex gap-1 text-xs">
              {(["index", "alt"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSlot(s)}
                  className={clsx(
                    "flex items-center gap-2 rounded-md px-2 py-1",
                    slot === s ? "bg-stage-700 text-stage-100" : "text-stage-400 hover:text-stage-200",
                  )}
                >
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ background: NOVATION_PALETTE[s === "index" ? value.index : value.alt] }}
                  />
                  {s === "index" ? t("colour.first") : t("colour.second")}
                </button>
              ))}
            </div>
          )}
          <PaletteGrid
            selected={selected}
            onPick={(i) => {
              if (value.mode === "flashing") onChange(slot === "alt" ? { ...value, alt: i } : { ...value, index: i });
              else onChange({ ...value, index: i });
            }}
          />
          <p className="text-xs text-stage-500">
            {value.mode === "flashing" ? t("colour.flashingHint") : value.mode === "pulsing" ? t("colour.pulsingHint") : t("colour.orderHint")}
          </p>
        </>
      )}
    </div>
  );
}

function PaletteGrid({ selected, onPick }: { selected: number; onPick: (index: number) => void }) {
  const { t } = useTranslation();
  const order = paletteByShade();
  return (
    <div role="listbox" aria-label={t("colour.palette")} className="grid grid-cols-16 gap-1">
      {order.map((i) => {
        const hex = NOVATION_PALETTE[i];
        const label = t("colour.swatchTitle", { hue: t(`hue.${hueKey(i)}`), index: i });
        return (
          <Tooltip key={i} content={label} delay={250}>
            <button
              type="button"
              role="option"
              aria-selected={i === selected}
              aria-label={label}
              onClick={() => onPick(i)}
              className={clsx(
                "aspect-square rounded-[30%] transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-accent-400",
                i === selected && "ring-2 ring-stage-100 ring-offset-1 ring-offset-stage-900",
              )}
              style={{ background: hex === "#000000" ? "#2a2a33" : hex }}
            />
          </Tooltip>
        );
      })}
    </div>
  );
}

function LimitedPicker({ value, onChange }: { value: PadColor; onChange: (c: PadColor) => void }) {
  const { t } = useTranslation();
  const current = rgbToHex(padColorRgb(value));
  return (
    <div className="flex flex-col gap-2">
      <div role="listbox" aria-label={t("colour.palette")} className="grid grid-cols-8 gap-1">
        {LEGACY_PALETTE.map((hex, i) => (
          <button
            key={i}
            type="button"
            role="option"
            aria-selected={hex === current}
            onClick={() => onChange({ mode: "rgb", ...hexToRgb(hex) })}
            className={clsx(
              "aspect-square rounded-[30%] transition-transform hover:scale-110",
              hex === current && "ring-2 ring-stage-100 ring-offset-1 ring-offset-stage-900",
            )}
            style={{ background: hex === "#000000" ? "#2a2a33" : hex }}
          />
        ))}
      </div>
      <p className="text-xs text-stage-500">{t("colour.limitedHint")}</p>
    </div>
  );
}

function RgbFields({ value, onChange }: { value: Extract<PadColor, { mode: "rgb" }>; onChange: (c: PadColor) => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2">
      <HsvPicker value={value} onChange={(rgb) => onChange({ mode: "rgb", ...rgb })} />
      <span className="text-xs text-stage-400">{t("colour.customHint")}</span>
    </div>
  );
}

function nearestIndex(c: { r: number; g: number; b: number }): number {
  let best = 0;
  let bestD = Infinity;
  NOVATION_PALETTE.forEach((hex, i) => {
    const p = hexToRgb(hex);
    const d = (p.r - c.r) ** 2 + (p.g - c.g) ** 2 + (p.b - c.b) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}
