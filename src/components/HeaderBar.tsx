import { clsx } from "clsx";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import logo from "../assets/lunchpad-icon.png";
import { useDeviceStore } from "../store/device";
import { useHubStore } from "../store/hub";
import { useSettingsStore } from "../store/settings";

/**
 * The single strip above the pads: app name, then the page tabs (children),
 * then stop-all and, in developer mode, the connection status.
 */
export function HeaderBar({ children }: { children?: React.ReactNode }) {
  const { t } = useTranslation();
  const status = useDeviceStore((s) => s.status);
  const device = useDeviceStore((s) => s.device);
  const developerMode = useSettingsStore((s) => s.settings?.developerMode ?? false);
  const inboxCount = useHubStore((s) => s.state?.inbox.length ?? 0);
  const openInbox = useHubStore((s) => s.openInbox);

  const statusText =
    status === "connected" && device
      ? device.virtual
        ? t("status.virtual", { model: t(`models.${device.model}`) })
        : t(`models.${device.model}`)
      : status === "connecting"
        ? t("status.connecting")
        : t("status.disconnected");

  return (
    <header className="flex h-11 shrink-0 items-stretch border-b border-stage-800 pl-4 pr-3">
      <div className="mr-4 flex items-center gap-2.5">
        <img src={logo} alt="" className="h-6 w-6 rounded-full" draggable={false} />
        <span className="text-sm font-semibold tracking-tight text-stage-100">{t("app.name")}</span>
      </div>

      <div className="flex min-w-0 flex-1 items-end overflow-hidden">{children}</div>

      <div className="ml-4 flex items-center gap-3">
        {inboxCount > 0 && (
          <button type="button" onClick={openInbox} className="flex items-center gap-1.5 rounded-md bg-accent-500/15 px-2 py-1 text-xs font-medium text-accent-300 hover:bg-accent-500/25">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-400" />
            {t("hub.inboxCount", { count: inboxCount })}
          </button>
        )}
        {developerMode && (
          <div className="flex items-center gap-2 text-xs text-stage-400">
            <StatusDot status={status} />
            <span>{statusText}</span>
          </div>
        )}
      </div>
    </header>
  );
}

function StatusDot({ status }: { status: "connected" | "connecting" | "disconnected" }) {
  return (
    <span className="relative flex h-2.5 w-2.5">
      {status === "connecting" && (
        <motion.span
          className="absolute inset-0 rounded-full bg-warn"
          animate={{ scale: [1, 2.2], opacity: [0.6, 0] }}
          transition={{ repeat: Infinity, duration: 1.2, ease: "easeOut" }}
        />
      )}
      <span
        className={clsx(
          "relative h-2.5 w-2.5 rounded-full",
          status === "connected" && "bg-ok shadow-[0_0_8px_var(--color-ok)]",
          status === "connecting" && "bg-warn",
          status === "disconnected" && "bg-stage-500",
        )}
      />
    </span>
  );
}
