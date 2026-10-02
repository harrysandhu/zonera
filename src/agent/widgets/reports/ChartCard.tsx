import React, { useState } from "react";
import { BarChart3, Check, FilePlus2, Table2, ChevronRight, ArrowUpRight } from "lucide-react";
import { go, useDemo } from "../../../state/store";
import { askIn } from "../../controller";
import { defineWidget } from "../frame";
import { addToReport, isInReport, removeFromReport } from "../../skills/reports/state";
import { Columns, CompareBars, HBars, Trend, format, type ColDatum, type Fmt, type HBarRow, type PairDatum } from "./charts";
import "../../../styles/agent-reports.css";

// W11 · ChartCard: one chart that answers the question, with a headline
// number, "Add to report" and "Break down by…" chips. Display only (ctx.show).
// Chips start a follow-up ask in agent mode; "Add to report" puts the chart in
// the next owner report.

export type ChartData =
  | { kind: "columns"; data: ColDatum[]; f?: Fmt; emphasize?: number[]; marker?: { at: number; label: string } }
  | { kind: "compare"; data: PairDatum[]; aLabel: string; bLabel: string; f?: Fmt }
  | { kind: "hbars"; rows: HBarRow[]; f?: Fmt; max?: number; priorLabel?: string; valueLabel?: string }
  | { kind: "line"; data: ColDatum[]; f?: Fmt; domain?: [number, number] };

export interface ChartCardProps {
  title: string;
  meta?: string;
  headline?: { value: string; label?: string; delta?: { text: string; tone: "ok" | "warn" | "bad" | "neutral" }; context?: string };
  chart: ChartData;
  /** One line under the chart: what it means. */
  note?: string;
  /** Follow-up asks: "Break down by size" → ask text. */
  breakdowns?: { label: string; ask: string }[];
  /** Enables "Add to report". */
  reportId?: string;
  links?: { label: string; route: string }[];
  height?: number;
}

export function ChartBody({ chart, height }: { chart: ChartData; height?: number }) {
  switch (chart.kind) {
    case "columns":
      return <Columns data={chart.data} f={chart.f} emphasize={chart.emphasize} marker={chart.marker} height={height} />;
    case "compare":
      return <CompareBars data={chart.data} aLabel={chart.aLabel} bLabel={chart.bLabel} f={chart.f} height={height} />;
    case "hbars":
      return <HBars rows={chart.rows} f={chart.f} max={chart.max} priorLabel={chart.priorLabel} valueLabel={chart.valueLabel} />;
    case "line":
      return <Trend data={chart.data} f={chart.f} domain={chart.domain} height={height} />;
  }
}

/** The same data as a table, so nothing is carried by color or hover alone. */
function DataView({ chart }: { chart: ChartData }) {
  let head: string[] = [];
  let rows: string[][] = [];
  if (chart.kind === "compare") {
    head = ["", chart.aLabel, chart.bLabel, "Change"];
    rows = chart.data.map(d => [d.note ?? d.label, format(chart.f, d.a), format(chart.f, d.b), d.b ? (d.a >= d.b ? "+" : "") + (((d.a - d.b) / d.b) * 100).toFixed(1) + "%" : "—"]);
  } else if (chart.kind === "hbars") {
    const prior = chart.rows.some(r => r.prior !== undefined);
    head = ["", chart.valueLabel ?? "Value", ...(prior ? [chart.priorLabel ?? "Before"] : []), ...(chart.rows.some(r => r.sub) ? ["Detail"] : [])];
    rows = chart.rows.map(r => [r.label, r.text ?? format(chart.f, r.value), ...(prior ? [r.prior !== undefined ? format(chart.f, r.prior) : "—"] : []), ...(chart.rows.some(x => x.sub) ? [r.sub ?? ""] : [])]);
  } else {
    head = ["", "Value"];
    rows = chart.data.map(d => [d.note ?? d.label, format(chart.f, d.value)]);
  }
  return (
    <table className="agr-dt">
      <thead>
        <tr>
          {head.map((h, i) => (
            <th key={i} className={i ? "num" : ""}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => (
              <td key={j} className={j ? "num tnum" : ""}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export const ChartCard = defineWidget<ChartCardProps, void>(function ChartCard(w) {
  useDemo();
  const { p } = w;
  const [table, setTable] = useState(false);
  const added = p.reportId ? isInReport(p.reportId) : false;
  return (
    <section className="ag-w ag-w--info agr-card">
      <header className="agr-card-h">
        <span className="agr-card-ic">
          <BarChart3 />
        </span>
        <span className="agr-card-tt">
          <b>{p.title}</b>
          {p.meta && <small>{p.meta}</small>}
        </span>
        <button type="button" className={`agr-ghost ${table ? "is-on" : ""}`} aria-pressed={table} onClick={() => setTable(t => !t)}>
          <Table2 /> {table ? "Chart" : "Table"}
        </button>
      </header>
      {p.headline && (
        <div className="agr-head">
          {p.headline.label && <span className="agr-lbl">{p.headline.label}</span>}
          <div className="agr-head-v">
            <b>{p.headline.value}</b>
            {p.headline.delta && <span className={`agr-delta is-${p.headline.delta.tone}`}>{p.headline.delta.text}</span>}
          </div>
          {p.headline.context && <p>{p.headline.context}</p>}
        </div>
      )}
      <div className="agr-card-b">{table ? <DataView chart={p.chart} /> : <ChartBody chart={p.chart} height={p.height} />}</div>
      {p.note && <p className="agr-note">{p.note}</p>}
      {(p.reportId || p.breakdowns?.length || p.links?.length) && (
        <footer className="agr-card-f">
          {p.reportId && (
            <button
              type="button"
              className={`agr-chip ${added ? "is-on" : ""}`}
              data-auto="report"
              onClick={() => (added ? removeFromReport(p.reportId!) : addToReport({ id: p.reportId!, title: p.title, chart: p.chart, note: p.note }))}
            >
              {added ? <Check /> : <FilePlus2 />}
              {added ? "In the October report" : "Add to report"}
            </button>
          )}
          {p.breakdowns?.map(b => (
            <button key={b.label} type="button" className="agr-chip" data-auto={"by:" + b.label} onClick={() => void askIn(w.s, b.ask)}>
              {b.label}
              <ChevronRight />
            </button>
          ))}
          <span className="agr-sp" />
          {p.links?.map(l => (
            <button key={l.route} type="button" className="ag-more" onClick={() => go(l.route)}>
              {l.label} <ArrowUpRight />
            </button>
          ))}
        </footer>
      )}
    </section>
  );
});
