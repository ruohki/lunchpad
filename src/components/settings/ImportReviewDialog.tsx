import { AnimatePresence, motion } from "framer-motion";
import Prism from "prismjs";
import "prismjs/components/prism-json";
import { Fragment, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { clsx } from "clsx";
import { Icon } from "../../icons/Icon";
import type { Action, ImportFinding, ImportReview, Page } from "../../lib/api";
import { PLACEHOLDER } from "../../lib/placeholders";
import { ACTION_ICONS, summarize } from "../actions/actionUtils";
import { Button } from "../ui";

const LEVELS: ImportFinding["level"][] = ["danger", "warning", "info"];
const BUTTON_LISTS = ["down", "up", "hold"] as const;
const FADER_LISTS = ["onTouch", "onChange", "onRelease"] as const;

/** Where an action sits in the imported pages. */
interface Place {
  page: string;
  x: number;
  y: number;
  caption: string;
  list: string;
  action: Action;
}

function places(content: Page[]): Map<string, Place> {
  const out = new Map<string, Place>();
  for (const page of content) {
    for (const b of page.buttons) {
      const caption = b.look.type === "text" ? b.look.caption : "";
      for (const list of BUTTON_LISTS) for (const action of b[list] ?? []) out.set(action.id, { page: page.name, x: b.x, y: b.y, caption, list, action });
    }
    for (const f of page.faders ?? []) {
      for (const list of FADER_LISTS) for (const action of f[list] ?? []) out.set(action.id, { page: page.name, x: f.x, y: f.y, caption: f.name, list, action });
    }
  }
  return out;
}

/**
 * What an import would do, listed for the user to check before anything from
 * it can run: secrets it uses, files it uploads, programs it starts. Every
 * finding opens the action in full, and the whole file can be read as a tree,
 * so the check needs no raw JSON. Shown on top of the settings dialog; Escape
 * or the backdrop cancel.
 */
export function ImportReviewDialog({ review, onCancel, onConfirm }: { review: ImportReview | null; onCancel: () => void; onConfirm: () => void }) {
  const { t } = useTranslation();
  const [checked, setChecked] = useState(false);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    setChecked(false);
    setOpenIds(new Set());
    setShowAll(false);
    if (!review) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onCancel();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [review, onCancel]);

  const content = review?.content ?? [];
  const byId = useMemo(() => places(content), [content]);
  const flagged = useMemo(() => {
    const m = new Map<string, ImportFinding["level"]>();
    for (const f of review?.findings ?? []) {
      const seen = m.get(f.actionId);
      if (!seen || LEVELS.indexOf(f.level) < LEVELS.indexOf(seen)) m.set(f.actionId, f.level);
    }
    return m;
  }, [review]);
  const groups = LEVELS.map((level) => ({ level, items: review?.findings.filter((f) => f.level === level) ?? [] })).filter((g) => g.items.length > 0);
  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const where = (page: string, x: number, y: number, caption: string, action: string) =>
    [page, t("import.position", { column: x + 1, row: y + 1 }), caption && `“${caption}”`, t(`actions.types.${action}.name`, { defaultValue: action })].filter(Boolean).join(" · ");

  return createPortal(
    <AnimatePresence>
      {review && (
        <motion.div
          key="import-review"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-stage-950/80 p-6"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onCancel();
          }}
        >
          <motion.div
            role="dialog"
            aria-label={t("import.title")}
            initial={{ scale: 0.98, y: 8 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.98, y: 8 }}
            transition={{ duration: 0.12 }}
            className="flex max-h-full w-full max-w-3xl flex-col gap-4 rounded-xl border border-stage-700 bg-stage-900 p-5 shadow-2xl"
          >
            <div>
              <h2 className="text-base font-semibold text-stage-100">{t("import.title")}</h2>
              <p className="mt-1 text-sm text-stage-300">{t("import.intro")}</p>
              <p className="mt-1 text-xs text-stage-500">{t("import.summary", { pages: review.pages, buttons: review.buttons, actions: review.actions })}</p>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
              {groups.map(({ level, items }) => (
                <section key={level} className="flex flex-col gap-2">
                  <h3 className={clsx("text-xs font-semibold uppercase tracking-wide", level === "danger" ? "text-danger" : level === "warning" ? "text-warn" : "text-stage-400")}>
                    {t(`import.levels.${level}`)}
                  </h3>
                  <ul className="flex flex-col gap-1.5">
                    {items.map((f, i) => {
                      const key = `${f.actionId}:${f.kind}:${i}`;
                      const open = openIds.has(key);
                      const place = byId.get(f.actionId);
                      return (
                        <li key={key} className={clsx("rounded-lg border px-3 py-2", level === "danger" ? "border-danger/40 bg-danger/10" : level === "warning" ? "border-warn/30 bg-warn/5" : "border-stage-700 bg-stage-800/60")}>
                          <div className="break-words text-sm text-stage-100">{t(`import.kinds.${f.kind}`, { detail: f.detail })}</div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stage-500">
                            <span>{where(f.page, f.x, f.y, f.caption, f.action)}</span>
                            {place && (
                              <button type="button" onClick={() => toggle(key)} className="text-accent-400 hover:underline">
                                {t(open ? "import.hideAction" : "import.showAction")}
                              </button>
                            )}
                          </div>
                          {open && place && (
                            <div className="mt-2">
                              <ActionDetails action={place.action} pages={content} />
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}

              <section className="flex flex-col gap-2">
                <button type="button" onClick={() => setShowAll((v) => !v)} className="flex items-center gap-2 text-left text-xs font-semibold uppercase tracking-wide text-stage-300 hover:text-stage-100">
                  <Icon name={showAll ? "ChevronDown" : "ChevronRight"} className="text-stage-500" />
                  {t("import.everything")}
                </button>
                {showAll && (
                  <div className="flex flex-col gap-3">
                    <p className="text-xs text-stage-500">{t("import.everythingHint")}</p>
                    {content.map((page) => (
                      <div key={page.id} className="flex flex-col gap-2">
                        <h4 className="text-sm font-medium text-stage-100">{page.name}</h4>
                        {[...page.buttons]
                          .sort((a, b) => b.y - a.y || a.x - b.x)
                          .map((b) => (
                            <Owner
                              key={`b${b.x},${b.y}`}
                              title={[t("import.position", { column: b.x + 1, row: b.y + 1 }), b.look.type === "text" && b.look.caption ? `“${b.look.caption}”` : ""].filter(Boolean).join(" · ")}
                              lists={BUTTON_LISTS.map((list) => ({ list, actions: b[list] ?? [] }))}
                              pages={content}
                              flagged={flagged}
                              openIds={openIds}
                              toggle={toggle}
                            />
                          ))}
                        {(page.faders ?? []).map((f) => (
                          <Owner
                            key={`f${f.id}`}
                            title={[t("import.fader", { name: f.name }), t("import.position", { column: f.x + 1, row: f.y + 1 })].join(" · ")}
                            lists={FADER_LISTS.map((list) => ({ list, actions: f[list] ?? [] }))}
                            pages={content}
                            flagged={flagged}
                            openIds={openIds}
                            toggle={toggle}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
            <label className="flex cursor-pointer items-start gap-2 text-sm text-stage-200">
              <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-1 accent-accent-500" />
              {t("import.confirm")}
            </label>
            <div className="flex justify-end gap-2">
              <Button onClick={onCancel}>{t("common.cancel")}</Button>
              <Button variant="primary" onClick={onConfirm} disabled={!checked}>
                {t("import.import")}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** A button or fader of the file with its non-empty lists and their actions. */
function Owner({
  title,
  lists,
  pages,
  flagged,
  openIds,
  toggle,
}: {
  title: string;
  lists: { list: string; actions: Action[] }[];
  pages: Page[];
  flagged: Map<string, ImportFinding["level"]>;
  openIds: Set<string>;
  toggle: (id: string) => void;
}) {
  const { t } = useTranslation();
  const filled = lists.filter((l) => l.actions.length > 0);
  return (
    <div className="rounded-lg border border-stage-700 bg-stage-800/40 px-3 py-2">
      <div className="text-xs font-medium text-stage-200">{title}</div>
      {filled.length === 0 ? (
        <div className="mt-1 text-xs text-stage-500">{t("import.noActions")}</div>
      ) : (
        filled.map(({ list, actions }) => (
          <div key={list} className="mt-1.5">
            <div className="text-[11px] uppercase tracking-wide text-stage-500">{t(`import.lists.${list}`)}</div>
            <ul className="mt-1 flex flex-col gap-1">
              {actions.map((action) => {
                const level = flagged.get(action.id);
                const open = openIds.has(action.id);
                return (
                  <li key={action.id} className="rounded-md bg-stage-900/70 px-2 py-1.5">
                    <div className="flex items-center gap-2 text-xs">
                      <Icon name={ACTION_ICONS[action.type]} className="shrink-0 text-sm text-stage-400" />
                      <span className="text-stage-100">{t(`actions.types.${action.type}.name`, { defaultValue: action.type })}</span>
                      <span className="min-w-0 flex-1 truncate text-stage-400">{summarize(t, action, pages)}</span>
                      {level && <span className={clsx("h-2 w-2 shrink-0 rounded-full", level === "danger" ? "bg-danger" : level === "warning" ? "bg-warn" : "bg-stage-400")} aria-label={t(`import.levels.${level}`)} />}
                      <button type="button" onClick={() => toggle(action.id)} className="shrink-0 text-accent-400 hover:underline">
                        {t(open ? "import.hideAction" : "import.showAction")}
                      </button>
                    </div>
                    {open && (
                      <div className="mt-2">
                        <ActionDetails action={action} pages={pages} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}

const SKIP = new Set(["id", "wait", "type"]);

/** Every field of an action, readable: placeholders marked, secrets in red, code and JSON coloured. */
function ActionDetails({ action, pages }: { action: Action; pages: Page[] }) {
  const { t } = useTranslation();
  const entries = Object.entries(action as unknown as Record<string, unknown>).filter(([k, v]) => !SKIP.has(k) && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0));
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-md bg-stage-950/70 px-3 py-2 text-xs">
      {entries.map(([key, value]) => (
        <Fragment key={key}>
          <dt className="pt-0.5 text-stage-500">{words(key)}</dt>
          <dd className="min-w-0 text-stage-200">
            <Value name={key} value={value} pages={pages} action={action} t={t} />
          </dd>
        </Fragment>
      ))}
    </dl>
  );
}

function words(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}

function Value({ name, value, pages, action, t }: { name: string; value: unknown; pages: Page[]; action: Action; t: (k: string, o?: Record<string, unknown>) => string }) {
  if (typeof value === "string") {
    if (name === "code") return <Code text={value} language="javascript" />;
    const json = looksLikeJson(value);
    if (json) return <Code text={json} language="json" />;
    if (value.includes("\n")) return <Code text={value} language={null} />;
    return <Marked text={value} />;
  }
  if (typeof value === "number" || typeof value === "boolean") return <span className="font-mono">{String(value)}</span>;
  if (name === "pageId" && typeof value === "string") return <span>{pages.find((p) => p.id === value)?.name ?? value}</span>;
  if (Array.isArray(value) && value.every((v) => typeof v !== "object")) return <Marked text={value.map(String).join(", ")} />;
  void action;
  void t;
  return <Code text={JSON.stringify(value, null, 2)} language="json" />;
}

function looksLikeJson(text: string): string | null {
  const trimmed = text.trim();
  if (!/^[[{]/.test(trimmed)) return null;
  try {
    JSON.parse(trimmed.replace(PLACEHOLDER, "0"));
    return text;
  } catch {
    return null;
  }
}

/** Inline text with `{{placeholders}}` marked; a secret stands out in red. */
function Marked({ text }: { text: string }) {
  const out: React.ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (const m of text.matchAll(PLACEHOLDER)) {
    const at = m.index!;
    if (at > last) out.push(text.slice(last, at));
    const secret = m[0].startsWith("{{secret.");
    out.push(
      <span key={k++} className={clsx("rounded-sm px-0.5 font-mono", secret ? "bg-danger/15 text-danger" : "bg-accent-500/15 text-accent-300")}>
        {m[0]}
      </span>,
    );
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <span className="break-words">{out}</span>;
}

/** A block of code or JSON, coloured by Prism, with placeholders (and secrets) marked on top. */
function Code({ text, language }: { text: string; language: "javascript" | "json" | null }) {
  const html = useMemo(() => {
    const grammar = language ? Prism.languages[language] : undefined;
    const base = grammar ? Prism.highlight(text, grammar, language ?? "javascript") : text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    return base.replace(/\{\{[^{}\s]*\}\}/g, (m) => `<span class="${m.startsWith("{{secret.") ? "import-secret" : "import-placeholder"}">${m}</span>`);
  }, [text, language]);
  return <pre className="code-field max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-md bg-stage-900 px-2 py-1.5 font-mono text-[11px] leading-relaxed text-stage-100" dangerouslySetInnerHTML={{ __html: html }} />;
}
