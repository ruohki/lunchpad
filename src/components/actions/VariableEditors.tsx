import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api, COMPARE_OPS, type Action, type Button as ButtonModel, type CompareOp, type ScriptOutcome } from "../../lib/api";
import { Select } from "../Select";
import { Button } from "../ui";
import { CodeField } from "../CodeField";
import { PlaceholderHint, SaveToFields, ScopeSelect, useVariableSuggestions } from "./VariableFields";
import { VariableNameField } from "./VariableNameField";
import { PlaceholderField } from "./PlaceholderField";
import { useVariablesStore } from "../../store/variables";
import { useShallow } from "zustand/react/shallow";

type SetVarAction = Extract<Action, { type: "setVariable" }>;
type AddAction = Extract<Action, { type: "addToVariable" }>;
type ScriptAction = Extract<Action, { type: "runScript" }>;
type IfAction = Extract<Action, { type: "ifStart" }>;

export function SetVariableEditor({ action, onChange, button }: { action: SetVarAction; onChange: (next: Action) => void; button: ButtonModel }) {
  const { t } = useTranslation();
  const suggestions = useVariableSuggestions(button);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1 text-xs text-stage-400">
          {t("vars.name")}
          <VariableNameField write value={action.name} onChange={(name) => onChange({ ...action, name })} suggestions={suggestions} className="w-44" ariaLabel={t("vars.name")} />
        </div>
        <label className="flex min-w-60 flex-1 flex-col gap-1 text-xs text-stage-400">
          {t("vars.value")}
          <PlaceholderField mono value={action.value} onChange={(value) => onChange({ ...action, value })} suggestions={suggestions} placeholder="{{velocity}}" ariaLabel={t("vars.value")} />
        </label>
        <ScopeSelect value={action.scope} onChange={(scope) => onChange({ ...action, scope })} />
      </div>
      <PlaceholderHint />
    </div>
  );
}

/** Counter: add a number (or a placeholder's number) to a variable. */
export function AddToVariableEditor({ action, onChange, button }: { action: AddAction; onChange: (next: Action) => void; button: ButtonModel }) {
  const { t } = useTranslation();
  const suggestions = useVariableSuggestions(button);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1 text-xs text-stage-400">
          {t("vars.name")}
          <VariableNameField write value={action.name} onChange={(name) => onChange({ ...action, name })} suggestions={suggestions} className="w-44" ariaLabel={t("vars.name")} />
        </div>
        <label className="flex w-48 flex-col gap-1 text-xs text-stage-400">
          {t("vars.amount")}
          <PlaceholderField mono value={action.amount} onChange={(amount) => onChange({ ...action, amount })} suggestions={suggestions} placeholder="1" ariaLabel={t("vars.amount")} />
        </label>
        <ScopeSelect value={action.scope} onChange={(scope) => onChange({ ...action, scope })} />
      </div>
      <p className="text-xs text-stage-500">{t("vars.amountHint")}</p>
    </div>
  );
}

export function BranchEditor({ action, onChange, button }: { action: IfAction; onChange: (next: Action) => void; button: ButtonModel }) {
  const { t } = useTranslation();
  const suggestions = useVariableSuggestions(button);
  const needsValue = !["isEmpty", "isNotEmpty"].includes(action.op);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1 text-xs text-stage-400">
          {t("branch.variable")}
          <VariableNameField value={action.variable} onChange={(variable) => onChange({ ...action, variable })} suggestions={suggestions} className="w-44" ariaLabel={t("branch.variable")} />
        </div>
        <div className="flex flex-col gap-1 text-xs text-stage-400">
          {t("branch.op")}
          <Select<CompareOp> value={action.op} options={COMPARE_OPS.map((op) => ({ value: op, label: t(`branch.ops.${op}`) }))} onChange={(op) => onChange({ ...action, op })} className="w-44" />
        </div>
        {needsValue && (
          <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs text-stage-400">
            {t("branch.value")}
            <PlaceholderField mono value={action.value} onChange={(value) => onChange({ ...action, value })} suggestions={suggestions} placeholder={action.op === "matches" ? "^scene-\\d+$" : "{{velocity}}"} ariaLabel={t("branch.value")} />
          </label>
        )}
      </div>
      <p className="text-xs text-stage-500">{t("branch.hint")}</p>
    </div>
  );
}

export function ScriptEditor({ action, onChange, button }: { action: ScriptAction; onChange: (next: Action) => void; button: ButtonModel }) {
  const { t } = useTranslation();
  const [outcome, setOutcome] = useState<ScriptOutcome | { error: string } | null>(null);
  const suggestions = useVariableSuggestions(button);
  const globalNames = useVariablesStore(useShallow((s) => Object.keys(s.globals).sort()));

  const test = async () => {
    try {
      setOutcome(await api.testScript(action.code));
    } catch (e) {
      setOutcome({ error: String(e) });
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <CodeField
        value={action.code}
        onChange={(code) => onChange({ ...action, code })}
        rows={6}
        placeholder={"// vars.temp = JSON.parse(vars.weather).main.temp\n// return vars.temp > 25 ? 'hot' : 'fine'"}
        ariaLabel={t("actions.types.runScript.name")}
        title={t("actions.types.runScript.name")}
        suggestions={suggestions}
        globals={globalNames}
      />
      <p className="text-xs text-stage-500">{t("script.hint")}</p>
      <div className="flex flex-wrap items-end gap-3">
        <SaveToFields name={action.saveTo} scope={action.saveScope} onChange={(saveTo, saveScope) => onChange({ ...action, saveTo, saveScope })} label={t("script.saveTo")} button={button} />
        <Button size="sm" onClick={() => void test()} disabled={!action.code.trim()}>
          {t("script.test")}
        </Button>
      </div>
      {outcome && (
        <div className="rounded-lg bg-stage-950 p-3 font-mono text-xs">
          {"error" in outcome ? (
            <span className="text-danger">{outcome.error}</span>
          ) : (
            <>
              <div className="text-ok">{t("script.result", { ms: outcome.elapsedMs })}</div>
              <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all text-stage-300">{outcome.result || "—"}</pre>
              {Object.keys(outcome.globals).length > 0 && (
                <div className="mt-1 text-stage-500">{t("script.globalsChanged", { names: Object.keys(outcome.globals).join(", ") })}</div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
