import { clsx } from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import Prism from "prismjs";
import "prismjs/components/prism-markdown";
import { PLACEHOLDER } from "../lib/placeholders";

// `{{name}}` stands out in Markdown notes: at the top level, inside emphasis and in headings.
{
  const placeholder = { pattern: new RegExp(PLACEHOLDER.source), alias: "variable" };
  const md = Prism.languages.insertBefore("markdown", "bold", { placeholder }) as Record<string, unknown>;
  type Nested = { inside?: Record<string, unknown> & { content?: { inside?: Record<string, unknown> } } };
  for (const token of ["bold", "italic", "strike", "url"]) {
    const inside = (md[token] as Nested | undefined)?.inside?.content?.inside;
    if (inside) inside.placeholder = placeholder;
  }
  for (const title of (md.title as Nested[] | undefined) ?? []) {
    if (title.inside) title.inside.placeholder = placeholder;
  }
}
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { typedRect } from "../lib/caret";
import { Popover } from "./Popover";
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
  /** Variable names offered after `vars.` (JavaScript) or `{{` (Markdown). */
  suggestions?: string[];
  /** Shared variable names offered after `globals.`. */
  globals?: string[];
  language?: Language;
}

const TEXT = "code-field font-mono text-sm leading-relaxed whitespace-pre-wrap break-words px-2.5 py-1.5";

/**
 * A JavaScript field with syntax colours: a highlighted copy of the text sits
 * underneath a transparent textarea, so typing, selection and the caret work
 * exactly as in a plain textarea while the colours come from the copy. The
 * copy is in the flow and sizes the field, so nothing ever scrolls out of
 * step. Typing `vars.` or `globals.` (JavaScript) or `{{` (Markdown) offers
 * the variable names under the caret. A button in the corner opens the same
 * text in a view that fills the window.
 */
