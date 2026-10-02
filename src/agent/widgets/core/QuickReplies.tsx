import React, { useState } from "react";
import { MessageCircleQuestion, CornerDownLeft } from "lucide-react";
import { defineWidget, Frame, stateOf } from "../frame";
import type { QuickRepliesAnswer, QuickRepliesProps } from "./types";

// W1 · One question with 2–5 reply chips and an optional free-text reply.
// Movie mode: "opt:<value>", or "type:other:<text>" then "submit".
export const QuickReplies = defineWidget<QuickRepliesProps, QuickRepliesAnswer>(function QuickReplies(w) {
  const { p, active, locked, answer } = w;
  const [other, setOther] = useState("");
  const chosen = p.options.find(o => o.value === answer)?.label ?? answer;
  return (
    <Frame icon={<MessageCircleQuestion />} title={p.question} {...stateOf(w, chosen)} className="ag-qr">
      {!locked && (
        <div className="ag-qr-b">
          <div className="ag-chips">
            {p.options.map(o => (
              <button key={o.value} type="button" className="ag-chip" data-auto={"opt:" + o.value} disabled={!active} onClick={() => w.respond(o.value)} title={o.hint}>
                {o.label}
                {o.hint && <small>{o.hint}</small>}
              </button>
            ))}
          </div>
          {p.other && (
            <form
              className="ag-qr-other"
              onSubmit={e => {
                e.preventDefault();
                if (other.trim()) w.respond(other.trim());
              }}
            >
              <input className="z-input" data-auto="other" placeholder={p.other} value={other} disabled={!active} onChange={e => setOther(e.target.value)} />
              <button type="submit" className="z-btn z-btn--sm" data-auto="submit" disabled={!active || !other.trim()} aria-label="Reply">
                <CornerDownLeft />
              </button>
            </form>
          )}
        </div>
      )}
    </Frame>
  );
});
