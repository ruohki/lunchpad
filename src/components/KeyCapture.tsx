import { clsx } from "clsx";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatCombo, keyFromEvent, modifiersFromEvent, mouseFromEvent } from "../lib/keys";

interface Props {
  value: { key: string; modifiers: string[] };
  onChange: (next: { key: string; modifiers: string[] }) => void;
}

/** Button that records the next key combination pressed on the keyboard. */
export function KeyCapture({ value, onChange }: Props) {
  const { t } = useTranslation();
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    if (!capturing) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        setCapturing(false);
        return;
      }
      const key = keyFromEvent(e);
      if (!key) return; // a bare modifier: keep waiting for the main key
      onChange({ key, modifiers: modifiersFromEvent(e) });
      setCapturing(false);
    };
    // Mouse buttons other than the left one work as keys too (push-to-talk on a side button).
    const onMouse = (e: MouseEvent) => {
      const key = mouseFromEvent(e);
      if (!key) return;
      e.preventDefault();
      e.stopPropagation();
      onChange({ key, modifiers: modifiersFromEvent(e) });
      setCapturing(false);
    };
    const swallow = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("mousedown", onMouse, true);
    window.addEventListener("auxclick", swallow, true);
    window.addEventListener("contextmenu", swallow, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("mousedown", onMouse, true);
      window.removeEventListener("auxclick", swallow, true);
      window.removeEventListener("contextmenu", swallow, true);
    };
  }, [capturing, onChange]);

  return (
    <button
      type="button"
      onClick={() => setCapturing(true)}
      className={clsx(
        "flex min-w-40 items-center justify-center rounded-md border px-3 py-2 font-mono text-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent-400",
        capturing
          ? "border-accent-400 bg-stage-800 text-accent-300"
          : "border-stage-700 bg-stage-800 text-stage-100 hover:bg-stage-700",
      )}
    >
      {capturing ? t("keys.capturing") : value.key ? formatCombo(value.key, value.modifiers) : t("keys.none")}
    </button>
  );
}
