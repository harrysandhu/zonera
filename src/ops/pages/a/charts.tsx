import React, { useEffect, useRef, useState } from "react";

// Paired columns: a primary series in the accent, a comparison series in neutral ink.
// Same anatomy as src/ui/charts.tsx (recessive grid, mono ticks, 4px rounded caps,
// 2px surface gap between touching bars, hover tooltip over the whole slot).

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

function niceTicks(max: number, count = 3) {
  const step0 = max / count || 1;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= step0) ?? step0;
  const out: number[] = [];
  for (let v = 0; v <= Math.ceil(max / step) * step + step / 2; v += step) out.push(+v.toFixed(6));
  return out;
}

export interface PairDatum { label: string; a: number; b: number; note?: string }

export function PairBarChart({ data, height = 200, aLabel, bLabel }: { data: PairDatum[]; height?: number; aLabel: string; bLabel: string }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const padL = 32, padR = 4, padT = 10, padB = 24;
  const max = Math.max(...data.flatMap(d => [d.a, d.b]));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const iw = Math.max(0, w - padL - padR);
  const ih = height - padT - padB;
  const slot = iw / data.length;
  const bw = Math.max(3, Math.min(12, (slot - 10) / 2));
  const y = (v: number) => padT + ih - (v / top) * ih;
  const col = (x: number, v: number) => {
    const h = Math.max(1, y(0) - y(v));
    const r = Math.min(3, bw / 2, h);
    return `M${x},${y(0)} V${y(v) + r} Q${x},${y(v)} ${x + r},${y(v)} H${x + bw - r} Q${x + bw},${y(v)} ${x + bw},${y(v) + r} V${y(0)} Z`;
  };
  return (
    <div className="zc" ref={ref} style={{ height }}>
      {w > 0 && (
        <svg width={w} height={height} role="img" aria-label={`${aLabel} and ${bLabel} by month`}>
          {ticks.map(t => (
            <g key={t}>
              <line x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} className="zc-grid" />
              <text x={padL - 8} y={y(t)} className="zc-ytick" dominantBaseline="middle" textAnchor="end">
                {t}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const x0 = padL + i * slot + (slot - (bw * 2 + 2)) / 2;
            return (
              <g key={d.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <rect x={padL + i * slot} y={padT} width={slot} height={ih} fill={hover === i ? "var(--surface-2)" : "transparent"} />
                <path d={col(x0, d.a)} className="pa-bar-a" />
                <path d={col(x0 + bw + 2, d.b)} className="pa-bar-b" />
                <text x={padL + i * slot + slot / 2} y={height - 6} className="zc-xtick" textAnchor="middle">
                  {d.label}
                </text>
              </g>
            );
          })}
          <line x1={padL} x2={w - padR} y1={y(0)} y2={y(0)} className="zc-base" />
        </svg>
      )}
      {hover !== null && w > 0 && (
        <div className="zc-tip pa-tip2" style={{ left: Math.min(w - 150, Math.max(0, padL + hover * slot + slot / 2 - 75)), top: Math.max(0, y(Math.max(data[hover].a, data[hover].b)) - 74) }}>
          <span>{data[hover].note ?? data[hover].label}</span>
          <b className="tnum">
            <i className="pa-sw pa-sw--a" />
            {aLabel} <em>{data[hover].a}</em>
          </b>
          <b className="tnum">
            <i className="pa-sw pa-sw--b" />
            {bLabel} <em>{data[hover].b}</em>
          </b>
        </div>
      )}
    </div>
  );
}
