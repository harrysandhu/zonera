import React from "react";
import { go } from "../state/store";

// Light markdown for streamed agent text: paragraphs, "- " bullets, **bold**,
// `mono`, and [label](ops/route) links. `shown` counts visible characters, so a
// partially streamed message never flashes raw markup.

type Inline = { k: "t" | "b" | "c" | "a"; s: string; href?: string };
type Para = { k: "p" | "li"; inl: Inline[] };

const cache = new Map<string, Para[]>();

function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  const re = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    if (m.index > last) out.push({ k: "t", s: src.slice(last, m.index) });
    if (m[1]) out.push({ k: "b", s: m[1] });
    else if (m[2]) out.push({ k: "c", s: m[2] });
    else out.push({ k: "a", s: m[3], href: m[4] });
    last = re.lastIndex;
  }
  if (last < src.length) out.push({ k: "t", s: src.slice(last) });
  return out;
}

export function parseRich(text: string): Para[] {
  const hit = cache.get(text);
  if (hit) return hit;
  const paras: Para[] = text
    .split(/\n/)
    .filter(l => l.trim().length)
    .map(l => (l.startsWith("- ") ? { k: "li", inl: parseInline(l.slice(2)) } : { k: "p", inl: parseInline(l) }));
  cache.set(text, paras);
  return paras;
}

export function richLength(text: string) {
  return parseRich(text).reduce((s, p) => s + p.inl.reduce((a, i) => a + i.s.length, 0), 0);
}

function renderInline(i: Inline, s: string, key: number) {
  if (i.k === "b") return <b key={key}>{s}</b>;
  if (i.k === "c") return <code key={key} className="ag-code">{s}</code>;
  if (i.k === "a")
    return (
      <button key={key} type="button" className="ag-link" onClick={() => i.href && go(i.href)}>
        {s}
      </button>
    );
  return <React.Fragment key={key}>{s}</React.Fragment>;
}

export function Rich({ text, shown, caret }: { text: string; shown?: number; caret?: boolean }) {
  const paras = parseRich(text);
  // `shown` is measured against the raw text; map it to visible characters.
  const total = richLength(text);
  let budget = shown === undefined ? total : Math.round((shown / Math.max(1, text.length)) * total);
  const out: React.ReactNode[] = [];
  let list: React.ReactNode[] = [];
  const flush = (k: number) => {
    if (list.length) out.push(<ul key={"ul" + k}>{list}</ul>);
    list = [];
  };
  paras.forEach((p, pi) => {
    if (budget <= 0) return;
    const kids: React.ReactNode[] = [];
    p.inl.forEach((i, ii) => {
      if (budget <= 0) return;
      const s = i.s.slice(0, budget);
      budget -= i.s.length;
      kids.push(renderInline(i, s, ii));
    });
    const last = budget <= 0 || pi === paras.length - 1;
    if (caret && last) kids.push(<span key="caret" className="ag-caret" aria-hidden />);
    if (p.k === "li") list.push(<li key={pi}>{kids}</li>);
    else {
      flush(pi);
      out.push(<p key={pi}>{kids}</p>);
    }
  });
  flush(999);
  return <div className="ag-rich">{out}</div>;
}
