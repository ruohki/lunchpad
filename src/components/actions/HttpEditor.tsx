import { open } from "@tauri-apps/plugin-dialog";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type Action, type Button as ButtonModel, type HttpAuth, type HttpMethod, type HttpOutcome, type HttpResponse } from "../../lib/api";
import { PlaceholderField } from "./PlaceholderField";
import { Select } from "../Select";
import { Button, Toggle } from "../ui";
import { inputCls, monoCls, PlaceholderHint, SaveToFields, useVariableSuggestions } from "./VariableFields";

type HttpAction = Extract<Action, { type: "httpRequest" }>;
type BodyKind = "json" | "form" | "text" | "custom" | "none" | "file" | "multipart";

const METHODS: HttpMethod[] = ["get", "post", "put", "patch", "delete", "head"];

function bodyKind(action: HttpAction): BodyKind {
  if (action.bodyMode === "file") return "file";
  if (action.bodyMode === "multipart") return "multipart";
  const ct = action.contentType;
  if (ct === null) return "none";
  if (ct === "application/json") return "json";
  if (ct === "application/x-www-form-urlencoded") return "form";
  if (ct === "text/plain") return "text";
  return "custom";
}

async function pickFile(): Promise<string | null> {
  const path = await open({ multiple: false, directory: false });
  return typeof path === "string" ? path : null;
}

