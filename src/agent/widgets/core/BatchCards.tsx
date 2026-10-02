import React from "react";
import { Check, Circle, CircleAlert, Clock3, Layers } from "lucide-react";
import { Avatar } from "../../../ui";
import { defineWidget, Frame } from "../frame";
import type { BatchProps } from "./types";

// W31 · One card per entity, running in parallel. Use with ctx.show() and update steps.
export const BatchCards = defineWidget<BatchProps, void>(function BatchCards(w) {
  const { p } = w;
  const complete = p.cards.filter(c => c.steps.every(s => s.state === "done")).length;
  const running = p.cards.some(c => c.steps.some(s => s.state === "run" || s.state === "todo" || s.state === "wait"));
  return (
    <Frame icon={<Layers />} title={p.title} meta={`${complete} of ${p.cards.length} complete`} state={running ? "live" : "info"} keepOpen>
      <div className="ag-batch">
        {p.cards.map(c => {
          const ok = c.steps.every(s => s.state === "done");
          return (
            <div key={c.id} className={`ag-bcard ${ok ? "is-ok" : ""}`}>
              <div className="ag-bcard-h">
                <Avatar name={c.avatar ?? c.title} size="sm" />
                <div>
                  <b>{c.title}</b>
                  {c.sub && <small>{c.sub}</small>}
                </div>
              </div>
              <ol>
                {c.steps.map((s, i) => (
                  <li key={i} className={`is-${s.state}`}>
                    <span className="ag-bcard-i">{s.state === "done" ? <Check /> : s.state === "run" ? <span className="ag-spin" /> : s.state === "fail" ? <CircleAlert /> : s.state === "wait" ? <Clock3 /> : <Circle />}</span>
                    <span>{s.label}</span>
                    {s.value && <em>{s.value}</em>}
                  </li>
                ))}
              </ol>
              {c.total && <div className="ag-bcard-f">{c.total}</div>}
            </div>
          );
        })}
      </div>
      {p.summary && !running && <div className="ag-prog-sum">{p.summary}</div>}
    </Frame>
  );
});
