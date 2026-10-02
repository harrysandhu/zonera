import React from "react";
import { Check, CircleSlash } from "lucide-react";
import { respond, type Block, type Session } from "../engine";
import { Choice, TenantCard, Ledger, Payment, Receipt, IdScan, Form, Protection, Esign } from "./people";
import { Plan, Progress, DataTable, Batch, Timeline, Slots, Result } from "./ops";
import { GateCode } from "./access";
import { RateSlider, Promo, SmsDrafts, CallHandoff } from "./growth";
import { Charts, Report, Briefing, Capabilities } from "./reports";
import { UnitPicker, TwinBuild } from "./twin";

export type WidgetBlock = Extract<Block, { t: "widget" }>;

export interface WP<P = any, A = any> {
  b: WidgetBlock;
  p: P;
  /** Waiting for a human decision. */
  active: boolean;
  /** Answered or skipped: render a read-only summary. */
  locked: boolean;
  answer?: A;
  respond: (a: A) => void;
  s: Session;
}

const REG: Record<string, React.ComponentType<WP>> = {
  choice: Choice,
  tenant: TenantCard,
  ledger: Ledger,
  payment: Payment,
  receipt: Receipt,
  idscan: IdScan,
  form: Form,
  protection: Protection,
  esign: Esign,
  plan: Plan,
  progress: Progress,
  table: DataTable,
  batch: Batch,
  timeline: Timeline,
  slots: Slots,
  result: Result,
  gatecode: GateCode,
  rates: RateSlider,
  promo: Promo,
  sms: SmsDrafts,
  call: CallHandoff,
  charts: Charts,
  report: Report,
  briefing: Briefing,
  capabilities: Capabilities,
  units: UnitPicker,
  twin: TwinBuild,
};

export function WidgetView({ b, s }: { b: WidgetBlock; s: Session }) {
  const C = REG[b.w];
  if (!C) return null;
  const active = b.status === "active";
  const locked = b.status === "answered" || b.status === "skipped";
  return (
    <div className="ag-wwrap" data-block={b.id}>
      <C b={b} p={b.props} active={active} locked={locked} answer={b.answer} respond={a => respond(b.id, a)} s={s} />
    </div>
  );
}

export type FrameState = "ask" | "done" | "live" | "info" | "skipped";

/** Every widget sits in this frame: icon, title, meta, and its decision state. */
export function Frame({
  icon,
  title,
  meta,
  state,
  doneLabel,
  children,
  foot,
  className = "",
  flush,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  meta?: React.ReactNode;
  state: FrameState;
  doneLabel?: React.ReactNode;
  children?: React.ReactNode;
  foot?: React.ReactNode;
  className?: string;
  flush?: boolean;
}) {
  return (
    <section className={`ag-w ag-w--${state} ${flush ? "ag-w--flush" : ""} ${className}`}>
      <header className="ag-w-h">
        {icon && <span className="ag-w-ic">{icon}</span>}
        <b className="ag-w-t">{title}</b>
        {meta && <span className="ag-w-meta">{meta}</span>}
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
        {state === "done" && doneLabel && (
          <span className="ag-decided">
            <Check />
            {doneLabel}
          </span>
        )}
        {state === "skipped" && (
          <span className="ag-decided ag-decided--skip">
            <CircleSlash />
            Skipped
          </span>
        )}
      </header>
      {children !== undefined && children !== null && children !== false && <div className="ag-w-b">{children}</div>}
      {foot && <footer className="ag-w-f">{foot}</footer>}
    </section>
  );
}

export function stateOf(w: WP, decidedLabel = "Decided"): { state: FrameState; doneLabel?: string } {
  if (w.b.status === "skipped") return { state: "skipped" };
  if (w.active) return { state: "ask" };
  if (w.locked) return { state: "done", doneLabel: decidedLabel };
  return { state: "info" };
}

/** A key-value row list used across widgets. */
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
