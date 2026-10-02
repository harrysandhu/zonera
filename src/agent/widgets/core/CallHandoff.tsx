import React, { useEffect, useState } from "react";
import { PhoneCall, PhoneOutgoing, Headphones, ArrowUpRight } from "lucide-react";
import { Avatar, Button } from "../../../ui";
import { openCall } from "../../../calls/api";
import { defineWidget, Frame, stateOf } from "../frame";
import type { CallHandoffAnswer, CallHandoffProps } from "./types";

// W42 · Hand a call to the voice agent. ask() it with status "ready" (Movie mode:
// "submit"), place the call with startOutboundCall(), then show() it again with
// status "dialing" → "live" and the callId so "Open call" works.
export const CallHandoff = defineWidget<CallHandoffProps, CallHandoffAnswer>(function CallHandoff(w) {
  const { p, active, answer } = w;
  const [t0] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const live = p.status === "live" || p.status === "dialing";
  useEffect(() => {
    if (!live) return;
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(t);
  }, [live]);
  const secs = Math.floor((now - t0) / 1000);
  const timer = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
  const st = p.status === "ready" ? stateOf(w, answer === "call" ? "Call started" : "Cancelled") : { state: live ? ("live" as const) : ("info" as const) };
  return (
    <Frame
      icon={<PhoneCall />}
      title={p.status === "ready" ? "Hand off to Zonera Voice" : p.status === "ended" ? "Call ended" : "Zonera Voice is on the call"}
      meta={p.status === "ready" ? undefined : timer}
      {...st}
      keepOpen={p.status !== "ready"}
      foot={
        p.status === "ready" ? (
          <>
            <Button data-auto="cancel" disabled={!active} onClick={() => w.respond("cancel")}>
              Not now
            </Button>
            <Button variant="accent" data-auto="submit" disabled={!active} onClick={() => w.respond("call")}>
              <PhoneOutgoing /> Call {p.name.split(" ")[0]}
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="ag-call">
        <div className="ag-call-who">
          <Avatar name={p.name} />
          <div>
            <b>{p.name}</b>
            <small className="mono">{p.phone}</small>
          </div>
          {live && (
            <span className="ag-call-wave" aria-hidden>
              {Array.from({ length: 14 }).map((_, i) => (
                <i key={i} style={{ animationDelay: `${(i % 7) * 0.09}s` }} />
              ))}
            </span>
          )}
        </div>
        <div className="ag-call-p">
          <span className="ag-lbl">Goal</span>
          <p>{p.purpose}</p>
        </div>
        <ol className="ag-call-s">
          {p.script.map((s, i) => (
            <li key={i}>
              <span className="mono">{String(i + 1).padStart(2, "0")}</span>
              {s}
            </li>
          ))}
        </ol>
        {p.outcome && <p className="ag-w-note">{p.outcome}</p>}
        {p.callId && (
          <div className="ag-call-a">
            <Button size="sm" onClick={() => openCall(p.callId!)}>
              <Headphones /> Listen in
            </Button>
            <Button size="sm" variant="ghost" onClick={() => openCall(p.callId!)}>
              Open in call center <ArrowUpRight />
            </Button>
          </div>
        )}
      </div>
    </Frame>
  );
});
