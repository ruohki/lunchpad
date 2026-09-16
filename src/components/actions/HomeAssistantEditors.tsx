import { clsx } from "clsx";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { HA_POWER_MODES, HA_VALUE_KINDS, type Action, type Button, type HaEntity, type HaPower, type HaValueKind } from "../../lib/api";
import { useMediaStore } from "../../store/media";
import { Popover } from "../Popover";
import { Select } from "../Select";
import { Slider } from "../Slider";
import { Button as UiButton } from "../ui";
import { PlaceholderField } from "./PlaceholderField";
import { useVariableSuggestions } from "./VariableFields";
import { VariableNameField } from "./VariableNameField";

const NONE: HaEntity[] = [];

/** Which entity domains make sense for a value kind; empty = any. */
const DOMAINS_FOR: Record<HaValueKind, string[]> = {
  brightness: ["light"],
  colorTemperature: ["light"],
  position: ["cover"],
  fanSpeed: ["fan"],
  volume: ["media_player"],
  number: ["number", "input_number"],
  temperature: ["climate"],
};

/** Slider range and unit per value kind. */
const RANGE: Record<HaValueKind, { min: number; max: number; step: number; unit: string }> = {
  brightness: { min: 0, max: 100, step: 1, unit: "%" },
  colorTemperature: { min: 2000, max: 6500, step: 50, unit: "K" },
  position: { min: 0, max: 100, step: 1, unit: "%" },
  fanSpeed: { min: 0, max: 100, step: 1, unit: "%" },
  volume: { min: 0, max: 100, step: 1, unit: "%" },
  number: { min: 0, max: 100, step: 1, unit: "" },
  temperature: { min: 5, max: 35, step: 0.5, unit: "°" },
};

/**
 * Entity picker: a text field that completes entity ids and friendly names
 * from the Home Assistant catalog, like the scene pickers do for OBS. Typing an
 * id that is not in the list is fine, so the editor works offline too.
 */
export function EntityPicker({ value, onChange, domains, label }: { value: string; onChange: (entityId: string) => void; domains?: string[]; label: string }) {
  const { t } = useTranslation();
  const ha = useMediaStore((s) => s.homeAssistant);
  const refresh = useMediaStore((s) => s.homeAssistantRefresh);
  const ref = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const entities = ha?.entities ?? NONE;

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    const scoped = domains && domains.length > 0 ? entities.filter((e) => domains.includes(e.domain)) : entities;
    const list = q ? scoped.filter((e) => e.entityId.toLowerCase().includes(q) || e.name.toLowerCase().includes(q)) : scoped;
    return list.slice(0, 40);
  }, [value, entities, domains]);
  const known = entities.find((e) => e.entityId === value);

  const accept = (e: HaEntity) => {
    onChange(e.entityId);
    setOpen(false);
  };

  return (
    <div className="flex flex-col gap-1 text-xs text-stage-400">
      <div className="flex items-center justify-between">
        <span>{label}</span>
        <span className="flex items-center gap-2 text-[11px] text-stage-500">
          {ha?.connected ? t("ha.entityCount", { count: entities.length }) : t("ha.notConnected")}
          <UiButton size="sm" onClick={() => void refresh()} aria-label={t("ha.refresh")}>
            {t("ha.refresh")}
          </UiButton>
        </span>
      </div>
      <input
        ref={ref}
        value={value}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open && matches.length > 0}
        aria-label={label}
        placeholder={t("ha.entityPlaceholder")}
        spellCheck={false}
        onChange={(e) => {
          onChange(e.target.value.trim());
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!open || matches.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => Math.min(matches.length - 1, h + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => Math.max(0, h - 1));
          } else if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault();
            accept(matches[highlight]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className="rounded-md bg-stage-800 px-2.5 py-1.5 font-mono text-sm text-stage-100 outline-none placeholder:text-stage-500 focus:ring-1 focus:ring-accent-400"
      />
      {known && (
        <span className="truncate text-[11px] text-stage-500">
          {known.name} · {t("ha.currentState", { state: known.state })}
        </span>
      )}
      <Popover open={open && matches.length > 0} anchor={ref} onClose={() => setOpen(false)} width={360} className="p-1.5">
        <ul role="listbox" className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
          {matches.map((e, i) => (
            <li
              key={e.entityId}
              role="option"
              aria-selected={i === highlight}
              onMouseEnter={() => setHighlight(i)}
              onMouseDown={(ev) => {
                ev.preventDefault();
                accept(e);
              }}
              className={clsx("flex cursor-pointer flex-col rounded px-2 py-1 text-sm", i === highlight ? "bg-stage-700 text-stage-50" : "text-stage-200")}
            >
              <span className="truncate">{e.name}</span>
              <span className="truncate font-mono text-[11px] text-stage-400">
                {e.entityId} · {e.state}
              </span>
            </li>
          ))}
        </ul>
      </Popover>
    </div>
  );
}

