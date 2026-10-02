import React, { useState } from "react";
import { ChartNoAxesColumn, Star } from "lucide-react";
import { defineWidget, Frame } from "../frame";
import type { CompetitorCompareProps } from "./types";

// Our street rate next to nearby facilities, one size at a time. Bars are
// sorted by price with a market-median rule; we are the accent, the competitor
// that was asked about is outlined. Display only: show() it, then follow with
// an AnswerCard that says what to do about it.

export const CompetitorCompare = defineWidget<CompetitorCompareProps, void>(function CompetitorCompare(w) {
  const { p } = w;
  const [size, setSize] = useState(p.size);
  const rows = p.rows.filter(r => r.prices[size] != null).sort((a, b) => (a.prices[size] as number) - (b.prices[size] as number));
  const vals = rows.map(r => r.prices[size] as number);
  const max = Math.max(...vals) * 1.08;
  const sorted = [...vals].sort((a, b) => a - b);
  const median = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  const us = rows.find(r => r.us);
  const label = p.sizes.find(s => s.id === size)?.label ?? size;
  const diff = us ? (us.prices[size] as number) - median : 0;

  return (
    <Frame icon={<ChartNoAxesColumn />} title={p.title} meta={p.meta} state="info" className="agg-cmp-w">
      <div className="agg-cmp">
        <div className="agg-cmp-top">
          <div className="agg-seg" role="group" aria-label="Unit size">
            {p.sizes.map(s => (
              <button key={s.id} type="button" aria-pressed={s.id === size} data-auto={`size:${s.id}`} onClick={() => setSize(s.id)}>
                {s.label}
              </button>
            ))}
          </div>
          {us && (
            <span className="agg-cmp-sum">
              {label} median <b className="tnum">${Math.round(median)}</b>
              <span className={`mono ${diff > 0 ? "is-up" : diff < 0 ? "is-down" : ""}`}>
                {diff === 0 ? "you're at the median" : `you're ${diff > 0 ? "+" : "−"}$${Math.abs(Math.round(diff))}`}
              </span>
            </span>
          )}
        </div>
        <div className="agg-cmp-rows" style={{ ["--med" as string]: `${(median / max) * 100}%` }}>
          <i className="agg-cmp-med" aria-hidden>
            <span className="mono">median</span>
          </i>
          {rows.map(r => {
            const v = r.prices[size] as number;
            return (
              <div key={r.name} className={`agg-cmp-r ${r.us ? "is-us" : ""} ${p.focus === r.name ? "is-focus" : ""}`}>
                <div className="agg-cmp-n">
                  <b>
                    {r.name}
                    {r.us && <em>You</em>}
                  </b>
                  <small>
                    {r.distance && <span className="mono">{r.distance}</span>}
                    {r.rating !== undefined && (
                      <span className="agg-cmp-star">
                        <Star />
                        {r.rating.toFixed(1)}
                        {r.reviews !== undefined && <span className="mono"> ({r.reviews})</span>}
                      </span>
                    )}
                    {r.promo && <span className="agg-cmp-promo">{r.promo}</span>}
                  </small>
                </div>
                <div className="agg-cmp-bar">
                  <span style={{ width: `${(v / max) * 100}%` }} />
                  <b className="tnum">${v}</b>
                </div>
              </div>
            );
          })}
        </div>
        {p.source && <p className="agg-note">{p.source}</p>}
      </div>
    </Frame>
  );
});
