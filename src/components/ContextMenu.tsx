import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../icons/Icon";
import { clsx } from "clsx";

export interface MenuItem {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  danger?: boolean;
  shortcut?: string;
  icon?: React.ReactNode;
}

export interface Submenu {
  submenu: string;
  items: MenuItem[];
  icon?: React.ReactNode;
}

export type MenuEntry = MenuItem | Submenu | "divider" | { heading: string };

export interface MenuState {
  x: number;
  y: number;
  items: MenuEntry[];
}

interface Props {
  menu: MenuState | null;
  onClose: () => void;
}

const MARGIN = 8;

interface Pos {
  left: number;
  top: number;
}

/**
 * Right-click / dropdown menu anchored at a screen position, with optional
 * submenus. Menu and submenus render into document.body and are positioned
 * from their measured size after mounting, so they always stay on screen and
 * a submenu sits flush against its row on whichever side has room.
 */
export function ContextMenu({ menu, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const subRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Pos>({ left: 0, top: 0 });
  const [openSub, setOpenSub] = useState<{ index: number; rect: DOMRect } | null>(null);
  const [subPos, setSubPos] = useState<Pos>({ left: 0, top: 0 });

  useEffect(() => {
    setOpenSub(null);
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || subRef.current?.contains(t)) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown, true);
    };
  }, [menu, onClose]);

  // Place the menu from its real size.
  useLayoutEffect(() => {
    if (!menu || !ref.current) return;
    const { offsetWidth: w, offsetHeight: h } = ref.current;
    setPos({
      left: Math.max(MARGIN, Math.min(menu.x, window.innerWidth - w - MARGIN)),
      top: Math.max(MARGIN, Math.min(menu.y, window.innerHeight - h - MARGIN)),
    });
  }, [menu]);

  // Place the submenu beside its row from its real size.
  useLayoutEffect(() => {
    if (!openSub || !subRef.current) return;
    const { offsetWidth: w, offsetHeight: h } = subRef.current;
    const r = openSub.rect;
    const fitsRight = r.right + w + MARGIN <= window.innerWidth;
    setSubPos({
      left: fitsRight ? r.right + 2 : Math.max(MARGIN, r.left - w - 2),
      top: Math.max(MARGIN, Math.min(r.top - 6, window.innerHeight - h - MARGIN)),
    });
  }, [openSub]);

  const pick = (item: MenuItem) => {
    if (item.disabled) return;
    onClose();
    item.onSelect();
  };

  const sub = menu && openSub ? (menu.items[openSub.index] as Submenu | undefined) : undefined;

  return createPortal(
    <AnimatePresence>
      {menu && (
        <motion.div
          key="menu"
          ref={ref}
          role="menu"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.12 }}
          style={{ left: pos.left, top: pos.top, maxHeight: window.innerHeight - 2 * MARGIN, transformOrigin: "top left" }}
          className="fixed z-40 min-w-56 max-w-80 overflow-y-auto rounded-lg border border-stage-700 bg-stage-900 p-1.5 shadow-2xl"
        >
          {menu.items.map((entry, i) => {
            if (entry === "divider") return <div key={i} className="my-1 border-t border-stage-800" />;
            if ("heading" in entry) {
              return (
                <div key={i} className="px-2.5 pb-1 pt-2 text-[11px] text-stage-500">
                  {entry.heading}
                </div>
              );
            }
            if ("submenu" in entry) {
              const open = openSub?.index === i;
              const show = (el: HTMLElement) => setOpenSub({ index: i, rect: el.getBoundingClientRect() });
              return (
                <button
                  key={i}
                  type="button"
                  role="menuitem"
                  aria-haspopup="menu"
                  aria-expanded={open}
                  onMouseEnter={(e) => show(e.currentTarget)}
                  onClick={(e) => (open ? setOpenSub(null) : show(e.currentTarget))}
                  className={clsx(
                    "flex w-full items-center justify-between gap-4 rounded-md px-2.5 py-1.5 text-left text-sm text-stage-100",
                    open ? "bg-stage-700" : "hover:bg-stage-700",
                  )}
                >
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    {entry.icon && <span className="text-stage-400">{entry.icon}</span>}
                    {entry.submenu}
                  </span>
                  <Icon name="ChevronRight" className="text-xs text-stage-500" />
                </button>
              );
            }
            return (
              <div key={i} onMouseEnter={() => setOpenSub(null)}>
                <MenuButton item={entry} onPick={pick} />
              </div>
            );
          })}
        </motion.div>
      )}
      {menu && sub && openSub && (
        <motion.div
          key={`sub-${openSub.index}`}
          ref={subRef}
          role="menu"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.1 }}
          style={{ left: subPos.left, top: subPos.top, maxHeight: window.innerHeight - 2 * MARGIN }}
          className="fixed z-50 min-w-56 max-w-80 overflow-y-auto rounded-lg border border-stage-700 bg-stage-900 p-1.5 shadow-2xl"
        >
          {sub.items.map((item, j) => (
            <MenuButton key={j} item={item} onPick={pick} />
          ))}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function MenuButton({ item, onPick }: { item: MenuItem; onPick: (item: MenuItem) => void }) {
  return (
    <button
      role="menuitem"
      disabled={item.disabled}
      onClick={() => onPick(item)}
      className={clsx(
        "flex w-full items-center justify-between gap-4 rounded-md px-2.5 py-1.5 text-left text-sm",
        item.disabled ? "cursor-default text-stage-500" : item.danger ? "text-danger hover:bg-danger/10" : "text-stage-100 hover:bg-stage-700",
      )}
    >
      <span className="flex items-center gap-2 whitespace-nowrap">
        {item.icon && <span className={item.disabled ? "text-stage-600" : "text-stage-400"}>{item.icon}</span>}
        {item.label}
      </span>
      {item.shortcut && <span className="text-xs text-stage-500">{item.shortcut}</span>}
    </button>
  );
}
