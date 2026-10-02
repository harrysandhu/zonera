import React, { useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "../../../ui";
import { defineWidget, Frame, stateOf } from "../frame";
import { fmtValue, niceTicks, shortMoney, useWidth } from "./format";
import type { ImpactPoint, ImpactSimulatorAnswer, ImpactSimulatorProps } from "./types";

// W34 · A slider (rate %, street price, promo length) and what it does to
// revenue, move-outs and occupancy over the next 12 months. Every slider stop is
// precomputed by the skill, so the projection is instant and deterministic.
// Movie mode: "slide:slider:<value>", then "submit" (or "cancel").

function paramText(v: number, unit: ImpactSimulatorProps["param"]["unit"]) {
  if (unit === "%") return `${Number.isInteger(v) ? v : v.toFixed(1)}%`;
  if (unit === "$") return `$${Math.round(v)}`;
  return `${v} wk`;
}

function nearest(points: ImpactPoint[], v: number) {
  let best = points[0];
  for (const p of points) if (Math.abs(p.v - v) < Math.abs(best.v - v)) best = p;
  return best;
}

export const ImpactSimulator = defineWidget<ImpactSimulatorProps, ImpactSimulatorAnswer>(function ImpactSimulator(w) {
  const { p, active, locked, answer } = w;
  const [v, setV] = useState(answer?.value ?? p.param.value);
  const value = locked && answer ? answer.value : v;
  const pt = nearest(p.points, value);
  const base = nearest(p.points, p.param.current ?? p.param.min);
  const label = paramText(value, p.param.unit);
  const head = p.metrics[0];
  const summary = answer?.action === "cancel" ? "Kept as is" : `${label} · ${head.label.toLowerCase()} ${fmtValue(pt.metrics[head.key], head.format)}`;
  const pos = ((value - p.param.min) / (p.param.max - p.param.min)) * 100;
  const rec = p.param.recommended;

  return (
    <Frame
      icon={<SlidersHorizontal />}
      title={p.title}
      meta={p.meta}
      {...stateOf(w, summary)}
      className="agg-sim-w"
      foot={
        <>
          {p.secondary !== "" && (
            <Button data-auto="cancel" disabled={!active} onClick={() => w.respond({ action: "cancel", value })}>
              {p.secondary ?? "Cancel"}
            </Button>
          )}
          <Button variant="primary" data-auto="submit" disabled={!active} onClick={() => w.respond({ action: "apply", value })}>
            {(p.cta ?? "Use {v}").replace("{v}", label)}
          </Button>
        </>
      }
    >
      <div className="agg-sim">
        <div className="agg-sim-ctl">
          <div className="agg-sim-head">
            <span className="agg-lbl">{p.param.label}</span>
            <b className="agg-sim-val tnum">{label}</b>
            {p.param.current !== undefined && (
              <span className="agg-sim-cur mono">
                {p.param.currentLabel ?? "Now"} {paramText(p.param.current, p.param.unit)}
              </span>
            )}
            {rec !== undefined && (
              <button type="button" className={`agg-rec ${Math.abs(rec - value) < 1e-6 ? "is-on" : ""}`} disabled={!active} data-auto="recommended" onClick={() => setV(rec)}>
                Recommended {paramText(rec, p.param.unit)}
              </button>
            )}
          </div>
          <div className="agg-range" style={{ ["--pos" as string]: `${pos}%` }}>
            <input
              type="range"
              data-auto="slider"
              min={p.param.min}
              max={p.param.max}
              step={p.param.step}
              value={value}
              disabled={!active}
              aria-label={p.param.label}
              onChange={e => setV(+e.target.value)}
            />
            {rec !== undefined && <i className="agg-range-rec" style={{ left: `${((rec - p.param.min) / (p.param.max - p.param.min)) * 100}%` }} aria-hidden />}
          </div>
          <div className="agg-range-ends mono">
            <span>{paramText(p.param.min, p.param.unit)}</span>
            <span>{paramText(p.param.max, p.param.unit)}</span>
          </div>
        </div>

        <div className="agg-kpis" style={{ gridTemplateColumns: `repeat(${p.metrics.length}, minmax(0, 1fr))` }}>
          {p.metrics.map(m => {
            const val = pt.metrics[m.key];
            const b = base.metrics[m.key];
            const diff = val - b;
            const good = m.good === undefined || Math.abs(diff) < 1e-9 ? "" : (diff > 0) === (m.good === "up") ? "is-good" : "is-bad";
            return (
              <div key={m.key} className="agg-kpi">
                <span className="agg-lbl">{m.label}</span>
                <b className={`tnum ${good}`}>{fmtValue(val, m.format)}</b>
                {m.hint && <small>{m.hint}</small>}
              </div>
            );
          })}
        </div>

        <TwoLine months={p.months} base={p.baseline.series} proj={pt.series} baseLabel={p.baseline.label} projLabel={p.projectedLabel ?? `At ${label}`} format={p.seriesFormat ?? "money"} />
        {(pt.note || p.note) && <p className="agg-note">{pt.note ?? p.note}</p>}
      </div>
    </Frame>
  );
});

/** Baseline vs projected, one month per point. Baseline is quiet; projection is the accent. */
export function TwoLine({ months, base, proj, baseLabel, projLabel, format, height = 150 }: { months: string[]; base: number[]; proj: number[]; baseLabel: string; projLabel: string; format: "money" | "pct"; height?: number }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const padL = 44,
    padR = 10,
    padT = 10,
    padB = 22;
  const all = [...base, ...proj];
  const ticks = useMemo(() => {
    const lo = Math.min(...all);
    const hi = Math.max(...all);
    const pad = (hi - lo) * 0.15 || hi * 0.02;
    return niceTicks(lo - pad, hi + pad, 3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all.join(",")]);
  const lo = ticks[0];
  const hi = ticks[ticks.length - 1];
  const iw = Math.max(0, w - padL - padR);
  const ih = height - padT - padB;
  const x = (i: number) => padL + (i * iw) / Math.max(1, months.length - 1);
  const y = (v: number) => padT + ih - ((v - lo) / (hi - lo || 1)) * ih;
  const path = (s: number[]) => s.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const f = (v: number) => (format === "money" ? shortMoney(v) : (v * 100).toFixed(0) + "%");
  const tip = (v: number) => (format === "money" ? "$" + Math.round(v).toLocaleString("en-US") : (v * 100).toFixed(1) + "%");
  return (
    <div className="agg-chart">
      <div className="agg-legend">
        <span>
          <i className="agg-sw agg-sw--base" />
          {baseLabel}
        </span>
        <span>
          <i className="agg-sw" />
          {projLabel}
        </span>
      </div>
      <div className="agg-plot" ref={ref} style={{ height }}>
        {w > 0 && (
          <svg
            width={w}
            height={height}
            role="img"
            aria-label={`${projLabel} vs ${baseLabel}`}
            onMouseMove={e => {
              const r = (e.currentTarget as SVGElement).getBoundingClientRect();
              const i = Math.round(((e.clientX - r.left - padL) / Math.max(1, iw)) * (months.length - 1));
              setHover(Math.max(0, Math.min(months.length - 1, i)));
            }}
            onMouseLeave={() => setHover(null)}
          >
            {ticks.map(t => (
              <g key={t}>
                <line x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} className="zc-grid" />
                <text x={padL - 8} y={y(t)} className="zc-ytick" dominantBaseline="middle" textAnchor="end">
                  {f(t)}
                </text>
              </g>
            ))}
            {months.map((m, i) => (
              <text key={m + i} x={x(i)} y={height - 5} className="zc-xtick" textAnchor="middle">
                {months.length > 8 && i % 2 ? "" : m}
              </text>
            ))}
            <path d={path(base)} className="agg-line agg-line--base" />
            <path d={path(proj)} className="agg-line" />
            <circle cx={x(proj.length - 1)} cy={y(proj[proj.length - 1])} r="3.5" className="zc-dot" />
            {hover !== null && (
              <g>
                <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + ih} className="zc-cross" />
                <circle cx={x(hover)} cy={y(base[hover])} r="3" className="agg-dot-base" />
                <circle cx={x(hover)} cy={y(proj[hover])} r="3.5" className="zc-dot" />
              </g>
            )}
          </svg>
        )}
        {hover !== null && w > 0 && (
          <div className="zc-tip agg-tip" style={{ left: Math.min(w - 170, Math.max(0, x(hover) - 85)), top: 0 }}>
            <span>{months[hover]}</span>
            <b className="tnum">{tip(proj[hover])}</b>
            <span className="tnum">
              {baseLabel} {tip(base[hover])}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
