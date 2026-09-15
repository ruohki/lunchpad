import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface Props {
  open: boolean;
  anchor: React.RefObject<HTMLElement | null>;
  /** Box to place the panel at instead of the anchor's (a caret, say); read every time the panel is placed. */
  at?: () => DOMRect | null;
  onClose: () => void;
  children: React.ReactNode;
  /** Popover width; defaults to the anchor width clamped to 240-420 px. */
  width?: number;
  className?: string;
}

/**
 * Floating panel rendered into document.body next to its anchor (or the box
 * `at` returns). Flips above when there is no room below, follows scrolling
 * and resizing; closes on outside click or Escape.
 */
export function Popover({ open, anchor, at, onClose, children, width: fixedWidth, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: fixedWidth ?? 320 });

  useLayoutEffect(() => {
    if (!open || !anchor.current) return;
    const place = () => {
      const r = at?.() ?? anchor.current!.getBoundingClientRect();
      const width = fixedWidth ?? Math.max(240, Math.min(420, r.width));
      const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
      const below = r.bottom + 6;
      const height = ref.current?.offsetHeight ?? 300;
      const top = below + height > window.innerHeight - 8 ? Math.max(8, r.top - height - 6) : below;
      setPos((p) => (p.top === top && p.left === left && p.width === width ? p : { top, left, width }));
    };
    place();
    const id = requestAnimationFrame(place);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, anchor, at, fixedWidth]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || anchor.current?.contains(t)) return;
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", onDown, true);
    };
  }, [open, onClose, anchor]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: -4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.98 }}
          transition={{ duration: 0.14, ease: "easeOut" }}
          style={{ top: pos.top, left: pos.left, width: pos.width }}
          className={
            "fixed z-50 max-h-[70vh] overflow-y-auto rounded-xl border border-stage-700 bg-stage-900 p-2 shadow-2xl " + (className ?? "")
          }
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
