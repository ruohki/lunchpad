import { clsx } from "clsx";
import type { CSSProperties } from "react";
import type { Button, PadColor } from "../lib/api";
import { contrastText, faceCss, limitedRgb, padColorAltRgb, padColorRgb, padCss } from "../lib/colors";

/** Reference pad size the look's font size is relative to (legacy: ~84 px pads). */
const REFERENCE_CELL = 84;

interface Props {
  button: Button;
  cell: number;
  active: boolean;
  round: boolean;
  /** Connected Launchpad has red/green LEDs only: draw the colours it can show, no pulsing. */
  limited?: boolean;
  /** The pad has no LED: colours do not apply, draw a neutral face with the look on it. */
  noLed?: boolean;
  className?: string;
}

/**
 * Visual of a configured pad: LED colour as background (flashing / pulsing
 * animated), text or image look on top. Shared by the grid and the editor
 * preview.
 */
export function PadFace({ button, cell, active, round, limited = false, noLed = false, className }: Props) {
  const color: PadColor = active && button.activeColor ? button.activeColor : button.color;
  const rgb = limited ? limitedRgb(padColorRgb(color)) : padColorRgb(color);
  const alt = limited ? limitedRgb(padColorAltRgb(color)) : padColorAltRgb(color);
  const off = noLed || (rgb.r === 0 && rgb.g === 0 && rgb.b === 0);
  const bg = off ? "var(--color-stage-700)" : padCss(rgb);

  const style: CSSProperties & Record<string, string> = {
    "--pad-a": bg,
    "--pad-b": off ? bg : padCss(alt),
    backgroundColor: bg,
  };

  const textColor = off ? "var(--color-stage-200)" : contrastText(rgb);

  return (
    <div
      className={clsx(
        "flex h-full w-full items-center justify-center overflow-hidden",
        round ? "rounded-full" : "rounded-[14%]",
        !off && color.mode === "flashing" && "pad-flashing",
        !off && !limited && color.mode === "pulsing" && "pad-pulsing",
        className,
      )}
      style={style}
    >
      {button.look.type === "text" ? (
        <span
          className="max-w-full px-[6%] text-center leading-[1.1] break-words"
          style={{
            fontFamily: faceCss(button.look.face),
            fontSize: Math.max(6, (button.look.size * cell) / REFERENCE_CELL),
            color: button.look.color || textColor,
            textShadow: off ? undefined : "0 1px 2px rgba(0,0,0,0.45)",
          }}
        >
          {button.look.caption}
        </span>
      ) : (
        <img
          src={button.look.uri}
          alt=""
          draggable={false}
          className="pointer-events-none h-[82%] w-[82%] object-contain"
        />
      )}
    </div>
  );
}
