import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { emptyButton, FADER_VARIABLES, type Button, type Fader, type FaderDirection, type Layout, type Page } from "../lib/api";
import { faderVariable, faderPadRgb, faderPads, formatFaderValue, hexToRgb, isControlCell, maxFaderLength, rgbToHex } from "../lib/fader";
import { useDeviceStore } from "../store/device";
import { useProfileStore } from "../store/profile";
import { useVariablesStore } from "../store/variables";
import { ActionsTab } from "./actions/ActionsTab";
import { RgbField } from "./RgbField";
import { Select } from "./Select";
import { Slider } from "./Slider";
import { Button as UiButton, IconClose, Segmented, Toggle } from "./ui";

const NO_PAGES: Page[] = [];
const inputCls = "h-8 rounded-md bg-stage-800 px-2.5 text-sm text-stage-100 outline-none placeholder:text-stage-500 focus:ring-1 focus:ring-accent-400";
/** Number fields of the range rows: narrow, growing with the window up to a cap. */
const rangeFieldCls = "flex min-w-[6.5rem] max-w-[11rem] flex-1 flex-col gap-1 text-xs text-stage-400";
const unitFieldCls = "flex min-w-[4rem] max-w-[7rem] flex-1 flex-col gap-1 text-xs text-stage-400";
const DIRECTIONS: FaderDirection[] = ["up", "right", "down", "left"];

