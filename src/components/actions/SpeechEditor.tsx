import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type Action, type Button as ButtonModel } from "../../lib/api";
import { PlaceholderField } from "./PlaceholderField";
import { useVariableSuggestions } from "./VariableFields";
import { useMediaStore } from "../../store/media";
import { Select } from "../Select";
import { Slider } from "../Slider";
import { Button } from "../ui";

type SpeechAction = Extract<Action, { type: "textToSpeech" }>;
const DEFAULT_VOICE = "__default__";

export function SpeechEditor({ action, onChange, button }: { action: SpeechAction; onChange: (next: Action) => void; button?: ButtonModel }) {
  const { t } = useTranslation();
  const suggestions = useVariableSuggestions(button);
  const voices = useMediaStore((s) => s.voices);
  const loadVoices = useMediaStore((s) => s.loadVoices);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    if (!voices) void loadVoices().catch(() => undefined);
  }, [voices, loadVoices]);

  const preview = async () => {
    if (speaking) {
      await api.stopSpeech().catch(() => undefined);
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    await api.previewSpeech({ text: action.text, voice: action.voice, volume: action.volume }).catch(() => undefined);
    window.setTimeout(() => setSpeaking(false), Math.min(15000, 400 + action.text.length * 70));
  };

  const options = [
    { value: DEFAULT_VOICE, label: t("speech.defaultVoice") },
    ...(voices ?? []).map((v) => ({ value: v.id, label: v.name, hint: v.language })),
    ...(action.voice && !(voices ?? []).some((v) => v.id === action.voice) ? [{ value: action.voice, label: action.voice }] : []),
  ];

  return (
    <div className="flex flex-col gap-3">
      <PlaceholderField multiline rows={2} value={action.text} onChange={(text) => onChange({ ...action, text })} suggestions={suggestions} placeholder={t("speech.placeholder")} spellCheck ariaLabel={t("speech.placeholder")} />
      <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-3">
        <div className="flex flex-col gap-1 text-xs text-stage-400">
          {t("speech.voice")}
          <Select size="sm" value={action.voice ?? DEFAULT_VOICE} options={options} onChange={(v) => onChange({ ...action, voice: v === DEFAULT_VOICE ? null : v })} />
        </div>
        <div className="flex flex-col gap-1 text-xs text-stage-400">
          {t("sound.volume")}
          <Slider value={Math.round(action.volume * 100)} min={0} max={100} onChange={(v) => onChange({ ...action, volume: v / 100 })} format={(v) => `${v}%`} ariaLabel={t("sound.volume")} />
        </div>
        <Button size="sm" onClick={() => void preview()} disabled={!action.text.trim()}>
          {speaking ? t("sound.stop") : t("sound.preview")}
        </Button>
      </div>
    </div>
  );
}
