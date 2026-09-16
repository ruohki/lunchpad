import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useDeviceStore } from "../store/device";
import { useProfileStore } from "../store/profile";
import { useSettingsStore } from "../store/settings";
import { useUpdateStore } from "../store/update";
import { Button, IconClose } from "./ui";
import { useState } from "react";
import { useUiStore } from "../store/ui";
import { useHubStore } from "../store/hub";
import { buttonsOutside } from "../lib/grid";

/** Bottom-right stack for errors and import results. */
export function Notices() {
  const { t } = useTranslation();
  const profileError = useProfileStore((s) => s.error);
  const lastImport = useProfileStore((s) => s.lastImport);
  const clearProfile = useProfileStore((s) => s.clearError);
  const deviceError = useDeviceStore((s) => s.error);
  const connected = useDeviceStore((s) => s.status === "connected");
  const inputProblem = useSettingsStore((s) => s.inputProblem);
  const dismissInput = useSettingsStore((s) => s.dismissInputProblem);
  const checkKeyboard = useSettingsStore((s) => s.checkKeyboardAccess);
  const undoHint = useProfileStore((s) => s.undoHint);
  const undo = useProfileStore((s) => s.undo);
  const dismissUndo = useProfileStore((s) => s.dismissUndo);
  const missingFiles = useProfileStore((s) => s.missingFiles);
  const missingDismissed = useProfileStore((s) => s.missingDismissed);
  const dismissMissing = useProfileStore((s) => s.dismissMissing);
  const activePage = useProfileStore((s) => s.activePage());
  const layout = useDeviceStore((s) => s.layout);
  const openOutside = useUiStore((s) => s.openOutside);
  const outside = activePage ? buttonsOutside(activePage, layout).length : 0;
  const [outsideDismissed, setOutsideDismissed] = useState<string | null>(null);
  const outsideKey = activePage ? `${activePage.id}:${outside}:${layout?.model ?? ""}` : "";
  const updateStatus = useUpdateStore((s) => s.status);
  const updateVersion = useUpdateStore((s) => s.version);
  const updateNotes = useUpdateStore((s) => s.notes);
  const updateDismissed = useUpdateStore((s) => s.dismissed);
  const dismissUpdate = useUpdateStore((s) => s.dismiss);
  const installUpdate = useUpdateStore((s) => s.install);

  const arrival = useHubStore((s) => s.arrival);
  const dismissArrival = useHubStore((s) => s.dismissArrival);
  const openInbox = useHubStore((s) => s.openInbox);

  const items: { key: string; tone: "error" | "info"; title: string; lines: string[]; onClose: () => void; action?: { label: string; run: () => void } }[] = [];
  if (arrival) {
    items.push({
      key: `hub-${arrival.id}`,
      tone: "info",
      title: t("hub.arrivedTitle"),
      lines: [t("hub.arrivedLine", { title: arrival.title, by: arrival.author ? t("hub.by", { name: arrival.author.name }) : "" }).replace(/\s{2,}/g, " ")],
      onClose: dismissArrival,
      action: { label: t("hub.openInbox"), run: openInbox },
    });
  }
  if (inputProblem) {
    items.push({
      key: "input",
      tone: "error",
      title: t("notices.inputTitle"),
      lines: [inputProblem.needsPermission ? t("notices.inputPermission") : t("notices.inputReason", { reason: inputProblem.reason })],
      onClose: dismissInput,
      action: { label: t("notices.checkAgain"), run: () => void checkKeyboard() },
    });
  }
  if (profileError) {
    items.push({ key: "profile-error", tone: "error", title: t("notices.errorTitle"), lines: [profileError], onClose: clearProfile });
  }
  if (lastImport) {
    const { pages, buttons, actions, warnings } = lastImport;
    items.push({
      key: "import",
      tone: "info",
      title: t("notices.importTitle", { pages: t("common.page", { count: pages }) }),
      lines: [
        t("notices.importSummary", { buttons: t("common.button", { count: buttons }), actions: t("common.action", { count: actions }) }),
        ...warnings.slice(0, 5),
        ...(warnings.length > 5 ? [t("notices.moreNotes", { count: warnings.length - 5 })] : []),
      ],
      onClose: clearProfile,
    });
  }
  if (undoHint !== null) {
    items.push({ key: "undo", tone: "info", title: t("notices.undoTitle"), lines: [t("notices.undoHint")], onClose: dismissUndo, action: { label: t("notices.undo"), run: () => void undo() } });
  }
  if (missingFiles.length > 0 && !missingDismissed) {
    items.push({
      key: "missing",
      tone: "error",
      title: t("notices.missingTitle", { count: missingFiles.length }),
      lines: [...missingFiles.slice(0, 3).map((f) => f.split(/[\\/]/).pop() ?? f), ...(missingFiles.length > 3 ? [t("notices.moreNotes", { count: missingFiles.length - 3 })] : []), t("notices.missingHint")],
      onClose: dismissMissing,
    });
  }
  if (outside > 0 && outsideDismissed !== outsideKey && layout) {
    items.push({
      key: "outside",
      tone: "info",
      title: t("notices.outsideTitle", { count: outside, model: t(`models.${layout.model}`) }),
      lines: [t("notices.outsideHint")],
      onClose: () => setOutsideDismissed(outsideKey),
      action: { label: t("notices.outsideShow"), run: openOutside },
    });
  }
  if (updateStatus === "available" && !updateDismissed) {
    items.push({
      key: "update",
      tone: "info",
      title: t("updater.noticeTitle"),
      lines: [t("updater.available", { version: updateVersion }), ...(updateNotes ? [updateNotes.split("\n")[0].slice(0, 160)] : [])],
      onClose: dismissUpdate,
      action: { label: t("updater.install"), run: () => void installUpdate() },
    });
  }
  if (deviceError && !connected) {
    items.push({ key: "device-error", tone: "error", title: t("notices.launchpad"), lines: [deviceError], onClose: () => useDeviceStore.setState({ error: null }) });
  }

  return (
    <div className="pointer-events-none absolute bottom-4 right-4 z-30 flex w-80 flex-col gap-2">
      <AnimatePresence>
        {items.map((n) => (
          <motion.div
            key={n.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className={
              "pointer-events-auto rounded-xl border p-3 shadow-2xl " +
              (n.tone === "error" ? "border-danger/40 bg-stage-900" : "border-stage-700 bg-stage-900")
            }
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className={"text-sm font-medium " + (n.tone === "error" ? "text-danger" : "text-stage-100")}>{n.title}</div>
                {n.lines.map((l, i) => (
                  <div key={i} className="mt-0.5 break-words text-xs text-stage-300">
                    {l}
                  </div>
                ))}
                {n.action && (
                  <div className="mt-2">
                    <Button size="sm" onClick={n.action.run}>
                      {n.action.label}
                    </Button>
                  </div>
                )}
              </div>
              <button onClick={n.onClose} aria-label={t("common.dismiss")} className="rounded-md p-1 text-stage-400 hover:bg-stage-800 hover:text-stage-100">
                <IconClose />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
