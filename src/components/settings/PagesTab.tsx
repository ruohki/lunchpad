import { open, save } from "@tauri-apps/plugin-dialog";
import { Reorder, useDragControls } from "framer-motion";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "../../icons/Icon";
import { api, DEFAULT_PAGE_ID, type ImportMode, type ImportReview, type Page } from "../../lib/api";
import { useProfileStore } from "../../store/profile";
import { Tooltip } from "../Tooltip";
import { Button } from "../ui";
import { Section } from "./SettingsDialog";
import { buttonsOutside } from "../../lib/grid";
import { useDeviceStore } from "../../store/device";
import { useHubStore } from "../../store/hub";
import { useUiStore } from "../../store/ui";
import { ImportReviewDialog } from "./ImportReviewDialog";

const inputCls = "w-full rounded-md bg-stage-800 px-2.5 py-1.5 text-sm text-stage-100 outline-none focus:ring-1 focus:ring-accent-400";

export function PagesTab() {
  const { t } = useTranslation();
  const profile = useProfileStore((s) => s.profile);
  const addPage = useProfileStore((s) => s.addPage);
  const renamePage = useProfileStore((s) => s.renamePage);
  const removePage = useProfileStore((s) => s.removePage);
  const duplicatePage = useProfileStore((s) => s.duplicatePage);
  const movePage = useProfileStore((s) => s.movePage);
  const setActivePage = useProfileStore((s) => s.setActivePage);
  const importLegacyFile = useProfileStore((s) => s.importLegacyFile);
  const importPageFile = useProfileStore((s) => s.importPageFile);
  const exportPageFile = useProfileStore((s) => s.exportPageFile);
  const restoreBackup = useProfileStore((s) => s.restoreBackup);
  const [legacyMode, setLegacyMode] = useState<ImportMode>("append");
  const [dragging, setDragging] = useState<string | null>(null);
  const layout = useDeviceStore((s) => s.layout);
  const pages = profile?.pages ?? [];

  const hubSignedIn = useHubStore((s) => s.state?.status === "connected" || s.state?.status === "connecting" || s.state?.status === "offline");
  const shared = useHubStore((s) => s.state?.shared);
  const openShare = useUiStore((s) => s.openShare);
  const openUpdate = useUiStore((s) => s.openUpdate);
  const openSettingsTab = useUiStore((s) => s.openSettings);
  const closeSettings = useUiStore((s) => s.closeSettings);
  const sharePage = (page: Page) => {
    if (!hubSignedIn) {
      openSettingsTab("hub");
      return;
    }
    closeSettings();
    const item = (shared ?? []).find((i) => i.kind === "page" && i.pageId === page.id);
    if (item) openUpdate(item, { kind: "page", pageId: page.id });
    else openShare({ kind: "page", pageId: page.id });
  };
  const [pending, setPending] = useState<{ review: ImportReview; run: () => Promise<unknown> } | null>(null);
  // A file made elsewhere is looked over first; anything worth checking is shown before it lands.
  const reviewThen = async (path: string, run: () => Promise<unknown>) => {
    const review = await api.reviewImportFile(path).catch(() => null);
    if (!review || review.findings.length === 0) await run();
    else setPending({ review, run });
  };
  const pickAndImportLegacy = async () => {
    const path = await open({ multiple: false, directory: false, filters: [{ name: t("settings.fileJson"), extensions: ["json", "txt"] }] });
    if (typeof path === "string") await reviewThen(path, () => importLegacyFile(path, legacyMode));
  };
  const pickAndImportPage = async () => {
    const path = await open({ multiple: false, directory: false, filters: [{ name: t("settings.filePage"), extensions: ["json"] }] });
    if (typeof path === "string") await reviewThen(path, () => importPageFile(path));
  };
  const exportAll = async () => {
    const path = await save({ defaultPath: "lunchpad-configuration.json", filters: [{ name: t("settings.fileProfile"), extensions: ["json"] }] });
    if (path) await api.exportProfileFile(path).catch((e) => useProfileStore.setState({ error: String(e) }));
  };
  const exportPage = async (page: Page) => {
    const path = await save({ defaultPath: `${page.name}.lunchpad-page.json`, filters: [{ name: t("settings.filePage"), extensions: ["json"] }] });
    if (path) await exportPageFile(page.id, path);
  };
  const reorder = (next: Page[]) => {
    if (!dragging) return;
    const to = next.findIndex((p) => p.id === dragging);
    const from = pages.findIndex((p) => p.id === dragging);
    if (to >= 0 && to !== from) void movePage(dragging, to);
  };

  const segment = (mode: ImportMode, label: string) => (
    <button
      key={mode}
      type="button"
      onClick={() => setLegacyMode(mode)}
      className={"flex-1 rounded-md px-2 py-1 font-medium transition-colors " + (legacyMode === mode ? "bg-stage-600 text-stage-100" : "text-stage-400 hover:text-stage-200")}
    >
      {label}
    </button>
  );

  return (
    <>
      <Section title={t("settings.pages")} description={t("settings.pagesHint")}>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => void addPage("")}>
            {t("pages.add")}
          </Button>
          <Button size="sm" onClick={() => void pickAndImportPage()}>
            {t("settings.importPage")}
          </Button>
          <Button size="sm" onClick={() => void exportAll()}>
            {t("settings.exportAll")}
          </Button>
          <Button size="sm" onClick={() => openSettingsTab("hub")}>
            {t("settings.backupToHub")}
          </Button>
        </div>
        <Reorder.Group axis="y" values={pages} onReorder={reorder} className="flex flex-col gap-1.5">
          {pages.map((page, index) => (
            <PageRow
              key={page.id}
              page={page}
              index={index}
              count={pages.length}
              active={page.id === profile?.activePage}
              outside={buttonsOutside(page, layout).length}
              onDragStart={() => setDragging(page.id)}
              onDragEnd={() => setDragging(null)}
              onActivate={() => void setActivePage(page.id)}
              onRename={(name) => void renamePage(page.id, name)}
              onDuplicate={() => void duplicatePage(page.id)}
              onMove={(to) => void movePage(page.id, to)}
              onExport={() => void exportPage(page)}
              onShare={() => sharePage(page)}
              sharedBefore={(shared ?? []).some((i) => i.kind === "page" && i.pageId === page.id)}
              onRemove={() => void removePage(page.id)}
            />
          ))}
        </Reorder.Group>
      </Section>

      <Section title={t("settings.restore")} description={t("settings.restoreHint")}>
        <div>
          <Button size="sm" onClick={() => void restoreBackup()}>
            {t("settings.restore")}
          </Button>
        </div>
      </Section>

      <Section title={t("settings.legacyTitle")} description={t("settings.legacyHint")}>
        <div className="flex max-w-sm gap-1 rounded-lg bg-stage-800 p-1 text-xs">
          {segment("append", t("settings.legacyAppend"))}
          {segment("replace", t("settings.legacyReplace"))}
        </div>
        <div>
          <Button size="sm" onClick={() => void pickAndImportLegacy()}>
            {t("settings.legacyChoose")}
          </Button>
        </div>
      </Section>
      <ImportReviewDialog
        review={pending?.review ?? null}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          const run = pending?.run;
          setPending(null);
          if (run) void run();
        }}
      />
    </>
  );
}

