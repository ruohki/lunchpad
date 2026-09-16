import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { clsx } from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import type { Button as PadButton, HubApplyTarget, HubDelivery, ImportMode, ImportReview } from "../lib/api";
import { cornersOf, isControl, isKey } from "../lib/grid";
import { useDeviceStore } from "../store/device";
import { useHubStore } from "../store/hub";
import { useProfileStore } from "../store/profile";
import { PadFace } from "./PadFace";
import { ImportReviewDialog } from "./settings/ImportReviewDialog";
import { Button, IconClose, Segmented } from "./ui";

const CELL = 26;
/** A stable empty inbox: a selector must return the same reference while nothing changed. */
const NO_DELIVERIES: HubDelivery[] = [];

interface Flow {
  delivery: HubDelivery;
  pageId: string;
  pad: { x: number; y: number } | null;
  mode: ImportMode;
}

/**
 * What the hub sent to this app. Each delivery is reviewed in the same dialog
 * an imported file goes through; a button also needs a pad to land on.
 */
export function HubInbox() {
  const { t } = useTranslation();
  const open = useHubStore((s) => s.inboxOpen);
  const close = useHubStore((s) => s.closeInbox);
  const inbox = useHubStore((s) => s.state?.inbox ?? NO_DELIVERIES);
  const dismiss = useHubStore((s) => s.dismiss);
  const reviewDelivery = useHubStore((s) => s.review);
  const applyDelivery = useHubStore((s) => s.apply);
  const error = useHubStore((s) => s.error);
  const profile = useProfileStore((s) => s.profile);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [review, setReview] = useState<ImportReview | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setFlow(null);
      setReview(null);
    }
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || review) return;
      e.stopPropagation();
      if (flow) setFlow(null);
      else close();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, flow, review, close]);

  const start = (delivery: HubDelivery) => {
    const pageId = profile?.activePage ?? profile?.pages[0]?.id ?? "default";
    setFlow({ delivery, pageId, pad: null, mode: "append" });
  };

  const targetOf = (f: Flow): HubApplyTarget | null => {
    if (f.delivery.kind === "button") return f.pad ? { kind: "button", pageId: f.pageId, x: f.pad.x, y: f.pad.y } : null;
    if (f.delivery.kind === "page") return { kind: "page" };
    return { kind: "profile", mode: f.mode };
  };

  const toReview = async (f: Flow) => {
    const target = targetOf(f);
    if (!target) return;
    setBusy(true);
    const result = await reviewDelivery(f.delivery.id, target);
    setBusy(false);
    if (result) setReview(result);
  };

  // Stable callbacks: the review dialog resets its state whenever these change.
  const cancelReview = useCallback(() => setReview(null), []);
  const confirm = useCallback(async () => {
    if (!flow) return;
    const target = targetOf(flow);
    setReview(null);
    if (!target) return;
    setBusy(true);
    const report = await applyDelivery(flow.delivery.id, target);
    setBusy(false);
    if (report) {
      useProfileStore.setState({ lastImport: report });
      setFlow(null);
      if (inbox.length <= 1) close();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow, applyDelivery, inbox.length, close]);
  const confirmReview = useCallback(() => void confirm(), [confirm]);

  return createPortal(
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            key="hub-inbox"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-stage-950/80 p-6"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) close();
            }}
          >
            <motion.div
              role="dialog"
              aria-label={t("hub.inbox")}
              initial={{ scale: 0.98, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.98, y: 8 }}
              transition={{ duration: 0.12 }}
              className="flex max-h-full w-full max-w-2xl flex-col gap-4 rounded-xl border border-stage-700 bg-stage-900 p-5 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-stage-100">{flow ? flow.delivery.title : t("hub.inbox")}</h2>
                  <p className="mt-1 text-sm text-stage-300">{flow ? t("hub.target.title") : t("hub.inboxHint")}</p>
                </div>
                <button type="button" onClick={close} aria-label={t("common.close")} className="rounded-md p-1 text-stage-400 hover:bg-stage-800 hover:text-stage-100">
                  <IconClose />
                </button>
              </div>

              <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
                {flow ? (
                  <TargetPicker flow={flow} onChange={setFlow} />
                ) : inbox.length === 0 ? (
                  <p className="py-6 text-center text-sm text-stage-500">{t("hub.inboxEmpty")}</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {inbox.map((d) => (
                      <DeliveryRow key={d.id} delivery={d} onImport={() => start(d)} onDismiss={() => void dismiss(d.id)} />
                    ))}
                  </ul>
                )}
                {error && <p className="mt-3 text-xs text-danger">{error}</p>}
              </div>

              {flow && (
                <div className="flex justify-end gap-2">
                  <Button onClick={() => setFlow(null)}>{t("hub.target.back")}</Button>
                  <Button variant="primary" disabled={busy || !targetOf(flow)} onClick={() => void toReview(flow)}>
                    {t("hub.target.continue")}
                  </Button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <ImportReviewDialog review={review} onCancel={cancelReview} onConfirm={confirmReview} />
    </>,
    document.body,
  );
}

