import { clsx } from "clsx";
import { motion, useReducedMotion } from "framer-motion";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { api, padKey, type Button, type Fader, type Layout, type PadSpec } from "../lib/api";
import { faderAt, faderFitsAt, faderFraction, faderLevelStep, faderPadRgb, faderPads, formatFaderValue, isControlCell } from "../lib/fader";
import { useShallow } from "zustand/react/shallow";
import { useElementSize } from "../lib/useElementSize";
import { useDeviceStore } from "../store/device";
import { isLinkActive } from "../lib/stateLink";
import { useMacroStore } from "../store/macros";
import { useMediaStore } from "../store/media";
import { useProfileStore, type PadRef } from "../store/profile";
import { useUiStore } from "../store/ui";
import { ContextMenu, type MenuEntry, type MenuState } from "./ContextMenu";
import { PadFace } from "./PadFace";
import { IconGear } from "./ui";
import { limitedRgb } from "../lib/colors";
import { padAt, sameRef, useDragStore } from "../lib/drag";
import { buttonsOutside, cornerRadius, cornersOf, isControl, isKey, noteName, type Corners } from "../lib/grid";

interface Props {
  layout: Layout;
  /** No device: clicks do not press pads, only editing works. */
  preview?: boolean;
}

/** Pointer distance before a modifier-press turns into a drag instead of a click. */
const DRAG_THRESHOLD = 6;

/** True for the modifier that moves a button: Ctrl, or ⌘ on macOS. */
const isMoveModifier = (e: { ctrlKey: boolean; metaKey: boolean }) => e.ctrlKey || e.metaKey;
/** True for the modifier that copies a button: Shift (Alt is kept from the legacy app). */
const isCopyModifier = (e: { shiftKey: boolean; altKey: boolean }) => e.shiftKey || e.altKey;

/**
 * The button matrix of the connected model, drawn to scale. Rows are laid out
 * top-down while the layout counts y from the bottom, so the row order is
 * reversed here. Pads show their configured look and colour, light up on
 * hardware and mouse presses, open a context menu on right click, and can be
 * dragged onto another pad with Ctrl / ⌘ (move, swapping with an occupied pad)
 * or Shift (copy, overwriting it). The drag runs on pointer events, so it works
 * the same in every webview.
 */
