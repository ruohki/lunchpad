import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { hubModelId } from "../../lib/hubModel";
import { useDeviceStore } from "../../store/device";
import { useHubStore } from "../../store/hub";
import { useProfileStore } from "../../store/profile";
import { useSettingsStore } from "../../store/settings";
import { useUiStore } from "../../store/ui";
import { Button, Spinner } from "../ui";
import { fieldCls, Section } from "./SettingsDialog";

/** Sign in to the community hub through the browser; the inbox of things sent from there. */
export function HubTab() {
  const { t } = useTranslation();
  const state = useHubStore((s) => s.state);
  const error = useHubStore((s) => s.error);
  const linkStart = useHubStore((s) => s.linkStart);
  const linkCancel = useHubStore((s) => s.linkCancel);
  const signOut = useHubStore((s) => s.signOut);
  const setUrl = useHubStore((s) => s.setUrl);
  const fetchListing = useHubStore((s) => s.fetchListing);
  const openInbox = useHubStore((s) => s.openInbox);
  const developerMode = useSettingsStore((s) => s.settings?.developerMode ?? false);
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState("");
  const [url, setUrlField] = useState<string | null>(null);

  if (!state) return <Spinner />;
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };
  const inboxCount = state.inbox.length;
  const shownError = error ?? state.error;

  return (
    <>
      <Section title={t("settings.tabs.hub")} description={t("hub.intro")}>
        {state.status === "signedOut" && (
          <div className="flex flex-col gap-3">
            <div>
              <Button variant="primary" size="sm" disabled={busy} onClick={() => void run(linkStart)}>
                {t("hub.signIn")}
              </Button>
            </div>
            <p className="max-w-lg text-xs text-stage-400">{t("hub.signInHint")}</p>
          </div>
        )}
        {state.status === "linking" && state.link && (
          <div className="flex max-w-lg flex-col gap-3 rounded-lg border border-stage-700 bg-stage-800/60 p-4">
            <div className="flex items-center gap-3 text-sm text-stage-100">
              <Spinner />
              {t("hub.waiting")}
            </div>
            <p className="text-xs text-stage-400">{t("hub.approveHint")}</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => void openUrl(state.link!.verifyUrl)}>
                {t("hub.openLink")}
              </Button>
              <Button size="sm" variant="danger" disabled={busy} onClick={() => void run(linkCancel)}>
                {t("hub.cancel")}
              </Button>
            </div>
          </div>
        )}
        {(state.status === "connected" || state.status === "connecting" || state.status === "offline") && state.user && (
          <div className="flex max-w-lg flex-col gap-3">
            <div className="flex items-center gap-3 rounded-lg border border-stage-700 bg-stage-800/60 px-3 py-2.5">
              {state.user.image ? (
                <img src={state.user.image} alt="" className="h-9 w-9 rounded-full" draggable={false} />
              ) : (
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-stage-700 text-xs font-semibold text-stage-200">{state.user.name.slice(0, 2).toUpperCase()}</span>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-xs text-stage-400">{t("hub.signedInAs")}</div>
                <div className="truncate text-sm text-stage-100">
                  {state.user.name} <span className="text-stage-500">@{state.user.handle}</span>
                </div>
              </div>
              <span className="flex items-center gap-1.5 text-xs text-stage-400" title={state.status === "offline" ? (state.error ?? undefined) : undefined}>
                <span className={"h-2 w-2 rounded-full " + (state.status === "connected" ? "bg-ok shadow-[0_0_8px_var(--color-ok)]" : state.status === "connecting" ? "bg-stage-500 animate-pulse" : "bg-warn")} />
                {state.status === "connected" ? t("hub.connected") : state.status === "connecting" ? t("hub.connecting") : t("hub.offline")}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => void openUrl(state.url)}>
                {t("hub.openHub")}
              </Button>
              <Button size="sm" variant="danger" disabled={busy} onClick={() => void run(signOut)}>
                {t("hub.signOut")}
              </Button>
            </div>
          </div>
        )}
        {shownError && <p className="max-w-lg text-xs text-danger">{shownError}</p>}
      </Section>

      <Section title={t("hub.inbox")} description={t("hub.inboxHint")}>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" onClick={openInbox} disabled={inboxCount === 0}>
            {t("hub.openInbox")}
          </Button>
          <span className="text-xs text-stage-400">{inboxCount === 0 ? t("hub.inboxEmpty") : t("hub.inboxCount", { count: inboxCount })}</span>
        </div>
        {state.user && (
          <div className="flex max-w-lg flex-col gap-1 text-xs text-stage-400">
            <span>{t("hub.fetchLabel")}</span>
            <div className="flex gap-2">
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && reference.trim()) void run(async () => (await fetchListing(reference.trim())) && setReference(""));
                }}
                className={fieldCls + " flex-1"}
                placeholder={state.url + "/s/…"}
                spellCheck={false}
              />
              <Button size="sm" disabled={busy || !reference.trim()} onClick={() => void run(async () => (await fetchListing(reference.trim())) && setReference(""))}>
                {t("hub.fetch")}
              </Button>
            </div>
            <span>{t("hub.fetchHint")}</span>
          </div>
        )}
      </Section>

      {state.user && <SharedSection />}
      {state.user && <BackupsSection />}

      {developerMode && (
        <Section title={t("hub.url")} description={t("hub.urlHint")}>
          <div className="flex max-w-lg gap-2">
            <input value={url ?? state.url} onChange={(e) => setUrlField(e.target.value)} className={fieldCls + " flex-1"} spellCheck={false} disabled={state.status !== "signedOut"} />
            <Button size="sm" disabled={busy || url === null || url === state.url || state.status !== "signedOut"} onClick={() => void run(async () => setUrl(url ?? state.url).then(() => setUrlField(null)))}>
              {t("common.save")}
            </Button>
          </div>
        </Section>
      )}
    </>
  );
}

