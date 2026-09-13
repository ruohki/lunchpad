import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "../../store/settings";
import { Button, IconClose } from "../ui";
import { fieldCls, Section } from "./SettingsDialog";

const NAME_RE = /^[A-Za-z0-9_-]{1,64}$/;

/** API keys and passwords for HTTP actions: stored in the credential store, used as {{secret.<name>}}, never shown again. */
export function SecretsTab() {
  const { t } = useTranslation();
  const names = useSettingsStore((s) => s.settings?.secrets ?? []);
  const setSecret = useSettingsStore((s) => s.setSecret);
  const deleteSecret = useSettingsStore((s) => s.deleteSecret);
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [replacing, setReplacing] = useState<string | null>(null);
  const [replacement, setReplacement] = useState("");

  const nameOk = NAME_RE.test(name.trim());
  const add = async () => {
    setError(null);
    try {
      await setSecret(name.trim(), value);
      setName("");
      setValue("");
    } catch (e) {
      setError(String(e));
    }
  };
  const replace = async (target: string) => {
    setError(null);
    try {
      await setSecret(target, replacement);
      setReplacing(null);
      setReplacement("");
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <>
      <Section description={t("settings.secretsHint")}>
        <div className="flex max-w-lg flex-col gap-3 text-xs text-stage-400">
          <div className="flex items-end gap-2">
            <label className="flex flex-1 flex-col gap-1">
              {t("settings.secretsName")}
              <input value={name} onChange={(e) => setName(e.target.value)} className={fieldCls} spellCheck={false} placeholder="elevenlabs" autoCapitalize="off" autoCorrect="off" />
            </label>
            <label className="flex flex-[2] flex-col gap-1">
              {t("settings.secretsValue")}
              <input
                type="password"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && nameOk && value.trim()) void add();
                }}
                className={fieldCls}
                autoComplete="off"
              />
            </label>
            <Button size="sm" onClick={() => void add()} disabled={!nameOk || !value.trim()}>
              {t("settings.secretsAdd")}
            </Button>
          </div>
          <span className="text-stage-500">{t("settings.secretsNameHint")}</span>
          {error && <span className="text-danger">{error}</span>}
        </div>
      </Section>

      <Section title={t("settings.secretsList", { count: names.length })}>
        {names.length === 0 ? (
          <p className="text-sm text-stage-400">{t("settings.secretsEmpty")}</p>
        ) : (
          <ul className="max-w-2xl divide-y divide-stage-800 rounded-lg border border-stage-800">
            {names.map((n) => (
              <li key={n} className="flex items-center gap-3 px-3 py-1.5 text-xs">
                <span className="w-44 shrink-0 truncate font-mono text-stage-200">{n}</span>
                {replacing === n ? (
                  <>
                    <input
                      type="password"
                      value={replacement}
                      onChange={(e) => setReplacement(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && replacement.trim()) void replace(n);
                        if (e.key === "Escape") setReplacing(null);
                      }}
                      className={fieldCls + " min-w-0 flex-1"}
                      autoComplete="off"
                      autoFocus
                    />
                    <Button size="sm" onClick={() => void replace(n)} disabled={!replacement.trim()}>
                      {t("settings.secretsSave")}
                    </Button>
                    <Button size="sm" onClick={() => setReplacing(null)}>
                      {t("common.cancel")}
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 truncate font-mono text-stage-500">{`{{secret.${n}}}`}</span>
                    <Button
                      size="sm"
                      onClick={() => {
                        setReplacing(n);
                        setReplacement("");
                      }}
                    >
                      {t("settings.secretsReplace")}
                    </Button>
                  </>
                )}
                <button type="button" onClick={() => void deleteSecret(n).catch((e) => setError(String(e)))} aria-label={t("settings.secretsRemove", { name: n })} className="rounded p-1 text-stage-500 hover:bg-stage-800 hover:text-stage-100">
                  <IconClose />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
