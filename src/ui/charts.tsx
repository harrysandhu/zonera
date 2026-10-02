import React, { useEffect, useRef, useState } from "react";

// Small, hand-built SVG charts. Single series in the accent, recessive grid,
// thin marks, hover tooltip on every chart. Text uses ink tokens only.

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

function niceTicks(min: number, max: number, count = 4) {
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

export interface Datum { label: string; value: number; note?: string }

export function BarChart({ data, height = 200, format = (v: number) => String(v), yFormat, emphasizeLast = true }: { data: Datum[]; height?: number; format?: (v: number) => string; yFormat?: (v: number) => string; emphasizeLast?: boolean }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const padL = 44, padR = 4, padT = 10, padB = 24;
  const max = Math.max(...data.map(d => d.value));
  const ticks = niceTicks(0, max, 3);
  const top = ticks[ticks.length - 1];
  const iw = Math.max(0, w - padL - padR);
  const ih = height - padT - padB;
  const slot = iw / data.length;
  const bw = Math.max(4, Math.min(28, slot - 8));
  const y = (v: number) => padT + ih - (v / top) * ih;
  return (
    <div className="zc" ref={ref} style={{ height }}>
      {w > 0 && (
        <svg width={w} height={height} role="img" aria-label="Bar chart">
          {ticks.map(t => (
            <g key={t}>
              <line x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} className="zc-grid" />
              <text x={padL - 8} y={y(t)} className="zc-ytick" dominantBaseline="middle" textAnchor="end">
                {(yFormat ?? format)(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const x = padL + i * slot + (slot - bw) / 2;
            const h = Math.max(1, y(0) - y(d.value));
            const last = emphasizeLast && i === data.length - 1;
            const r = Math.min(4, bw / 2, h);
            const path = `M${x},${y(0)} V${y(d.value) + r} Q${x},${y(d.value)} ${x + r},${y(d.value)} H${x + bw - r} Q${x + bw},${y(d.value)} ${x + bw},${y(d.value) + r} V${y(0)} Z`;
            return (
              <g key={d.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <rect x={padL + i * slot} y={padT} width={slot} height={ih} fill="transparent" />
                <path d={path} className={`zc-bar ${last ? "zc-bar--on" : ""} ${hover === i ? "zc-bar--hover" : ""}`} />
                <text x={x + bw / 2} y={height - 6} className="zc-xtick" textAnchor="middle">
                  {d.label}
                </text>
              </g>
            );
          })}
          <line x1={padL} x2={w - padR} y1={y(0)} y2={y(0)} className="zc-base" />
        </svg>
      )}
      {hover !== null && w > 0 && (
        <div className="zc-tip" style={{ left: Math.min(w - 140, Math.max(0, padL + hover * slot + slot / 2 - 70)), top: Math.max(0, y(data[hover].value) - 52) }}>
          <span>{data[hover].note ?? data[hover].label}</span>
          <b className="tnum">{format(data[hover].value)}</b>
        </div>
      )}
    </div>
  );
}

export function LineChart({ data, height = 200, format = (v: number) => String(v), domain }: { data: Datum[]; height?: number; format?: (v: number) => string; domain?: [number, number] }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const padL = 44, padR = 10, padT = 12, padB = 24;
  const vals = data.map(d => d.value);
  const [lo0, hi0] = domain ?? [Math.min(...vals), Math.max(...vals)];
  const ticks = niceTicks(lo0, hi0, 3);
  const lo = ticks[0], hi = ticks[ticks.length - 1];
  const iw = Math.max(0, w - padL - padR);
  const ih = height - padT - padB;
  const x = (i: number) => padL + (i * iw) / Math.max(1, data.length - 1);
  const y = (v: number) => padT + ih - ((v - lo) / (hi - lo || 1)) * ih;
  const d = data.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = `${d} L${x(data.length - 1)},${y(lo)} L${x(0)},${y(lo)} Z`;
  const id = React.useId().replace(/:/g, "");
  return (
    <div className="zc" ref={ref} style={{ height }}>
      {w > 0 && (
        <svg
          width={w}
          height={height}
          role="img"
          aria-label="Line chart"
          onMouseMove={e => {
            const r = (e.currentTarget as SVGElement).getBoundingClientRect();
            const i = Math.round(((e.clientX - r.left - padL) / iw) * (data.length - 1));
            setHover(Math.max(0, Math.min(data.length - 1, i)));
          }}
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id={"lg" + id} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="var(--accent)" stopOpacity="0.16" />
              <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map(t => (
            <g key={t}>
              <line x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} className="zc-grid" />
              <text x={padL - 8} y={y(t)} className="zc-ytick" dominantBaseline="middle" textAnchor="end">
                {format(t)}
              </text>
            </g>
          ))}
          <path d={area} fill={`url(#lg${id})`} />
          <path d={d} className="zc-line" />
          {data.map((p, i) => (
            <text key={p.label} x={x(i)} y={height - 6} className="zc-xtick" textAnchor="middle">
              {i % Math.ceil(data.length / 12) === 0 ? p.label : ""}
            </text>
          ))}
          <circle cx={x(data.length - 1)} cy={y(data[data.length - 1].value)} r="4" className="zc-dot" />
          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={padT} y2={y(lo)} className="zc-cross" />
              <circle cx={x(hover)} cy={y(data[hover].value)} r="4" className="zc-dot" />
            </g>
          )}
        </svg>
      )}
      {hover !== null && w > 0 && (
        <div className="zc-tip" style={{ left: Math.min(w - 140, Math.max(0, x(hover) - 70)), top: Math.max(0, y(data[hover].value) - 54) }}>
          <span>{data[hover].note ?? data[hover].label}</span>
          <b className="tnum">{format(data[hover].value)}</b>
        </div>
      )}
    </div>
  );
}

/** Horizontal meter rows: label · bar · value. For "share of" comparisons. */
export function MeterList({ rows, format = (v: number) => (v * 100).toFixed(0) + "%" }: { rows: { label: React.ReactNode; value: number; sub?: React.ReactNode; tone?: "accent" | "warn" | "ok" | "neutral" }[]; format?: (v: number) => string }) {
  return (
    <div className="zc-meters">
      {rows.map((r, i) => (
        <div className="zc-meter" key={i}>
          <span className="zc-meter-l">{r.label}</span>
          <span className="zc-meter-t">
            <i style={{ width: `${Math.max(2, r.value * 100)}%` }} className={`zc-meter-f zc-meter-f--${r.tone ?? "accent"}`} />
          </span>
          <span className="zc-meter-v tnum">{format(r.value)}</span>
          {r.sub && <span className="zc-meter-s">{r.sub}</span>}
        </div>
      ))}
    </div>
  );
}
