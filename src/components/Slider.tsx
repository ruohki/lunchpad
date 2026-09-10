import { clsx } from "clsx";
import { useCallback, useRef } from "react";

interface Props {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  ariaLabel?: string;
  className?: string;
  /** Optional value formatter for the label at the right end. */
  format?: (value: number) => string;
}

/** Horizontal slider built from plain elements; drag with the pointer or use the arrow keys. */
export function Slider({ value, min, max, step = 1, onChange, ariaLabel, className, format }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const ratio = max > min ? (value - min) / (max - min) : 0;

  const fromPointer = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return;
      const r = track.getBoundingClientRect();
      const t = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
      const raw = min + t * (max - min);
      const snapped = Math.round(raw / step) * step;
      onChange(Math.max(min, Math.min(max, Number(snapped.toFixed(6)))));
    },
    [min, max, step, onChange],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    fromPointer(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (e.buttons & 1) fromPointer(e.clientX);
  };

  const onKey = (e: React.KeyboardEvent) => {
    const big = (max - min) / 10;
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") next = value + step;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = value - step;
    if (e.key === "PageUp") next = value + big;
    if (e.key === "PageDown") next = value - big;
    if (e.key === "Home") next = min;
    if (e.key === "End") next = max;
    if (next !== null) {
      e.preventDefault();
      onChange(Math.max(min, Math.min(max, Number(next.toFixed(6)))));
    }
  };

  return (
    <div className={clsx("flex min-h-[32px] items-center gap-3", className)}>
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onKeyDown={onKey}
        className="relative h-8 flex-1 cursor-pointer touch-none select-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
      >
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-stage-700">
          <div className="h-full rounded-full bg-accent-500" style={{ width: `${ratio * 100}%` }} />
        </div>
        <div
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-stage-100 shadow"
          style={{ left: `${ratio * 100}%` }}
        />
      </div>
      {format && <span className="w-10 shrink-0 text-right font-mono text-xs text-stage-300">{format(value)}</span>}
    </div>
  );
}
