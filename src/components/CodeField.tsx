import { clsx } from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import Prism from "prismjs";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Button } from "./ui";

interface Props {
  value: string;
  onChange: (next: string) => void;
  /** Minimum height in lines; the field grows with its content. */
  rows?: number;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
  /** Heading of the maximized view. */
  title?: string;
}

const TEXT = "code-field font-mono text-sm leading-relaxed whitespace-pre-wrap break-words px-2.5 py-1.5";

/**
 * A JavaScript field with syntax colours: a highlighted copy of the text sits
 * underneath a transparent textarea, so typing, selection and the caret work
 * exactly as in a plain textarea while the colours come from the copy. The
 * copy is in the flow and sizes the field, so nothing ever scrolls out of
 * step. A button in the corner opens the same text in a view that fills the
 * window, for longer scripts.
 */
export function CodeField({ value, onChange, rows = 6, placeholder, className, ariaLabel, title }: Props) {
  const { t } = useTranslation();
  const [maximized, setMaximized] = useState(false);
  const small = useRef<HTMLTextAreaElement>(null);

  const close = () => {
    setMaximized(false);
    window.setTimeout(() => small.current?.focus(), 0);
  };

  // Escape leaves the maximized view only; the editor dialog underneath must not see it.
  useEffect(() => {
    if (!maximized) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      e.preventDefault();
      close();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [maximized]);

  return (
    <>
      <div className={clsx("relative w-full rounded-md bg-stage-800 focus-within:ring-1 focus-within:ring-accent-400", className)}>
        <Surface value={value} onChange={onChange} placeholder={placeholder} ariaLabel={ariaLabel} minHeight={`calc(${rows}lh + 0.75rem)`} textareaRef={small} extraPadding />
        <button
          type="button"
          aria-label={t("code.maximize")}
          title={t("code.maximize")}
          onClick={() => setMaximized(true)}
          className="absolute right-1 top-1 rounded-md px-1.5 py-0.5 text-sm leading-none text-stage-500 hover:bg-stage-700 hover:text-stage-200 focus-visible:outline-2 focus-visible:outline-accent-400"
        >
          ⤢
        </button>
      </div>

      {createPortal(
        <AnimatePresence>
          {maximized && (
            <motion.div
              key="code-max"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-stage-950/80 p-4 sm:p-8"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) close();
              }}
            >
              <motion.div
                role="dialog"
                aria-label={title ?? ariaLabel ?? t("code.maximize")}
                initial={{ scale: 0.98 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.98 }}
                transition={{ duration: 0.12 }}
                className="flex h-full w-full max-w-5xl flex-col gap-3 rounded-xl border border-stage-700 bg-stage-900 p-4 shadow-2xl"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-stage-100">{title ?? ariaLabel}</span>
                  <Button size="sm" onClick={close}>
                    {t("code.minimize")}
                  </Button>
                </div>
                <div className="min-h-0 flex-1 overflow-auto rounded-md bg-stage-800 focus-within:ring-1 focus-within:ring-accent-400">
                  <Surface value={value} onChange={onChange} placeholder={placeholder} ariaLabel={ariaLabel} minHeight="100%" autoFocus />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}

/** The highlighted copy with the transparent textarea on top of it. */
function Surface({
  value,
  onChange,
  placeholder,
  ariaLabel,
  minHeight,
  autoFocus = false,
  extraPadding = false,
  textareaRef,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  minHeight: string;
  autoFocus?: boolean;
  /** Room on the right for the maximize button. */
  extraPadding?: boolean;
  textareaRef?: React.RefObject<HTMLTextAreaElement>;
}) {
  const html = useMemo(() => Prism.highlight(value, Prism.languages.javascript, "javascript"), [value]);
  const pad = extraPadding ? "pr-9" : "";
  return (
    <div className="relative min-h-full w-full">
      <pre
        aria-hidden
        className={clsx(TEXT, pad, "m-0 overflow-hidden text-stage-100")}
        style={{ minHeight }}
        // A trailing newline keeps the copy one line taller than the text, like the textarea.
        dangerouslySetInnerHTML={{ __html: html + "\n" }}
      />
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        className={clsx(TEXT, pad, "absolute inset-0 h-full w-full resize-none overflow-hidden bg-transparent text-transparent caret-stage-100 outline-none placeholder:text-stage-500")}
      />
    </div>
  );
}
