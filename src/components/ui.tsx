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
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className={clsx("h-4 w-4", className)}>
      <circle cx="10" cy="10" r="2.6" />
      <path
        strokeLinejoin="round"
        d="M8.4 2.5h3.2l.4 1.9 1.4.8 1.8-.7 1.6 2.8-1.4 1.3v1.6l1.4 1.3-1.6 2.8-1.8-.7-1.4.8-.4 1.9H8.4l-.4-1.9-1.4-.8-1.8.7-1.6-2.8 1.4-1.3V8.6L3.2 7.3l1.6-2.8 1.8.7 1.4-.8z"
      />
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
