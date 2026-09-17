import { RefreshCw, Settings, X } from "lucide-react";
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
        {/* Driven by the checked state alone, not a layout animation: when the switch's container
            moves (a dialog opening, a list reflowing) the knob moves with it instead of trailing. */}
        <motion.span
          initial={false}
          animate={{ x: checked ? 16 : 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-stage-100"
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
  return <RefreshCw aria-hidden className={clsx("h-4 w-4", className)} />;
}

export function IconGear({ className }: { className?: string }) {
  return <Settings aria-hidden className={clsx("h-4 w-4", className)} />;
}

export function IconClose({ className }: { className?: string }) {
  return <X aria-hidden className={clsx("h-4 w-4", className)} />;
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