export function LaunchpadGrid({ layout, preview = false }: Props) {
  const { t } = useTranslation();
  const { ref, width, height } = useElementSize<HTMLDivElement>();
  const reduced = useReducedMotion();
  const [menu, setMenu] = useState<MenuState | null>(null);
  const drag = useDragStore((s) => s.drag);
  const setDrag = useDragStore((s) => s.setDrag);
  const pending = useRef<{ from: PadRef; copy: boolean; x: number; y: number; started: boolean; fader: { fader: Fader; step: number } | null } | null>(null);

  const clipboard = useProfileStore((s) => s.clipboard);
  const openEditor = useProfileStore((s) => s.openEditor);
  const openFaderEditor = useProfileStore((s) => s.openFaderEditor);
  const removeFader = useProfileStore((s) => s.removeFader);
  const undo = useProfileStore((s) => s.undo);
  const redo = useProfileStore((s) => s.redo);
  const history = useProfileStore((s) => s.history);
  const running = useMacroStore((s) => s.running.length);
  const stopAll = useMacroStore((s) => s.stopAll);
  const copyButton = useProfileStore((s) => s.copyButton);
  const cutButton = useProfileStore((s) => s.cutButton);
  const pasteButton = useProfileStore((s) => s.pasteButton);
  const clearButton = useProfileStore((s) => s.clearButton);
  const moveButton = useProfileStore((s) => s.moveButton);
  const moveFader = useProfileStore((s) => s.moveFader);
  const page = useProfileStore((s) => s.activePage());
  const openOutside = useUiStore((s) => s.openOutside);
  const outsideCount = useMemo(() => (page ? buttonsOutside(page, layout).length : 0), [page, layout]);
  const pageRef = useRef(page);
  pageRef.current = page;
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  const totalRowWeight = layout.rowWeights.reduce((a, b) => a + b, 0);
  const aspect = layout.width / totalRowWeight;
  const padding = 8;
  const boardWidth = Math.max(0, Math.min(width - padding, (height - padding) * aspect));
  const boardHeight = boardWidth / aspect;

  const rowsTopDown = useMemo(
    () => [...layout.rowWeights].reverse().map((w) => `${w}fr`).join(" "),
    [layout.rowWeights],
  );
  // Piano keys are drawn as one keyboard row (see `Keyboard`), everything else cell by cell.
  const padsTopDown = useMemo(
    () => layout.pads.filter((p) => !isKey(p.shape)).sort((a, b) => b.y - a.y || a.x - b.x),
    [layout.pads],
  );
  const keys = useMemo(() => layout.pads.filter((p) => isKey(p.shape)), [layout.pads]);
  /** Ordinal of every knob on the device (top row first, left to right), for its accessible name. */
  const knobNumbers = useMemo(
    () =>
      new Map(
        layout.pads
          .filter((p) => p.shape === "knob")
          .sort((a, b) => b.y - a.y || a.x - b.x)
          .map((p, i) => [padKey(p.x, p.y), i + 1]),
      ),
    [layout.pads],
  );
  const cell = boardWidth / layout.width;

  useEffect(
    () => () => {
      document.body.style.cursor = "";
    },
    [],
  );

  /** A modifier-press on a button: becomes a drag once the pointer travels, otherwise stays a click. */
  const startDrag = useCallback(
    (pad: PadSpec, copy: boolean, x: number, y: number) => {
      const hit = pageRef.current ? faderAt(pageRef.current, pad.x, pad.y) : null;
      // A fader moves as a whole; its first pad lands where the grabbed pad's offset says.
      const faderDrag = hit ? { fader: hit.fader, step: hit.step } : null;
      const originFor = (over: PadRef): PadRef => {
        if (!faderDrag) return over;
        const pads = faderPads(faderDrag.fader);
        const grabbed = pads[faderDrag.step] ?? pads[0];
        return { x: faderDrag.fader.x + (over.x - grabbed[0]), y: faderDrag.fader.y + (over.y - grabbed[1]) };
      };
      const fitsAt = (over: PadRef | null): boolean => {
        if (!over || !pageRef.current) return true;
        // A button cannot land on a knob or a touch strip.
        if (!faderDrag) return !isControlCell(layoutRef.current, over.x, over.y);
        const origin = originFor(over);
        return origin.x >= 0 && origin.y >= 0 && faderFitsAt(faderDrag.fader, origin.x, origin.y, pageRef.current, layoutRef.current);
      };
      pending.current = { from: { x: pad.x, y: pad.y }, copy: copy && !faderDrag, x, y, started: false, fader: faderDrag };

      const cleanup = () => {
        pending.current = null;
        setDrag(null);
        document.body.style.cursor = "";
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onCancel);
        window.removeEventListener("keydown", onKey);
      };
      const onMove = (e: PointerEvent) => {
        const p = pending.current;
        if (!p) return;
        if (!p.started) {
          if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < DRAG_THRESHOLD) return;
          p.started = true;
          document.body.style.cursor = p.copy ? "copy" : "grabbing";
        }
        const over = padAt(e.clientX, e.clientY);
        setDrag((d) => (d && sameRef(d.over, over) ? d : { from: p.from, copy: p.copy, over, fader: p.fader, fits: fitsAt(over) }));
      };
      const onUp = (e: PointerEvent) => {
        const p = pending.current;
        cleanup();
        if (!p?.started) return;
        const over = padAt(e.clientX, e.clientY);
        if (!over || sameRef(over, p.from)) return;
        if (p.fader) {
          if (fitsAt(over)) {
            const origin = originFor(over);
            void moveFader(p.fader.fader.id, origin.x, origin.y);
          }
          return;
        }
        if (!fitsAt(over)) return;
        void moveButton(p.from, over, p.copy);
      };
      const onCancel = () => cleanup();
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") cleanup();
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
      window.addEventListener("keydown", onKey);
    },
    [moveButton, moveFader],
  );

  const openMenu = useCallback(
    (e: React.MouseEvent, pad: PadSpec, hasButton: boolean, faderId: string | null) => {
      e.preventDefault();
      // macOS reports Ctrl+click as a right click; Ctrl is the move modifier, not a menu request.
      if (e.ctrlKey || pending.current?.started) return;
      const historyItems: MenuEntry[] = [
        ...(outsideCount > 0 ? ["divider" as const, { label: t("grid.outside", { count: outsideCount }), onSelect: openOutside }] : []),
        "divider",
        { label: t("grid.undo"), disabled: history.undo === 0, onSelect: () => void undo() },
        { label: t("grid.redo"), disabled: history.redo === 0, onSelect: () => void redo() },
        "divider",
        { label: running > 0 ? t("topbar.running", { count: running }) : t("topbar.stopAll"), disabled: running === 0, danger: running > 0, onSelect: () => void stopAll() },
      ];
      if (faderId) {
        setMenu({
          x: e.clientX,
          y: e.clientY,
          items: [
            { label: t("grid.editFader"), onSelect: () => openFaderEditor(pad.x, pad.y) },
            "divider",
            { label: t("grid.removeFader"), danger: true, onSelect: () => void removeFader(faderId) },
            ...historyItems,
          ],
        });
        return;
      }
      if (isControl(pad.shape)) {
        setMenu({ x: e.clientX, y: e.clientY, items: [{ label: t("grid.assignFader"), onSelect: () => openFaderEditor(pad.x, pad.y) }, ...historyItems] });
        return;
      }
      setMenu({
        x: e.clientX,
        y: e.clientY,
        items: [
          { label: hasButton ? t("grid.editButton") : t("grid.addButton"), onSelect: () => openEditor(pad.x, pad.y) },
          "divider",
          { label: t("grid.copy"), disabled: !hasButton, onSelect: () => copyButton(pad.x, pad.y) },
          { label: t("grid.cut"), disabled: !hasButton, onSelect: () => void cutButton(pad.x, pad.y) },
          { label: t("grid.paste"), disabled: !clipboard, onSelect: () => void pasteButton(pad.x, pad.y) },
          "divider",
          { label: t("grid.newFader"), onSelect: () => openFaderEditor(pad.x, pad.y) },
          "divider",
          { label: t("grid.clearButton"), disabled: !hasButton, danger: true, onSelect: () => void clearButton(pad.x, pad.y) },
          ...historyItems,
        ],
      });
    },
    [t, clipboard, openEditor, openFaderEditor, removeFader, copyButton, cutButton, pasteButton, clearButton, undo, redo, history, running, stopAll, outsideCount, openOutside],
  );

  const dragButton = drag && !drag.fader ? (page?.buttons.find((b) => b.x === drag.from.x && b.y === drag.from.y) ?? null) : null;
  const dragCorners = cornersOf(drag ? layout.pads.find((p) => p.x === drag.from.x && p.y === drag.from.y)?.shape : undefined);
  // Pads the dragged fader would occupy at the pointer, for the highlight.
  const dragFaderPads = useMemo(() => {
    if (!drag?.fader || !drag.over) return null;
    const pads = faderPads(drag.fader.fader);
    const grabbed = pads[drag.fader.step] ?? pads[0];
    const dx = drag.over.x - grabbed[0];
    const dy = drag.over.y - grabbed[1];
    return new Set(pads.map(([x, y]) => padKey(x + dx, y + dy)));
  }, [drag]);

  const renderPad = (pad: PadSpec): ReactNode => (
    <Pad
      pad={pad}
      cell={cell}
      order={pad.x + pad.y}
      preview={preview}
      limited={layout.limitedColor}
      controlNumber={knobNumbers.get(padKey(pad.x, pad.y)) ?? null}
      topRow={pad.y === layout.height - 1}
      dragSource={!!drag && (drag.fader ? faderPads(drag.fader.fader).some(([x, y]) => x === pad.x && y === pad.y) : drag.from.x === pad.x && drag.from.y === pad.y)}
      dropTarget={
        drag?.fader
          ? dragFaderPads?.has(padKey(pad.x, pad.y))
            ? drag.fits
              ? "move"
              : "blocked"
            : null
          : !!drag && !!drag.over && drag.over.x === pad.x && drag.over.y === pad.y && !sameRef(drag.over, drag.from)
            ? !drag.fits
              ? "blocked"
              : drag.copy
                ? "copy"
                : "move"
            : null
      }
      onContextMenu={openMenu}
      onDragStart={startDrag}
    />
  );

  return (
    <div ref={ref} className="flex h-full w-full items-center justify-center">
      {boardWidth > 0 && (
        <motion.div
          key={layout.model}
          initial={reduced ? false : { opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="grid bg-stage-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_6px_14px_-8px_rgba(0,0,0,0.8)]"
          style={{
            width: boardWidth,
            height: boardHeight,
            // In pixels: a percentage turns elliptical on a board that is much wider than tall.
            borderRadius: Math.min(boardWidth, boardHeight) * 0.03,
            padding: cell * 0.1,
            gridTemplateColumns: `repeat(${layout.width}, minmax(0, 1fr))`,
            gridTemplateRows: rowsTopDown,
            gap: cell * 0.08,
          }}
        >
          {padsTopDown.map((pad) => {
            // Explicit placement: rows count from the bottom, and touch strips span several rows.
            const place = { gridColumn: pad.x + 1, gridRow: `${layout.height - pad.y} / span ${Math.max(1, pad.rows)}` };
            if (pad.x === layout.width - 1 && pad.y === layout.height - 1 && (pad.shape === "empty" || pad.shape === "logo")) {
              return (
                <div key={padKey(pad.x, pad.y)} style={place}>
                  <SettingsPad cell={cell} />
                </div>
              );
            }
            if (pad.shape === "empty") return null;
            return (
              <div key={padKey(pad.x, pad.y)} style={place} className="min-h-0 min-w-0">
                {renderPad(pad)}
              </div>
            );
          })}
          {keys.length > 0 && <Keyboard keys={keys} height={layout.height} cell={cell} renderPad={renderPad} />}
        </motion.div>
      )}
      {drag && dragButton && <DragGhost button={dragButton} cell={cell} copy={drag.copy} corners={dragCorners} limited={layout.limitedColor} />}
      {drag?.fader && <FaderGhost fader={drag.fader.fader} cell={cell} />}
      <ContextMenu menu={menu} onClose={() => setMenu(null)} />
    </div>
  );
}

/**
 * The piano keys of a keyboard model as one row across the whole board: white
 * keys side by side, each black key over the gap right of the white key whose
 * x it shares, as on the instrument.
 */
function Keyboard({ keys, height, cell, renderPad }: { keys: PadSpec[]; height: number; cell: number; renderPad: (pad: PadSpec) => ReactNode }) {
  const whites = keys.filter((k) => k.shape === "keyWhite").sort((a, b) => a.x - b.x);
  const blacks = keys.filter((k) => k.shape === "keyBlack");
  const top = Math.max(...keys.map((k) => k.y));
  const bottom = Math.min(...keys.map((k) => k.y));
  const slot = 100 / Math.max(1, whites.length);
  const gap = cell * 0.04;
  // The keys are positioned inside an inner box so the outer padding (the gap below the pads
  // and the board's bottom corner) takes effect.
  return (
    <div className="min-h-0 min-w-0" style={{ gridColumn: "1 / -1", gridRow: `${height - top} / span ${top - bottom + 1}`, paddingTop: cell * 0.22, paddingBottom: cell * 0.06 }}>
      <div className="relative h-full w-full">
        {whites.map((k, i) => (
          <div key={padKey(k.x, k.y)} className="absolute inset-y-0" style={{ left: `${i * slot}%`, width: `${slot}%`, paddingLeft: gap / 2, paddingRight: gap / 2 }}>
            {renderPad(k)}
          </div>
        ))}
        {blacks.map((k) => {
          const i = whites.findIndex((w) => w.x === k.x);
          if (i < 0) return null;
          return (
            <div key={padKey(k.x, k.y)} className="absolute top-0 z-10" style={{ left: `${(i + 1) * slot - slot * 0.31}%`, width: `${slot * 0.62}%`, height: "60%" }}>
              {renderPad(k)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** A strip of the fader's colours following the pointer while it is moved. */
function FaderGhost({ fader, cell }: { fader: Fader; cell: number }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const onMove = (e: PointerEvent) => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);
  if (!pos) return null;
  const size = cell * 0.5;
  const vertical = fader.direction === "up" || fader.direction === "down";
  const steps = faderPads(fader).map((_, i) => i);
  const ordered = fader.direction === "up" || fader.direction === "left" ? [...steps].reverse() : steps;
  return createPortal(
    <div aria-hidden className={clsx("pointer-events-none fixed z-50 flex gap-0.5 opacity-90", vertical ? "flex-col" : "flex-row")} style={{ left: pos.x + 12, top: pos.y + 12 }}>
      {ordered.map((step) => {
        const [r, g, b] = faderPadRgb(fader, step);
        return <div key={step} className="rounded-sm shadow" style={{ width: size, height: size, backgroundColor: `rgb(${r}, ${g}, ${b})` }} />;
      })}
    </div>,
    document.body,
  );
}

/** A rotary knob: a 270° arc showing the bound fader's level, dim when nothing is bound. */
function KnobFace({ fraction, cell }: { fraction: number | null; cell: number }) {
  const size = Math.max(18, cell * 0.64);
  const r = 40;
  const start = 135;
  const sweep = 270;
  const point = (deg: number): [number, number] => [50 + r * Math.cos((deg * Math.PI) / 180), 50 + r * Math.sin((deg * Math.PI) / 180)];
  const arc = (from: number, to: number) => {
    const [x1, y1] = point(from);
    const [x2, y2] = point(to);
    return `M ${x1} ${y1} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x2} ${y2}`;
  };
  const f = Math.max(0, Math.min(1, fraction ?? 0));
  const end = start + sweep * f;
  const [px, py] = [50 + 24 * Math.cos((end * Math.PI) / 180), 50 + 24 * Math.sin((end * Math.PI) / 180)];
  return (
    <svg viewBox="5 5 90 90" width={size} height={size} aria-hidden>
      <circle cx="50" cy="50" r="33" className="fill-stage-800" />
      <path d={arc(start, start + sweep)} className="stroke-stage-600" strokeWidth="8" fill="none" strokeLinecap="round" />
      {fraction !== null && f > 0.004 && <path d={arc(start, end)} className="stroke-accent-400" strokeWidth="8" fill="none" strokeLinecap="round" />}
      <line x1="50" y1="50" x2={px} y2={py} className={fraction !== null ? "stroke-stage-100" : "stroke-stage-500"} strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}

/** A touch strip: a tall bar filled to the bound fader's level, its printed name at the top. */
function StripFace({ fraction, label, cell }: { fraction: number | null; label: string | null; cell: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, fraction ?? 0)) * 100);
  return (
    <div
      aria-hidden
      data-strip
      className="relative min-h-0 flex-1 overflow-hidden rounded-md bg-stage-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
      style={{ width: Math.max(10, cell * 0.68) }}
    >
      {fraction !== null && <div className="absolute inset-x-0 bottom-0 bg-accent-500/70" style={{ height: `${pct}%` }} />}
      {label && <span className="absolute inset-x-0 top-1 truncate px-0.5 text-center text-[9px] text-stage-400">{label}</span>}
    </div>
  );
}

/** The dragged button, following the pointer above everything else. */
function DragGhost({ button, cell, copy, corners, limited }: { button: Button; cell: number; copy: boolean; corners: Corners; limited: boolean }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const onMove = (e: PointerEvent) => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);
  if (!pos) return null;
  const size = corners === "square" ? cell : cell * 0.84;
  return createPortal(
    <div aria-hidden className="pointer-events-none fixed z-50" style={{ left: pos.x - size / 2, top: pos.y - size / 2, width: size, height: size }}>
      <div className="h-full w-full overflow-hidden opacity-90 shadow-[0_16px_32px_-8px_rgba(0,0,0,0.9)]" style={{ borderRadius: cornerRadius(corners, cell) }}>
        <PadFace button={button} cell={cell} active={false} corners={corners} limited={limited} />
      </div>
      {copy && (
        <span className="absolute -right-1 -top-1 rounded-full bg-accent-500 px-1.5 text-[11px] font-semibold leading-4 text-stage-950 shadow">
          +
        </span>
      )}
    </div>,
    document.body,
  );
}

/** The corner every model leaves free (or uses for a logo LED) opens the settings, like the legacy "SET" pad. */
function SettingsPad({ cell }: { cell: number }) {
  const { t } = useTranslation();
  const toggle = useUiStore((s) => s.toggleSettings);
  const open = useUiStore((s) => s.settingsOpen);
  return (
    <div className="flex h-full w-full items-center justify-center" style={{ padding: cell * 0.08 }}>
      <motion.button
        type="button"
        aria-label={t("common.settings")}
        aria-expanded={open}
        onClick={toggle}
        whileTap={{ scale: 0.93 }}
        className={clsx(
          "flex h-full w-full items-center justify-center rounded-full text-stage-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),inset_0_-2px_0_rgba(0,0,0,0.5)] transition-colors hover:text-stage-100 focus-visible:outline-2 focus-visible:outline-accent-400",
          open ? "bg-stage-600" : "bg-stage-800 hover:bg-stage-700",
        )}
      >
        <IconGear className="h-[40%] w-[40%]" />
      </motion.button>
    </div>
  );
}

interface PadProps {
  pad: PadSpec;
  cell: number;
  order: number;
  preview: boolean;
  /** Red/green device: draw the colours it can show. */
  limited: boolean;
  /** Ordinal of a knob among the device's knobs, for its accessible name. */
  controlNumber: number | null;
  /** On the device's top row: knobs, strips and rect buttons there share one top edge. */
  topRow: boolean;
  /** This pad's button is being dragged. */
  dragSource: boolean;
  /** A dragged button or fader hovers here: it would move / copy onto this pad, or cannot land here. */
  dropTarget: "move" | "copy" | "blocked" | null;
  onContextMenu: (e: React.MouseEvent, pad: PadSpec, hasButton: boolean, faderId: string | null) => void;
  onDragStart: (pad: PadSpec, copy: boolean, x: number, y: number) => void;
}

/** A pad that belongs to a fader: its blend colour, the level pad shows the value (in the lower part of a piano key, clear of the black keys). */
function FaderFace({ fader, step, cell, corners, limited }: { fader: Fader; step: number; cell: number; corners: Corners; limited: boolean }) {
  const key = corners === "key";
  const blend = faderPadRgb(fader, step);
  const shown = limited ? limitedRgb({ r: blend[0], g: blend[1], b: blend[2] }) : { r: blend[0], g: blend[1], b: blend[2] };
  const { r, g, b } = shown;
  const isLevel = step === faderLevelStep(fader);
  const bright = 0.299 * r + 0.587 * g + 0.114 * b > 150;
  return (
    <div
      className={clsx("relative flex h-full w-full justify-center overflow-hidden", key ? "items-end pb-[14%]" : "items-center")}
      style={{ backgroundColor: `rgb(${r}, ${g}, ${b})`, borderRadius: cornerRadius(corners, cell), boxShadow: isLevel && !key ? "inset 0 0 0 2px rgba(255,255,255,0.8)" : "inset 0 -3px 0 rgba(0,0,0,0.35)" }}
    >
      {isLevel && (
        <span className="px-1 text-center font-semibold leading-none" style={{ fontSize: Math.max(8, cell * (key ? 0.16 : 0.2)), color: bright ? "#111" : "#fff", textShadow: bright ? undefined : "0 1px 2px rgba(0,0,0,0.5)" }}>
          {formatFaderValue(fader)}
        </span>
      )}
      {step === 0 && !isLevel && fader.name && (
        <span className="absolute inset-x-0 bottom-[8%] truncate px-1 text-center text-white/70" style={{ fontSize: Math.max(7, cell * 0.14) }}>
          {fader.name}
        </span>
      )}
    </div>
  );
}

const Pad = memo(function Pad({ pad, cell, order, preview, limited, controlNumber, topRow, dragSource, dropTarget, onContextMenu, onDragStart }: PadProps) {
  const { t } = useTranslation();
  const key = padKey(pad.x, pad.y);
  const pressed = useDeviceStore((s) => s.pressedSet.has(key));
  const activePageId = useProfileStore((s) => s.profile?.activePage ?? null);
  const running = useMacroStore((s) => activePageId !== null && s.runningPads.has(`${activePageId}|${key}`));
  const button = useProfileStore((s) => {
    const p = s.profile;
    const page = p ? (p.pages.find((pg) => pg.id === p.activePage) ?? p.pages[0]) : null;
    return page?.buttons.find((b) => b.x === pad.x && b.y === pad.y) ?? null;
  });
  const openEditor = useProfileStore((s) => s.openEditor);
  const openFaderEditor = useProfileStore((s) => s.openFaderEditor);
  const [fader, step] = useProfileStore(
    useShallow((s): readonly [Fader | null, number] => {
      const p = s.profile;
      const page = p ? (p.pages.find((pg) => pg.id === p.activePage) ?? p.pages[0]) : null;
      const hit = page ? faderAt(page, pad.x, pad.y) : null;
      return hit ? [hit.fader, hit.step] : [null, -1];
    }),
  );
  const linked = useMediaStore((s) => isLinkActive(button?.stateLink, s.obs, s.slobs));
  const missing = useProfileStore((s) => s.missingFiles);
  const hasMissing = !!button && [...button.down, ...button.up, ...button.hold].some((a) => a.type === "playSound" && missing.includes(a.file));
  const [mouseDown, setMouseDown] = useState(false);
  const reduced = useReducedMotion();
  const lit = pressed || mouseDown || running || linked;
  const control = isControl(pad.shape);
  /** Distance from a cell's top edge to the top of a knob, strip or top-row button. */
  const topInset = cell * 0.06;

  // Working a knob or strip with the pointer: the value shown follows the pointer at once,
  // the device path (paced by the engine) catches up and then takes over again.
  const controlDrag = useRef<{ pointerId: number; startY: number; startFraction: number } | null>(null);
  const [dragFraction, setDragFraction] = useState<number | null>(null);
  const faderValue = fader?.value;
  useEffect(() => {
    if (controlDrag.current === null) setDragFraction(null);
  }, [faderValue]);
  const setControl = useCallback(
    (raw: number) => {
      const value = Math.max(0, Math.min(1, raw));
      setDragFraction(value);
      if (!preview) void api.controlPad(pad.x, pad.y, value).catch(() => undefined);
    },
    [preview, pad],
  );
  const endControlDrag = useCallback((e: React.PointerEvent) => {
    const d = controlDrag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    controlDrag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    // The last value reaches the profile within the engine's pacing interval.
    window.setTimeout(() => setDragFraction(null), 250);
  }, []);
  /** Fraction of a strip's travel at the pointer, bottom = 0. */
  const stripFraction = (e: React.PointerEvent) => {
    const bar = e.currentTarget.querySelector("[data-strip]");
    const rect = (bar ?? e.currentTarget).getBoundingClientRect();
    return rect.height > 0 ? 1 - (e.clientY - rect.top) / rect.height : 0;
  };
  /** A printed button that sends nothing the app can use (keyboard functions). */
  const decorative = !control && pad.note === null && pad.shape !== "empty" && pad.shape !== "logo";
  const pressable = !control && !decorative && pad.shape !== "empty" && pad.shape !== "logo";

  const press = useCallback(
    (e: React.PointerEvent) => {
      // WebKit turns Ctrl+click into button 2; keep it as a Ctrl-modified press.
      const primary = e.button === 0 || (e.button === 2 && e.ctrlKey);
      if (!pressable || !primary) return;
      if (isMoveModifier(e) || isCopyModifier(e)) {
        // A modifier turns the press into a drag of the button or fader (nothing to drag on an empty pad).
        if (button || fader) {
          e.preventDefault();
          onDragStart(pad, isCopyModifier(e), e.clientX, e.clientY);
        }
        return;
      }
      setMouseDown(true);
      if (!preview) void api.pressPad(pad.x, pad.y, true).catch(() => undefined);
    },
    [pressable, preview, pad, button, fader, onDragStart],
  );

  const release = useCallback(() => {
    if (!mouseDown) return;
    setMouseDown(false);
    if (!preview) void api.pressPad(pad.x, pad.y, false).catch(() => undefined);
  }, [mouseDown, preview, pad]);

  if (pad.shape === "empty") return <div aria-hidden />;

  if (pad.shape === "logo") {
    return (
      <div className="flex items-center justify-center" aria-hidden>
        <span className="rounded-full border border-stage-600" style={{ width: cell * 0.36, height: cell * 0.36 }} />
      </div>
    );
  }

  if (control) {
    const fraction = dragFraction ?? (fader ? faderFraction(fader) : null);
    const name = pad.shape === "strip" ? t("grid.strip", { name: pad.label ?? "" }) : t("grid.knob", { n: controlNumber ?? pad.x + 1 });
    return (
      <div
        data-pad={`${pad.x},${pad.y}`}
        className={clsx(
          "relative flex h-full w-full items-center justify-center rounded-md transition-opacity",
          dropTarget === "move" && "ring-2 ring-accent-400",
          dropTarget === "blocked" && "ring-2 ring-danger",
          dragSource && "opacity-40",
        )}
        onContextMenu={(e) => onContextMenu(e, pad, false, fader?.id ?? null)}
      >
        <button
          type="button"
          aria-label={fader ? `${name}: ${formatFaderValue(fader)}` : name}
          onPointerDown={(e) => {
            const primary = e.button === 0 || (e.button === 2 && e.ctrlKey);
            if (!primary || !fader) return;
            // A modifier press moves the bound fader, as on a button.
            if (isMoveModifier(e) || isCopyModifier(e)) {
              e.preventDefault();
              onDragStart(pad, false, e.clientX, e.clientY);
              return;
            }
            // Otherwise the pointer works the control: a strip takes the touched position, a
            // knob turns with the vertical travel.
            controlDrag.current = { pointerId: e.pointerId, startY: e.clientY, startFraction: faderFraction(fader) };
            if (pad.shape === "strip") setControl(stripFraction(e));
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
              // A synthetic pointer cannot be captured; the drag then ends when the pointer leaves.
            }
          }}
          onPointerMove={(e) => {
            const d = controlDrag.current;
            if (!d || d.pointerId !== e.pointerId) return;
            setControl(pad.shape === "strip" ? stripFraction(e) : d.startFraction + (d.startY - e.clientY) / (cell * 3));
          }}
          onPointerUp={endControlDrag}
          onPointerCancel={endControlDrag}
          onClick={(e) => {
            // Nothing to work on an unbound control: a plain click assigns a fader.
            if (!fader && !isMoveModifier(e) && !isCopyModifier(e)) openFaderEditor(pad.x, pad.y);
          }}
          onDoubleClick={(e) => {
            if (isMoveModifier(e)) openFaderEditor(pad.x, pad.y);
          }}
          className={clsx("flex h-full w-full flex-col items-center justify-start gap-0.5 rounded-md focus-visible:outline-2 focus-visible:outline-accent-400", fader && "cursor-ns-resize")}
          style={{ paddingTop: topInset, paddingBottom: 4 }}
        >
          {pad.shape === "strip" ? <StripFace fraction={fraction} label={pad.label} cell={cell} /> : <KnobFace fraction={fraction} cell={cell} />}
          {pad.shape === "knob" && <span className="text-[9px] leading-none text-stage-500">{fader ? formatFaderValue(fader, fader.min + (fader.max - fader.min) * (fraction ?? 0)) : pad.label}</span>}
        </button>
      </div>
    );
  }

  const corners = cornersOf(pad.shape);
  const radius = cornerRadius(corners, cell);
  /** A rect button on the top row hangs from the same edge as the knobs and strips next to it. */
  const hangTop = topRow && pad.shape === "rect";
  const white = pad.shape === "keyWhite";
  const black = pad.shape === "keyBlack";
  const pianoKey = white || black;
  /** Rect buttons keep one size whatever their row's height; the Pro MK3's small ones take half a cell; the rest fill their cell. */
  const sizeClass = pad.shape === "small" ? "h-1/2 w-1/2" : pad.shape === "rect" ? "shrink-0" : "h-full w-full";
  const sizeStyle = pad.shape === "rect" ? { width: cell * 0.7, height: cell * 0.38 } : undefined;

  if (decorative) {
    return (
      <div className={clsx("flex h-full w-full justify-center", hangTop ? "items-start" : "items-center")} style={hangTop ? { paddingTop: topInset } : undefined}>
        <span
          aria-label={t("grid.noInput", { name: pad.label ?? "" })}
          className={clsx("flex items-center justify-center bg-stage-800/60 px-1 text-center text-[9px] leading-tight text-stage-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]", sizeClass)}
          style={{ ...sizeStyle, borderRadius: radius }}
        >
          {pad.label}
        </span>
      </div>
    );
  }

  const legendSize = Math.max(8, Math.min(12, cell * 0.16));
  const name =
    button && button.look.type === "text" && button.look.caption
      ? button.look.caption
      : pad.label
        ? t("grid.namedButton", { name: pad.label })
        : (white || black) && pad.note !== null
          ? t("grid.key", { name: noteName(pad.note) })
          : t("grid.padLabel", { column: pad.x + 1, row: pad.y + 1 });

  return (
    <div
      data-pad={`${pad.x},${pad.y}`}
      className={clsx(
        "relative flex h-full w-full justify-center transition-opacity",
        hangTop ? "items-start" : "items-center",
        dropTarget === "move" && "ring-2 ring-accent-400",
        dropTarget === "copy" && "ring-2 ring-ok",
        dropTarget === "blocked" && "ring-2 ring-danger",
        dragSource && "opacity-40",
      )}
      // Built without undefined entries: React writes an undefined longhand as "", which
      // resets the padding-top the shorthand just set and squashes a round button.
      style={{ borderRadius: radius, ...(pad.shape === "round" ? { padding: cell * 0.08 } : {}), ...(hangTop ? { paddingTop: topInset } : {}) }}
      onContextMenu={(e) => onContextMenu(e, pad, !!button, fader?.id ?? null)}
    >
      <motion.button
        type="button"
        aria-label={name}
        aria-pressed={lit}
        onPointerDown={press}
        onPointerUp={release}
        onPointerLeave={release}
        onPointerCancel={release}
        onDoubleClick={(e) => {
          if (!isMoveModifier(e)) return;
          if (fader) openFaderEditor(pad.x, pad.y);
          else openEditor(pad.x, pad.y);
        }}
        initial={reduced ? false : { opacity: 0 }}
        animate={{
          opacity: 1,
          // A key dips like a real one, hinged at its top edge; a button shrinks in place.
          ...(pianoKey ? { scaleY: lit ? 0.965 : 1 } : { scale: lit ? 0.93 : 1 }),
          transition: reduced
            ? { duration: 0 }
            : { opacity: { delay: order * 0.018, duration: 0.25 }, scale: { type: "spring", stiffness: 700, damping: 28 }, scaleY: { type: "spring", stiffness: 700, damping: 28 } },
        }}
        style={{ ...sizeStyle, borderRadius: radius, originY: pianoKey ? 0 : 0.5 }}
        className={clsx(
          "relative flex select-none items-center justify-center overflow-hidden text-center leading-none transition-[box-shadow] duration-100 focus-visible:outline-2 focus-visible:outline-accent-400",
          sizeClass,
          // A button or fader face covers the whole control: no background of its own underneath,
          // which would bleed through along the rounded edge of a light key.
          button || fader
            ? lit
              ? "shadow-[0_0_22px_2px_rgba(255,255,255,0.18)]"
              : "shadow-[inset_0_-3px_0_rgba(0,0,0,0.35)]"
            : lit
              ? "bg-accent-500 text-stage-950 shadow-[0_0_22px_2px_rgba(255,122,26,0.55)]"
              : white
                ? "bg-stage-200 text-stage-600 shadow-[inset_0_-4px_0_rgba(0,0,0,0.18),inset_1px_0_0_rgba(255,255,255,0.5)] hover:bg-stage-100"
                : black
                  ? "bg-stage-950 text-stage-500 shadow-[inset_0_-4px_0_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.08),0_3px_6px_rgba(0,0,0,0.6)] hover:bg-stage-800"
                  : corners === "round" || corners === "rect"
                    ? "bg-stage-800 text-stage-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),inset_0_-2px_0_rgba(0,0,0,0.5)] hover:bg-stage-700"
                    : "bg-stage-700 text-stage-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-3px_0_rgba(0,0,0,0.45)] hover:bg-stage-600",
        )}
      >
        {hasMissing && <span aria-label={t("sound.missing")} className="pointer-events-none absolute right-[7%] top-[7%] z-20 h-[12%] w-[12%] min-h-1.5 min-w-1.5 rounded-full bg-warn shadow-[0_0_0_1px_rgba(0,0,0,0.5)]" />}
        {running && (
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-0 z-10 border-2 border-stage-100/70"
            style={{ borderRadius: radius }}
            animate={{ opacity: [0.2, 0.9, 0.2] }}
            transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
          />
        )}
        {fader ? (
          <FaderFace fader={fader} step={step} cell={cell} corners={corners} limited={limited} />
        ) : button ? (
          <PadFace button={button as Button} cell={cell} active={lit} corners={corners} limited={limited} noLed={pad.led === "none"} noLedTone={white ? "light" : "dark"} align={pianoKey ? "bottom" : "center"} />
        ) : (
          pad.label && (
            <span className="px-1 font-medium" style={{ fontSize: legendSize }}>
              {pad.label}
            </span>
          )
        )}
      </motion.button>
    </div>
  );
});
