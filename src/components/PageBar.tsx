import { clsx } from "clsx";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "../icons/Icon";
import { DEFAULT_PAGE_ID, type Page } from "../lib/api";
import { useProfileStore } from "../store/profile";
import { ContextMenu, type MenuState } from "./ContextMenu";
import { Tooltip } from "./Tooltip";

/**
 * Page tabs in the header strip. Click switches the page (and repaints the
 * device). Tabs keep a readable width: with many pages the strip scrolls
 * (without a scrollbar, the active tab is kept in view) and the list button
 * at the end opens every page in a menu.
 */
export function PageTabs() {
  const { t } = useTranslation();
  const profile = useProfileStore((s) => s.profile);
  const setActivePage = useProfileStore((s) => s.setActivePage);
  const addPage = useProfileStore((s) => s.addPage);
  const renamePage = useProfileStore((s) => s.renamePage);
  const removePage = useProfileStore((s) => s.removePage);
  const duplicatePage = useProfileStore((s) => s.duplicatePage);
  const movePage = useProfileStore((s) => s.movePage);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const strip = useRef<HTMLDivElement>(null);
  const activeId = profile?.activePage;

  // Keep the active tab visible when it changes or pages come and go.
  useEffect(() => {
    if (!activeId) return;
    const el = strip.current?.querySelector<HTMLElement>(`[data-page="${CSS.escape(activeId)}"]`);
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeId, profile?.pages.length]);

  if (!profile) return null;

  const openMenu = (e: React.MouseEvent, page: Page, index: number) => {
    e.preventDefault();
    setMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        { label: t("pages.rename"), onSelect: () => setRenaming(page.id) },
        { label: t("pages.duplicate"), onSelect: () => void duplicatePage(page.id) },
        "divider",
        { label: t("pages.moveLeft"), disabled: index === 0, onSelect: () => void movePage(page.id, index - 1) },
        {
          label: t("pages.moveRight"),
          disabled: index === profile.pages.length - 1,
          onSelect: () => void movePage(page.id, index + 1),
        },
        "divider",
        {
          label: t("pages.remove"),
          danger: true,
          disabled: page.id === DEFAULT_PAGE_ID,
          onSelect: () => void removePage(page.id),
        },
      ],
    });
  };

  const openList = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenu({
      x: rect.left,
      y: rect.bottom + 4,
      items: profile.pages.map((page) => ({
        label: page.name,
        icon: page.id === profile.activePage ? <Icon name="Check" /> : undefined,
        onSelect: () => void setActivePage(page.id),
      })),
    });
  };

  return (
    <nav className="flex h-full min-w-0 flex-1 items-end" aria-label={t("pages.label")}>
      <div
        ref={strip}
        className="flex h-full min-w-0 items-end gap-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onWheel={(e) => {
          // A plain wheel scrolls the strip sideways, like a tab bar.
          if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && strip.current) strip.current.scrollLeft += e.deltaY;
        }}
      >
        {profile.pages.map((page, index) => {
          const active = page.id === profile.activePage;
          return (
            <div key={page.id} data-page={page.id} className="relative shrink-0">
              {renaming === page.id ? (
                <RenameField
                  initial={page.name}
                  onDone={(name) => {
                    setRenaming(null);
                    if (name && name !== page.name) void renamePage(page.id, name);
                  }}
                />
              ) : (
                <button
                  onClick={() => void setActivePage(page.id)}
                  onDoubleClick={() => setRenaming(page.id)}
                  onContextMenu={(e) => openMenu(e, page, index)}
                  className={clsx(
                    "relative flex max-w-44 items-baseline rounded-t-md px-3 pb-2.5 pt-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent-400",
                    active ? "text-stage-100" : "text-stage-400 hover:text-stage-200",
                  )}
                >
                  <span className="truncate">{page.name}</span>
                  <span className="ml-1.5 shrink-0 text-[11px] text-stage-500">{page.buttons.length || ""}</span>
                </button>
              )}
              {active && renaming !== page.id && (
                <motion.span
                  layoutId="page-underline"
                  className="absolute inset-x-1 bottom-0 h-0.5 rounded-full bg-accent-500"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="mb-1 ml-1 flex shrink-0 items-center gap-0.5">
        <Tooltip content={t("pages.add")} side="bottom">
          <button
            onClick={() => void addPage("")}
            aria-label={t("pages.add")}
            className="rounded-md px-2 py-1 text-sm text-stage-400 hover:bg-stage-800 hover:text-stage-100"
          >
            +
          </button>
        </Tooltip>
        {profile.pages.length > 1 && (
          <Tooltip content={t("pages.all", { count: profile.pages.length })} side="bottom">
            <button
              onClick={openList}
              aria-label={t("pages.all", { count: profile.pages.length })}
              className="rounded-md px-1.5 py-1 text-stage-400 hover:bg-stage-800 hover:text-stage-100"
            >
              <Icon name="ChevronDown" className="text-[10px]" />
            </button>
          </Tooltip>
        )}
      </div>
      <ContextMenu menu={menu} onClose={() => setMenu(null)} />
    </nav>
  );
}

function RenameField({ initial, onDone }: { initial: string; onDone: (name: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <input
      autoFocus
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onDone(value.trim())}
      onKeyDown={(e) => {
        if (e.key === "Enter") onDone(value.trim());
        if (e.key === "Escape") onDone(initial);
      }}
      className="mb-1 w-32 rounded-md bg-stage-800 px-2 py-1 text-sm text-stage-100 outline-none focus:ring-1 focus:ring-accent-400"
    />
  );
}
