import { clsx } from "clsx";
import type { CSSProperties } from "react";
import type { Button, PadColor } from "../lib/api";
import { contrastText, edgeCss, faceCss, limitedRgb, padColorAltRgb, padColorRgb, padCss } from "../lib/colors";
import { cornerRadius, legendSize, type Corners } from "../lib/grid";
import { PadLabel } from "./PadLabel";

/** Reference pad size the look's font size is relative to (legacy: ~84 px pads). */
const REFERENCE_CELL = 84;

interface Props {
  button: Button;
  cell: number;
  active: boolean;
  /** Outline of the control the face sits on; a square pad by default. */
  corners?: Corners;
  /** Connected Launchpad has red/green LEDs only: draw the colours it can show, no pulsing. */
  limited?: boolean;
  /** The pad has no LED: colours do not apply, draw a neutral face with the look on it. */
  noLed?: boolean;
  /** The neutral face of a control without LED: dark like a button, or light like a white key. */
  noLedTone?: "dark" | "light";
  /** Where the look sits: centred, or in the lower part (a white key's top is under the black keys). */
  align?: "center" | "bottom";
  /** The LED lights only the printed symbol (or the caption): the body stays dark. */
  mask?: boolean;
  /** The symbol printed on a masked button. */
  symbol?: string | null;
  className?: string;
}

/**
 * Visual of a configured pad: LED colour as background (flashing / pulsing
 * animated), text or image look on top. Shared by the grid and the editor
 * preview.
 */
export function PadFace({ button, cell, active, corners = "square", limited = false, noLed = false, noLedTone = "dark", align = "center", mask = false, symbol = null, className }: Props) {
  const color: PadColor = active && button.activeColor ? button.activeColor : button.color;
  const rgb = limited ? limitedRgb(padColorRgb(color)) : padColorRgb(color);
  const alt = limited ? limitedRgb(padColorAltRgb(color)) : padColorAltRgb(color);
  const off = noLed || (rgb.r === 0 && rgb.g === 0 && rgb.b === 0);

  if (mask) {
    // A black body with the grey printed symbol lit in the LED's colour; a caption of the
    // button's own takes the symbol's place.
    const lit = padCss(rgb);
    const text = button.look.type === "text" ? button.look : null;
    const caption = text?.caption ?? "";
    // The same size as the printed legend of an unconfigured pad, so a button on Scale
    // does not grow its label next to a bare Arp.
    const glyphSize = legendSize(cell);
    return (
      <div
        className={clsx("flex h-full w-full items-center justify-center overflow-hidden", !off && !limited && color.mode === "pulsing" && "pad-pulsing", className)}
        style={{ backgroundColor: "var(--color-ink)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -3px 0 rgba(0,0,0,0.7)", borderRadius: cornerRadius(corners, cell), "--pad-a": lit, "--pad-b": padCss(alt) } as CSSProperties}
      >
        <span
          className={clsx("px-1 text-center leading-none", caption ? "font-semibold" : "font-medium", !off && color.mode === "flashing" && "pad-flashing-symbol")}
          style={{
            fontSize: text && caption ? Math.max(6, (text.size * cell) / REFERENCE_CELL) : glyphSize,
            fontFamily: text && caption ? faceCss(text.face) : undefined,
            color: off ? "var(--color-stage-400)" : lit,
            textShadow: off ? undefined : `0 0 ${Math.max(3, cell * 0.08)}px ${lit}`,
          }}
        >
          {caption ? caption : <PadLabel label={symbol} size={glyphSize} />}
        </span>
      </div>
    );
  }
  const light = noLed && noLedTone === "light";
  const bg = off ? (light ? "var(--color-stage-200)" : "var(--color-stage-700)") : padCss(rgb);

  const edgeA = off ? (light ? "rgba(0,0,0,0.18)" : "rgba(0,0,0,0.45)") : edgeCss(rgb);

  const style: CSSProperties & Record<string, string> = {
    "--pad-a": bg,
    "--pad-b": off ? bg : padCss(alt),
    backgroundColor: bg,
    // The same bottom edge a fader face draws (the pad button underneath has one too, but an
    // opaque face covers it), one colour per phase so a flashing face keeps it in both.
    "--edge-a": edgeA,
    "--edge-b": off ? edgeA : edgeCss(alt),
    boxShadow: "inset 0 -3px 0 var(--edge-a)",
    borderRadius: cornerRadius(corners, cell),
  };

  const textColor = off ? (light ? "var(--color-stage-900)" : "var(--color-stage-200)") : contrastText(rgb);

  return (
    <div
      className={clsx(
        "flex h-full w-full justify-center overflow-hidden",
        align === "bottom" ? "items-end pb-[10%]" : "items-center",
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
          className={clsx("pointer-events-none w-[82%] object-contain", align === "bottom" ? "h-[30%]" : "h-[82%]")}
        />
      )}
    </div>
  );
}
