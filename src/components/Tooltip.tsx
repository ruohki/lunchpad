import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface Props {
  content: React.ReactNode;
  children: React.ReactNode;
  /** Preferred side; flips when there is no room. */
  side?: "top" | "bottom";
  /** Milliseconds of hovering before the tip appears. */
  delay?: number;
  /**
   * Give the wrapper a box of its own (inline-flex) instead of `display: contents`.
   * Needed around disabled buttons, which swallow pointer events themselves.
   */
  wrap?: boolean;
}

const GAP = 8;

/**
 * Hover / keyboard-focus tooltip rendered into document.body, replacing the
 * native `title` attribute. The wrapper has no box of its own, so the child
 * keeps its place in flex and grid layouts.
 */
export function Tooltip({ content, children, side = "top", delay = 450, wrap = false }: Props) {
  const wrapper = useRef<HTMLSpanElement>(null);
  const tip = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; side: "top" | "bottom" } | null>(null);

  const clear = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };
  const show = () => {
    if (!content) return;
    clear();
    timer.current = window.setTimeout(() => setOpen(true), delay);
  };
  const hide = useCallback(() => {
    clear();
    setOpen(false);
  }, []);

  const place = useCallback(() => {
    const anchor = (wrap ? wrapper.current : ((wrapper.current?.firstElementChild as HTMLElement | null) ?? wrapper.current)) as HTMLElement | null;
    const box = tip.current;
    if (!anchor || !box) return;
    const r = anchor.getBoundingClientRect();
    const w = box.offsetWidth;
    const h = box.offsetHeight;
    let s = side;
    let top = s === "top" ? r.top - h - GAP : r.bottom + GAP;
    if (s === "top" && top < 8) {
      s = "bottom";
      top = r.bottom + GAP;
    } else if (s === "bottom" && top + h > window.innerHeight - 8) {
      s = "top";
      top = r.top - h - GAP;
    }
    const left = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 8));
    setPos({ top, left, side: s });
  }, [side, wrap]);

  useLayoutEffect(() => {
    if (open) place();
    else setPos(null);
  }, [open, place, content]);

  useEffect(() => clear, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") hide();
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [open, hide]);

  const dy = (pos?.side ?? side) === "top" ? 3 : -3;

  return (
    <>
      <span
        ref={wrapper}
        className={wrap ? "inline-flex" : "contents"}
        onPointerEnter={show}
        onPointerLeave={hide}
        onPointerDown={hide}
        onFocus={(e) => {
          if ((e.target as HTMLElement).matches?.(":focus-visible")) show();
        }}
        onBlur={hide}
      >
        {children}
      </span>
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={tip}
              role="tooltip"
              initial={{ opacity: 0, y: dy, scale: 0.98 }}
              animate={{ opacity: pos ? 1 : 0, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: dy, scale: 0.98 }}
              transition={{ duration: 0.12, ease: "easeOut" }}
              style={{ top: pos?.top ?? 0, left: pos?.left ?? 0 }}
              className="pointer-events-none fixed z-[60] max-w-xs break-words rounded-md border border-stage-700 bg-stage-950 px-2 py-1 text-xs leading-snug text-stage-100 shadow-xl"
            >
              {content}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
