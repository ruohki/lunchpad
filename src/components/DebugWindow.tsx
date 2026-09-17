import { useEffect, useState } from "react";
import { api, type DebugContent } from "../lib/api";

/**
 * The page of a debug window: the text of one debug action, refreshed every time
 * the action runs. Opened by the backend as `index.html?debug=<action id>`.
 */
export function DebugWindow({ id }: { id: string }) {
  const [content, setContent] = useState<DebugContent | null>(null);
  useEffect(() => {
    let alive = true;
    api
      .debugText(id)
      .then((c) => {
        if (alive && c) setContent(c);
      })
      .catch(() => {});
    const off = api.onDebugText((c) => {
      if (c.id === id) setContent(c);
    });
    return () => {
      alive = false;
      void off.then((f) => f());
    };
  }, [id]);
  return (
    <pre className="m-0 h-full overflow-auto bg-stage-950 p-4 font-mono text-sm whitespace-pre-wrap break-words text-stage-100" style={{ userSelect: "text", WebkitUserSelect: "text" }}>
      {content?.text ?? ""}
    </pre>
  );
}
