import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { ButtonEditor } from "./components/ButtonEditor";
import { DevicePicker } from "./components/DevicePicker";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { LaunchpadGrid } from "./components/LaunchpadGrid";
import { OutsidePanel } from "./components/OutsidePanel";
import { Notices } from "./components/Notices";
import { HeaderBar } from "./components/HeaderBar";
import { PageTabs } from "./components/PageBar";
import { SettingsDialog } from "./components/settings/SettingsDialog";
import { SidePanel } from "./components/SidePanel";
import { Spinner } from "./components/ui";
import { useDeviceStore } from "./store/device";
import { useMacroStore } from "./store/macros";
import { useMediaStore } from "./store/media";
import { useProfileStore } from "./store/profile";
import { useSettingsStore } from "./store/settings";
import { useUiStore } from "./store/ui";
import { useUpdateStore } from "./store/update";
import { api } from "./lib/api";
import i18n from "./i18n";
import { useVariablesStore } from "./store/variables";
import { FaderEditor } from "./components/FaderEditor";

export default function App() {
  const initDevice = useDeviceStore((s) => s.init);
  const initProfile = useProfileStore((s) => s.init);
  const initMacros = useMacroStore((s) => s.init);
  const initSettings = useSettingsStore((s) => s.init);
  const initMedia = useMediaStore((s) => s.init);
  const initVariables = useVariablesStore((s) => s.init);
  const ready = useDeviceStore((s) => s.ready);
  const status = useDeviceStore((s) => s.status);
  const layout = useDeviceStore((s) => s.layout);
  const profile = useProfileStore((s) => s.profile);
  const settingsOpen = useUiStore((s) => s.settingsOpen);
  const closeSettings = useUiStore((s) => s.closeSettings);
  const developerMode = useSettingsStore((s) => s.settings?.developerMode ?? false);

  useEffect(() => {
    let disposeDevice: (() => void) | undefined;
    let disposeProfile: (() => void) | undefined;
    let disposeMacros: (() => void) | undefined;
    let disposeSettings: (() => void) | undefined;
    let disposeMedia: (() => void) | undefined;
    let disposeVariables: (() => void) | undefined;
    void initDevice().then((fn) => (disposeDevice = fn));
    void initProfile().then((fn) => (disposeProfile = fn));
    void initMacros().then((fn) => (disposeMacros = fn));
    void initSettings().then((fn) => (disposeSettings = fn));
    void initMedia().then((fn) => (disposeMedia = fn));
    void initVariables().then((fn) => (disposeVariables = fn));
    void api.setTrayLabels({
      discord: i18n.t("tray.discord"),
      show: i18n.t("tray.show"),
      stayOnTop: i18n.t("tray.stayOnTop"),
      minimizeToTray: i18n.t("tray.minimizeToTray"),
      runAtStartup: i18n.t("tray.runAtStartup"),
      stopAll: i18n.t("tray.stopAll"),
      quit: i18n.t("tray.quit"),
    });
    // Look for a new release once the window is up; failures stay silent here.
    const updateTimer = window.setTimeout(() => void useUpdateStore.getState().check(false), 4000);
    return () => {
      window.clearTimeout(updateTimer);
      disposeDevice?.();
      disposeProfile?.();
      disposeMacros?.();
      disposeSettings?.();
      disposeMedia?.();
      disposeVariables?.();
    };
  }, [initDevice, initProfile, initMacros, initSettings, initMedia, initVariables]);

  const undo = useProfileStore((s) => s.undo);
  const redo = useProfileStore((s) => s.redo);
  const editing = useProfileStore((s) => s.editor !== null || s.faderEditor !== null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSettings();
      // Undo / redo the edits to the pages while no editor or text field has the focus.
      const key = e.key.toLowerCase();
      const isUndo = (e.metaKey || e.ctrlKey) && !e.shiftKey && key === "z";
      const isRedo = ((e.metaKey || e.ctrlKey) && e.shiftKey && key === "z") || (e.ctrlKey && !e.metaKey && key === "y");
      if (isUndo || isRedo) {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (editing || settingsOpen || tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        void (isRedo ? redo() : undo());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeSettings, undo, redo, editing, settingsOpen]);

  const connected = status === "connected" && !!layout;
  const activeLayout = connected ? layout : null;
  const view = !ready || !profile ? "loading" : activeLayout ? "workspace" : "picker";

  return (
    <ErrorBoundary>
      <div className="relative flex h-full flex-col bg-stage-950">
        <HeaderBar>{view === "workspace" && <PageTabs />}</HeaderBar>
        <SettingsDialog open={settingsOpen} onClose={closeSettings} />

        <main className="relative flex min-h-0 flex-1 flex-col">
          <AnimatePresence mode="wait" initial={false}>
            {view === "loading" && (
              <motion.div key="loading" className="flex h-full items-center justify-center" exit={{ opacity: 0 }}>
                <Spinner />
              </motion.div>
            )}
            {view === "picker" && (
              <motion.div
                key="picker"
                className="h-full"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
              >
                <DevicePicker />
              </motion.div>
            )}
            {view === "workspace" && activeLayout && (
              <motion.div
                key="workspace"
                className="flex h-full flex-col"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex min-h-0 flex-1">
                  <div className="min-w-0 flex-1 p-2">
                    <LaunchpadGrid layout={activeLayout} />
                  </div>
                  {developerMode && <SidePanel layout={activeLayout} />}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <ButtonEditor />
          <FaderEditor />
          <OutsidePanel />
          <Notices />
        </main>
      </div>
    </ErrorBoundary>
  );
}