export function HttpEditor({ action, onChange, button }: { action: HttpAction; onChange: (next: Action) => void; button?: ButtonModel }) {
  const { t } = useTranslation();
  const suggestions = useVariableSuggestions(button);
  const [outcome, setOutcome] = useState<HttpOutcome | { failed: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const canHaveBody = action.method !== "get" && action.method !== "head";
  const kind = bodyKind(action);
  const needsField = action.response === "base64Field" || action.response === "urlField";

  const setKind = (k: BodyKind) => {
    if (k === "file") return onChange({ ...action, bodyMode: "file", contentType: null });
    if (k === "multipart") return onChange({ ...action, bodyMode: "multipart", contentType: null });
    const ct = k === "json" ? "application/json" : k === "form" ? "application/x-www-form-urlencoded" : k === "text" ? "text/plain" : k === "none" ? null : action.contentType ?? "";
    onChange({ ...action, bodyMode: "text", contentType: ct });
  };

  const setAuth = (type: HttpAuth["type"]) => {
    const auth: HttpAuth = type === "basic" ? { type, username: "", password: "" } : type === "bearer" ? { type, token: "" } : { type: "none" };
    onChange({ ...action, auth });
  };

  const test = async () => {
    setBusy(true);
    setOutcome(null);
    try {
      const { type: _t, saveTo: _s, saveScope: _c, ...request } = action;
      setOutcome(await api.testHttpRequest(request));
    } catch (e) {
      setOutcome({ failed: String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Select<HttpMethod> size="sm" value={action.method} options={METHODS.map((m) => ({ value: m, label: m.toUpperCase() }))} onChange={(method) => onChange({ ...action, method })} className="w-28" />
        <PlaceholderField mono value={action.url} onChange={(url) => onChange({ ...action, url })} suggestions={suggestions} placeholder="https://example.com/api/{{x}}" ariaLabel="URL" />
        <Button size="sm" onClick={() => void test()} disabled={busy || !action.url.trim()}>
          {t("http.test")}
        </Button>
      </div>

      <div className="grid grid-cols-[8rem_1fr] items-start gap-3">
        <div className="flex flex-col gap-1 text-xs text-stage-400">
          {t("http.auth")}
          <Select<HttpAuth["type"]>
            size="sm"
            value={action.auth.type}
            options={[
              { value: "none", label: t("http.authNone") },
              { value: "basic", label: t("http.authBasic") },
              { value: "bearer", label: t("http.authBearer") },
            ]}
            onChange={setAuth}
          />
        </div>
        {action.auth.type === "basic" && (
          <div className="flex gap-2 pt-4">
            <PlaceholderField value={action.auth.username} onChange={(username) => onChange({ ...action, auth: { type: "basic", username, password: (action.auth as { password: string }).password } })} suggestions={suggestions} placeholder={t("http.username")} ariaLabel={t("http.username")} />
            <input type="password" value={action.auth.password} onChange={(e) => onChange({ ...action, auth: { type: "basic", username: (action.auth as { username: string }).username, password: e.target.value } })} placeholder={t("http.password")} className={inputCls + " flex-1"} />
          </div>
        )}
        {action.auth.type === "bearer" && (
          <div className="mt-4 flex">
            <PlaceholderField mono value={action.auth.token} onChange={(token) => onChange({ ...action, auth: { type: "bearer", token } })} suggestions={suggestions} placeholder={t("http.token")} ariaLabel={t("http.token")} />
          </div>
        )}
      </div>
      <p className="text-xs text-stage-500">{t("http.secretHint")}</p>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs text-stage-400">
          {t("http.headers")}
          <button type="button" onClick={() => onChange({ ...action, headers: [...action.headers, { name: "", value: "" }] })} className="rounded-md bg-stage-700 px-2 py-0.5 text-stage-100 hover:bg-stage-600">
            + {t("http.addHeader")}
          </button>
        </div>
        {action.headers.map((h, i) => (
          <div key={i} className="flex gap-2">
            <input value={h.name} onChange={(e) => onChange({ ...action, headers: action.headers.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} placeholder="X-Header" className={monoCls + " w-48"} spellCheck={false} />
            <PlaceholderField mono value={h.value} onChange={(value) => onChange({ ...action, headers: action.headers.map((x, j) => (j === i ? { ...x, value } : x)) })} suggestions={suggestions} placeholder={t("http.headerValue")} ariaLabel={t("http.headerValue")} />
            <button type="button" aria-label={t("actions.remove")} onClick={() => onChange({ ...action, headers: action.headers.filter((_, j) => j !== i) })} className="rounded-md px-1.5 text-[10px] text-stage-400 hover:bg-danger/15 hover:text-danger">
              ✕
            </button>
          </div>
        ))}
      </div>

      {canHaveBody && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-3 text-xs text-stage-400">
            {t("http.body")}
            <Select<BodyKind>
              size="sm"
              value={kind}
              options={[
                { value: "json", label: "JSON" },
                { value: "form", label: t("http.form") },
                { value: "text", label: t("http.text") },
                { value: "custom", label: t("http.customType") },
                { value: "multipart", label: t("http.multipart"), hint: t("http.multipartHint") },
                { value: "file", label: t("http.fileBody"), hint: t("http.fileBodyHint") },
                { value: "none", label: t("http.noType") },
              ]}
              onChange={setKind}
              className="w-52"
            />
            {(kind === "custom" || kind === "file") && (
              <input value={action.contentType ?? ""} onChange={(e) => onChange({ ...action, contentType: e.target.value || null })} placeholder={kind === "file" ? t("http.guessedType") : "Content-Type"} className={monoCls + " flex-1"} spellCheck={false} />
            )}
          </div>

          {kind === "file" && (
            <div className="flex items-center gap-2">
              <input value={action.bodyFile ?? ""} onChange={(e) => onChange({ ...action, bodyFile: e.target.value || null })} placeholder={t("http.filePath")} className={monoCls + " flex-1"} spellCheck={false} />
              <Button size="sm" onClick={() => void pickFile().then((p) => p && onChange({ ...action, bodyFile: p }))}>
                {t("launch.choose")}
              </Button>
            </div>
          )}

          {kind === "multipart" && (
            <>
              <PlaceholderField mono multiline rows={3} value={action.body} onChange={(body) => onChange({ ...action, body })} suggestions={suggestions} placeholder={"title=Clip from {{pageId}}\nvelocity={{velocity}}"} ariaLabel={t("http.body")} />
              <div className="flex items-center justify-between text-xs text-stage-400">
                {t("http.files")}
                <button
                  type="button"
                  onClick={() => onChange({ ...action, files: [...action.files, { field: "file", path: "", filename: null, contentType: null }] })}
                  className="rounded-md bg-stage-700 px-2 py-0.5 text-stage-100 hover:bg-stage-600"
                >
                  + {t("http.addFile")}
                </button>
              </div>
              {action.files.map((f, i) => {
                const update = (patch: Partial<typeof f>) => onChange({ ...action, files: action.files.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
                return (
                  <div key={i} className="grid grid-cols-[7rem_1fr_auto_auto] items-center gap-2">
                    <input value={f.field} onChange={(e) => update({ field: e.target.value })} placeholder={t("http.fieldName")} className={monoCls} spellCheck={false} />
                    <input value={f.path} onChange={(e) => update({ path: e.target.value })} placeholder={t("http.filePath")} className={monoCls} spellCheck={false} />
                    <Button size="sm" onClick={() => void pickFile().then((p) => p && update({ path: p }))}>
                      {t("launch.choose")}
                    </Button>
                    <button type="button" aria-label={t("actions.remove")} onClick={() => onChange({ ...action, files: action.files.filter((_, j) => j !== i) })} className="rounded-md px-1.5 text-[10px] text-stage-400 hover:bg-danger/15 hover:text-danger">
                      ✕
                    </button>
                  </div>
                );
              })}
            </>
          )}

          {kind !== "file" && kind !== "multipart" && kind !== "none" && (
            <PlaceholderField mono multiline rows={4} value={action.body} onChange={(body) => onChange({ ...action, body })} suggestions={suggestions} placeholder={kind === "json" ? '{ "velocity": {{velocity}} }' : ""} ariaLabel={t("http.body")} />
          )}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-3 text-xs text-stage-400">
          {t("http.response")}
          <Select<HttpResponse>
            size="sm"
            value={action.response}
            options={[
              { value: "text", label: t("http.responseText"), hint: t("http.responseTextHint") },
              { value: "file", label: t("http.responseFile"), hint: t("http.responseFileHint") },
              { value: "base64Field", label: t("http.responseBase64"), hint: t("http.responseBase64Hint") },
              { value: "urlField", label: t("http.responseUrl"), hint: t("http.responseUrlHint") },
            ]}
            onChange={(response) => onChange({ ...action, response })}
            className="w-64"
          />
          {needsField && (
            <input value={action.responseField} onChange={(e) => onChange({ ...action, responseField: e.target.value })} placeholder={t("http.fieldHint")} className={monoCls + " flex-1"} spellCheck={false} aria-label={t("http.field")} />
          )}
        </div>
        {(action.response !== "text" || action.reuse) && (
          <div className="flex flex-col gap-1 text-xs text-stage-400">
            {t("http.fileName")}
            <PlaceholderField mono value={action.fileName} onChange={(fileName) => onChange({ ...action, fileName })} suggestions={suggestions} placeholder={t("http.fileNameAuto")} ariaLabel={t("http.fileName")} />
            <span className="text-stage-500">{t("http.fileNameHint")}</span>
          </div>
        )}
        <Toggle checked={action.reuse} onChange={(reuse) => onChange({ ...action, reuse })} label={t("http.reuse")} hint={t("http.reuseHint")} />
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <SaveToFields name={action.saveTo} scope={action.saveScope} onChange={(saveTo, saveScope) => onChange({ ...action, saveTo, saveScope })} label={t("http.saveTo")} />
        <label className="flex flex-col gap-1 text-xs text-stage-400">
          {t("http.timeout")}
          <input
            type="text"
            inputMode="numeric"
            value={action.timeoutMs}
            onChange={(e) => onChange({ ...action, timeoutMs: Math.max(500, Math.min(120000, parseInt(e.target.value.replace(/[^0-9]/g, ""), 10) || 10000)) })}
            className={monoCls + " w-24"}
          />
        </label>
        <Toggle checked={action.ignoreTlsErrors} onChange={(ignoreTlsErrors) => onChange({ ...action, ignoreTlsErrors })} label={t("http.ignoreTls")} />
      </div>
      {action.saveTo && <p className="text-xs text-stage-500">{t("http.saveHint", { name: action.saveTo })}</p>}
      <PlaceholderHint />

      {outcome && (
        <div className="rounded-lg bg-stage-950 p-3 font-mono text-xs">
          {"failed" in outcome ? (
            <span className="text-danger">{outcome.failed}</span>
          ) : (
            <>
              <div className={outcome.ok ? "text-ok" : "text-warn"}>
                {outcome.cached ? t("http.reused", { file: outcome.file }) : t("http.result", { status: outcome.status, ms: outcome.elapsedMs })}
              </div>
              {outcome.file && !outcome.cached && <div className="text-stage-300">{t("http.savedTo", { file: outcome.file })}</div>}
              {outcome.error && <div className="text-danger">{outcome.error}</div>}
              {!outcome.cached && (
                <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all text-stage-300">
                  {outcome.bodyPreview || (outcome.bytes > 0 ? t("http.binaryBody", { bytes: outcome.bytes }) : t("http.emptyBody"))}
                </pre>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