export function CodeField({ value, onChange, rows = 6, placeholder, className, ariaLabel, title, suggestions = [], globals = [], language = "javascript" }: Props) {
  const { t } = useTranslation();
  const [maximized, setMaximized] = useState(false);
  const small = useRef<HTMLTextAreaElement>(null);
  const big = useRef<HTMLTextAreaElement>(null);

  const close = () => {
    setMaximized(false);
    window.setTimeout(() => small.current?.focus(), 0);
  };

  // Escape leaves the maximized view only; the editor dialog underneath must not see it.
  useEffect(() => {
    if (!maximized) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // An open completion list takes the Escape itself (its own listener follows this one).
      if (big.current?.getAttribute("aria-expanded") === "true") return;
      e.stopPropagation();
      e.preventDefault();
      close();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [maximized]);

  const surface = { value, onChange, placeholder, ariaLabel, suggestions, globals, language };

  return (
    <>
      <div className={clsx("relative w-full rounded-md bg-stage-800 focus-within:ring-1 focus-within:ring-accent-400", className)}>
        <Surface {...surface} minHeight={`calc(${rows}lh + 0.75rem)`} textareaRef={small} extraPadding />
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
                  <Surface {...surface} minHeight="100%" textareaRef={big} autoFocus />
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

/** Where the text before the caret ends in `vars.`, `globals.` or `{{` plus a started name. */
interface Access {
  object: "vars" | "globals" | "placeholder";
  partial: string;
  /** Index of the object's first character in the text. */
  from: number;
}

function accessBefore(value: string, caret: number | null, language: Language): Access | null {
  if (caret === null) return null;
  const head = value.slice(0, caret);
  if (language === "markdown") {
    const m = /\{\{([^{}\s]*)$/.exec(head);
    return m ? { object: "placeholder", partial: m[1], from: caret - m[0].length } : null;
  }
  const m = /(vars|globals)\.([A-Za-z0-9_$]*)$/.exec(head);
  return m ? { object: m[1] as "vars" | "globals", partial: m[2], from: caret - m[0].length } : null;
}

/** `vars.name` for a plain identifier, `vars["fader.gain"]` for anything else; `{{name}}` in Markdown. */
function accessExpression(object: Access["object"], name: string): string {
  if (object === "placeholder") return `{{${name}}}`;
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? `${object}.${name}` : `${object}[${JSON.stringify(name)}]`;
}

type Language = "javascript" | "markdown";

/** The highlighted copy with the transparent textarea on top of it, and the completion list. */
function Surface({
  value,
  onChange,
  placeholder,
  ariaLabel,
  minHeight,
  autoFocus = false,
  extraPadding = false,
  textareaRef,
  suggestions,
  globals,
  language,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  minHeight: string;
  autoFocus?: boolean;
  /** Room on the right for the maximize button. */
  extraPadding?: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  suggestions: string[];
  globals: string[];
  language: Language;
}) {
  const html = useMemo(() => Prism.highlight(value, Prism.languages[language], language), [value, language]);
  const pad = extraPadding ? "pr-9" : "";
  const copy = useRef<HTMLPreElement>(null);
  const [caret, setCaret] = useState<number | null>(null);
  const [typing, setTyping] = useState(false);
  const [highlighted, setHighlighted] = useState(0);

  const access = useMemo(() => accessBefore(value, caret, language), [value, caret, language]);
  const matches = useMemo(() => {
    if (!access) return [];
    const pool = access.object === "globals" ? globals : suggestions;
    const q = access.partial.toLowerCase();
    return pool.filter((n) => n.toLowerCase().startsWith(q) && n !== access.partial).slice(0, 12);
  }, [access, suggestions, globals]);
  const open = typing && !!access && matches.length > 0;
  // The list sits under the caret's line; the copy is laid out like the textarea, so it knows where that is.
  const at = () => (access && caret !== null ? typedRect(copy.current, access.from, caret) : null);

  const track = (e: React.SyntheticEvent<HTMLTextAreaElement>) => setCaret(e.currentTarget.selectionStart);

  const insert = (name: string) => {
    if (!access || caret === null) return;
    const expression = accessExpression(access.object, name);
    const after = value.slice(caret);
    // Typing inside an existing `{{...}}` keeps one closing pair.
    const rest = access.object === "placeholder" && after.startsWith("}}") ? after.slice(2) : after;
    const next = value.slice(0, access.from) + expression + rest;
    onChange(next);
    setTyping(false);
    const at = access.from + expression.length;
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(at, at);
      setCaret(at);
    });
  };

  return (
    <div className="relative min-h-full w-full">
      <pre
        ref={copy}
        aria-hidden
        className={clsx(TEXT, pad, "m-0 overflow-hidden text-stage-100")}
        style={{ minHeight }}
        // A trailing newline keeps the copy one line taller than the text, like the textarea.
        dangerouslySetInnerHTML={{ __html: html + "\n" }}
      />
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setCaret(e.target.selectionStart);
          setTyping(true);
          setHighlighted(0);
        }}
        onClick={track}
        onKeyUp={track}
        onSelect={track}
        onBlur={() => setTyping(false)}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlighted((h) => Math.min(matches.length - 1, h + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlighted((h) => Math.max(0, h - 1));
          } else if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault();
            insert(matches[highlighted]);
          } else if (e.key === "Escape") {
            e.stopPropagation();
            setTyping(false);
          }
        }}
        placeholder={placeholder}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        aria-autocomplete="list"
        aria-expanded={open}
        className={clsx(TEXT, pad, "absolute inset-0 h-full w-full resize-none overflow-hidden bg-transparent text-transparent caret-stage-100 outline-none placeholder:text-stage-500")}
      />
      <Popover open={open} anchor={textareaRef} at={at} onClose={() => setTyping(false)} width={280} className="p-1.5">
        <ul role="listbox" className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
          {matches.map((name, i) => (
            <li
              key={name}
              role="option"
              aria-selected={i === highlighted}
              onMouseEnter={() => setHighlighted(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                insert(name);
              }}
              className={clsx("cursor-pointer rounded-md px-2.5 py-1.5 font-mono text-sm", i === highlighted ? "bg-stage-700 text-stage-100" : "text-stage-200")}
            >
              {access ? accessExpression(access.object, name) : name}
            </li>
          ))}
        </ul>
      </Popover>
    </div>
  );
}
