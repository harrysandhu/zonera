import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, ChevronRight, ChevronDown, CornerDownRight, CircleAlert, FileText, FileSpreadsheet, Image as ImageIcon, PhoneCall, Info, CircleCheck, TriangleAlert, X } from "lucide-react";
import { editSlot, type Block, type Item, type Session, type ToolCall } from "./engine";
import { submit } from "./controller";
import { Rich } from "./Rich";
import { WidgetView } from "./widgets/WidgetView";

// The conversation: user bubbles, agent turns (thinking, tool calls, streamed
// text, widgets, events). Agent blocks are memoised on their version number so
// streaming one line doesn't re-render the whole transcript.

export function AgentMark({ size = 20 }: { size?: number }) {
  return (
    <span className="ag-mark" style={{ width: size, height: size }} aria-hidden>
      <svg viewBox="0 0 20 20" width={size * 0.62} height={size * 0.62}>
        <path d="M10 1.8l1.9 5.2 5.3 1.9-5.3 1.9L10 16l-1.9-5.2L2.8 8.9l5.3-1.9z" fill="currentColor" />
        <circle cx="16" cy="15.6" r="1.6" fill="currentColor" opacity=".55" />
      </svg>
    </span>
  );
}

export function fileIcon(name: string) {
  if (/\.csv$|\.xlsx?$/.test(name)) return <FileSpreadsheet />;
  if (/\.jpe?g$|\.png$|\.webp$/.test(name)) return <ImageIcon />;
  return <FileText />;
}

export function FileChip({ name, onRemove }: { name: string; onRemove?: () => void }) {
  const meta = name.endsWith(".pdf") ? "PDF · 3 pages" : name.endsWith(".csv") ? "CSV · 163 rows" : "Image";
  return (
    <span className="ag-file">
      <span className="ag-file-ic">{fileIcon(name)}</span>
      <span className="ag-file-t">
        <b>{name}</b>
        <small>{meta}</small>
      </span>
      {onRemove && (
        <button type="button" aria-label={`Remove ${name}`} onClick={onRemove}>
          <X />
        </button>
      )}
    </span>
  );
}

