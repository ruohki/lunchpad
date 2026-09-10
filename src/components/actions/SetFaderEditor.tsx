import { useTranslation } from "react-i18next";
import type { Action, Button } from "../../lib/api";
import { useProfileStore } from "../../store/profile";
import { Select } from "../Select";
import { Toggle } from "../ui";
import { PlaceholderField } from "./PlaceholderField";
import { useVariableSuggestions } from "./VariableFields";

type SetFaderAction = Extract<Action, { type: "setFader" }>;

/** Move a fader to a value, optionally without running its actions. */
export function SetFaderEditor({ action, onChange, button }: { action: SetFaderAction; onChange: (next: Action) => void; button: Button }) {
  const { t } = useTranslation();
  const suggestions = useVariableSuggestions(button);
  const pages = useProfileStore((s) => s.profile?.pages);
  const faders = (pages ?? []).flatMap((p) => (p.faders ?? []).map((f) => ({ value: f.name.trim() || f.id, label: f.name.trim() || f.id, hint: p.name })));
  const options = [...faders, ...(action.fader && !faders.some((f) => f.value === action.fader) ? [{ value: action.fader, label: t("obs.missing", { name: action.fader, app: t("app.name") }) }] : [])];
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1 text-xs text-stage-400">
          {t("fader.pick")}
          <Select size="sm" value={action.fader || null} options={options} onChange={(fader) => onChange({ ...action, fader })} placeholder={t("fader.pickPlaceholder")} />
        </div>
        <div className="flex flex-col gap-1 text-xs text-stage-400">
          {t("fader.value")}
          <PlaceholderField mono value={action.value} onChange={(value) => onChange({ ...action, value })} suggestions={suggestions} placeholder="50" ariaLabel={t("fader.value")} />
        </div>
      </div>
      <Toggle checked={action.runActions} onChange={(runActions) => onChange({ ...action, runActions })} label={t("fader.runActions")} hint={t("fader.runActionsHint")} />
      <p className="text-xs text-stage-500">{t("fader.setHint")}</p>
    </div>
  );
}
