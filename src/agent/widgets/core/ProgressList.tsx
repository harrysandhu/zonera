import React from "react";
import { Check, Circle, CircleAlert, ListTodo, MinusCircle } from "lucide-react";
import { defineWidget, Frame } from "../frame";
import type { ProgressProps } from "./types";

// W30 · Live execution of a plan. Use with ctx.show() and update item states.
export const ProgressList = defineWidget<ProgressProps, void>(function ProgressList(w) {
  const { p } = w;
  const done = p.items.filter(i => i.state === "done" || i.state === "skip" || i.state === "fail").length;
  const running = done < p.items.length;
  return (
    <Frame icon={<ListTodo />} title={p.title} meta={`${done} of ${p.items.length}`} state={running ? "live" : "info"} flush keepOpen>
      <ol className="ag-prog">
        {p.items.map(i => (
          <li key={i.id} className={`is-${i.state}`}>
            <span className="ag-prog-i">
              {i.state === "done" ? <Check /> : i.state === "run" ? <span className="ag-spin" /> : i.state === "fail" ? <CircleAlert /> : i.state === "skip" ? <MinusCircle /> : <Circle />}
            </span>
            <span className="ag-prog-t">
              <b>{i.label}</b>
              {i.sub && <small>{i.sub}</small>}
            </span>
            {i.result && <span className="ag-prog-r">{i.result}</span>}
          </li>
        ))}
      </ol>
      {p.summary && !running && <div className="ag-prog-sum">{p.summary}</div>}
    </Frame>
  );
});