export function Thread({ s }: { s: Session }) {
  const scroller = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);

  useLayoutEffect(() => {
    pinned.current = true;
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [s.id]);

  useEffect(() => {
    const el = scroller.current;
    const body = inner.current;
    if (!el || !body) return;
    const onScroll = () => {
      pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 90;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(() => {
      if (pinned.current) el.scrollTo({ top: el.scrollHeight, behavior: "auto" });
    });
    ro.observe(body);
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, [s.id]);

  return (
    <div className="ag-scroll" ref={scroller}>
      <div className="ag-thread" ref={inner}>
        {s.items.map((it, i) =>
          it.t === "user" ? <UserMsg key={it.id} it={it} /> : it.t === "event" ? <EventRow key={it.id} b={it} /> : <AgentTurn key={it.id} it={it} s={s} last={i === s.items.length - 1} />,
        )}
      </div>
    </div>
  );
}

function UserMsg({ it }: { it: Extract<Item, { t: "user" }> }) {
  return (
    <div className="ag-user">
      {it.files.length > 0 && (
        <div className="ag-user-files">
          {it.files.map(f => (
            <FileChip key={f} name={f} />
          ))}
        </div>
      )}
      {it.text && <div className="ag-bubble">{it.text}</div>}
    </div>
  );
}

function AgentTurn({ it, s, last }: { it: Extract<Item, { t: "agent" }>; s: Session; last: boolean }) {
  const working = !it.done && last && (s.status === "running" || s.status === "waiting");
  const tail = it.blocks[it.blocks.length - 1];
  const idle = working && s.status === "running" && (!tail || (tail.t === "say" && tail.done) || (tail.t === "widget" && tail.status !== "active") || (tail.t === "tools" && tail.calls.every(c => c.status !== "running")));
  return (
    <div className="ag-turn">
      <div className="ag-turn-h">
        <AgentMark />
        <b>Zonera</b>
        <span className="mono">{it.at}</span>
      </div>
      <div className="ag-turn-b">
        {it.blocks.map(b => (
          <BlockView key={b.id} b={b} v={b.v} s={s} itemId={it.id} />
        ))}
        {idle && <Working />}
        {last && it.done && s.suggest.length > 0 && (
          <div className="ag-next">
            {s.suggest.map(x => (
              <button key={x} type="button" className="ag-next-b" onClick={() => submit(s, x)}>
                <CornerDownRight />
                {x}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Working() {
  return (
    <div className="ag-working" aria-label="Working">
      <i />
      <i />
      <i />
    </div>
  );
}

const BlockView = React.memo(
  function BlockView({ b, s, itemId }: { b: Block; v: number; s: Session; itemId: string }) {
    switch (b.t) {
      case "understand":
        return <Understand b={b} s={s} itemId={itemId} />;
      case "think":
        return <Thinking b={b} />;
      case "tools":
        return <Tools b={b} />;
      case "say":
        return (
          <div className="ag-say">
            <Rich text={b.text} shown={b.shown} caret={!b.done} />
          </div>
        );
      case "widget":
        return <WidgetView b={b} s={s} />;
    }
  },
  (a, b) => a.b === b.b && a.v === b.v && a.s.status === b.s.status && a.itemId === b.itemId,
);

function Understand({ b, s, itemId }: { b: Extract<Block, { t: "understand" }>; s: Session; itemId: string }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="ag-und">
      {b.chips.map(c => (
        <span key={c.key} className="ag-und-w">
          <button
            type="button"
            className={`ag-und-c is-${c.state} ${c.options?.length ? "is-edit" : ""}`}
            disabled={!c.options?.length}
            onClick={() => setOpen(o => (o === c.key ? null : c.key))}
            title={c.state === "default" ? "Default. Click to change" : undefined}
          >
            <span className="ag-und-l">{c.label}</span>
            <span>{c.text}</span>
            {c.options?.length ? <ChevronDown /> : null}
          </button>
          {open === c.key && c.options && (
            <span className="ag-pop ag-und-pop">
              {c.options.map(o => (
                <button
                  key={String(o.value)}
                  type="button"
                  onClick={() => {
                    setOpen(null);
                    editSlot(s, itemId, c.key, o.value);
                  }}
                >
                  {o.label}
                </button>
              ))}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

function Thinking({ b }: { b: Extract<Block, { t: "think" }> }) {
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const live = b.ms === undefined;
  useEffect(() => {
    if (!live) return;
    const t = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(t);
  }, [live]);
  const secs = ((live ? now - b.start : b.ms!) / 1000).toFixed(1);
  return (
    <div className={`ag-think ${open ? "is-open" : ""}`}>
      <button type="button" className="ag-think-h" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        {live ? <span className="ag-shimmer">Thinking</span> : <span>Thought for {secs}s</span>}
        {live && <span className="mono ag-think-t">{secs}s</span>}
        <ChevronRight className="ag-chev" />
      </button>
      {open && <p className="ag-think-b">{b.text}</p>}
    </div>
  );
}

function summarize(args: Record<string, unknown>) {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(args)) {
    if (v === undefined) continue;
    const s = typeof v === "string" ? `"${v}"` : Array.isArray(v) ? `[${v.length}]` : typeof v === "object" && v ? "{…}" : String(v);
    parts.push(`${k}: ${s}`);
    if (parts.join(", ").length > 70) break;
  }
  return parts.join(", ");
}

function Tools({ b }: { b: Extract<Block, { t: "tools" }> }) {
  return (
    <div className="ag-tools">
      {b.calls.map(c => (
        <ToolRow key={c.id} c={c} />
      ))}
    </div>
  );
}

function ToolRow({ c }: { c: ToolCall }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`ag-tool ${open ? "is-open" : ""} ag-tool--${c.status}`}>
      <button type="button" className="ag-tool-h" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className="ag-tool-st">{c.status === "running" ? <span className="ag-spin" /> : c.status === "done" ? <Check /> : <CircleAlert />}</span>
        <span className="ag-tool-n">{c.name}</span>
        <span className="ag-tool-a">{summarize(c.args)}</span>
        <span className="ag-tool-ms">{c.ms !== undefined ? (c.ms / 1000).toFixed(1) + "s" : ""}</span>
        <ChevronRight className="ag-chev" />
      </button>
      {open && (
        <div className="ag-tool-b">
          <div>
            <span className="eyebrow">Input</span>
            <pre>{JSON.stringify(c.args, null, 2)}</pre>
          </div>
          <div>
            <span className="eyebrow">Output</span>
            <pre>{c.status === "running" ? "…" : JSON.stringify(c.result ?? null, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

function EventRow({ b }: { b: Extract<Item, { t: "event" }> }) {
  const icon = b.tone === "ok" ? <CircleCheck /> : b.tone === "warn" ? <TriangleAlert /> : b.tone === "call" ? <PhoneCall /> : <Info />;
  return (
    <div className={`ag-event ag-event--${b.tone}`}>
      {icon}
      <span>{b.text}</span>
      <span className="mono">{b.at}</span>
    </div>
  );
}
