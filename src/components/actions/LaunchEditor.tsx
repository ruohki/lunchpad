import { open } from "@tauri-apps/plugin-dialog";
import { useTranslation } from "react-i18next";
import type { Action, Button as ButtonModel } from "../../lib/api";
import { PlaceholderField } from "./PlaceholderField";
import { useVariableSuggestions } from "./VariableFields";
import { Button, Toggle } from "../ui";
import { PlaceholderHint, SaveToFields } from "./VariableFields";

type LaunchAction = Extract<Action, { type: "launchApplication" }>;
const isWindows = navigator.platform.toLowerCase().includes("win");

export function LaunchEditor({ action, onChange, button }: { action: LaunchAction; onChange: (next: Action) => void; button?: ButtonModel }) {
  const { t } = useTranslation();
  const suggestions = useVariableSuggestions(button);

  const pick = async () => {
    const path = await open({ multiple: false, directory: false });
    if (typeof path === "string") onChange({ ...action, executable: path });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1 text-xs text-stage-400">
        {t("launch.executable")}
        <div className="flex gap-2">
          <PlaceholderField mono value={action.executable} onChange={(executable) => onChange({ ...action, executable })} suggestions={suggestions} placeholder={t("launch.executablePlaceholder")} ariaLabel={t("launch.executable")} />
          <Button size="sm" onClick={() => void pick()}>
            {t("launch.choose")}
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-1 text-xs text-stage-400">
        {t("launch.arguments")}
        <PlaceholderField mono value={action.arguments} onChange={(args) => onChange({ ...action, arguments: args })} suggestions={suggestions} placeholder={t("launch.argumentsPlaceholder")} ariaLabel={t("launch.arguments")} />
      </div>
      <div className="flex flex-wrap gap-6">
        <Toggle checked={action.killOnStop} onChange={(killOnStop) => onChange({ ...action, killOnStop })} label={t("launch.killOnStop")} hint={t("launch.killOnStopHint")} />
        {isWindows && <Toggle checked={action.hidden} onChange={(hidden) => onChange({ ...action, hidden })} label={t("launch.hidden")} />}
      </div>
      <SaveToFields name={action.saveOutputTo} scope={action.saveScope} onChange={(saveOutputTo, saveScope) => onChange({ ...action, saveOutputTo, saveScope })} label={t("launch.saveOutput")} />
      <PlaceholderHint />
    </div>
  );
}
