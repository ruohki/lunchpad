import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { clsx } from "clsx";
import type { ImportFinding, ImportReview } from "../../lib/api";
import { Button } from "../ui";

const LEVELS: ImportFinding["level"][] = ["danger", "warning", "info"];

/**
 * What an import would do, listed for the user to check before anything from
 * it can run: secrets it uses, files it uploads, programs it starts. Shown on
 * top of the settings dialog; Escape or the backdrop cancel.
 */
export function ImportReviewDialog({ review, onCancel, onConfirm }: { review: ImportReview | null; onCancel: () => void; onConfirm: () => void }) {
  const { t } = useTranslation();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setChecked(false);
    if (!review) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onCancel();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [review, onCancel]);

  const groups = LEVELS.map((level) => ({ level, items: review?.findings.filter((f) => f.level === level) ?? [] })).filter((g) => g.items.length > 0);

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
            className="flex max-h-full w-full max-w-2xl flex-col gap-4 rounded-xl border border-stage-700 bg-stage-900 p-5 shadow-2xl"
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
                    {items.map((f, i) => (
                      <li key={`${level}-${i}`} className={clsx("rounded-lg border px-3 py-2", level === "danger" ? "border-danger/40 bg-danger/10" : level === "warning" ? "border-warn/30 bg-warn/5" : "border-stage-700 bg-stage-800/60")}>
                        <div className="break-words text-sm text-stage-100">{t(`import.kinds.${f.kind}`, { detail: f.detail })}</div>
                        <div className="mt-0.5 text-xs text-stage-500">
                          {t("import.where", { page: f.page, column: f.x + 1, row: f.y + 1, action: t(`actions.types.${f.action}.name`, { defaultValue: f.action }) })}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
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
