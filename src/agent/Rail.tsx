import React, { useMemo, useState } from "react";
import { Plus, Search, ChevronRight, MessageSquareText } from "lucide-react";
import { agent, CATEGORIES, setActive, type Session } from "./engine";
import { SKILLS } from "./skills";
import { launch, newTab } from "./controller";

// Left rail: new session, the operations grouped by category, recent sessions.

export function statusDot(s: Session) {
  if (s.status === "running") return <span className="ag-dot ag-dot--run" aria-label="Running" />;
  if (s.status === "waiting") return <span className="ag-dot ag-dot--wait" aria-label="Needs you" />;
  if (s.unread) return <span className="ag-dot ag-dot--unread" aria-label="Updated" />;
  return <span className="ag-dot" aria-hidden />;
}

export function Rail({ onPick }: { onPick?: () => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const groups = useMemo(() => {
    const s = q.trim().toLowerCase();
    return CATEGORIES.map(c => {
      const all = SKILLS.filter(k => k.category === c.id && k.examples.length);
      const featured = all.filter(k => k.featured);
      const list = (s ? all.filter(k => k.title.toLowerCase().includes(s) || k.examples.some(e => e.toLowerCase().includes(s))) : featured.length ? featured : all).sort((a, b) => (a.n ?? 99) - (b.n ?? 99));
      return { ...c, list, total: all.length };
    }).filter(g => g.list.length);
  }, [q, SKILLS.length]);
  const recent = [...agent.sessions].filter(s => s.items.length).reverse();

  return (
    <nav className="ag-rail" aria-label="Agent operations">
      <div className="ag-rail-top">
        <button
          type="button"
          className="ag-new"
          onClick={() => {
            newTab();
            onPick?.();
          }}
        >
          <Plus /> New session
        </button>
        <label className="ag-rail-search">
          <Search />
          <input placeholder="Find an action" value={q} onChange={e => setQ(e.target.value)} />
        </label>
      </div>
      <div className="ag-rail-scroll">
        {groups.map(g => {
          const expanded = !!q || open[g.id];
          const shown = expanded ? g.list : g.list.slice(0, 5);
          return (
            <div className="ag-rail-g" key={g.id}>
              <div className="ag-rail-gh">
                <span>{g.label}</span>
                <em className="mono">{g.total}</em>
              </div>
              {shown.map(k => (
                <button
                  key={k.id}
                  type="button"
                  className="ag-rail-i"
                  title={k.examples[0]}
                  onClick={() => {
                    launch(k.examples[0], k.files ?? [], { newTab: true });
                    onPick?.();
                  }}
                >
                  <span className="ag-rail-n mono">{k.n ? String(k.n).padStart(2, "0") : "··"}</span>
                  <span className="ag-rail-t">{k.title}</span>
                </button>
              ))}
              {g.list.length > 5 && !q && (
                <button type="button" className="ag-rail-more" onClick={() => setOpen(o => ({ ...o, [g.id]: !o[g.id] }))}>
                  {expanded ? "Show less" : `${g.list.length - 5} more`}
                  <ChevronRight className={expanded ? "is-open" : ""} />
                </button>
              )}
            </div>
          );
        })}
        {recent.length > 0 && (
          <div className="ag-rail-g ag-rail-recent">
            <div className="ag-rail-gh">
              <span>Recent sessions</span>
            </div>
            {recent.map(s => (
              <button
                key={s.id}
                type="button"
                className={`ag-rail-s ${agent.activeId === s.id ? "is-on" : ""}`}
                onClick={() => {
                  setActive(s.id);
                  onPick?.();
                }}
              >
                {statusDot(s)}
                <span className="ag-rail-t">{s.title}</span>
                <span className="mono">{s.createdAt.replace(/ (am|pm)$/, "")}</span>
              </button>
            ))}
          </div>
        )}
        {!groups.length && (
          <div className="ag-rail-empty">
            <MessageSquareText />
            Nothing matches. Ask it in the composer instead.
          </div>
        )}
      </div>
    </nav>
  );
}
