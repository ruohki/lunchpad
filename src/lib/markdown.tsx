import Prism from "prismjs";
import type { ReactNode } from "react";

/**
 * A small Markdown for notes: headings, paragraphs (a line break stays a
 * line break), lists, quotes, rules, fenced code (coloured when Prism knows
 * the language) and inline bold, italic, strike, code and links. Nothing is
 * ever inserted as HTML except Prism's escaped output.
 */
export function Markdown({ text }: { text: string }) {
  return <div className="flex flex-col gap-1.5 text-xs leading-snug text-stage-200">{blocks(text)}</div>;
}

const INLINE = /(`[^`\n]+`)|(\*\*[^*\n]+?\*\*)|(~~[^~\n]+?~~)|(\*[^*\n]+?\*)|(\[[^\]\n]+\]\([^)\s]+\))/g;

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (const m of text.matchAll(INLINE)) {
    const at = m.index!;
    if (at > last) out.push(text.slice(last, at));
    const raw = m[0];
    if (m[1]) {
      out.push(
        <code key={k++} className="rounded bg-stage-800 px-1 font-mono text-[11px] text-accent-300">
          {raw.slice(1, -1)}
        </code>,
      );
    } else if (m[2]) {
      out.push(
        <strong key={k++} className="font-semibold text-stage-100">
          {inline(raw.slice(2, -2))}
        </strong>,
      );
    } else if (m[3]) {
      out.push(
        <del key={k++} className="text-stage-400">
          {inline(raw.slice(2, -2))}
        </del>,
      );
    } else if (m[4]) {
      out.push(<em key={k++}>{inline(raw.slice(1, -1))}</em>);
    } else {
      // A tooltip cannot be clicked: the link shows as its text.
      out.push(
        <span key={k++} className="text-stage-100 underline decoration-stage-500">
          {inline(raw.slice(1, raw.indexOf("](")))}
        </span>,
      );
    }
    last = at + raw.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Lines of a paragraph, each kept on its own line. */
function lines(items: string[]): ReactNode[] {
  return items.flatMap((line, i) => (i === 0 ? inline(line) : [<br key={`br${i}`} />, ...inline(line)]));
}

function codeBlock(key: number, code: string, language: string): ReactNode {
  const grammar = language ? (Prism.languages[language] as Prism.Grammar | undefined) : undefined;
  return (
    <pre key={key} className="code-field overflow-x-auto rounded-md bg-stage-900 px-2 py-1.5 font-mono text-[11px] leading-relaxed text-stage-100">
      {grammar ? <code dangerouslySetInnerHTML={{ __html: Prism.highlight(code, grammar, language) }} /> : <code>{code}</code>}
    </pre>
  );
}

function blocks(text: string): ReactNode[] {
  const src = text.replace(/\r\n?/g, "\n").split("\n");
  const out: ReactNode[] = [];
  const para: string[] = [];
  let i = 0;
  let k = 0;
  const flush = () => {
    if (para.length === 0) return;
    out.push(<p key={k++}>{lines(para)}</p>);
    para.length = 0;
  };
  while (i < src.length) {
    const line = src[i];
    const fence = /^```\s*([\w+-]*)\s*$/.exec(line);
    if (fence) {
      flush();
      const body: string[] = [];
      i++;
      while (i < src.length && !/^```\s*$/.test(src[i])) body.push(src[i++]);
      i++;
      out.push(codeBlock(k++, body.join("\n"), fence[1].toLowerCase()));
      continue;
    }
    const heading = /^(#{1,3})\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) {
      flush();
      const level = heading[1].length;
      const cls = level === 1 ? "text-sm font-semibold text-stage-100" : level === 2 ? "text-xs font-semibold text-stage-100" : "text-xs font-medium text-stage-300";
      out.push(
        level === 1 ? <h1 key={k++} className={cls}>{inline(heading[2])}</h1> : level === 2 ? <h2 key={k++} className={cls}>{inline(heading[2])}</h2> : <h3 key={k++} className={cls}>{inline(heading[2])}</h3>,
      );
      i++;
      continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      flush();
      out.push(<hr key={k++} className="border-stage-700" />);
      i++;
      continue;
    }
    if (/^\s*>/.test(line)) {
      flush();
      const inner: string[] = [];
      while (i < src.length && /^\s*>/.test(src[i])) inner.push(src[i++].replace(/^\s*>\s?/, ""));
      out.push(
        <blockquote key={k++} className="flex flex-col gap-1 border-l-2 border-stage-600 pl-2 text-stage-300">
          {blocks(inner.join("\n"))}
        </blockquote>,
      );
      continue;
    }
    const bullet = /^\s*[-*+]\s+/;
    const number = /^\s*\d+[.)]\s+/;
    const kind = bullet.test(line) ? bullet : number.test(line) ? number : null;
    if (kind) {
      flush();
      const items: string[] = [];
      while (i < src.length && kind.test(src[i])) items.push(src[i++].replace(kind, ""));
      const li = items.map((item, n) => <li key={n}>{inline(item)}</li>);
      out.push(
        kind === bullet ? (
          <ul key={k++} className="flex list-disc flex-col gap-0.5 pl-4">
            {li}
          </ul>
        ) : (
          <ol key={k++} className="flex list-decimal flex-col gap-0.5 pl-4">
            {li}
          </ol>
        ),
      );
      continue;
    }
    if (line.trim() === "") {
      flush();
      i++;
      continue;
    }
    para.push(line);
    i++;
  }
  flush();
  return out;
}
