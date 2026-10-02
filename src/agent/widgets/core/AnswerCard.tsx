import React from "react";
import { ArrowUpRight, ChevronRight } from "lucide-react";
import { askAgent, go } from "../../../state/store";
import { defineWidget } from "../frame";
import { ChartView } from "./chart";
import type { AnswerCardProps } from "./types";

// W10 · One big number with context and a mini list, or a row of tiles.
// Display only: use with ctx.show(). Item actions start a new ask.
export const AnswerCard = defineWidget<AnswerCardProps, void>(function AnswerCard(w) {
  const { p } = w;
  return (
    <section className="ag-w ag-w--info ag-ans">
      {p.value && (
        <div className="ag-ans-h">
          {p.label && <span className="ag-lbl">{p.label}</span>}
          <div className="ag-ans-v">
            <b className="tnum">{p.value}</b>
            {p.delta && <span className={`ag-delta is-${p.delta.tone}`}>{p.delta.text}</span>}
          </div>
          {p.context && <p>{p.context}</p>}
        </div>
      )}
      {p.tiles && (
        <div className="ag-tiles">
          {p.tiles.map(t => (
            <div key={t.label} className="ag-tile">
              <span className="ag-lbl">{t.label}</span>
              <b className="tnum">{t.value}</b>
              <span className="ag-tile-f">
                {t.delta && <span className={`ag-delta is-${t.delta.tone}`}>{t.delta.text}</span>}
                {t.context && <small>{t.context}</small>}
              </span>
            </div>
          ))}
        </div>
      )}
      {p.chart && (
        <div className="ag-ans-c">
          {p.chart.title && <span className="ag-lbl">{p.chart.title}</span>}
          <ChartView spec={p.chart} />
        </div>
      )}
      {p.items && (
        <div className="ag-ans-l">
          {p.itemsTitle && <div className="ag-ans-lh">{p.itemsTitle}</div>}
          <ul>
            {p.items.map((it, i) => (
              <li key={i}>
                <span className="ag-ans-li">{it.label}</span>
                {it.meta && <span className="ag-ans-lm">{it.meta}</span>}
                {it.action ? (
                  <button type="button" className="z-btn z-btn--sm" onClick={() => askAgent(it.action!.ask)}>
                    {it.action.label}
                  </button>
                ) : it.route ? (
                  <button type="button" className="ag-icon" aria-label="Open" onClick={() => go(it.route!)}>
                    <ChevronRight />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}
      {p.links && p.links.length > 0 && (
        <div className="ag-ans-links">
          {p.links.map(l => (
            <button key={l.route} type="button" className="ag-more" onClick={() => go(l.route)}>
              {l.label} <ArrowUpRight />
            </button>
          ))}
        </div>
      )}
    </section>
  );
});
