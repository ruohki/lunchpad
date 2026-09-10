import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import logo from "../../assets/lunchpad-icon.png";
import { useUpdateStore } from "../../store/update";
import { Button } from "../ui";
import { Section } from "./SettingsDialog";

export const REPO_URL = "https://github.com/ruohki/lunchpad";
export const RELEASES_URL = `${REPO_URL}/releases`;
export const DISCORD_URL = "https://discord.gg/4Ys9TRR";
const AUTHOR = "Tillmann Hübner";
const AUTHOR_EMAIL = "ruohki@gmail.com";
const YEARS = "2020–2026";

function Link({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={() => void openUrl(href)} className="text-left text-accent-400 hover:underline">
      {children}
    </button>
  );
}

/** The legacy "About" screen: version, author, licence and trademark notes, links, plus the update check. */
export function AboutTab() {
  const { t } = useTranslation();
  const [version, setVersion] = useState("");
  const status = useUpdateStore((s) => s.status);
  const available = useUpdateStore((s) => s.version);
  const error = useUpdateStore((s) => s.error);
  const downloaded = useUpdateStore((s) => s.downloaded);
  const total = useUpdateStore((s) => s.total);
  const check = useUpdateStore((s) => s.check);
  const install = useUpdateStore((s) => s.install);

  useEffect(() => {
    getVersion()
      .then(setVersion)
      .catch(() => setVersion(""));
  }, []);

  const statusText = (() => {
    switch (status) {
      case "checking":
        return t("updater.checking");
      case "upToDate":
        return t("updater.upToDate");
      case "available":
        return t("updater.available", { version: available });
      case "installing":
        return total ? t("updater.installingPercent", { percent: Math.min(100, Math.round((downloaded / total) * 100)) }) : t("updater.installing");
      case "ready":
        return t("updater.ready");
      case "error":
        return t("updater.error", { error });
      default:
        return "";
    }
  })();

  return (
    <>
      <div className="mb-7 flex items-start gap-5">
        <img src={logo} alt="" draggable={false} className="h-24 w-24 shrink-0 rounded-2xl" />
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-lg font-semibold text-stage-100">
            {t("app.name")} <span className="text-sm font-normal text-stage-400">{version}</span>
          </h3>
          <p className="text-xs text-stage-400">
            {t("about.copyright", { years: YEARS, author: AUTHOR })} <Link href={`mailto:${AUTHOR_EMAIL}`}>{AUTHOR_EMAIL}</Link>
          </p>
          <div className="flex flex-wrap gap-4 text-xs">
            <Link href={REPO_URL}>{t("about.source")}</Link>
            <Link href={RELEASES_URL}>{t("about.releases")}</Link>
          </div>
        </div>
      </div>

      <Section title={t("about.updatesTitle")} description={t("about.updatesHint")}>
        <div className="flex flex-wrap items-center gap-3 text-sm text-stage-300">
          <Button size="sm" onClick={() => void check(true)} disabled={status === "checking" || status === "installing" || status === "ready"}>
            {t("about.checkUpdates")}
          </Button>
          {status === "available" && (
            <Button size="sm" variant="primary" onClick={() => void install()}>
              {t("updater.install")}
            </Button>
          )}
          {statusText && <span className={status === "error" ? "text-danger" : ""}>{statusText}</span>}
        </div>
      </Section>

      <Section title={t("about.legalTitle")}>
        <div className="flex max-w-lg flex-col gap-2 text-xs text-stage-400">
          <p>{t("about.license")}</p>
          <p>{t("about.trademarks")}</p>
          <p>{t("about.specs")}</p>
          <p>{t("about.novation")}</p>
        </div>
      </Section>

      <Section title={t("about.communityTitle")} description={t("about.communityHint")}>
        <div className="text-sm">
          <Link href={DISCORD_URL}>{DISCORD_URL}</Link>
        </div>
      </Section>
    </>
  );
}
