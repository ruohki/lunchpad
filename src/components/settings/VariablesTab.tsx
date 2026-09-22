import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "../../icons/Icon";
import { api, BUILTIN_VARIABLES, type DownloadCacheInfo } from "../../lib/api";
import { builtinValues } from "../../lib/placeholders";
import { useBuiltinEnv } from "../../lib/useBuiltins";
import { useNow } from "../../lib/useNow";
import { useVariablesStore } from "../../store/variables";
import { Tooltip } from "../Tooltip";
import { Button, IconClose } from "../ui";
import { fieldCls, Section } from "./SettingsDialog";

/** The shared variables: what macros and faders have written, with a way to add, change and drop them. */
export function VariablesTab() {
  const { t } = useTranslation();
  const globals = useVariablesStore((s) => s.globals);
  const remove = useVariablesStore((s) => s.remove);
  const setVariable = useVariablesStore((s) => s.setVariable);
  const clear = useVariablesStore((s) => s.clear);
  const pruneFaders = useVariablesStore((s) => s.pruneFaders);
  const [confirmClear, setConfirmClear] = useState(false);
  const [pruned, setPruned] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const names = useMemo(() => Object.keys(globals).sort((a, b) => a.localeCompare(b)), [globals]);
  const faderCount = names.filter((n) => n.startsWith("fader.")).length;
  const provided = builtinValues(useNow(1000), null, undefined, useBuiltinEnv());

  const change = (name: string, value: string) => {
    setError(null);
    void setVariable(name, value).catch((e) => setError(String(e)));
  };

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

      <Section title={t("settings.builtinsTitle")} description={t("settings.builtinsHint")}>
        <ul className="flex flex-col gap-1">
          {BUILTIN_VARIABLES.map((name) => (
            <li key={name} className="grid grid-cols-[minmax(0,140px)_minmax(0,1fr)_minmax(0,220px)] items-baseline gap-3">
              <code className="truncate font-mono text-sm text-builtin">{name}</code>
              <span className="text-xs text-stage-400">{t(`vars.builtins.${name}`)}</span>
              {/* A folder path is longer than the column: cut it short, the tip has all of it. */}
              <Tooltip content={provided[name] ?? ""} size="wide">
                <span className="min-w-0 truncate text-right font-mono text-xs text-stage-300">{provided[name] ?? ""}</span>
              </Tooltip>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t("settings.variablesNew")} description={t("settings.variablesNewHint")}>
        <NewVariable existing={globals} onAdd={change} />
      </Section>

      <Section title={t("settings.variablesList", { count: names.length })}>
        {error && <p className="text-xs text-danger">{error}</p>}
        {names.length === 0 ? (
          <p className="text-sm text-stage-400">{t("settings.variablesEmpty")}</p>
        ) : (
          <ul className="max-w-2xl divide-y divide-stage-800 rounded-lg border border-stage-800">
            {names.map((name) => (
              <VariableRow key={name} name={name} value={globals[name]} onChange={(value) => change(name, value)} onRemove={() => void remove([name])} />
            ))}
          </ul>
        )}
      </Section>

      <DownloadsSection />
    </>
  );
}

/** A name and a value for a variable that does not exist yet. */
function NewVariable({ existing, onAdd }: { existing: Record<string, string>; onAdd: (name: string, value: string) => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const trimmed = name.trim();
  const problem =
    trimmed === ""
      ? null
      : /[\s{}]/.test(trimmed)
        ? t("settings.variablesNameInvalid")
        : (BUILTIN_VARIABLES as readonly string[]).includes(trimmed)
          ? t("settings.variablesNameBuiltin", { name: trimmed })
          : trimmed in existing
            ? t("settings.variablesNameExists", { name: trimmed })
            : null;
  const canAdd = trimmed !== "" && problem === null;
  const add = () => {
    if (!canAdd) return;
    onAdd(trimmed, value);
    setName("");
    setValue("");
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") add();
  };

  return (
    <div className="flex max-w-2xl flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={onKeyDown}
          className={fieldCls + " w-56"}
          placeholder={t("settings.variablesName")}
          aria-label={t("settings.variablesName")}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
        />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          className={fieldCls + " min-w-40 flex-1"}
          placeholder={t("settings.variablesValue")}
          aria-label={t("settings.variablesValue")}
          spellCheck={false}
        />
        <Button size="sm" variant="primary" onClick={add} disabled={!canAdd}>
          {t("settings.variablesAdd")}
        </Button>
      </div>
      {problem && <p className="text-xs text-warn">{problem}</p>}
    </div>
  );
}

/** One shared variable: its value turns into a field on a click, Enter or leaving keeps it, Escape drops it. */
function VariableRow({ name, value, onChange, onRemove }: { name: string; value: string; onChange: (value: string) => void; onRemove: () => void }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  // Escape unmounts the field, and the blur that follows must not keep the draft.
  const cancelled = useRef(false);
  const start = () => {
    cancelled.current = false;
    setDraft(value);
    setEditing(true);
  };
  const finish = () => {
    if (cancelled.current) return;
    setEditing(false);
    if (draft !== value) onChange(draft);
  };
  const cancel = () => {
    cancelled.current = true;
    setDraft(value);
    setEditing(false);
  };

  return (
    <li className="flex items-center gap-3 px-3 py-1.5 font-mono text-xs">
      <span className="w-56 shrink-0 truncate text-stage-200">{name}</span>
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={finish}
          onKeyDown={(e) => {
            if (e.key === "Enter") finish();
            if (e.key === "Escape") cancel();
          }}
          className={fieldCls + " min-w-0 flex-1 py-0.5 text-xs"}
          aria-label={t("settings.variablesValueOf", { name })}
          spellCheck={false}
        />
      ) : (
        <Tooltip content={value} size="wide">
          <button type="button" onClick={start} className="min-w-0 flex-1 truncate rounded px-1 text-left text-stage-400 hover:bg-stage-800 hover:text-stage-100" aria-label={t("settings.variablesEdit", { name })}>
            {value === "" ? <span className="italic text-stage-600">{t("settings.variablesEmptyValue")}</span> : value}
          </button>
        </Tooltip>
      )}
      <button type="button" onClick={start} aria-label={t("settings.variablesEdit", { name })} className="rounded p-1 text-stage-500 hover:bg-stage-800 hover:text-stage-100">
        <Icon name="Pencil" />
      </button>
      <button type="button" onClick={onRemove} aria-label={t("settings.variablesRemove", { name })} className="rounded p-1 text-stage-500 hover:bg-stage-800 hover:text-stage-100">
        <IconClose />
      </button>
    </li>
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
