import { clsx } from "clsx";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "../icons/Icon";
import { formatCombo, formatKey, KEY_GROUPS, keyFromEvent, modifiersFromEvent, mouseFromEvent } from "../lib/keys";
import { Popover } from "./Popover";
import { Tooltip } from "./Tooltip";

interface Props {
  value: { key: string; modifiers: string[] };
  onChange: (next: { key: string; modifiers: string[] }) => void;
}

/**
 * Button that records the next key combination pressed on the keyboard, with a
 * list beside it for keys the keyboard cannot produce (F13 on a laptop, Escape,
 * a missing number pad).
 */
export function KeyCapture({ value, onChange }: Props) {
  const { t } = useTranslation();
  const [capturing, setCapturing] = useState(false);
  const [picking, setPicking] = useState(false);
  const groupRef = useRef<HTMLDivElement>(null);

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
    <div ref={groupRef} className="inline-flex">
      <button
        type="button"
        onClick={() => {
          setPicking(false);
          setCapturing(true);
        }}
        className={clsx(
          "flex min-w-40 items-center justify-center rounded-l-md border px-3 py-2 font-mono text-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent-400",
          capturing
            ? "border-accent-400 bg-stage-800 text-accent-300"
            : "border-stage-700 bg-stage-800 text-stage-100 hover:bg-stage-700",
        )}
      >
        {capturing ? t("keys.capturing") : value.key ? formatCombo(value.key, value.modifiers) : t("keys.none")}
      </button>
      <Tooltip content={t("keys.pick")}>
        <button
          type="button"
          aria-label={t("keys.pick")}
          aria-expanded={picking}
          onClick={() => {
            setCapturing(false);
            setPicking((p) => !p);
          }}
          className={clsx(
            "flex items-center rounded-r-md border border-l-0 px-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-accent-400",
            picking ? "border-accent-400 bg-stage-800 text-accent-300" : "border-stage-700 bg-stage-800 text-stage-300 hover:bg-stage-700 hover:text-stage-100",
          )}
        >
          <Icon name="ChevronDown" />
        </button>
      </Tooltip>
      <Popover open={picking} anchor={groupRef} onClose={() => setPicking(false)} width={380}>
        <KeyList
          value={value.key}
          onPick={(key) => {
            onChange({ key, modifiers: value.modifiers });
            setPicking(false);
          }}
        />
      </Popover>
    </div>
  );
}

/** Searchable list of every key the app can press; the modifiers stay as they were. */
function KeyList({ value, onPick }: { value: string; onPick: (key: string) => void }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);

  const q = query.trim().toLowerCase();
  const groups = KEY_GROUPS.map((g) => ({
    id: g.id,
    keys: q ? g.keys.filter((k) => k.includes(q) || formatKey(k).toLowerCase().includes(q)) : g.keys,
  })).filter((g) => g.keys.length > 0);
  const first = groups[0]?.keys[0];

  return (
    <div className="flex flex-col gap-2.5 p-1">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && first) {
            e.preventDefault();
            onPick(first);
          }
        }}
        placeholder={t("keys.search")}
        aria-label={t("keys.search")}
        spellCheck={false}
        className="w-full rounded-md bg-stage-800 px-2.5 py-1.5 text-sm text-stage-100 outline-none placeholder:text-stage-500 focus:ring-1 focus:ring-accent-400"
      />
      {groups.length === 0 && <p className="px-1 py-1 text-xs text-stage-500">{t("keys.noMatch")}</p>}
      {groups.map((g) => (
        <div key={g.id} className="flex flex-col gap-1">
          <div className="px-0.5 text-[11px] font-medium uppercase tracking-wide text-stage-500">{t(`keys.groups.${g.id}`)}</div>
          <div className="flex flex-wrap gap-1">
            {g.keys.map((k) => {
              const on = k === value;
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onPick(k)}
                  className={clsx("min-w-8 rounded-md px-1.5 py-1 font-mono text-xs transition-colors", on ? "bg-accent-500 text-stage-950" : "bg-stage-800 text-stage-200 hover:bg-stage-700 hover:text-stage-50")}
                >
                  {formatKey(k)}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