let appVersion: string | null = null;
void getVersion().then((v) => (appVersion = v)).catch(() => undefined);

/** Whether `a` is a newer version than `b` (1.0.0-rc.3 < 1.0.0 < 1.0.1). */
function newerThan(a: string, b: string): boolean {
  const parse = (v: string) => {
    const m = v.trim().replace(/^v/i, "").match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?/);
    return m ? { core: [Number(m[1]), Number(m[2] ?? 0), Number(m[3] ?? 0)], pre: m[4] ? m[4].split(".") : [] } : { core: [0, 0, 0], pre: [] };
  };
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < 3; i++) if (pa.core[i] !== pb.core[i]) return pa.core[i] > pb.core[i];
  if (pa.pre.length === 0 || pb.pre.length === 0) return pa.pre.length === 0 && pb.pre.length > 0;
  for (let i = 0; i < Math.max(pa.pre.length, pb.pre.length); i++) {
    const x = pa.pre[i];
    const y = pb.pre[i];
    if (x === undefined) return false;
    if (y === undefined) return true;
    const nx = Number(x);
    const ny = Number(y);
    if (!Number.isNaN(nx) && !Number.isNaN(ny)) {
      if (nx !== ny) return nx > ny;
    } else if (x !== y) return x > y;
  }
  return false;
}

function DeliveryRow({ delivery, onImport, onDismiss }: { delivery: HubDelivery; onImport: () => void; onDismiss: () => void }) {
  const { t } = useTranslation();
  const risk = delivery.risk === "danger" ? "bg-danger" : delivery.risk === "caution" ? "bg-warn" : "bg-ok";
  const newer = delivery.appVersion && appVersion ? newerThan(delivery.appVersion, appVersion) : false;
  return (
    <li className="flex items-center gap-3 rounded-lg border border-stage-700 bg-stage-800/50 px-3 py-2.5">
      <span className={clsx("h-2 w-2 shrink-0 rounded-full", risk)} title={t(`hub.risk.${delivery.risk}`)} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="rounded bg-stage-700 px-1.5 text-[10px] font-semibold uppercase tracking-wide text-stage-300">{t(`hub.kinds.${delivery.kind}`)}</span>
          <span className="truncate text-sm text-stage-100">{delivery.title}</span>
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-stage-500">
          {delivery.author && <span>{t("hub.by", { name: delivery.author.name })}</span>}
          {delivery.versionNumber > 0 && <span>{t("hub.version", { number: delivery.versionNumber })}</span>}
          {delivery.appVersion && <span className={newer ? "text-warn" : undefined}>{t(newer ? "hub.madeWithNewer" : "hub.madeWith", { version: delivery.appVersion })}</span>}
          <button type="button" onClick={() => void openUrl(delivery.listingUrl)} className="text-accent-400 hover:underline">
            {t("hub.viewOnHub")}
          </button>
        </div>
      </div>
      <Button size="sm" variant="primary" onClick={onImport}>
        {t("hub.import")}
      </Button>
      <Button size="sm" variant="danger" onClick={onDismiss}>
        {t("hub.dismiss")}
      </Button>
    </li>
  );
}

