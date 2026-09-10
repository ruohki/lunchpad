import { BUILTIN_VARIABLES, FADER_VARIABLES } from "../../lib/api";
import { useShallow } from "zustand/react/shallow";
import { useProfileStore } from "../../store/profile";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { Action, VarScope } from "../../lib/api";
import { useVariablesStore } from "../../store/variables";
import { Select } from "../Select";
import { knownVariables } from "./actionUtils";
import { VariableNameField } from "./VariableNameField";

/**
 * Completion list for variable fields on this button: built-ins, what the
 * button writes, shared variables, every fader's `fader.<name>` level, and the
 * fader variables while a fader is being edited.
 */
export function useVariableSuggestions(button?: { down: Action[]; up: Action[]; hold?: Action[] }): string[] {
  const globals = useVariablesStore((s) => s.globals);
  const hints = useVariablesStore((s) => s.hints);
  const faderOpen = useProfileStore((s) => s.faderEditor !== null);
  const faderNames = useProfileStore(useShallow((s) => (s.profile?.pages ?? []).flatMap((p) => (p.faders ?? []).map((f) => `fader.${f.name.trim() || f.id}`))));
  return useMemo(() => {
    const context = [...hints, ...(faderOpen ? FADER_VARIABLES.filter((v) => !hints.includes(v)) : [])];
    const names = button ? knownVariables(button, globals) : [...BUILTIN_VARIABLES, ...Object.keys(globals)];
    const rest = [...new Set([...names, ...faderNames])].filter((n) => !context.includes(n)).sort();
    return [...context, ...rest];
  }, [button, globals, hints, faderOpen, faderNames]);
}

export const inputCls = "rounded-md bg-stage-800 px-2.5 py-1.5 text-sm text-stage-100 outline-none placeholder:text-stage-500 focus:ring-1 focus:ring-accent-400";
export const monoCls = "rounded-md bg-stage-800 px-2.5 py-1.5 font-mono text-sm text-stage-100 outline-none placeholder:text-stage-500 focus:ring-1 focus:ring-accent-400";

/** "Save to variable" name + scope pair used by several editors. */
export function SaveToFields({
  name,
  scope,
  onChange,
  label,
  button,
}: {
  name: string | null;
  scope: VarScope;
  onChange: (name: string | null, scope: VarScope) => void;
  label?: string;
  button?: { down: Action[]; up: Action[] };
}) {
  const { t } = useTranslation();
  const suggestions = useVariableSuggestions(button);
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1 text-xs text-stage-400">
        {label ?? t("vars.saveTo")}
        <VariableNameField value={name ?? ""} onChange={(v) => onChange(v.trim() ? v : null, scope)} suggestions={suggestions} className="w-44" ariaLabel={label ?? t("vars.saveTo")} />
      </div>
      <ScopeSelect value={scope} onChange={(s) => onChange(name, s)} />
    </div>
  );
}

export function ScopeSelect({ value, onChange }: { value: VarScope; onChange: (s: VarScope) => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1 text-xs text-stage-400">
      {t("vars.scope")}
      <Select<VarScope>
        value={value}
        options={[
          { value: "local", label: t("vars.local"), hint: t("vars.localHint") },
          { value: "global", label: t("vars.global"), hint: t("vars.globalHint") },
        ]}
        onChange={onChange}
        className="w-36"
      />
    </div>
  );
}

export function PlaceholderHint() {
  const { t } = useTranslation();
  return <p className="text-xs text-stage-500">{t("vars.placeholderHint")}</p>;
}
