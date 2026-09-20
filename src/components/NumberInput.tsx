import { useState } from "react";

interface Props {
  value: number;
  min?: number;
  max?: number;
  /** Accept a decimal point (a comma too); whole numbers otherwise. */
  decimal?: boolean;
  onChange: (n: number) => void;
  className?: string;
  ariaLabel?: string;
  placeholder?: string;
}

/**
 * Text field for a number (no native spinner). What is typed stays on screen while the field
 * has the focus, so clearing it does not snap to the minimum and a second digit is not clamped
 * away mid-word: a value inside the range is handed on as it is typed, anything else when the
 * field is left (clamped, or dropped when it is not a number).
 */
export function NumberInput({ value, min, max, decimal = false, onChange, className, ariaLabel, placeholder }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const signed = min === undefined || min < 0;
  const allowed = decimal ? (signed ? /[^\d.,-]/g : /[^\d.,]/g) : signed ? /[^\d-]/g : /\D/g;
  const clamp = (n: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
  const parse = (text: string) => {
    const n = decimal ? parseFloat(text.replace(",", ".")) : parseInt(text, 10);
    return Number.isFinite(n) ? n : null;
  };
  const commit = () => {
    if (draft !== null) {
      const n = parse(draft);
      if (n !== null) onChange(clamp(n));
    }
    setDraft(null);
  };

  return (
    <input
      type="text"
      inputMode={decimal ? "decimal" : "numeric"}
      value={draft ?? (Number.isFinite(value) ? String(value) : "")}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={(e) => {
        const text = e.target.value.replace(allowed, "");
        setDraft(text);
        const n = parse(text);
        if (n !== null && clamp(n) === n) onChange(n);
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      className={className}
    />
  );
}
