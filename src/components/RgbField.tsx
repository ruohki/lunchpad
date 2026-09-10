import { useRef, useState } from "react";
import { hexToRgb, rgbToHex } from "../lib/colors";
import { HsvPicker } from "./HsvPicker";
import { Popover } from "./Popover";

interface Props {
  /** "#rrggbb" */
  value: string;
  onChange: (hex: string) => void;
  label?: string;
}

/** Compact field for a plain RGB colour (text colour etc.): swatch + hex, picker in a popover. */
export function RgbField({ value, onChange, label }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <div className="flex flex-col gap-1">
      {label && <span className="text-xs text-stage-400">{label}</span>}
      <button
        ref={ref}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-[32px] items-center gap-2 rounded-md bg-stage-800 px-2 py-1.5 text-sm text-stage-100 hover:bg-stage-700 focus-visible:outline-2 focus-visible:outline-accent-400"
      >
        <span className="h-5 w-5 rounded-[30%] border border-stage-600" style={{ backgroundColor: value }} />
        <span className="font-mono text-xs">{value.toUpperCase()}</span>
      </button>
      <Popover open={open} anchor={ref} onClose={() => setOpen(false)} width={260} className="p-3">
        <HsvPicker value={hexToRgb(value)} onChange={(rgb) => onChange(rgbToHex(rgb))} />
      </Popover>
    </div>
  );
}
