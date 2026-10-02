import React from "react";
import { GitCompareArrows, ArrowRight } from "lucide-react";
import { Button } from "../../../ui";
import { defineWidget, Frame, stateOf } from "../frame";
import type { DiffAnswer, DiffProps } from "./types";

// W39 · Before / after for a record change. Movie mode: "submit" or "cancel".
export const Diff = defineWidget<DiffProps, DiffAnswer>(function Diff(w) {
  const { p, active, answer } = w;
  return (
    <Frame
      icon={<GitCompareArrows />}
      title={p.title}
      meta={p.meta}
      tier="Ask first"
      {...stateOf(w, answer === "approve" ? `${p.rows.length} change${p.rows.length > 1 ? "s" : ""} approved` : "Cancelled")}
      flush
      foot={
        <>
          <Button data-auto="cancel" disabled={!active} onClick={() => w.respond("cancel")}>
            {p.secondary ?? "Cancel"}
          </Button>
          <Button variant="primary" data-auto="submit" disabled={!active} onClick={() => w.respond("approve")}>
            {p.cta ?? "Approve change"}
          </Button>
        </>
      }
    >
      <div className="ag-diff">
        {p.rows.map(r => (
          <div key={r.field} className="ag-diff-r">
            <span className="ag-diff-f">{r.field}</span>
            <span className="ag-diff-b">{r.before || "—"}</span>
            <ArrowRight />
            <span className="ag-diff-a">{r.after || "—"}</span>
          </div>
        ))}
        {p.note && <p className="ag-w-note">{p.note}</p>}
      </div>
    </Frame>
  );
});
