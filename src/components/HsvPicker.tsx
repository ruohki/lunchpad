import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { hexToRgb, hsvToRgb, rgbToHex, rgbToHsv, type Rgb } from "../lib/colors";

interface Props {
  value: Rgb;
  onChange: (rgb: Rgb) => void;
}

/**
 * Colour picker built from plain elements: a saturation/value square, a hue
 * bar and a hex field. Replaces the browser's native colour input.
 */
export function HsvPicker({ value, onChange }: Props) {
  const { t } = useTranslation();
  const [hsv, setHsv] = useState(() => rgbToHsv(value));
  const squareRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const hex = rgbToHex(value);

  // Follow external changes (hex field, presets) without losing the hue of greys.
  useEffect(() => {
    const current = rgbToHex(hsvToRgb(hsv));
    if (current !== hex) {
      const next = rgbToHsv(value);
      setHsv((prev) => ({ h: next.s === 0 ? prev.h : next.h, s: next.s, v: next.v }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hex]);

  const commit = (next: Partial<typeof hsv>) => {
    const merged = { ...hsv, ...next };
    setHsv(merged);
    onChange(hsvToRgb(merged));
  };

  const pickSquare = (e: React.PointerEvent) => {
    const r = squareRef.current!.getBoundingClientRect();
    const s = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    const v = 1 - Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
    commit({ s, v });
  };
  const pickHue = (e: React.PointerEvent) => {
    const r = hueRef.current!.getBoundingClientRect();
    commit({ h: Math.max(0, Math.min(359.9, ((e.clientX - r.left) / r.width) * 360)) });
  };

  const drag = (pick: (e: React.PointerEvent) => void) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      pick(e);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (e.buttons & 1) pick(e);
    },
  });

  const hueHex = rgbToHex(hsvToRgb({ h: hsv.h, s: 1, v: 1 }));

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={squareRef}
        role="img"
        aria-label={t("colour.pick")}
        {...drag(pickSquare)}
        className="relative h-36 w-full cursor-crosshair touch-none select-none rounded-lg"
        style={{
          backgroundColor: hueHex,
          backgroundImage: "linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)",
        }}
      >
        <span
          className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.6)]"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, backgroundColor: hex }}
        />
      </div>
      <div
        ref={hueRef}
        role="slider"
        aria-label={t("colour.hue")}
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(hsv.h)}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") commit({ h: (hsv.h + 354) % 360 });
          if (e.key === "ArrowRight") commit({ h: (hsv.h + 6) % 360 });
        }}
        {...drag(pickHue)}
        className="relative h-4 w-full cursor-pointer touch-none select-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
        style={{ background: "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)" }}
      >
        <span
          className="pointer-events-none absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.6)]"
          style={{ left: `${(hsv.h / 360) * 100}%`, backgroundColor: hueHex }}
        />
      </div>
      <div className="flex items-center gap-3">
        <span className="h-8 w-8 shrink-0 rounded-md border border-stage-700" style={{ backgroundColor: hex }} />
        <input
          key={hex}
          defaultValue={hex.toUpperCase()}
          aria-label={t("colour.hex")}
          spellCheck={false}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (/^#?[0-9a-fA-F]{6}$/.test(v)) onChange(hexToRgb(v.startsWith("#") ? v : `#${v}`));
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="w-28 rounded-md bg-stage-800 px-2 py-1.5 font-mono text-sm text-stage-100 outline-none focus:ring-1 focus:ring-accent-400"
        />
      </div>
    </div>
  );
}
