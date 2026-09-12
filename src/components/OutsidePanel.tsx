import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import type { PlacedButton } from "../lib/api";
import { padAt, sameRef, useDragStore } from "../lib/drag";
import { faderAt } from "../lib/fader";
import { buttonsOutside } from "../lib/grid";
import { useDeviceStore } from "../store/device";
import { useProfileStore, type PadRef } from "../store/profile";
import { useUiStore } from "../store/ui";
import { PadFace } from "./PadFace";
import { IconClose } from "./ui";

/** Pointer distance before a press on a tile becomes a drag. */
const DRAG_THRESHOLD = 6;
const TILE = 56;

/**
 * Buttons of the active page that the connected Launchpad has no pad for,
 * listed as tiles that can be dragged onto an empty pad of the grid. The drag
 * goes through the shared drag state, so the grid highlights the target and
 * draws the ghost exactly as for a move inside the grid.
 */
export function OutsidePanel() {
  const { t } = useTranslation();
  const open = useUiStore((s) => s.outsideOpen);
  const close = useUiStore((s) => s.closeOutside);
  const layout = useDeviceStore((s) => s.layout);
  const page = useProfileStore((s) => s.activePage());
  const moveButton = useProfileStore((s) => s.moveButton);
  const setDrag = useDragStore((s) => s.setDrag);
  const pageRef = useRef(page);
  pageRef.current = page;

  const outside = useMemo(() => (page ? buttonsOutside(page, layout) : []), [page, layout]);

  // The panel exists to bring buttons back; once the last one is on a pad it has nothing
  // left to show and closes on its own. (It only opens with at least one button listed.)
  useEffect(() => {
    if (open && outside.length === 0) close();
  }, [open, outside.length, close]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  /** Only an empty pad of the grid can take a button from here. */
  const fitsAt = (over: PadRef | null): boolean => {
    const current = pageRef.current;
    if (!over || !current) return false;
    if (current.buttons.some((b) => b.x === over.x && b.y === over.y)) return false;
    return faderAt(current, over.x, over.y) === null;
  };

  const startDrag = (button: PlacedButton, e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const from: PadRef = { x: button.x, y: button.y };
    const origin = { x: e.clientX, y: e.clientY };
    let started = false;
    const cleanup = () => {
      setDrag(null);
      document.body.style.cursor = "";
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", cleanup);
    };
    const onMove = (ev: PointerEvent) => {
      if (!started) {
        if (Math.hypot(ev.clientX - origin.x, ev.clientY - origin.y) < DRAG_THRESHOLD) return;
        started = true;
        document.body.style.cursor = "grabbing";
      }
      const over = padAt(ev.clientX, ev.clientY);
      setDrag((d) => (d && sameRef(d.over, over) ? d : { from, copy: false, over, fader: null, fits: fitsAt(over) }));
    };
    const onUp = (ev: PointerEvent) => {
      cleanup();
      if (!started) return;
      const over = padAt(ev.clientX, ev.clientY);
      if (over && fitsAt(over)) void moveButton(from, over, false);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", cleanup);
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.aside
          key="outside"
          role="dialog"
          aria-label={t("outside.title")}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          transition={{ duration: 0.18 }}
          className="fixed right-4 top-1/2 z-40 flex max-h-[80vh] w-64 -translate-y-1/2 flex-col rounded-2xl border border-stage-700 bg-stage-900/95 shadow-2xl backdrop-blur"
        >
          <header className="flex items-center justify-between border-b border-stage-800 px-4 py-3">
            <h2 className="text-sm font-semibold text-stage-100">{t("outside.title")}</h2>
            <button onClick={close} aria-label={t("common.close")} className="rounded-md p-1 text-stage-400 hover:bg-stage-800 hover:text-stage-100">
              <IconClose />
            </button>
          </header>
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
            <p className="text-xs text-stage-400">
              {outside.length === 0 ? t("outside.none") : t("outside.hint", { count: outside.length, model: layout ? t(`models.${layout.model}`) : "" })}
            </p>
            <ul className="grid grid-cols-3 gap-2">
              {outside.map((b) => (
                <li key={`${b.x},${b.y}`} className="flex flex-col items-center gap-1">
                  <div
                    role="button"
                    aria-label={t("outside.position", { column: b.x + 1, row: b.y + 1 })}
                    onPointerDown={(e) => startDrag(b, e)}
                    className="cursor-grab touch-none rounded-[14%] bg-stage-800 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] active:cursor-grabbing"
                    style={{ width: TILE, height: TILE }}
                  >
                    <PadFace button={b} cell={TILE - 8} active={false} round={false} limited={layout?.limitedColor ?? false} />
                  </div>
                  <span className="text-[10px] text-stage-500">{t("outside.position", { column: b.x + 1, row: b.y + 1 })}</span>
                </li>
              ))}
            </ul>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>,
    document.body,
  );
}
