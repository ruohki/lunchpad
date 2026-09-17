import { useTranslation } from "react-i18next";
import type { Action, Button } from "../../lib/api";
import { Toggle } from "../ui";
import { PlaceholderField } from "./PlaceholderField";
import { useVariableSuggestions } from "./VariableFields";

type DebugAction = Extract<Action, { type: "debug" }>;

/** A window with a text: the action's own, updated every time it runs. */
export function DebugEditor({ action, onChange, button }: { action: DebugAction; onChange: (next: Action) => void; button?: Button }) {
  const { t } = useTranslation();
  const suggestions = useVariableSuggestions(button);
  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-xs text-stage-400">
        {t("debug.title")}
        <div className="flex w-64">
          <PlaceholderField value={action.title} onChange={(title) => onChange({ ...action, title })} suggestions={suggestions} placeholder="Debug" ariaLabel={t("debug.title")} />
        </div>
      </label>
      <label className="flex flex-col gap-1 text-xs text-stage-400">
        {t("debug.text")}
        <PlaceholderField multiline rows={4} mono value={action.text} onChange={(text) => onChange({ ...action, text })} suggestions={suggestions} placeholder={t("debug.textPlaceholder")} ariaLabel={t("debug.text")} />
      </label>
      <Toggle checked={action.alwaysOnTop} onChange={(alwaysOnTop) => onChange({ ...action, alwaysOnTop })} label={t("debug.onTop")} hint={t("debug.onTopHint")} />
      <p className="text-xs text-stage-500">{t("debug.hint")}</p>
    </div>
  );
}
