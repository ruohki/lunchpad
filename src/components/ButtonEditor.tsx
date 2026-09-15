import { open } from "@tauri-apps/plugin-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, emptyButton, type Button, type Layout, type Look, type Page } from "../lib/api";
import { FACES } from "../lib/colors";
import { useDeviceStore } from "../store/device";
import { useProfileStore } from "../store/profile";
import { ActionsTab } from "./actions/ActionsTab";
import { ColorField } from "./ColorField";
import { PadFace } from "./PadFace";
import { RgbField } from "./RgbField";
import { Select } from "./Select";
import { Slider } from "./Slider";
import { Button as UiButton, IconClose, Segmented, Toggle } from "./ui";
import { Tooltip } from "./Tooltip";
import { StateLinkField } from "./StateLinkField";

const NO_PAGES: Page[] = [];

/** Modal editor for one pad: look, colours and actions. */
export function ButtonEditor() {
  const { t } = useTranslation();
  const target = useProfileStore((s) => s.editor);
  const closeEditor = useProfileStore((s) => s.closeEditor);
  const buttonAt = useProfileStore((s) => s.buttonAt);
  const saveButton = useProfileStore((s) => s.saveButton);
  const clearButton = useProfileStore((s) => s.clearButton);
  const layout = useDeviceStore((s) => s.layout);
  const limited = layout?.limitedColor ?? false;
  const pages = useProfileStore((s) => s.profile?.pages) ?? NO_PAGES;
  const existing = target ? buttonAt(target.x, target.y) : null;

  return (
    <AnimatePresence>
      {target && (
        <motion.div
          key="editor"
          className="absolute inset-0 z-30 flex items-center justify-center bg-stage-950/70 p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeEditor}
        >
          <motion.div
            role="dialog"
            aria-label={t("editor.titleEdit")}
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="flex h-full max-h-[720px] w-full max-w-4xl flex-col rounded-2xl border border-stage-700 bg-stage-900 shadow-2xl"
          >
            <EditorForm
              key={`${target.pageId}:${target.x}:${target.y}`}
              pageId={target.pageId}
              x={target.x}
              y={target.y}
              initial={existing ? stripCoords(existing) : null}
              limited={limited}
              pages={pages}
              layout={layout}
              onCancel={closeEditor}
              onSave={(b) => void saveButton(target.x, target.y, b).then(closeEditor)}
              onRemove={existing ? () => void clearButton(target.x, target.y).then(closeEditor) : undefined}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function stripCoords(b: Button & { x?: number; y?: number }): Button {
  const { x: _x, y: _y, ...rest } = b;
  return structuredClone(rest);
}

interface FormProps {
  pageId: string;
  x: number;
  y: number;
  initial: Button | null;
  limited: boolean;
  pages: Page[];
  layout: Layout | null;
  onCancel: () => void;
  onSave: (b: Button) => void;
  onRemove?: () => void;
}

type Tab = "appearance" | "actions";

function EditorForm({ pageId, x, y, initial, limited, pages, layout, onCancel, onSave, onRemove }: FormProps) {
  const { t } = useTranslation();
  const [button, setButton] = useState<Button>(() => initial ?? randomNewButton());
  const [tab, setTab] = useState<Tab>("appearance");
  const [previewActive, setPreviewActive] = useState(false);
  const pad = layout?.pads.find((p) => p.x === x && p.y === y);
  const ledKind = pad?.led ?? "rgb";
  /** A tap-only button (Arp, Scale): the device reports no release, so only the pressed list. */
  const momentary = pad?.momentary ?? false;
  const [imageError, setImageError] = useState<string | null>(null);
  const dirty = JSON.stringify(button) !== JSON.stringify(initial);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSave(button);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [button, onCancel, onSave]);

  const setLook = (look: Look) => setButton({ ...button, look });
  const textLook = button.look.type === "text" ? button.look : null;
  const imageLook = button.look.type === "image" ? button.look : null;

  const pickImage = async () => {
    setImageError(null);
    const path = await open({
      multiple: false,
      directory: false,
      filters: [{ name: t("settings.fileImages"), extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"] }],
    });
    if (typeof path !== "string") return;
    try {
      const uri = await api.readImageDataUri(path);
      setLook({ type: "image", uri });
    } catch (e) {
      setImageError(String(e));
    }
  };

  return (
    <>
      <header className="flex items-center justify-between border-b border-stage-800 px-5 py-3">
        <div className="flex items-center gap-4">
          <h2 className="text-sm font-semibold text-stage-100">
            {initial ? t("editor.titleEdit") : t("editor.titleNew")}
            <span className="ml-2 font-normal text-stage-400">{t("editor.position", { column: x + 1, row: y + 1 })}</span>
          </h2>
          <Segmented
            value={tab}
            options={[
              { value: "appearance", label: t("editor.tabAppearance") },
              { value: "actions", label: `${t("editor.tabActions")}${button.down.length + button.up.length ? ` · ${button.down.length + button.up.length}` : ""}` },
            ]}
            onChange={setTab}
          />
        </div>
        <button onClick={onCancel} aria-label={t("common.close")} className="rounded-md p-1 text-stage-400 hover:bg-stage-800 hover:text-stage-100">
          <IconClose />
        </button>
      </header>

      {/* minmax(0, 1fr): a plain 1fr column grows to its content's min-content width, so one long
          unbreakable value (a URL in a row summary, say) would widen the dialog and add a horizontal
          scrollbar instead of being truncated. */}
      <div className="grid min-h-0 flex-1 grid-cols-[200px_minmax(0,1fr)] gap-6 overflow-y-auto p-5">
        {/* Preview */}
        <div className="flex flex-col items-center gap-3">
          <div
            className="h-40 w-40 rounded-[14%] bg-stage-800 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
            onPointerDown={() => setPreviewActive(true)}
            onPointerUp={() => setPreviewActive(false)}
            onPointerLeave={() => setPreviewActive(false)}
          >
            <PadFace button={button} cell={144} active={previewActive} limited={limited} noLed={ledKind === "none"} />
          </div>
          <p className="text-center text-xs text-stage-400">{t("editor.previewHint")}</p>
        </div>

        {/* Form */}
        {tab === "actions" ? (
          <div className="flex flex-col gap-3">
            {momentary && <p className="text-xs text-stage-500">{t("editor.tapOnly")}</p>}
            <ActionsTab button={button} onChange={setButton} pages={pages} layout={layout} lists={momentary ? ["down"] : undefined} />
          </div>
        ) : (
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-stage-100">{t("editor.label")}</h3>
              <Segmented
                value={button.look.type}
                options={[
                  { value: "text", label: t("editor.text") },
                  { value: "image", label: t("editor.image") },
                ]}
                onChange={(t) =>
                  setLook(
                    t === "text"
                      ? { type: "text", caption: "", size: 16, face: "sans", color: "#ffffff" }
                      : { type: "image", uri: "" },
                  )
                }
              />
            </div>

            {textLook ? (
              <div className="grid grid-cols-[1fr_auto] gap-3">
                <label className="flex flex-col gap-1 text-xs text-stage-400">
                  {t("editor.caption")}
                  <input
                    autoFocus
                    value={textLook.caption}
                    onChange={(e) => setLook({ ...textLook, caption: e.target.value })}
                    className={inputCls}
                  />
                </label>
                <RgbField label={t("editor.textColour")} value={textLook.color} onChange={(color) => setLook({ ...textLook, color })} />
                <div className="flex flex-col gap-1 text-xs text-stage-400">
                  {t("editor.font")}
                  <Select
                    value={textLook.face}
                    options={[
                      ...FACES.map((f) => ({ value: f.key, label: t(`faces.${f.key}`) })),
                      ...(FACES.some((f) => f.key === textLook.face) ? [] : [{ value: textLook.face, label: textLook.face }]),
                    ]}
                    onChange={(face) => setLook({ ...textLook, face })}
                    ariaLabel={t("editor.font")}
                  />
                </div>
                <div className="flex w-44 flex-col gap-1 text-xs text-stage-400">
                  {t("editor.sizeLabel")}
                  <Slider value={textLook.size} min={6} max={48} onChange={(size) => setLook({ ...textLook, size })} ariaLabel={t("editor.sizeLabel")} format={(v) => `${v}`} />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <UiButton onClick={() => void pickImage()}>{t("editor.chooseImage")}</UiButton>
                {imageLook?.uri && <UiButton onClick={() => setLook({ type: "image", uri: "" })}>{t("editor.removeImage")}</UiButton>}
                {imageError && <span className="text-xs text-danger">{imageError}</span>}
                {!imageLook?.uri && !imageError && <span className="text-xs text-stage-400">{t("editor.imageHint")}</span>}
              </div>
            )}
          </section>

          {ledKind === "none" ? (
            <p className="text-xs text-stage-500">{t("editor.noLedHint")}</p>
          ) : (
          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-medium text-stage-100">{t("editor.colour")}</h3>
            {ledKind === "white" && <p className="text-xs text-stage-500">{t("editor.whiteLedHint")}</p>}
            <div className="grid grid-cols-2 gap-3">
              <ColorField label={t("editor.colour")} value={button.color} onChange={(color) => setButton({ ...button, color })} limited={limited} />
              {button.activeColor && (
                <ColorField
                  label={t("editor.colourWhileActive")}
                  value={button.activeColor}
                  onChange={(activeColor) => setButton({ ...button, activeColor })}
                  limited={limited}
                />
              )}
            </div>
            <Toggle
              checked={button.activeColor !== null}
              onChange={(v) => setButton({ ...button, activeColor: v ? { ...button.color } : null })}
              label={t("editor.activeToggle")}
              hint={t("editor.activeHint")}
            />
          </section>
          )}

          {ledKind !== "none" && (
          <section className="flex flex-col gap-3">
            <div>
              <h3 className="text-sm font-medium text-stage-100">{t("editor.linkTitle")}</h3>
              <p className="mt-0.5 text-xs text-stage-400">{t("editor.linkHint")}</p>
            </div>
            <StateLinkField
              value={button.stateLink}
              onChange={(stateLink) => setButton({ ...button, stateLink, activeColor: stateLink && !button.activeColor ? { ...button.color } : button.activeColor })}
            />
          </section>
          )}
        </div>
        )}
      </div>

      <footer className="flex items-center justify-between border-t border-stage-800 px-5 py-3">
        <div className="flex items-center gap-2">
          {onRemove && (
            <UiButton variant="danger" onClick={onRemove}>
              {t("editor.removeButton")}
            </UiButton>
          )}
          {initial && (
            <Tooltip content={t("editor.testHint")} wrap>
              <UiButton
                disabled={dirty || initial.down.length + initial.up.length + initial.hold.length === 0}
                onClick={() => void api.runButton(pageId, x, y, "tap").catch(() => undefined)}
              >
                {t("editor.test")}
              </UiButton>
            </Tooltip>
          )}
        </div>
        <div className="flex gap-2">
          <UiButton onClick={onCancel}>{t("common.cancel")}</UiButton>
          <UiButton variant="primary" onClick={() => onSave(button)}>
            {t("common.save")}
          </UiButton>
        </div>
      </footer>
    </>
  );
}

const inputCls =
  "min-h-[32px] rounded-md bg-stage-800 px-2.5 py-1.5 text-sm text-stage-100 outline-none focus:ring-1 focus:ring-accent-400";


/** New buttons get a random palette colour, like dropping a file did in legacy. */
function randomNewButton(): Button {
  const b = emptyButton();
  b.color = { mode: "palette", index: 1 + Math.floor(Math.random() * 127) };
  return b;
}