/** Turn an entity on, off, or toggle it. */
export function HomeAssistantTurnEditor({ action, onChange }: { action: Action; onChange: (next: Action) => void }) {
  const { t } = useTranslation();
  if (action.type !== "homeAssistantTurn") return null;
  return (
    <div className="flex flex-col gap-3">
      <EntityPicker label={t("ha.entity")} value={action.entity} onChange={(entity) => onChange({ ...action, entity })} />
      <div className="flex w-48 flex-col gap-1 text-xs text-stage-400">
        {t("ha.mode")}
        <Select<HaPower> size="sm" value={action.mode} options={HA_POWER_MODES.map((m) => ({ value: m, label: t(`ha.modes.${m}`) }))} onChange={(mode) => onChange({ ...action, mode })} />
      </div>
    </div>
  );
}

/** Set brightness, position, volume, a number, … fixed or from a variable / fader. */
export function HomeAssistantValueEditor({ action, onChange, button }: { action: Action; onChange: (next: Action) => void; button: Button }) {
  const { t } = useTranslation();
  const suggestions = useVariableSuggestions(button);
  if (action.type !== "homeAssistantSetValue") return null;
  const range = RANGE[action.kind];
  const format = (v: number) => (range.unit === "%" ? `${Math.round(v)} %` : range.unit === "K" ? `${Math.round(v)} K` : `${v}${range.unit}`);
  return (
    <div className="flex flex-col gap-3">
      <EntityPicker label={t("ha.entity")} value={action.entity} onChange={(entity) => onChange({ ...action, entity })} domains={DOMAINS_FOR[action.kind]} />
      <div className="flex w-56 flex-col gap-1 text-xs text-stage-400">
        {t("ha.kind")}
        <Select<HaValueKind>
          size="sm"
          value={action.kind}
          options={HA_VALUE_KINDS.map((k) => ({ value: k, label: t(`ha.kinds.${k}`) }))}
          onChange={(kind) => onChange({ ...action, kind, value: Math.max(RANGE[kind].min, Math.min(RANGE[kind].max, action.value)) })}
        />
      </div>
      <div className="grid grid-cols-[1fr_auto] items-end gap-3">
        <div className={"flex flex-col gap-1 text-xs text-stage-400 " + (action.valueFrom ? "opacity-50" : "")}>
          {t("ha.value")}
          {action.kind === "number" ? (
            <input
              value={Number.isFinite(action.value) ? String(action.value) : ""}
              inputMode="decimal"
              onChange={(e) => onChange({ ...action, value: parseFloat(e.target.value.replace(",", ".")) || 0 })}
              className="w-40 rounded-md bg-stage-800 px-2.5 py-1.5 font-mono text-sm text-stage-100 outline-none focus:ring-1 focus:ring-accent-400"
              aria-label={t("ha.value")}
            />
          ) : (
            <Slider value={action.value} min={range.min} max={range.max} step={range.step} onChange={(value) => onChange({ ...action, value })} format={format} ariaLabel={t("ha.value")} />
          )}
        </div>
        <div className="flex w-48 flex-col gap-1 text-xs text-stage-400">
          {t("volume.fromVariable")}
          <VariableNameField value={action.valueFrom ?? ""} onChange={(v) => onChange({ ...action, valueFrom: v || null })} suggestions={suggestions} placeholder={t("volume.fromPlaceholder")} />
        </div>
      </div>
      <p className="text-xs text-stage-500">{t(`ha.kindHints.${action.kind}`)}</p>
    </div>
  );
}

/** Any service call with JSON data; placeholders expand in every field. */
export function HomeAssistantServiceEditor({ action, onChange, button }: { action: Action; onChange: (next: Action) => void; button: Button }) {
  const { t } = useTranslation();
  const suggestions = useVariableSuggestions(button);
  if (action.type !== "homeAssistantCallService") return null;
  const field = "rounded-md bg-stage-800 px-2.5 py-1.5 font-mono text-sm text-stage-100 outline-none placeholder:text-stage-500 focus:ring-1 focus:ring-accent-400";
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs text-stage-400">
          {t("ha.domain")}
          <input value={action.domain} onChange={(e) => onChange({ ...action, domain: e.target.value.trim() })} className={field} spellCheck={false} placeholder="light" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-stage-400">
          {t("ha.service")}
          <input value={action.service} onChange={(e) => onChange({ ...action, service: e.target.value.trim() })} className={field} spellCheck={false} placeholder="turn_on" />
        </label>
      </div>
      <EntityPicker label={t("ha.entityOptional")} value={action.entity} onChange={(entity) => onChange({ ...action, entity })} />
      <div className="flex flex-col gap-1 text-xs text-stage-400">
        {t("ha.data")}
        <PlaceholderField value={action.data} onChange={(data) => onChange({ ...action, data })} suggestions={suggestions} multiline rows={3} mono language="json" placeholder={'{ "brightness_pct": {{fader.desk}} }'} />
        <span className="text-stage-500">{t("ha.dataHint")}</span>
      </div>
    </div>
  );
}
