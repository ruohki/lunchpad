import { clsx } from "clsx";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { isBuiltinVariable } from "../../lib/placeholders";
import { Popover } from "../Popover";

interface Props {
  value: string;
  onChange: (name: string) => void;
  /** Names to offer; the current text filters them. */
  suggestions: string[];
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
  /** The variable will be written: the names Lunchpad provides are not offered and are flagged. */
  write?: boolean;
}

/**
 * Text field for a variable name with a completion popover (no native
 * datalist). Arrow keys move the highlight, Enter or Tab accept, Escape closes.
 */
export function VariableNameField({ value, onChange, suggestions, placeholder, className, ariaLabel, write = false }: Props) {
  const { t } = useTranslation();
  const ref = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    const list = suggestions.filter((s) => (!write || !isBuiltinVariable(s)) && s.toLowerCase().includes(q) && s !== value);
    return list.slice(0, 40);
  }, [value, suggestions, write]);
  const provided = write && isBuiltinVariable(value.trim());

  const accept = (name: string) => {
    onChange(name);
    setOpen(false);
  };

  return (
    <>
      <input
        ref={ref}
        value={value}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open && matches.length > 0}
        aria-label={ariaLabel}
        placeholder={placeholder ?? t("vars.namePlaceholder")}
        spellCheck={false}
        onChange={(e) => {
          onChange(e.target.value.replace(/\s+/g, "_"));
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!open || matches.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => Math.min(matches.length - 1, h + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => Math.max(0, h - 1));
          } else if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault();
            accept(matches[highlight]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        aria-invalid={provided || undefined}
        className={clsx(
          "rounded-md bg-stage-800 px-2.5 py-1.5 font-mono text-sm outline-none placeholder:text-stage-500",
          provided ? "text-builtin ring-1 ring-danger" : "text-stage-100 focus:ring-1 focus:ring-accent-400",
          className,
        )}
      />
      {provided && <span className="text-xs text-danger">{t("vars.builtinName")}</span>}
      <Popover open={open && matches.length > 0} anchor={ref} onClose={() => setOpen(false)} width={260} className="p-1.5">
        <ul role="listbox" className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
          {matches.map((name, i) => (
            <li
              key={name}
              role="option"
              aria-selected={i === highlight}
              onMouseEnter={() => setHighlight(i)}
              onMouseDown={(e) => {
                e.preventDefault(); // keep focus in the field
                accept(name);
              }}
              className={clsx(
                "cursor-pointer rounded-md px-2.5 py-1.5 font-mono text-sm",
                i === highlight && "bg-stage-700",
                isBuiltinVariable(name) ? "text-builtin" : i === highlight ? "text-stage-100" : "text-stage-200",
              )}
            >
              {name}
            </li>
          ))}
        </ul>
      </Popover>
    </>
  );
}
