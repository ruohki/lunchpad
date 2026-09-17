import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "./ui";

/**
 * A small question over an editor ("Discard your changes?"). Escape and a click
 * beside it keep editing; only the red button confirms.
 */
export function ConfirmPrompt({ open, title, body, confirmLabel, onConfirm, onCancel }: { open: boolean; title: string; body: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void }) {
  const { t } = useTranslation();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="confirm"
          className="absolute inset-0 z-40 flex items-center justify-center rounded-2xl bg-stage-950/60 p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => {
            e.stopPropagation();
            onCancel();
          }}
        >
          <motion.div
            role="alertdialog"
            aria-label={title}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-xl border border-stage-700 bg-stage-900 p-5 shadow-2xl"
          >
            <h3 className="text-sm font-semibold text-stage-100">{title}</h3>
            <p className="mt-1 text-sm text-stage-400">{body}</p>
            <div className="mt-4 flex justify-end gap-2">
              <Button onClick={onCancel} autoFocus>
                {t("editor.keepEditing")}
              </Button>
              <Button variant="danger" onClick={onConfirm}>
                {confirmLabel}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
