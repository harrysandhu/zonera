import React, { useEffect, useRef, useState } from "react";
import { fmt } from "../../../state/store";

// Charts for the reports widgets. Hand-built SVG in the same language as
// src/ui/charts.tsx: one accent for the series the question is about, a
// recessive neutral for the comparison, hairline grid, thin marks with a 4px
// rounded data end, hover tooltip on every mark. Text uses ink tokens only.

export type Fmt = "money" | "money-k" | "pct" | "pct0" | "int" | "days";

export function format(f: Fmt | undefined, v: number) {
  switch (f) {
    case "money":
      return fmt.money(v);
    case "money-k":
      return Math.abs(v) >= 1000 ? "$" + (v / 1000).toFixed(v >= 10000 ? 0 : 1) + "k" : fmt.money(v);
    case "pct":
      return (v * 100).toFixed(1) + "%";
    case "pct0":
      return Math.round(v * 100) + "%";
    case "days":
      return Math.round(v) + "d";
    default:
      return Math.round(v).toLocaleString("en-US");
  }
}
const tick = (f: Fmt | undefined, v: number) => (f === "money" || f === "money-k" ? (Math.abs(v) >= 1000 ? "$" + Math.round(v / 1000) + "k" : "$" + Math.round(v)) : f === "pct" ? Math.round(v * 100) + "%" : format(f, v));

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(e => setW(Math.round(e[0].contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function niceTicks(min: number, max: number, count = 3) {
  const span = max - min || 1;
  const step0 = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= step0) ?? step0;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) out.push(+v.toFixed(6));
  return out;
}

/** A column with a 4px rounded data end and a square base. */
function colPath(x: number, w: number, y0: number, y1: number) {
  const h = y0 - y1;
  if (h <= 0.5) return `M${x},${y0 - 1} h${w} v1 h${-w} Z`;
  const r = Math.min(4, w / 2, h);
  return `M${x},${y0} V${y1 + r} Q${x},${y1} ${x + r},${y1} H${x + w - r} Q${x + w},${y1} ${x + w},${y1 + r} V${y0} Z`;
}

function Tip({ x, y, w, title, rows }: { x: number; y: number; w: number; title: string; rows: { k?: string; v: string; sw?: string }[] }) {
  return (
    <div className="agr-tip" style={{ left: Math.min(w - 156, Math.max(0, x - 78)), top: Math.max(0, y) }}>
      <span>{title}</span>
      {rows.map((r, i) => (
        <b key={i}>
          {r.sw && <i className={`agr-sw agr-sw--${r.sw}`} />}
          {r.k && <em>{r.k}</em>}
          <span className="tnum">{r.v}</span>
        </b>
      ))}
    </div>
  );
}

export interface ColDatum {
  label: string;
  value: number;
  note?: string;
}

/** Single-series columns. `emphasize` marks the bars the answer is about. */
export function Columns({ data, height = 180, f, emphasize, marker }: { data: ColDatum[]; height?: number; f?: Fmt; emphasize?: number[]; marker?: { at: number; label: string } }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const padL = 44, padR = 6, padT = marker ? 22 : 10, padB = 24;
  const max = Math.max(1, ...data.map(d => d.value));
  const ticks = niceTicks(0, max);
  const top = ticks[ticks.length - 1];
  const iw = Math.max(0, w - padL - padR);
  const ih = height - padT - padB;
  const slot = iw / Math.max(1, data.length);
  const bw = Math.max(4, Math.min(24, slot - 8));
  const y = (v: number) => padT + ih - (v / top) * ih;
  const emph = new Set(emphasize ?? [data.length - 1]);
  const every = Math.ceil(data.length / Math.max(1, Math.floor(iw / 44)));
  return (
    <div className="agr-chart" ref={ref} style={{ height }}>
      {w > 0 && (
        <svg width={w} height={height} role="img" aria-label="Column chart">
          {ticks.map(t => (
            <g key={t}>
              <line x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} className="agr-grid" />
              <text x={padL - 8} y={y(t)} className="agr-tick" dominantBaseline="middle" textAnchor="end">
                {tick(f, t)}
              </text>
            </g>
          ))}
          {marker && marker.at >= 0 && marker.at < data.length && (
            <g>
              <line x1={padL + marker.at * slot} x2={padL + marker.at * slot} y1={padT - 8} y2={y(0)} className="agr-marker" />
              <text x={padL + marker.at * slot + 6} y={padT - 10} className="agr-marker-t">
                {marker.label}
              </text>
            </g>
          )}
          {data.map((d, i) => {
            const x = padL + i * slot + (slot - bw) / 2;
            return (
              <g key={d.label + i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <rect x={padL + i * slot} y={padT} width={slot} height={ih} fill="transparent" />
                <path d={colPath(x, bw, y(0), y(d.value))} className={`agr-col ${emph.has(i) ? "is-on" : ""} ${hover === i ? "is-hover" : ""}`} />
                {i % every === 0 && (
                  <text x={x + bw / 2} y={height - 6} className="agr-tick" textAnchor="middle">
                    {d.label}
                  </text>
                )}
              </g>
            );
          })}
          <line x1={padL} x2={w - padR} y1={y(0)} y2={y(0)} className="agr-base" />
        </svg>
      )}
      {hover !== null && w > 0 && <Tip x={padL + hover * slot + slot / 2} y={y(data[hover].value) - 56} w={w} title={data[hover].note ?? data[hover].label} rows={[{ v: format(f, data[hover].value) }]} />}
    </div>
  );
}

export interface PairDatum {
  label: string;
  a: number;
  b: number;
  note?: string;
}

/** Paired columns: the period asked about (accent) next to its comparison (neutral). */
export function CompareBars({ data, aLabel, bLabel, height = 190, f }: { data: PairDatum[]; aLabel: string; bLabel: string; height?: number; f?: Fmt }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const padL = 44, padR = 6, padT = 10, padB = 24;
  const max = Math.max(1, ...data.flatMap(d => [d.a, d.b]));
  const ticks = niceTicks(0, max);
  const top = ticks[ticks.length - 1];
  const iw = Math.max(0, w - padL - padR);
  const ih = height - padT - padB;
  const slot = iw / Math.max(1, data.length);
  const bw = Math.max(4, Math.min(16, (slot - 12) / 2));
  const y = (v: number) => padT + ih - (v / top) * ih;
  return (
    <div className="agr-chart-w">
      <Legend items={[{ label: aLabel, sw: "a" }, { label: bLabel, sw: "b" }]} />
      <div className="agr-chart" ref={ref} style={{ height }}>
        {w > 0 && (
          <svg width={w} height={height} role="img" aria-label={`${aLabel} compared with ${bLabel}`}>
            {ticks.map(t => (
              <g key={t}>
                <line x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} className="agr-grid" />
                <text x={padL - 8} y={y(t)} className="agr-tick" dominantBaseline="middle" textAnchor="end">
                  {tick(f, t)}
                </text>
              </g>
            ))}
            {data.map((d, i) => {
              const x = padL + i * slot + (slot - (bw * 2 + 2)) / 2;
              return (
                <g key={d.label + i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                  <rect x={padL + i * slot} y={padT} width={slot} height={ih} fill="transparent" />
                  <path d={colPath(x, bw, y(0), y(d.b))} className={`agr-col agr-col--b ${hover === i ? "is-hover" : ""}`} />
                  <path d={colPath(x + bw + 2, bw, y(0), y(d.a))} className={`agr-col is-on ${hover === i ? "is-hover" : ""}`} />
                  <text x={padL + i * slot + slot / 2} y={height - 6} className="agr-tick" textAnchor="middle">
                    {d.label}
                  </text>
                </g>
              );
            })}
            <line x1={padL} x2={w - padR} y1={y(0)} y2={y(0)} className="agr-base" />
          </svg>
        )}
        {hover !== null && w > 0 && (
          <Tip
            x={padL + hover * slot + slot / 2}
            y={y(Math.max(data[hover].a, data[hover].b)) - 74}
            w={w}
            title={data[hover].note ?? data[hover].label}
            rows={[
              { k: aLabel, v: format(f, data[hover].a), sw: "a" },
              { k: bLabel, v: format(f, data[hover].b), sw: "b" },
            ]}
          />
        )}
      </div>
    </div>
  );
}

export interface HBarRow {
  label: string;
  value: number;
  /** Value shown at the tip; defaults to the formatted value. */
  text?: string;
  sub?: string;
  /** Comparison value drawn as a thin tick on the track. */
  prior?: number;
  tone?: "accent" | "muted" | "warn" | "bad";
}

/** Ranked horizontal bars: label · bar · value at the tip. Optional comparison tick. */
export function HBars({ rows, f, max, priorLabel, valueLabel }: { rows: HBarRow[]; f?: Fmt; max?: number; priorLabel?: string; valueLabel?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const top = max ?? Math.max(1e-9, ...rows.flatMap(r => [r.value, r.prior ?? 0]));
  const hasPrior = rows.some(r => r.prior !== undefined);
  return (
    <div className="agr-chart-w">
      {hasPrior && <Legend items={[{ label: valueLabel ?? "Now", sw: "a" }, { label: priorLabel ?? "Before", sw: "tick" }]} />}
      <div className="agr-hbars" role="list">
        {rows.map((r, i) => (
          <div key={r.label + i} className={`agr-hbar ${hover === i ? "is-hover" : ""}`} role="listitem" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <span className="agr-hbar-l">{r.label}</span>
            <span className="agr-hbar-t">
              <i className={`agr-hbar-f agr-hbar-f--${r.tone ?? "accent"}`} style={{ width: `${Math.max(r.value > 0 ? 1.5 : 0, (r.value / top) * 100)}%` }} />
              {r.prior !== undefined && <i className="agr-hbar-p" style={{ left: `${Math.min(100, (r.prior / top) * 100)}%` }} />}
              {hover === i && (r.prior !== undefined || r.sub) && (
                <span className="agr-hbar-tip">
                  <b className="tnum">{r.text ?? format(f, r.value)}</b>
                  {r.prior !== undefined && (
                    <em>
                      {priorLabel ?? "Before"} {format(f, r.prior)}
                    </em>
                  )}
                  {r.sub && <em>{r.sub}</em>}
                </span>
              )}
            </span>
            <span className="agr-hbar-v tnum">{r.text ?? format(f, r.value)}</span>
            {r.sub && <span className="agr-hbar-s">{r.sub}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Legend({ items }: { items: { label: string; sw: "a" | "b" | "tick" | "warn" }[] }) {
  return (
    <div className="agr-legend">
      {items.map(i => (
        <span key={i.label}>
          <i className={`agr-sw agr-sw--${i.sw}`} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

/** Line for a trend. Single series; the latest point carries an end dot. */
export function Trend({ data, height = 170, f, domain }: { data: ColDatum[]; height?: number; f?: Fmt; domain?: [number, number] }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const padL = 44, padR = 12, padT = 12, padB = 24;
  const vals = data.map(d => d.value);
  const [lo0, hi0] = domain ?? [Math.min(...vals), Math.max(...vals)];
  const ticks = niceTicks(lo0, hi0);
  const lo = ticks[0], hi = ticks[ticks.length - 1];
  const iw = Math.max(0, w - padL - padR);
  const ih = height - padT - padB;
  const x = (i: number) => padL + (i * iw) / Math.max(1, data.length - 1);
  const y = (v: number) => padT + ih - ((v - lo) / (hi - lo || 1)) * ih;
  const d = data.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = `${d} L${x(data.length - 1)},${y(lo)} L${x(0)},${y(lo)} Z`;
  const every = Math.ceil(data.length / Math.max(1, Math.floor(iw / 44)));
  return (
    <div className="agr-chart" ref={ref} style={{ height }}>
      {w > 0 && data.length > 0 && (
        <svg
          width={w}
          height={height}
          role="img"
          aria-label="Trend"
          onMouseMove={e => {
            const r = (e.currentTarget as SVGElement).getBoundingClientRect();
            const i = Math.round(((e.clientX - r.left - padL) / Math.max(1, iw)) * (data.length - 1));
            setHover(Math.max(0, Math.min(data.length - 1, i)));
          }}
          onMouseLeave={() => setHover(null)}
        >
          {ticks.map(t => (
            <g key={t}>
              <line x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} className="agr-grid" />
              <text x={padL - 8} y={y(t)} className="agr-tick" dominantBaseline="middle" textAnchor="end">
                {tick(f, t)}
              </text>
            </g>
          ))}
          <path d={area} className="agr-area" />
          <path d={d} className="agr-line" />
          {data.map((p, i) =>
            i % every === 0 ? (
              <text key={p.label + i} x={x(i)} y={height - 6} className="agr-tick" textAnchor="middle">
                {p.label}
              </text>
            ) : null,
          )}
          <circle cx={x(data.length - 1)} cy={y(data[data.length - 1].value)} r="4" className="agr-dot" />
          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={padT} y2={y(lo)} className="agr-cross" />
              <circle cx={x(hover)} cy={y(data[hover].value)} r="4" className="agr-dot" />
            </g>
          )}
        </svg>
      )}
      {hover !== null && w > 0 && <Tip x={x(hover)} y={y(data[hover].value) - 56} w={w} title={data[hover].note ?? data[hover].label} rows={[{ v: format(f, data[hover].value) }]} />}
    </div>
  );
}
