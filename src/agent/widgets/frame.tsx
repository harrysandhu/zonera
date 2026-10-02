import React, { useState } from "react";
import { Check, ChevronDown, CircleSlash, ShieldCheck } from "lucide-react";
import type { Session, WidgetBlock } from "../engine";

// The contract every widget implements, and the frame every widget sits in.
//
// A widget is a React component that receives WP<Props, Answer>:
//   p        its data (whatever the skill passed to ctx.ask / ctx.show)
//   active   true while a decision is pending: controls are enabled
//   locked   true once answered or skipped: render read-only
//   answer   the value it was answered with (when locked)
//   respond  call once with the answer; the skill's `await ctx.ask(...)` resolves
//
// Movie mode presses elements tagged `data-auto="<key>"` inside the widget, so
// tag every button / input a script might need (see AUTHORING.md).

export interface WP<P = any, A = any> {
  b: WidgetBlock;
  p: P;
  active: boolean;
  locked: boolean;
  answer?: A;
  respond: (a: A) => void;
  s: Session;
}

/** Registry entry. P and A are phantom types so ctx.ask() is fully typed. */
export interface WidgetDef<P, A> {
  C: React.ComponentType<WP<P, A>>;
  /** @internal phantom */ _p?: P;
  /** @internal phantom */ _a?: A;
}

export function defineWidget<P, A = void>(C: React.ComponentType<WP<P, A>>): WidgetDef<P, A> {
  return { C };
}

export type FrameState = "ask" | "done" | "live" | "info" | "skipped";

export function stateOf(w: WP, decided?: React.ReactNode): { state: FrameState; summary?: React.ReactNode } {
  if (w.b.status === "skipped") return { state: "skipped" };
  if (w.active) return { state: "ask" };
  if (w.locked) return { state: "done", summary: decided };
  return { state: "info" };
}

/**
 * Every widget renders inside a Frame: icon, title, meta, decision state.
 * When `state` is "done" (answered) the body collapses to a one-line summary
 * with a Details toggle, so the transcript stays clean.
 */
export function Frame({
  icon,
  title,
  meta,
  state,
  summary,
  children,
  foot,
  className = "",
  flush,
  tier,
  keepOpen,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  meta?: React.ReactNode;
  state: FrameState;
  /** One-line read-only summary shown once answered. */
  summary?: React.ReactNode;
  children?: React.ReactNode;
  foot?: React.ReactNode;
  className?: string;
  /** Body without padding (tables, lists). */
  flush?: boolean;
  /** Permission tier badge, e.g. "Ask first". */
  tier?: string;
  /** Keep the body visible after answering (results the user should still see). */
  keepOpen?: boolean;
}) {
  const [details, setDetails] = useState(false);
  const collapsed = (state === "done" || state === "skipped") && !keepOpen && !details;
  return (
    <section className={`ag-w ag-w--${state} ${flush ? "ag-w--flush" : ""} ${collapsed ? "is-collapsed" : ""} ${className}`}>
      <header className="ag-w-h">
        {icon && <span className="ag-w-ic">{icon}</span>}
        <span className="ag-w-tt">
          <b className="ag-w-t">{title}</b>
          {collapsed && summary && <span className="ag-w-sum">{summary}</span>}
        </span>
        {meta && !collapsed && <span className="ag-w-meta">{meta}</span>}
        {tier && state === "ask" && (
          <span className="ag-tier" title="Permission tier from Settings → Agent permissions">
            <ShieldCheck />
            {tier}
          </span>
        )}
        {state === "ask" && (
          <span className="ag-need">
            <i />
            Needs you
          </span>
        )}
        {state === "live" && (
          <span className="ag-need ag-need--live">
            <span className="ag-spin" />
            Running
          </span>
        )}
        {state === "done" && (
          <span className="ag-decided">
            <Check />
            Done
          </span>
        )}
        {state === "skipped" && (
          <span className="ag-decided ag-decided--skip">
            <CircleSlash />
            Skipped
          </span>
        )}
        {(state === "done" || state === "skipped") && !keepOpen && (
          <button type="button" className={`ag-w-toggle ${details ? "is-open" : ""}`} onClick={() => setDetails(d => !d)} aria-expanded={details}>
            {details ? "Hide" : "Details"}
            <ChevronDown />
          </button>
        )}
      </header>
      {!collapsed && children !== undefined && children !== null && children !== false && <div className="ag-w-b">{children}</div>}
      {!collapsed && foot && state !== "done" && state !== "skipped" && <footer className="ag-w-f">{foot}</footer>}
    </section>
  );
}

/** Key-value rows used across widgets. */
export function Rows({ rows, total }: { rows: [React.ReactNode, React.ReactNode, string?][]; total?: [React.ReactNode, React.ReactNode] }) {
  return (
    <dl className="ag-rows">
      {rows.map(([k, v, cls], i) => (
        <div key={i} className={cls}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
      {total && (
        <div className="ag-rows-total">
          <dt>{total[0]}</dt>
          <dd>{total[1]}</dd>
        </div>
      )}
    </dl>
  );
}

export function Seg<T extends string>({ value, options, onChange, disabled, auto }: { value: T; options: { value: T; label: React.ReactNode; icon?: React.ReactNode }[]; onChange: (v: T) => void; disabled?: boolean; auto?: string }) {
  return (
    <div className="ag-seg" role="group">
      {options.map(o => (
        <button key={o.value} type="button" data-auto={auto ? `${auto}:${o.value}` : undefined} aria-pressed={o.value === value} disabled={disabled} onClick={() => onChange(o.value)}>
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ on, onChange, label, disabled, auto }: { on: boolean; onChange: (v: boolean) => void; label: React.ReactNode; disabled?: boolean; auto?: string }) {
  return (
    <label className={`ag-check ${disabled ? "is-disabled" : ""}`}>
      <input type="checkbox" data-auto={auto} checked={on} disabled={disabled} onChange={e => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
