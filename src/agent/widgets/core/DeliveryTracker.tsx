import React from "react";
import { Send, Check, CheckCheck, Clock3, CircleAlert, Reply } from "lucide-react";
import { Avatar } from "../../../ui";
import { defineWidget, Frame } from "../frame";
import type { DeliveryProps, DeliveryState } from "./types";

const ORDER: DeliveryState[] = ["queued", "sent", "delivered", "read", "replied"];
const LABEL: Record<DeliveryState, string> = { queued: "Queued", sent: "Sent", delivered: "Delivered", read: "Read", replied: "Replied", failed: "Failed" };

// W5 · Per-recipient delivery: queued → sent → delivered → read / replied.
// Use with ctx.show() and update row states.
export const DeliveryTracker = defineWidget<DeliveryProps, void>(function DeliveryTracker(w) {
  const { p } = w;
  const done = p.rows.filter(r => r.state !== "queued" && r.state !== "sent").length;
  const live = p.rows.some(r => r.state === "queued" || r.state === "sent");
  return (
    <Frame icon={<Send />} title={p.title ?? (p.channel === "email" ? "Emails" : p.channel === "call" ? "Calls" : "Texts")} meta={`${done} of ${p.rows.length} delivered`} state={live ? "live" : "info"} flush keepOpen>
      <ul className="ag-dlv">
        {p.rows.map(r => {
          const k = ORDER.indexOf(r.state);
          return (
            <li key={r.id} className={`is-${r.state}`}>
              <Avatar name={r.name} size="sm" />
              <span className="ag-dlv-t">
                <b>{r.name}</b>
                <small className="mono">{r.to}</small>
              </span>
              <span className="ag-dlv-bar" aria-hidden>
                {ORDER.slice(1, 4).map((s, i) => (
                  <i key={s} className={k >= i + 1 ? "is-on" : ""} />
                ))}
              </span>
              <span className="ag-dlv-s">
                {r.state === "queued" ? <Clock3 /> : r.state === "sent" ? <span className="ag-spin" /> : r.state === "failed" ? <CircleAlert /> : r.state === "replied" ? <Reply /> : r.state === "read" ? <CheckCheck /> : <Check />}
                {LABEL[r.state]}
                {r.at && <span className="mono">{r.at}</span>}
              </span>
              {r.reply && <q className="ag-dlv-reply">{r.reply}</q>}
            </li>
          );
        })}
      </ul>
    </Frame>
  );
});
