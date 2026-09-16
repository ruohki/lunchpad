import { clsx } from "clsx";
import { useRef, useState } from "react";
import { IconClose } from "./ui";

interface Props {
  value: string[];
  onChange: (tags: string[]) => void;
  max?: number;
  placeholder?: string;
  className?: string;
}

const clean = (raw: string): string =>
  raw
    .trim()
    .toLowerCase()
    .replace(/^#/, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);

/** Tags as chips: Enter, comma or space adds one, Backspace on an empty field removes the last. */
export function TagInput({ value, onChange, max = 8, placeholder, className }: Props) {
  const [draft, setDraft] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const add = (raw: string) => {
    const tag = clean(raw);
    if (!tag || tag.length < 2 || value.includes(tag) || value.length >= max) return;
    onChange([...value, tag]);
  };
  const commit = () => {
    if (draft.trim()) add(draft);
    setDraft("");
  };

  return (
    <div
      onClick={() => input.current?.focus()}
      className={clsx("flex min-h-[32px] flex-wrap items-center gap-1 rounded-md bg-stage-800 px-2 py-1 text-sm text-stage-100 focus-within:ring-1 focus-within:ring-accent-400", className)}
    >
      {value.map((tag) => (
        <span key={tag} className="inline-flex items-center gap-1 rounded bg-stage-700 py-0.5 pl-2 pr-1 text-xs text-stage-200">
          #{tag}
          <button type="button" aria-label={`Remove ${tag}`} onClick={() => onChange(value.filter((t) => t !== tag))} className="rounded p-0.5 text-stage-400 hover:bg-stage-600 hover:text-stage-100">
            <IconClose className="h-3 w-3" />
          </button>
        </span>
      ))}
      {value.length < max && (
        <input
          ref={input}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "," || e.key === " ") {
              e.preventDefault();
              commit();
            } else if (e.key === "Backspace" && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          placeholder={value.length ? "" : placeholder}
          className="min-w-[6rem] flex-1 bg-transparent py-0.5 text-sm outline-none placeholder:text-stage-500"
          spellCheck={false}
          autoCapitalize="off"
        />
      )}
    </div>
  );
}
