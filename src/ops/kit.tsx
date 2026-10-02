import React from "react";
import { Sparkles } from "lucide-react";
import { askAgent } from "../state/store";
import { Sparkline } from "../ui";
import "../styles/ops-kit.css";

// Building blocks every operator page uses, so all pages share one rhythm:
// <Page> → <PageHeader> → content grid of <Section>s / cards.

export function Page({ children, wide, className = "" }: { children: React.ReactNode; wide?: boolean; className?: string }) {
  return <div className={`ok-page ${wide ? "ok-page--wide" : ""} ${className}`}>{children}</div>;
}

export function PageHeader({ title, sub, actions, ask }: { title: React.ReactNode; sub?: React.ReactNode; actions?: React.ReactNode; ask?: string }) {
  return (
    <header className="ok-head">
      <div className="ok-head-t">
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      <div className="ok-head-a">
        {ask && (
          <button className="ok-ask" onClick={() => askAgent(ask)} title="Have the agent do this">
            <Sparkles size={14} />
            <span>{ask}</span>
          </button>
        )}
        {actions}
      </div>
    </header>
  );
}

export function Stat({ label, value, delta, tone, spark, sub }: { label: string; value: React.ReactNode; delta?: string; tone?: "ok" | "bad" | "warn" | "neutral"; spark?: number[]; sub?: React.ReactNode }) {
  return (
    <div className="ok-stat">
      <div className="ok-stat-l">{label}</div>
      <div className="ok-stat-v tnum">{value}</div>
      <div className="ok-stat-f">
        {delta && <span className={`ok-delta ok-delta--${tone ?? "neutral"}`}>{delta}</span>}
        {sub && <span className="faint">{sub}</span>}
        {spark && <Sparkline values={spark} width={86} height={26} color={tone === "bad" ? "var(--bad)" : "var(--lake)"} className="ok-stat-s" />}
      </div>
    </div>
  );
}

export function StatRow({ children }: { children: React.ReactNode }) {
  return <div className="ok-stats">{children}</div>;
}

export function Section({ title, action, children, className = "", flush }: { title?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string; flush?: boolean }) {
  return (
    <section className={`ok-sec ${flush ? "ok-sec--flush" : ""} ${className}`}>
      {(title || action) && (
        <div className="ok-sec-h">
          {typeof title === "string" ? <h2>{title}</h2> : title}
          {action}
        </div>
      )}
      <div className="ok-sec-b">{children}</div>
    </section>
  );
}

export function Toolbar({ children }: { children: React.ReactNode }) {
  return <div className="ok-toolbar">{children}</div>;
}

export function Chips<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string; count?: number }[]; onChange: (v: T) => void }) {
  return (
    <div className="ok-chips" role="group">
      {options.map(o => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
          {o.count !== undefined && <em>{o.count}</em>}
        </button>
      ))}
    </div>
  );
}

export function KV({ items }: { items: [React.ReactNode, React.ReactNode][] }) {
  return (
    <dl className="ok-kv">
      {items.map(([k, v], i) => (
        <React.Fragment key={i}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="ok-empty">
      <b>{title}</b>
      {body && <p>{body}</p>}
      {action}
    </div>
  );
}
