import { clsx } from "clsx";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "../../icons/Icon";
import { typedRect } from "../../lib/caret";
import { PLACEHOLDER } from "../../lib/placeholders";
import { Popover } from "../Popover";
import { Tooltip } from "../Tooltip";

interface Props {
  value: string;
  onChange: (next: string) => void;
  /** Variable names to offer. */
  suggestions: string[];
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  className?: string;
  mono?: boolean;
  spellCheck?: boolean;
  ariaLabel?: string;
  /** Colour the text as code as well as the placeholders. */
  language?: "json";
}

/** Padding, size and radius are shared by the field and the layer behind it, or the two drift apart. */
const fieldCls = "w-full rounded-md px-2.5 py-1.5 text-sm outline-none";
const wrapCls = "relative min-w-0 flex-1 rounded-md bg-stage-800 focus-within:ring-1 focus-within:ring-accent-400";

/** JSON pieces: a string (with an optional colon, which makes it a key), a number, a literal, punctuation. */
const JSON_TOKEN = /("(?:[^"\\]|\\.)*"\s*:)|("(?:[^"\\]|\\.)*")|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b|([{}[\],:])/g;

function jsonParts(text: string, out: ReactNode[], key: () => number) {
  let last = 0;
  for (const m of text.matchAll(JSON_TOKEN)) {
    const at = m.index!;
    if (at > last) out.push(text.slice(last, at));
    const cls = m[1] ? "text-stage-100" : m[2] ? "text-ok" : m[3] ? "text-warn" : m[4] ? "text-accent-400" : "text-stage-400";
    out.push(
      <span key={key()} className={cls}>
        {m[0]}
      </span>,
    );
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
}

/** The value split into coloured pieces: placeholders always, code tokens when a language is set. */
function highlight(value: string, language: Props["language"]): ReactNode[] {
  const out: ReactNode[] = [];
  let n = 0;
  const key = () => ++n;
  let last = 0;
  for (const m of value.matchAll(PLACEHOLDER)) {
    const at = m.index!;
    const before = value.slice(last, at);
    if (language === "json") jsonParts(before, out, key);
    else if (before) out.push(before);
    out.push(
      <span key={key()} className="rounded-sm bg-accent-500/15 text-accent-300">
        {m[0]}
      </span>,
    );
    last = at + m[0].length;
  }
  const rest = value.slice(last);
  if (language === "json") jsonParts(rest, out, key);
  else if (rest) out.push(rest);
  return out;
}

/**
 * Text field for values the engine expands: typing `{{` opens the variable
 * list at the caret, Enter or Tab inserts `{{name}}`, and the button at the
 * end offers the whole list. Works as a single line or a textarea.
 *
 * The text is drawn twice: the input itself is transparent (its caret and
 * selection are not) and a layer behind it shows the same text with the
 * placeholders, and optionally JSON, in colour. Both use the same font and
 * padding and scroll together.
 */
export function PlaceholderField({ value, onChange, suggestions, multiline = false, rows = 2, placeholder, className, mono = false, spellCheck = false, ariaLabel, language }: Props) {
  const { t } = useTranslation();
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const layer = useRef<HTMLDivElement | null>(null);
  const [caret, setCaret] = useState<number | null>(null);
  const [typing, setTyping] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const [highlighted, setHighlighted] = useState(0);

  // An unfinished `{{name` right before the caret.
  const token = useMemo(() => {
    if (caret === null) return null;
    const head = value.slice(0, caret);
    const start = head.lastIndexOf("{{");
    if (start < 0) return null;
    const inner = head.slice(start + 2);
    if (inner.includes("}") || /\s/.test(inner)) return null;
    return { start, query: inner };
  }, [value, caret]);

  const matches = useMemo(() => {
    if (!browsing && !token) return [];
    const q = browsing ? "" : token!.query.toLowerCase();
    return suggestions.filter((s) => s.toLowerCase().includes(q)).slice(0, 40);
  }, [suggestions, token, browsing]);
  const open = ((typing && !!token) || browsing) && matches.length > 0;
  // A caller may hand us a field that is not set yet; the plain input tolerated it.
  const text = value ?? "";
  const parts = useMemo(() => highlight(text, language), [text, language]);

  // While typing, the list sits under the caret's line (the whole field, when it is one line);
  // the layer behind the field knows where the caret is.
  const at = browsing
    ? undefined
    : () => {
        if (!token || caret === null) return null;
        const line = typedRect(layer.current, token.start, caret);
        if (!line || multiline || !ref.current) return line;
        const box = ref.current.getBoundingClientRect();
        return new DOMRect(line.left, box.top, 0, box.height);
      };

  const close = () => {
    setTyping(false);
    setBrowsing(false);
  };

  const insert = (name: string) => {
    let next: string;
    let pos: number;
    if (token && !browsing && caret !== null) {
      const before = value.slice(0, token.start);
      const after = value.slice(caret);
      const rest = after.startsWith("}}") ? after.slice(2) : after;
      next = `${before}{{${name}}}${rest}`;
      pos = before.length + name.length + 4;
    } else {
      const at = caret ?? value.length;
      next = `${value.slice(0, at)}{{${name}}}${value.slice(at)}`;
      pos = at + name.length + 4;
    }
    onChange(next);
    close();
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(pos, pos);
      setCaret(pos);
    });
  };

  const track = (e: React.SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>) => setCaret(e.currentTarget.selectionStart);

  const shared = {
    value,
    placeholder,
    spellCheck,
    "aria-label": ariaLabel,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      onChange(e.target.value);
      setCaret(e.target.selectionStart);
      setTyping(true);
      setBrowsing(false);
      setHighlighted(0);
    },
    onClick: track,
    onKeyUp: track,
    onSelect: track,
    // The layer behind has no scrollbar of its own; it follows the field.
    onScroll: (e: React.UIEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const el = layer.current;
      if (!el) return;
      el.scrollTop = e.currentTarget.scrollTop;
      el.scrollLeft = e.currentTarget.scrollLeft;
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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
        close();
      }
    },
    className: clsx(
      fieldCls,
      "relative bg-transparent text-transparent caret-stage-100 placeholder:text-stage-500 selection:bg-accent-500/30 selection:text-stage-100",
      mono && "font-mono",
      // The scrollbar is always there (its track is transparent) so the text is never
      // wrapped for one width while the layer behind wraps it for another.
      multiline && "resize-y overflow-y-scroll",
    ),
  };

  return (
    <div className={clsx("flex min-w-0 flex-1 gap-0.5", multiline ? "items-start" : "items-center")}>
      <div className={clsx(wrapCls, className)}>
        <div
          ref={layer}
          aria-hidden
          className={clsx(
            fieldCls,
            "pointer-events-none absolute inset-0 text-stage-100",
            mono && "font-mono",
            // Same scrollbar as the field so both wrap the text at the same width; the
            // field's own scrollbar sits on top of it.
            multiline ? "overflow-x-hidden overflow-y-scroll whitespace-pre-wrap break-words" : "overflow-hidden whitespace-pre",
          )}
        >
          {parts}
          {/* Keeps the last line's height when the value ends in a newline. */}
          {"​"}
        </div>
        {multiline ? (
          <textarea ref={ref as React.RefObject<HTMLTextAreaElement>} rows={rows} {...shared} />
        ) : (
          <input ref={ref as React.RefObject<HTMLInputElement>} type="text" {...shared} />
        )}
      </div>
      <Tooltip content={t("vars.insertVariable")}>
        <button
          type="button"
          aria-label={t("vars.insertVariable")}
          onClick={() => {
            setBrowsing((b) => !b);
            setTyping(false);
            setHighlighted(0);
          }}
          className="flex h-8 w-7 shrink-0 items-center justify-center rounded-md text-stage-400 hover:bg-stage-700 hover:text-stage-100"
        >
          <Icon name="Variable" />
        </button>
      </Tooltip>
      <Popover open={open} anchor={ref} at={at} onClose={close} width={260} className="p-1.5">
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
              {`{{${name}}}`}
            </li>
          ))}
        </ul>
      </Popover>
    </div>
  );
}
