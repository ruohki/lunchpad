import { Markdown } from "../lib/markdown";
import { builtinValues, expandPlaceholders, usesClock } from "../lib/placeholders";
import { useNow } from "../lib/useNow";
import { useProfileStore } from "../store/profile";
import { useVariablesStore } from "../store/variables";

/**
 * A button's description with its placeholders filled: the shared variables
 * as they are now, the page and caption, and the clock, ticking while a time
 * is shown. Mounted only while its tooltip is open.
 */
export function Description({ text, pageId, caption }: { text: string; pageId: string | null; caption: string }) {
  const globals = useVariablesStore((s) => s.globals);
  const pageName = useProfileStore((s) => s.profile?.pages.find((p) => p.id === pageId)?.name ?? "");
  const now = useNow(usesClock(text) ? 1000 : 0);
  const vars = { ...globals, ...builtinValues(now, pageId === null ? null : { id: pageId, name: pageName }, caption) };
  return <Markdown text={expandPlaceholders(text, vars)} />;
}
