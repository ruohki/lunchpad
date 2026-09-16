import { openUrl } from "@tauri-apps/plugin-opener";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import type { HubShareResult } from "../lib/api";
import { hubModelId } from "../lib/hubModel";
import { useDeviceStore } from "../store/device";
import { useHubStore } from "../store/hub";
import { useProfileStore } from "../store/profile";
import { useUiStore } from "../store/ui";
import { fieldCls } from "./settings/SettingsDialog";
import { TagInput } from "./TagInput";
import { Button, IconClose, Segmented } from "./ui";

const TITLE_MAX = 80;
const SUMMARY_MAX = 160;

/**
 * Share a button or a page on the hub from the app: a title, a line about it,
 * public or unlisted, then the link. The hub scans the content and refuses
 * anything with a written-out credential; that message is shown here.
 */
export function ShareDialog() {
  const { t } = useTranslation();
  const intent = useUiStore((s) => s.shareIntent);
  const target = intent?.target ?? null;
  const updating = intent?.mode === "update" ? intent.item : null;
  const close = useUiStore((s) => s.closeShare);
  const share = useHubStore((s) => s.share);
  const update = useHubStore((s) => s.update);
  const profile = useProfileStore((s) => s.profile);
  const device = useDeviceStore((s) => s.device);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<"public" | "unlisted">("public");
  const [changelog, setChangelog] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<HubShareResult | null>(null);
  const [copied, setCopied] = useState(false);

  // A fresh form for every target, titled after the caption or the page name.
  useEffect(() => {
    if (!target) return;
    const page = profile?.pages.find((p) => p.id === target.pageId);
    let suggested = "";
    let suggestedDescription = "";
    if (target.kind === "page") suggested = page?.name ?? "";
    else {
      const b = page?.buttons.find((x) => x.x === target.x && x.y === target.y);
      suggested = b && b.look.type === "text" ? b.look.caption : "";
      // The button's own description (its Markdown tooltip) is the natural starting point.
      suggestedDescription = b?.description ?? "";
    }
    setTitle(suggested.slice(0, TITLE_MAX));
    setSummary("");
    setDescription(suggestedDescription.slice(0, 10000));
    setTags([]);
    setChangelog("");
    setVisibility("public");
    setError(null);
    setResult(null);
    setCopied(false);
    setBusy(false);
  }, [target, profile]);

  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      close();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [target, close]);

  const submit = async () => {
    if (!target) return;
    if (!updating && title.trim().length < 3) return;
    setBusy(true);
    setError(null);
    try {
      if (updating) {
        setResult(await update({ listingId: updating.listingId, target, changelog: changelog.trim() }));
        return;
      }
      const r = await share({
        target,
        title: title.trim(),
        summary: summary.trim(),
        description: description.trim(),
        tags,
        visibility,
        model: hubModelId(device?.virtual ? null : device?.model),
      });
      setResult(r);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // the field is selectable as a fallback
    }
  };

  return createPortal(
    <AnimatePresence>
      {target && (
        <motion.div
          key="share"
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
            aria-label={t(updating ? (target.kind === "page" ? "hub.share.titleUpdatePage" : "hub.share.titleUpdateButton") : target.kind === "page" ? "hub.share.titlePage" : "hub.share.titleButton")}
            initial={{ scale: 0.98, y: 8 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.98, y: 8 }}
            transition={{ duration: 0.12 }}
            className="flex max-h-full w-full max-w-lg flex-col gap-4 rounded-xl border border-stage-700 bg-stage-900 p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-stage-100">{t(updating ? (target.kind === "page" ? "hub.share.titleUpdatePage" : "hub.share.titleUpdateButton") : target.kind === "page" ? "hub.share.titlePage" : "hub.share.titleButton")}</h2>
                {!result && <p className="mt-1 text-sm text-stage-300">{updating ? t("hub.share.updateIntro", { title: updating.title }) : t("hub.share.intro")}</p>}
              </div>
              <button type="button" onClick={close} aria-label={t("common.close")} className="rounded-md p-1 text-stage-400 hover:bg-stage-800 hover:text-stage-100">
                <IconClose />
              </button>
            </div>

            {result ? (
              <div className="flex flex-col gap-3">
                <p className={"rounded-lg border px-3 py-2 text-sm " + (result.status === "published" ? "border-ok/30 bg-ok/5 text-stage-100" : result.status === "pending" ? "border-warn/30 bg-warn/5 text-stage-100" : "border-danger/40 bg-danger/10 text-stage-100")}>
                  {result.status === "published"
                    ? updating
                      ? t("hub.share.doneUpdated", { number: result.versionNumber })
                      : t("hub.share.donePublished")
                    : result.status === "pending"
                      ? updating
                        ? t("hub.share.doneUpdatePending", { number: result.versionNumber })
                        : t("hub.share.donePending")
                      : t("hub.share.doneRejected", { reason: result.statusReason ?? "" })}
                </p>
                <div className="flex gap-2">
                  <input readOnly value={result.shareUrl} onFocus={(e) => e.currentTarget.select()} className={fieldCls + " flex-1"} />
                  <Button size="sm" onClick={() => void copy()}>
                    {copied ? t("hub.share.copied") : t("hub.share.copyLink")}
                  </Button>
                </div>
                <div className="flex justify-end gap-2">
                  <Button onClick={() => void openUrl(result.url)}>{t("hub.share.open")}</Button>
                  <Button variant="primary" onClick={close}>
                    {t("common.close")}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-1 text-xs text-stage-400">
                {updating && (
                  <label className="flex flex-col gap-1">
                    {t("hub.share.changelog")}
                    <textarea value={changelog} onChange={(e) => setChangelog(e.target.value.slice(0, 1000))} rows={3} className={fieldCls + " font-sans"} autoFocus />
                    <span>{t("hub.share.changelogHint")}</span>
                  </label>
                )}
                {!updating && (
                <>
                <label className="flex flex-col gap-1">
                  <span className="flex justify-between">
                    {t("hub.share.name")}
                    <span className="text-stage-500">
                      {title.length}/{TITLE_MAX}
                    </span>
                  </span>
                  <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))} className={fieldCls + " font-sans"} autoFocus />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="flex justify-between">
                    {t("hub.share.summary")}
                    <span className="text-stage-500">
                      {summary.length}/{SUMMARY_MAX}
                    </span>
                  </span>
                  <input value={summary} onChange={(e) => setSummary(e.target.value.slice(0, SUMMARY_MAX))} className={fieldCls + " font-sans"} />
                  <span>{t("hub.share.summaryHint")}</span>
                </label>
                <label className="flex flex-col gap-1">
                  {t("hub.share.description")}
                  <textarea value={description} onChange={(e) => setDescription(e.target.value.slice(0, 10000))} rows={4} className={fieldCls + " font-sans"} />
                  <span>{t("hub.share.descriptionHint")}</span>
                </label>
                <div className="flex flex-col gap-1">
                  {t("hub.share.tags")}
                  <TagInput value={tags} onChange={setTags} placeholder="obs soundboard" />
                  <span>{t("hub.share.tagsHint")}</span>
                </div>
                <div className="flex flex-col gap-1">
                  {t("hub.share.visibility")}
                  <div>
                    <Segmented
                      value={visibility}
                      options={[
                        { value: "public", label: t("hub.share.public") },
                        { value: "unlisted", label: t("hub.share.unlisted") },
                      ]}
                      onChange={setVisibility}
                    />
                  </div>
                  <span>{visibility === "public" ? t("hub.share.publicHint") : t("hub.share.unlistedHint")}</span>
                </div>
                </>
                )}
                {error && <p className="whitespace-pre-line rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-stage-100">{error}</p>}
                <div className="flex justify-end gap-2 pt-1">
                  <Button onClick={close}>{t("common.cancel")}</Button>
                  <Button variant="primary" disabled={busy || (!updating && title.trim().length < 3)} onClick={() => void submit()}>
                    {busy ? t("hub.share.sharing") : updating ? t("hub.share.submitUpdate") : t("hub.share.submit")}
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