function PageRow({
  page,
  index,
  count,
  active,
  outside,
  onDragStart,
  onDragEnd,
  onActivate,
  onRename,
  onDuplicate,
  onMove,
  onExport,
  onShare,
  sharedBefore,
  onRemove,
}: {
  page: Page;
  index: number;
  count: number;
  active: boolean;
  outside: number;
  onDragStart: () => void;
  onDragEnd: () => void;
  onActivate: () => void;
  onRename: (name: string) => void;
  onDuplicate: () => void;
  onMove: (to: number) => void;
  onExport: () => void;
  onShare: () => void;
  sharedBefore: boolean;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const controls = useDragControls();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(page.name);
  const actions = page.buttons.reduce((n, b) => n + b.down.length + b.up.length + b.hold.length, 0);
  const finish = () => {
    setEditing(false);
    const next = name.trim();
    if (next && next !== page.name) onRename(next);
    else setName(page.name);
  };
  const iconBtn = "rounded-md px-1.5 py-1 text-stage-400 hover:bg-stage-700 hover:text-stage-100 disabled:opacity-30 disabled:hover:bg-transparent";

  return (
    <Reorder.Item
      value={page}
      dragListener={false}
      dragControls={controls}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      whileDrag={{ scale: 1.01, boxShadow: "0 12px 30px -10px rgba(0,0,0,0.8)" }}
      className={"flex items-center gap-2 rounded-lg border px-2 py-1.5 " + (active ? "border-accent-500/50 bg-stage-800/70" : "border-stage-700 bg-stage-800/40")}
    >
      <Tooltip content={t("pages.dragHandle")}>
        <button type="button" aria-label={t("pages.dragHandle")} onPointerDown={(e) => controls.start(e)} className="cursor-grab touch-none select-none rounded px-1 py-1 text-stage-500 hover:bg-stage-700 hover:text-stage-200 active:cursor-grabbing">
          <Icon name="GripVertical" />
        </button>
      </Tooltip>
      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={finish}
            onKeyDown={(e) => {
              if (e.key === "Enter") finish();
              if (e.key === "Escape") {
                setName(page.name);
                setEditing(false);
              }
            }}
            className={inputCls}
          />
        ) : (
          <button type="button" onClick={onActivate} onDoubleClick={() => setEditing(true)} className="flex min-w-0 max-w-full items-baseline gap-2 text-left">
            <span className={"truncate text-sm font-medium " + (active ? "text-stage-100" : "text-stage-200")}>{page.name}</span>
            <span className="shrink-0 text-xs text-stage-500">
              {t("common.button", { count: page.buttons.length })} · {t("common.action", { count: actions })}
            </span>
            {outside > 0 && <span className="shrink-0 rounded bg-warn/20 px-1.5 text-[11px] text-warn">{t("pages.outside", { count: outside })}</span>}
          </button>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <Tooltip content={t("pages.rename")}>
          <button type="button" aria-label={t("pages.rename")} onClick={() => setEditing(true)} className={iconBtn}>
            <Icon name="Pencil" />
          </button>
        </Tooltip>
        <Tooltip content={t("pages.duplicate")}>
          <button type="button" aria-label={t("pages.duplicate")} onClick={onDuplicate} className={iconBtn}>
            <Icon name="Copy" />
          </button>
        </Tooltip>
        <Tooltip content={t("pages.moveUp")}>
          <button type="button" aria-label={t("pages.moveUp")} disabled={index === 0} onClick={() => onMove(index - 1)} className={iconBtn}>
            <Icon name="ArrowUp" />
          </button>
        </Tooltip>
        <Tooltip content={t("pages.moveDown")}>
          <button type="button" aria-label={t("pages.moveDown")} disabled={index === count - 1} onClick={() => onMove(index + 1)} className={iconBtn}>
            <Icon name="ArrowDown" />
          </button>
        </Tooltip>
        <Tooltip content={t("pages.export")}>
          <button type="button" aria-label={t("pages.export")} onClick={onExport} className={iconBtn}>
            <Icon name="FileOutput" />
          </button>
        </Tooltip>
        <Tooltip content={sharedBefore ? t("pages.update") : t("pages.share")}>
          <button type="button" aria-label={sharedBefore ? t("pages.update") : t("pages.share")} onClick={onShare} className={iconBtn + (sharedBefore ? " text-accent-400" : "")}>
            <Icon name="Globe" />
          </button>
        </Tooltip>
        <Tooltip content={page.id === DEFAULT_PAGE_ID ? t("pages.removeDefault") : t("pages.remove")}>
          <button type="button" aria-label={t("pages.remove")} disabled={page.id === DEFAULT_PAGE_ID} onClick={onRemove} className={iconBtn + " hover:text-danger"}>
            <Icon name="Trash" />
          </button>
        </Tooltip>
      </div>
    </Reorder.Item>
  );
}
