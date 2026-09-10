import { clsx } from "clsx";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "../../icons/Icon";
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
}

const baseCls = "w-full rounded-md bg-stage-800 px-2.5 py-1.5 text-sm text-stage-100 outline-none placeholder:text-stage-500 focus:ring-1 focus:ring-accent-400";

/**
 * Text field for values the engine expands: typing `{{` opens the variable
 * list at the caret, Enter or Tab inserts `{{name}}`, and the button at the
 * end offers the whole list. Works as a single line or a textarea.
 */
export function PlaceholderField({ value, onChange, suggestions, multiline = false, rows = 2, placeholder, className, mono = false, spellCheck = false, ariaLabel }: Props) {
  const { t } = useTranslation();
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const [caret, setCaret] = useState<number | null>(null);
  const [typing, setTyping] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const [highlight, setHighlight] = useState(0);

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
      setHighlight(0);
    },
    onClick: track,
    onKeyUp: track,
    onSelect: track,
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (!open) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => Math.min(matches.length - 1, h + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => Math.max(0, h - 1));
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insert(matches[highlight]);
      } else if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    },
    className: clsx(baseCls, mono && "font-mono", multiline && "resize-y", className),
  };

  return (
    <div className={clsx("flex min-w-0 flex-1 gap-0.5", multiline ? "items-start" : "items-center")}>
      {multiline ? (
        <textarea ref={ref as React.RefObject<HTMLTextAreaElement>} rows={rows} {...shared} />
      ) : (
        <input ref={ref as React.RefObject<HTMLInputElement>} type="text" {...shared} />
      )}
      <Tooltip content={t("vars.insertVariable")}>
        <button
          type="button"
          aria-label={t("vars.insertVariable")}
          onClick={() => {
            setBrowsing((b) => !b);
            setTyping(false);
            setHighlight(0);
          }}
          className="flex h-8 w-7 shrink-0 items-center justify-center rounded-md text-stage-400 hover:bg-stage-700 hover:text-stage-100"
        >
          <Icon name="Variable" />
        </button>
      </Tooltip>
      <Popover open={open} anchor={ref} onClose={close} width={260} className="p-1.5">
        <ul role="listbox" className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
          {matches.map((name, i) => (
            <li
              key={name}
              role="option"
              aria-selected={i === highlight}
              onMouseEnter={() => setHighlight(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                insert(name);
              }}
              className={clsx("cursor-pointer rounded-md px-2.5 py-1.5 font-mono text-sm", i === highlight ? "bg-stage-700 text-stage-100" : "text-stage-200")}
            >
              {`{{${name}}}`}
            </li>
          ))}
        </ul>
      </Popover>
    </div>
  );
}
