import { clsx } from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { IconClose } from "../ui";
import { AboutTab } from "./AboutTab";
import { DiagnosticsTab } from "./DiagnosticsTab";
import { InterfaceTab } from "./InterfaceTab";
import { KeyboardTab } from "./KeyboardTab";
import { LaunchpadTab } from "./LaunchpadTab";
import { ObsTab } from "./ObsTab";
import { PagesTab } from "./PagesTab";
import { SlobsTab } from "./SlobsTab";
import { SoundTab } from "./SoundTab";

export type SettingsTab = "launchpad" | "sound" | "keyboard" | "interface" | "obs" | "slobs" | "pages" | "about" | "diagnostics";

interface NavGroup {
  group: string;
  tabs: SettingsTab[];
}

/** Add an integration here (and a tab component) and it shows up in the navigation. */
const NAV: NavGroup[] = [
  { group: "general", tabs: ["launchpad", "sound", "keyboard", "interface"] },
  { group: "integrations", tabs: ["obs", "slobs"] },
  { group: "data", tabs: ["pages"] },
  { group: "about", tabs: ["about", "diagnostics"] },
];

const TABS: Record<SettingsTab, () => React.ReactElement> = {
  launchpad: LaunchpadTab,
  sound: SoundTab,
  keyboard: KeyboardTab,
  interface: InterfaceTab,
  obs: ObsTab,
  slobs: SlobsTab,
  pages: PagesTab,
  about: AboutTab,
  diagnostics: DiagnosticsTab,
};

let lastTab: SettingsTab = "launchpad";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SettingsDialog({ open, onClose }: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<SettingsTab>(lastTab);
  const select = (next: SettingsTab) => {
    lastTab = next;
    setTab(next);
  };
  const Body = TABS[tab];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="settings"
          className="absolute inset-0 z-30 flex items-center justify-center bg-stage-950/70 p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-label={t("settings.title")}
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="flex h-full max-h-[640px] w-full max-w-4xl overflow-hidden rounded-2xl border border-stage-700 bg-stage-900 shadow-2xl"
          >
            <nav className="flex w-52 shrink-0 flex-col border-r border-stage-800 bg-stage-900/80 p-3" aria-label={t("settings.title")}>
              <div className="px-2 pb-3 pt-1 text-sm font-semibold text-stage-100">{t("settings.title")}</div>
              {NAV.map((g) => (
                <div key={g.group} className="mb-3">
                  <div className="px-2 pb-1 text-[11px] text-stage-500">{t(`settings.groups.${g.group}`)}</div>
                  {g.tabs.map((id) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={tab === id}
                      onClick={() => select(id)}
                      className={clsx(
                        "relative flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                        tab === id ? "text-stage-100" : "text-stage-400 hover:bg-stage-800 hover:text-stage-200",
                      )}
                    >
                      {tab === id && (
                        <motion.span layoutId="settings-tab" className="absolute inset-0 rounded-md bg-stage-700" transition={{ type: "spring", stiffness: 500, damping: 40 }} />
                      )}
                      <span className="relative">{t(`settings.tabs.${id}`)}</span>
                    </button>
                  ))}
                </div>
              ))}
            </nav>

            <div className="flex min-w-0 flex-1 flex-col">
              <header className="flex items-center justify-between border-b border-stage-800 px-6 py-3">
                <h2 className="text-sm font-semibold text-stage-100">{t(`settings.tabs.${tab}`)}</h2>
                <button onClick={onClose} aria-label={t("common.close")} className="rounded-md p-1 text-stage-400 hover:bg-stage-800 hover:text-stage-100">
                  <IconClose />
                </button>
              </header>
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div key={tab} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.12 }}>
                    <Body />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Shared layout pieces for the tabs. */
export function Section({ title, description, children }: { title?: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="mb-7 flex flex-col gap-4">
      {(title || description) && (
        <div>
          {title && <h3 className="text-sm font-medium text-stage-100">{title}</h3>}
          {description && <p className="mt-0.5 max-w-lg text-xs text-stage-400">{description}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

export const fieldCls = "rounded-md bg-stage-800 px-2.5 py-1.5 font-mono text-sm text-stage-100 outline-none focus:ring-1 focus:ring-accent-400";
