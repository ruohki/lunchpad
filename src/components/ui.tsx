import { clsx } from "clsx";
import { motion } from "framer-motion";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "quiet" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md";
}

export function Button({ variant = "quiet", size = "md", className, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      className={clsx(
        "inline-flex items-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400 disabled:cursor-not-allowed disabled:opacity-40",
        // "sm" matches the 32 px height of text fields and selects so buttons beside them line up.
        size === "sm" ? "min-h-[32px] px-2.5 py-1 text-xs" : "px-3.5 py-2 text-sm",
        variant === "primary" && "bg-accent-500 text-stage-950 hover:bg-accent-400",
        variant === "quiet" && "bg-stage-700 text-stage-100 hover:bg-stage-600",
        variant === "danger" && "bg-transparent text-danger hover:bg-danger/10",
        className,
      )}
    />
  );
}

interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, label, hint, disabled }: ToggleProps) {
  return (
    <label className={clsx("flex items-start gap-3", disabled ? "opacity-40" : "cursor-pointer")}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={clsx(
          "relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400",
          checked ? "bg-accent-500" : "bg-stage-600",
        )}
      >
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className={clsx(
            "absolute top-0.5 h-4 w-4 rounded-full bg-stage-100",
            checked ? "left-[18px]" : "left-0.5",
          )}
        />
      </button>
      <span className="flex flex-col">
        <span className="text-sm text-stage-100">{label}</span>
        {hint && <span className="text-xs text-stage-400">{hint}</span>}
      </span>
    </label>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <motion.span
      aria-hidden
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, ease: "linear", duration: 0.9 }}
      className={clsx(
        "inline-block h-4 w-4 rounded-full border-2 border-stage-500 border-t-accent-400",
        className,
      )}
    />
  );
}

export function IconRefresh({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className={clsx("h-4 w-4", className)}>
      <path d="M16.5 10a6.5 6.5 0 1 1-1.9-4.6" strokeLinecap="round" />
      <path d="M16.5 3.5v3.2h-3.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconGear({ className }: { className?: string }) {
  // Eight teeth around the hub, generated as one polygon so the wheel is symmetric.
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className={clsx("h-4 w-4", className)}>
      <circle cx="10" cy="10" r="2.5" />
      <path strokeLinejoin="round" d="M8.93 4.50 L9.10 2.66 L10.90 2.66 L11.07 4.50 L13.13 5.36 L14.56 4.17 L15.83 5.44 L14.64 6.87 L15.50 8.93 L17.34 9.10 L17.34 10.90 L15.50 11.07 L14.64 13.13 L15.83 14.56 L14.56 15.83 L13.13 14.64 L11.07 15.50 L10.90 17.34 L9.10 17.34 L8.93 15.50 L6.87 14.64 L5.44 15.83 L4.17 14.56 L5.36 13.13 L4.50 11.07 L2.66 10.90 L2.66 9.10 L4.50 8.93 L5.36 6.87 L4.17 5.44 L5.44 4.17 L6.87 5.36 Z" />
    </svg>
  );
}

export function IconClose({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className={clsx("h-4 w-4", className)}>
      <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
    </svg>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-stage-400">{label}</span>
      <span className="text-sm text-stage-100">{children}</span>
    </div>
  );
}

/** Tab strip for an editor header: one highlighted segment per option. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-lg bg-stage-800 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={clsx(
            "rounded-md px-3 py-1 text-xs font-medium transition-colors",
            value === o.value ? "bg-stage-600 text-stage-100" : "text-stage-400 hover:text-stage-200",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
