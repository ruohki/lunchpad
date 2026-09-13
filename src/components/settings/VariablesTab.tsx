import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type DownloadCacheInfo } from "../../lib/api";
import { useVariablesStore } from "../../store/variables";
import { Tooltip } from "../Tooltip";
import { Button, IconClose } from "../ui";
import { Section } from "./SettingsDialog";

/** The shared variables: what macros and faders have written, with a way to drop what is no longer wanted. */
export function VariablesTab() {
  const { t } = useTranslation();
  const globals = useVariablesStore((s) => s.globals);
  const remove = useVariablesStore((s) => s.remove);
  const clear = useVariablesStore((s) => s.clear);
  const pruneFaders = useVariablesStore((s) => s.pruneFaders);
  const [confirmClear, setConfirmClear] = useState(false);
  const [pruned, setPruned] = useState<number | null>(null);
  const names = useMemo(() => Object.keys(globals).sort((a, b) => a.localeCompare(b)), [globals]);
  const faderCount = names.filter((n) => n.startsWith("fader.")).length;

  return (
    <>
      <Section description={t("settings.variablesHint")}>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => {
              void pruneFaders().then(setPruned);
            }}
            disabled={faderCount === 0}
          >
            {t("settings.variablesPrune")}
          </Button>
          {confirmClear ? (
            <>
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  setConfirmClear(false);
                  void clear();
                }}
              >
                {t("settings.variablesClearConfirm", { count: names.length })}
              </Button>
              <Button size="sm" onClick={() => setConfirmClear(false)}>
                {t("common.cancel")}
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => setConfirmClear(true)} disabled={names.length === 0}>
              {t("settings.variablesClear")}
            </Button>
          )}
          {pruned !== null && <span className="text-xs text-stage-400">{t("settings.variablesPruned", { count: pruned })}</span>}
        </div>
      </Section>

      <Section title={t("settings.variablesList", { count: names.length })}>
        {names.length === 0 ? (
          <p className="text-sm text-stage-400">{t("settings.variablesEmpty")}</p>
        ) : (
          <ul className="max-w-2xl divide-y divide-stage-800 rounded-lg border border-stage-800">
            {names.map((name) => (
              <li key={name} className="flex items-center gap-3 px-3 py-1.5 font-mono text-xs">
                <span className="w-56 shrink-0 truncate text-stage-200">{name}</span>
                <Tooltip content={globals[name]}>
                  <span className="min-w-0 flex-1 truncate text-stage-400">{globals[name]}</span>
                </Tooltip>
                <button
                  type="button"
                  onClick={() => void remove([name])}
                  aria-label={t("settings.variablesRemove", { name })}
                  className="rounded p-1 text-stage-500 hover:bg-stage-800 hover:text-stage-100"
                >
                  <IconClose />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <DownloadsSection />
    </>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** The files HTTP request actions downloaded, with a way to start over. */
function DownloadsSection() {
  const { t } = useTranslation();
  const [info, setInfo] = useState<DownloadCacheInfo | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [cleared, setCleared] = useState<number | null>(null);

  const refresh = () => api.downloadCacheInfo().then(setInfo).catch(() => undefined);
  useEffect(() => {
    void refresh();
  }, []);

  return (
    <Section title={t("settings.downloads")} description={t("settings.downloadsHint")}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-2 text-sm text-stage-300">{info && info.files > 0 ? t("settings.downloadsCount", { count: info.files, size: formatSize(info.bytes) }) : t("settings.downloadsEmpty")}</span>
        <Button size="sm" onClick={() => void api.openDownloadFolder().catch(() => undefined)}>
          {t("settings.downloadsShow")}
        </Button>
        {confirm ? (
          <>
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                setConfirm(false);
                void api
                  .clearDownloadCache()
                  .then((n) => {
                    setCleared(n);
                    void refresh();
                  })
                  .catch(() => undefined);
              }}
            >
              {t("settings.downloadsClearConfirm", { count: info?.files ?? 0 })}
            </Button>
            <Button size="sm" onClick={() => setConfirm(false)}>
              {t("common.cancel")}
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={() => setConfirm(true)} disabled={!info || info.files === 0}>
            {t("settings.downloadsClear")}
          </Button>
        )}
        {cleared !== null && <span className="text-xs text-stage-400">{t("settings.downloadsCleared", { count: cleared })}</span>}
      </div>
    </Section>
  );
}
