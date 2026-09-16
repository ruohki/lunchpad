import { clsx } from "clsx";
import { useEffect, useRef, useState } from "react";
import { Popover } from "./Popover";
import { Icon } from "../icons/Icon";

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

interface Props<T extends string> {
  value: T | null;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  size?: "sm" | "md";
  className?: string;
  ariaLabel?: string;
  disabled?: boolean;
}

/**
 * Dropdown built from plain elements (no native select): a trigger button and
 * a popover list with arrow-key navigation, Home/End, Enter and Escape.
 */
export function Select<T extends string>({ value, options, onChange, placeholder, size = "md", className, ariaLabel, disabled }: Props<T>) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const current = options.find((o) => o.value === value) ?? null;

  useEffect(() => {
    if (!open) return;
    const idx = Math.max(0, options.findIndex((o) => o.value === value));
    setHighlight(idx);
    requestAnimationFrame(() => {
      listRef.current?.focus();
      listRef.current?.querySelectorAll("li")[idx]?.scrollIntoView({ block: "nearest" });
    });
  }, [open, options, value]);

  const choose = (index: number) => {
    const opt = options[index];
    if (!opt) return;
    onChange(opt.value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onListKey = (e: React.KeyboardEvent) => {
    const move = (next: number) => {
      const clamped = Math.max(0, Math.min(options.length - 1, next));
      setHighlight(clamped);
      listRef.current?.querySelectorAll("li")[clamped]?.scrollIntoView({ block: "nearest" });
    };
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        move(highlight + 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        move(highlight - 1);
        break;
      case "Home":
        e.preventDefault();
        move(0);
        break;
      case "End":
        e.preventDefault();
        move(options.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        choose(highlight);
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={clsx(
          "flex items-center justify-between gap-2 rounded-md bg-stage-800 text-left text-stage-100 transition-colors hover:bg-stage-700 focus-visible:outline-2 focus-visible:outline-accent-400 disabled:opacity-40",
          // Both sizes match the text inputs' height so mixed form rows line up.
          size === "sm" ? "min-h-[32px] px-2.5 py-1.5 text-sm" : "min-h-[32px] px-2.5 py-1.5 text-sm",
          open && "ring-1 ring-accent-400",
          className,
        )}
      >
        <span className={clsx("truncate", !current && "text-stage-400")}>{current?.label ?? placeholder ?? ""}</span>
        <Icon name="ChevronDown" className="shrink-0 text-stage-400" />
      </button>
      <Popover open={open} anchor={triggerRef} onClose={() => setOpen(false)}>
        <ul ref={listRef} role="listbox" tabIndex={-1} onKeyDown={onListKey} className="flex flex-col gap-0.5 outline-none">
          {options.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              onMouseEnter={() => setHighlight(i)}
              onClick={() => choose(i)}
              className={clsx(
                "cursor-pointer rounded-md px-2.5 py-1.5 text-sm",
                i === highlight ? "bg-stage-700 text-stage-100" : "text-stage-200",
                o.value === value && "font-medium",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="truncate">{o.label}</span>
                {o.value === value && <span className="text-xs text-accent-400">●</span>}
              </div>
              {o.hint && <div className="text-xs text-stage-500">{o.hint}</div>}
            </li>
          ))}
        </ul>
      </Popover>
    </>
  );
}