/** Modal editor for a fader: where it sits, how it looks, its range and what it does. */
export function FaderEditor() {
  const { t } = useTranslation();
  const target = useProfileStore((s) => s.faderEditor);
  const close = useProfileStore((s) => s.closeFaderEditor);
  const save = useProfileStore((s) => s.saveFader);
  const remove = useProfileStore((s) => s.removeFader);
  const pages = useProfileStore((s) => s.profile?.pages) ?? NO_PAGES;
  const layout = useDeviceStore((s) => s.layout);

  return (
    <AnimatePresence>
      {target && (
        <motion.div key="fader-editor" className="absolute inset-0 z-30 flex items-center justify-center bg-stage-950/70 p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close}>
          <motion.div
            role="dialog"
            aria-label={target.isNew ? t("fader.titleNew") : t("fader.titleEdit")}
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="flex h-full max-h-[720px] w-full max-w-4xl flex-col rounded-2xl border border-stage-700 bg-stage-900 shadow-2xl"
          >
            <FaderForm
              key={target.fader.id || "new"}
              initial={target.fader}
              isNew={target.isNew}
              page={pages.find((p) => p.id === target.pageId) ?? null}
              pages={pages}
              layout={layout}
              onSave={(f) => void save(f)}
              onRemove={() => void remove(target.fader.id)}
              onCancel={close}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Text field for a number that keeps what the user types until it parses. */
function NumberText({ value, onChange, className, step = 1 }: { value: number; onChange: (n: number) => void; className?: string; step?: number }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = () => {
    const n = parseFloat(text.replace(",", "."));
    if (Number.isFinite(n)) onChange(Math.round(n / step) * step);
    else setText(String(value));
  };
  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
      }}
      className={inputCls + " " + (className ?? "")}
    />
  );
}

function FaderForm({
  initial,
  isNew,
  page,
  pages,
  layout,
  onSave,
  onRemove,
  onCancel,
}: {
  initial: Fader;
  isNew: boolean;
  page: Page | null;
  pages: Page[];
  layout: Layout | null;
  onSave: (f: Fader) => void;
  onRemove: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [fader, setFader] = useState<Fader>(initial);
  const [tab, setTab] = useState<"fader" | "actions">("fader");
  const setHints = useVariablesStore((s) => s.setHints);

  // Offer the fader's variables in every completion while the editor is open.
  useEffect(() => {
    setHints([...FADER_VARIABLES]);
    return () => setHints([]);
  }, [setHints]);

  const maxLen = maxFaderLength(layout, fader.x, fader.y, fader.direction);
  const pads = faderPads(fader);
  const overlaps = useMemo(() => {
    if (!page) return false;
    const mine = new Set(pads.map(([x, y]) => `${x},${y}`));
    return page.faders.some((other) => other.id !== fader.id && faderPads(other).some(([x, y]) => mine.has(`${x},${y}`)));
  }, [page, pads, fader.id]);
  const covered = useMemo(() => (page ? page.buttons.filter((b) => pads.some(([x, y]) => x === b.x && y === b.y)).length : 0), [page, pads]);

  const pseudo: Button = useMemo(() => ({ ...emptyButton(), down: fader.onChange }), [fader.onChange]);
  const setDirection = (direction: FaderDirection) => setFader({ ...fader, direction, length: Math.min(fader.length, maxFaderLength(layout, fader.x, fader.y, direction)) });
  const control = isControlCell(layout, fader.x, fader.y);
  const controlShape = layout?.pads.find((p) => p.x === fader.x && p.y === fader.y)?.shape;
  const valid = (control ? fader.length >= 1 : fader.length >= 2) && !overlaps && fader.min !== fader.max;

  return (
    <>
      <header className="flex items-center justify-between border-b border-stage-800 px-5 py-3">
        <div className="flex items-center gap-4">
          <h2 className="text-sm font-semibold text-stage-100">
            {control ? t(controlShape === "strip" ? "fader.titleStrip" : "fader.titleKnob") : isNew ? t("fader.titleNew") : t("fader.titleEdit")}
            <span className="ml-2 font-normal text-stage-400">{t("fader.position", { column: fader.x + 1, row: fader.y + 1 })}</span>
          </h2>
          <Segmented
            value={tab}
            options={[
              { value: "fader", label: t("fader.tabFader") },
              { value: "actions", label: `${t("fader.tabActions")}${fader.onChange.length ? ` · ${fader.onChange.length}` : ""}` },
            ]}
            onChange={setTab}
          />
        </div>
        <button onClick={onCancel} aria-label={t("common.close")} className="rounded-md p-1 text-stage-400 hover:bg-stage-800 hover:text-stage-100">
          <IconClose />
        </button>
      </header>

      {tab === "actions" ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
          <p className="text-xs text-stage-500">{t("fader.variablesHint")}</p>
          <ActionsTab button={pseudo} onChange={(b) => setFader({ ...fader, onChange: b.down })} pages={pages} layout={layout} lists={["down"]} labels={{ down: "fader.onChange" }} hideLoop faderContext />
        </div>
      ) : (
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 py-4">
        <section className="grid grid-cols-[1fr_1fr_auto_auto] items-start gap-3">
          <label className="flex flex-col gap-1 text-xs text-stage-400">
            {t("fader.name")}
            <input value={fader.name} onChange={(e) => setFader({ ...fader, name: e.target.value })} placeholder={t("fader.namePlaceholder")} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-stage-400">
            {t("fader.variable")}
            <input value={fader.variable ?? ""} onChange={(e) => setFader({ ...fader, variable: e.target.value.replace(/\s+/g, "_") })} placeholder={faderVariable({ ...fader, variable: "" })} className={inputCls + " font-mono"} spellCheck={false} />
            <span className="text-stage-500">{t("fader.variableHint", { key: `fader.${faderVariable(fader)}` })}</span>
          </label>
          {!control && (
            <>
          <div className="flex flex-col gap-1 text-xs text-stage-400">
            {t("fader.direction")}
            <Select<FaderDirection> size="sm" value={fader.direction} options={DIRECTIONS.map((d) => ({ value: d, label: t(`fader.directions.${d}`) }))} onChange={setDirection} />
          </div>
          <label className="flex flex-col gap-1 text-xs text-stage-400">
            {t("fader.length", { max: maxLen })}
            <NumberText value={fader.length} onChange={(n) => setFader({ ...fader, length: Math.max(2, Math.min(maxLen, Math.round(n))) })} className="w-20" />
          </label>
            </>
          )}
        </section>

        {control && <p className="text-xs text-stage-500">{t("fader.controlHint")}</p>}

        {!control && (
        <section className="flex flex-col gap-2">
          <div className="text-xs text-stage-400">{t("fader.preview")}</div>
          <div className="flex gap-1">
            {pads.map(([x, y], i) => {
              const [r, g, b] = faderPadRgb(fader, i);
              return <div key={`${x},${y}`} className="h-8 flex-1 rounded-md" style={{ backgroundColor: `rgb(${r}, ${g}, ${b})` }} title={`${x + 1}, ${y + 1}`} />;
            })}
            <div className="ml-2 self-center text-xs text-stage-400">{formatFaderValue(fader)}</div>
          </div>
          {overlaps && <p className="text-xs text-danger">{t("fader.overlap")}</p>}
          {covered > 0 && <p className="text-xs text-warn">{t("fader.covered", { count: covered })}</p>}
        </section>
        )}

        {!control && (
        <section className="grid grid-cols-3 items-end gap-3">
          <RgbField label={t("fader.colorA")} value={rgbToHex(fader.colorA)} onChange={(hex) => setFader({ ...fader, colorA: hexToRgb(hex) })} />
          <RgbField label={t("fader.colorB")} value={rgbToHex(fader.colorB)} onChange={(hex) => setFader({ ...fader, colorB: hexToRgb(hex) })} />
          <div className="flex flex-col gap-1 text-xs text-stage-400">
            {t("fader.dim")}
            <Slider value={fader.dim} min={0} max={60} onChange={(dim) => setFader({ ...fader, dim })} format={(v) => `${v} %`} ariaLabel={t("fader.dim")} />
          </div>
        </section>
        )}

        <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-end gap-3">
          <label className={rangeFieldCls}>
            {t("fader.min")}
            <NumberText value={fader.min} step={0.001} onChange={(min) => setFader({ ...fader, min })} className="w-full" />
          </label>
          <label className={rangeFieldCls}>
            {t("fader.max")}
            <NumberText value={fader.max} step={0.001} onChange={(max) => setFader({ ...fader, max })} className="w-full" />
          </label>
          <label className={unitFieldCls}>
            {t("fader.unit")}
            <input value={fader.unit} onChange={(e) => setFader({ ...fader, unit: e.target.value })} className={inputCls + " w-full"} />
          </label>
          <div className="flex w-20 flex-col gap-1 text-xs text-stage-400">
            {t("fader.decimals")}
            <Select<"0" | "1" | "2"> size="sm" value={String(Math.min(2, fader.decimals)) as "0" | "1" | "2"} options={[{ value: "0", label: "0" }, { value: "1", label: "1" }, { value: "2", label: "2" }]} onChange={(v) => setFader({ ...fader, decimals: parseInt(v, 10) })} />
          </div>
          <UiButton
            size="sm"
            onClick={() =>
              setFader({
                ...fader,
                min: fader.max,
                max: fader.min,
                display: fader.display ? { ...fader.display, min: fader.display.max, max: fader.display.min } : null,
              })
            }
          >
            {t("fader.invert")}
          </UiButton>
        </div>
        <p className="text-xs text-stage-500">{fader.min > fader.max ? t("fader.rangeInverted") : t("fader.rangeHint")}</p>
        </section>

        <section className="flex flex-col gap-3">
          <Toggle
            checked={fader.display !== null}
            onChange={(on) => setFader({ ...fader, display: on ? { min: 0, max: 100, unit: "%", decimals: 0 } : null })}
            label={t("fader.displayToggle")}
            hint={t("fader.displayHint")}
          />
          {fader.display && (
            <div className="flex flex-wrap items-end gap-3">
              <label className={rangeFieldCls}>
                {t("fader.displayMin")}
                <NumberText value={fader.display.min} step={0.001} onChange={(min) => setFader({ ...fader, display: { ...fader.display!, min } })} className="w-full" />
              </label>
              <label className={rangeFieldCls}>
                {t("fader.displayMax")}
                <NumberText value={fader.display.max} step={0.001} onChange={(max) => setFader({ ...fader, display: { ...fader.display!, max } })} className="w-full" />
              </label>
              <label className={unitFieldCls}>
                {t("fader.unit")}
                <input value={fader.display.unit} onChange={(e) => setFader({ ...fader, display: { ...fader.display!, unit: e.target.value } })} className={inputCls + " w-full"} />
              </label>
              <div className="flex w-20 flex-col gap-1 text-xs text-stage-400">
                {t("fader.decimals")}
                <Select<"0" | "1" | "2">
                  size="sm"
                  value={String(Math.min(2, fader.display.decimals)) as "0" | "1" | "2"}
                  options={[{ value: "0", label: "0" }, { value: "1", label: "1" }, { value: "2", label: "2" }]}
                  onChange={(v) => setFader({ ...fader, display: { ...fader.display!, decimals: parseInt(v, 10) } })}
                />
              </div>
            </div>
          )}
        </section>

        {!control && <p className="text-xs text-stage-500">{t("fader.coverHint")}</p>}
      </div>
      )}

      <footer className="flex items-center justify-between border-t border-stage-800 px-5 py-3">
        <div>
          {!isNew && (
            <UiButton variant="danger" onClick={onRemove}>
              {t("fader.remove")}
            </UiButton>
          )}
        </div>
        <div className="flex gap-2">
          <UiButton onClick={onCancel}>{t("common.cancel")}</UiButton>
          <UiButton variant="primary" onClick={() => onSave(fader)} disabled={!valid}>
            {t("common.save")}
          </UiButton>
        </div>
      </footer>
    </>
  );
}
