import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Minimal, safe markdown renderer for help articles (no HTML passthrough, no dependency):
 * paragraphs, `-`/`1.` lists, `**bold**`, `*italic*`, `# headings`, and pipe tables.
 */
type Block =
  | { kind: "p"; text: string }
  | { kind: "h"; level: 2 | 3; text: string }
  | { kind: "ul" | "ol"; items: string[] }
  | { kind: "table"; head: string[]; rows: string[][] };

export function parseMarkdown(src: string): Block[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ kind: "p", text: para.join(" ") });
    para = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      flush();
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      blocks.push({ kind: "h", level: heading[1].length <= 2 ? 2 : 3, text: heading[2] });
      continue;
    }
    const ul = /^[-*]\s+(.*)$/.exec(line);
    const ol = /^\d+[.)]\s+(.*)$/.exec(line) ?? /^[०-९]+[.)]\s+(.*)$/.exec(line);
    if (ul || ol) {
      flush();
      const kind = ul ? "ul" : "ol";
      const last = blocks[blocks.length - 1];
      const text = (ul ?? ol)![1];
      if (last && last.kind === kind) last.items.push(text);
      else blocks.push({ kind, items: [text] });
      continue;
    }
    if (line.startsWith("|")) {
      flush();
      const cells = (l: string) =>
        l
          .trim()
          .replace(/^\||\|$/g, "")
          .split("|")
          .map((c) => c.trim());
      const head = cells(line);
      const rows: string[][] = [];
      let j = i + 1;
      if (j < lines.length && /^\|?\s*:?-{2,}/.test(lines[j].trim())) j++;
      while (j < lines.length && lines[j].trim().startsWith("|")) {
        rows.push(cells(lines[j]));
        j++;
      }
      blocks.push({ kind: "table", head, rows });
      i = j - 1;
      continue;
    }
    para.push(line);
  }
  flush();
  return blocks;
}

/** Inline **bold** and *italic*. */
export function renderInline(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(m[1] !== undefined ? <strong key={k++}>{m[1]}</strong> : <em key={k++}>{m[2]}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source, className }: { source: string; className?: string }) {
  const blocks = parseMarkdown(source);
  return (
    <div className={cn("space-y-3 text-sm leading-relaxed text-fg-body [&_strong]:font-semibold [&_strong]:text-fg", className)}>
      {blocks.map((b, i) => {
        if (b.kind === "p") return <p key={i}>{renderInline(b.text)}</p>;
        if (b.kind === "h")
          return b.level === 2 ? (
            <h2 key={i} className="pt-2 text-base font-semibold text-fg">
              {renderInline(b.text)}
            </h2>
          ) : (
            <h3 key={i} className="pt-1 text-sm font-semibold text-fg">
              {renderInline(b.text)}
            </h3>
          );
        if (b.kind !== "table") {
          const List = b.kind;
          return (
            <List key={i} className={cn("space-y-1 pl-5", b.kind === "ul" ? "list-disc" : "list-decimal")}>
              {b.items.map((it, j) => (
                <li key={j}>{renderInline(it)}</li>
              ))}
            </List>
          );
        }
        return (
          <div key={i} className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted text-left text-xs text-fg-muted">
                <tr>
                  {b.head.map((h, j) => (
                    <th key={j} scope="col" className="px-3 py-2 font-semibold">
                      {renderInline(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {b.rows.map((r, j) => (
                  <tr key={j} className="border-t border-border">
                    {r.map((c, k) => (
                      <td key={k} className="px-3 py-2 tabular">
                        {renderInline(c)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