/** A pad for a button, a mode for a configuration; a page needs nothing. */
function TargetPicker({ flow, onChange }: { flow: Flow; onChange: (next: Flow) => void }) {
  const { t } = useTranslation();
  const profile = useProfileStore((s) => s.profile);
  const layout = useDeviceStore((s) => s.layout);
  const pages = profile?.pages ?? [];
  const page = pages.find((p) => p.id === flow.pageId) ?? pages[0];

  const cells = useMemo(() => {
    if (!layout) return null;
    const rows: { x: number; y: number; usable: boolean; button: PadButton | null; fader: boolean; corners: ReturnType<typeof cornersOf> }[][] = [];
    for (let y = layout.height - 1; y >= 0; y--) {
      const row = [];
      for (let x = 0; x < layout.width; x++) {
        const spec = layout.pads.find((p) => p.x === x && p.y === y);
        const usable = Boolean(spec && spec.shape !== "empty" && spec.shape !== "logo" && !isControl(spec.shape) && !isKey(spec.shape) && spec.led !== "none");
        const placed = page?.buttons.find((b) => b.x === x && b.y === y) ?? null;
        const fader = Boolean(page?.faders.some((f) => faderCovers(f, x, y)));
        row.push({ x, y, usable, button: placed, fader, corners: cornersOf(spec?.shape) });
      }
      rows.push(row);
    }
    return rows;
  }, [layout, page]);

  if (flow.delivery.kind === "page") return <p className="text-sm text-stage-300">{t("hub.target.pageHint")}</p>;

  if (flow.delivery.kind === "profile") {
    return (
      <div className="flex flex-col gap-3">
        <Segmented
          value={flow.mode}
          options={[
            { value: "append", label: t("hub.target.profileAppend") },
            { value: "replace", label: t("hub.target.profileReplace") },
          ]}
          onChange={(mode) => onChange({ ...flow, mode })}
        />
        {flow.mode === "replace" && <p className="text-xs text-warn">{t("hub.target.profileReplaceHint")}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2 text-xs text-stage-400">
        {t("hub.target.page")}
        <select value={page?.id ?? ""} onChange={(e) => onChange({ ...flow, pageId: e.target.value, pad: null })} className="rounded-md bg-stage-800 px-2 py-1 text-sm text-stage-100 outline-none focus:ring-1 focus:ring-accent-400">
          {pages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs text-stage-400">{t("hub.target.padHint")}</p>
      {!cells ? (
        <p className="text-xs text-warn">{t("hub.errors.noLayout")}</p>
      ) : (
        <div className="inline-grid gap-1 self-start rounded-xl bg-stage-950 p-2" style={{ gridTemplateColumns: `repeat(${layout!.width}, ${CELL}px)` }}>
          {cells.flat().map((c) => {
            const picked = flow.pad?.x === c.x && flow.pad?.y === c.y;
            if (!c.usable) return <span key={`${c.x},${c.y}`} style={{ width: CELL, height: CELL }} />;
            return (
              <button
                key={`${c.x},${c.y}`}
                type="button"
                disabled={c.fader}
                aria-label={t("grid.padLabel", { column: c.x + 1, row: c.y + 1 })}
                aria-pressed={picked}
                onClick={() => onChange({ ...flow, pad: { x: c.x, y: c.y } })}
                className={clsx("overflow-hidden transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-30", picked && "ring-2 ring-accent-400 ring-offset-2 ring-offset-stage-950")}
                style={{ width: CELL, height: CELL, borderRadius: c.corners === "round" ? 9999 : 4 }}
              >
                {c.button ? <PadFace button={c.button} cell={CELL} active={false} corners={c.corners} /> : <span className="block h-full w-full bg-stage-700" style={{ borderRadius: c.corners === "round" ? 9999 : 4 }} />}
              </button>
            );
          })}
        </div>
      )}
      {flow.pad && page?.buttons.some((b) => b.x === flow.pad!.x && b.y === flow.pad!.y) && <p className="text-xs text-warn">{t("hub.target.occupied")}</p>}
    </div>
  );
}

function faderCovers(f: { x: number; y: number; direction: string; length: number }, x: number, y: number): boolean {
  const [dx, dy] = { up: [0, 1], right: [1, 0], down: [0, -1], left: [-1, 0] }[f.direction] ?? [0, 1];
  for (let i = 0; i < f.length; i++) if (f.x + dx * i === x && f.y + dy * i === y) return true;
  return false;
}