const formatBytes = (n: number): string => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 1024)} kB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

/** Private copies of the whole profile on the hub: make one, restore one, drop one. */
function BackupsSection() {
  const { t } = useTranslation();
  const backups = useHubStore((s) => s.backups);
  const loadBackups = useHubStore((s) => s.loadBackups);
  const backupNow = useHubStore((s) => s.backupNow);
  const deleteBackup = useHubStore((s) => s.deleteBackup);
  const restoreBackup = useHubStore((s) => s.restoreBackup);
  const online = useHubStore((s) => s.state?.status === "connected");
  const device = useDeviceStore((s) => s.device);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState<string | null>(null);

  useEffect(() => {
    if (backups === null) void loadBackups();
  }, [backups, loadBackups]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };
  const makeBackup = () =>
    run(async () => {
      const backup = await backupNow(name.trim(), hubModelId(device?.virtual ? null : device?.model));
      if (backup) {
        setMade(backup.name);
        setName("");
        window.setTimeout(() => setMade(null), 5000);
      }
    });

  return (
    <Section title={t("hub.backups.title")} description={t("hub.backups.hint")}>
      <div className="flex max-w-lg flex-col gap-2">
        <div className="flex items-end gap-2">
          <label className="flex flex-1 flex-col gap-1 text-xs text-stage-400">
            {t("hub.backups.name")}
            <input value={name} onChange={(e) => setName(e.target.value.slice(0, 80))} className={fieldCls + " font-sans"} placeholder={t("hub.backups.namePlaceholder")} />
          </label>
          <Button size="sm" variant="primary" disabled={busy || !online} onClick={() => void makeBackup()}>
            {t("hub.backups.now")}
          </Button>
        </div>
        {made && <p className="text-xs text-ok">{t("hub.backups.made", { name: made })}</p>}
        {backups === null ? (
          <Spinner />
        ) : backups.length === 0 ? (
          <p className="text-xs text-stage-500">{t("hub.backups.empty")}</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {backups.map((b) => (
              <li key={b.id} className="flex items-center gap-2 rounded-lg border border-stage-700 bg-stage-800/40 px-2.5 py-1.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-stage-100">{b.name}</div>
                  <div className="text-xs text-stage-500">
                    {new Date(b.createdAt).toLocaleString()} · {t("common.page", { count: b.stats.pages })} · {t("common.button", { count: b.stats.buttons })} · {formatBytes(b.bytes)}
                    {b.appVersion && ` · Lunchpad ${b.appVersion}`}
                  </div>
                </div>
                <Button size="sm" disabled={busy} onClick={() => void run(() => restoreBackup(b.id))}>
                  {t("hub.backups.restore")}
                </Button>
                <Button size="sm" variant="danger" disabled={busy} onClick={() => void run(() => deleteBackup(b.id))}>
                  {t("hub.backups.delete")}
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div>
          <Button size="sm" variant="quiet" disabled={busy} onClick={() => void run(loadBackups)}>
            {t("hub.backups.reload")}
          </Button>
        </div>
      </div>
    </Section>
  );
}

/** What was shared from this app, where it sits in the pages, and its state on the hub. */
function SharedSection() {
  const { t } = useTranslation();
  const shared = useHubStore((s) => s.state?.shared ?? []);
  const syncShared = useHubStore((s) => s.syncShared);
  const forgetShared = useHubStore((s) => s.forgetShared);
  const online = useHubStore((s) => s.state?.status === "connected");
  const profile = useProfileStore((s) => s.profile);
  const openUpdate = useUiStore((s) => s.openUpdate);
  const closeSettings = useUiStore((s) => s.closeSettings);
  const [busy, setBusy] = useState(false);
  const synced = useHubStore((s) => s.sharedSynced);
  useEffect(() => {
    if (online && !synced) void syncShared();
  }, [online, synced, syncShared]);

  const where = (item: (typeof shared)[number]): string => {
    const page = profile?.pages.find((p) => p.id === item.pageId);
    if (!page) return t("hub.shared.where.gone");
    if (item.kind === "page") return t("hub.shared.where.page", { page: page.name });
    const exists = page.buttons.some((b) => b.x === item.x && b.y === item.y);
    return exists ? t("hub.shared.where.button", { column: (item.x ?? 0) + 1, row: (item.y ?? 0) + 1, page: page.name }) : t("hub.shared.where.gone");
  };
  const statusCls = (status: string) => (status === "published" ? "text-ok" : status === "pending" ? "text-warn" : status === "rejected" || status === "hidden" ? "text-danger" : "text-stage-400");

  return (
    <Section title={t("hub.shared.title")} description={t("hub.shared.hint")}>
      <div className="flex max-w-lg flex-col gap-2">
        {shared.length === 0 ? (
          <p className="text-xs text-stage-500">{t("hub.shared.empty")}</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {shared.map((item) => (
              <li key={item.listingId} className="flex items-center gap-2 rounded-lg border border-stage-700 bg-stage-800/40 px-2.5 py-1.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="rounded bg-stage-700 px-1.5 text-[10px] font-semibold uppercase tracking-wide text-stage-300">{t(`hub.kinds.${item.kind}`)}</span>
                    <span className="truncate text-sm text-stage-100">{item.title}</span>
                    <span className={"text-[11px] " + statusCls(item.status)}>{t(`hub.shared.status.${item.status || ""}`)}</span>
                  </div>
                  <div className="text-xs text-stage-500">{where(item)}</div>
                </div>
                <Button
                  size="sm"
                  disabled={!online}
                  onClick={() => {
                    closeSettings();
                    openUpdate(item, item.kind === "page" ? { kind: "page", pageId: item.pageId } : { kind: "button", pageId: item.pageId, x: item.x ?? 0, y: item.y ?? 0 });
                  }}
                >
                  {t("hub.shared.update")}
                </Button>
                <Button size="sm" onClick={() => void openUrl(item.url)}>
                  {t("hub.shared.open")}
                </Button>
                <Button size="sm" variant="danger" disabled={busy} onClick={() => void forgetShared(item.listingId)}>
                  {t("hub.shared.forget")}
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div>
          <Button
            size="sm"
            variant="quiet"
            disabled={busy || !online}
            onClick={() => {
              setBusy(true);
              void syncShared().finally(() => setBusy(false));
            }}
          >
            {t("hub.shared.sync")}
          </Button>
        </div>
      </div>
    </Section>
  );
}
