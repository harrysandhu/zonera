import React from "react";
import { ReceiptText, Check, MessageSquare, Undo2, ArrowUpRight, Zap } from "lucide-react";
import { go } from "../../../state/store";
import { undoAction } from "../../engine";
import { money } from "../../data";
import { defineWidget, Frame, Rows } from "../frame";
import type { ReceiptProps } from "./types";

// W15 · Paid, new balance, what it triggered, where the receipt went, Undo.
export const Receipt = defineWidget<ReceiptProps, void>(function Receipt(w) {
  const { p, s } = w;
  const total = p.lines.reduce((a, l) => a + l.amount, 0);
  const action = p.actionId ? s.actions.find(a => a.id === p.actionId) : undefined;
  return (
    <Frame icon={<ReceiptText />} title={p.title ?? "Receipt"} meta={p.no} state="info" className={action?.undone ? "is-undone" : ""}>
      <div className="ag-receipt">
        <div className="ag-receipt-h">
          <div>
            <b>{p.payer}</b>
            <small>
              {p.unit && <span className="mono">{p.unit} · </span>}Zonera Alder Lake · Oct 2, 2026
            </small>
          </div>
          <div className="ag-receipt-amt tnum">{money(total)}</div>
        </div>
        <Rows rows={[...p.lines.map(l => [l.label, money(l.amount)] as [string, string]), ["Method", p.method]]} total={["New balance", money(p.balance)]} />
        {p.triggered && p.triggered.length > 0 && (
          <ul className="ag-trig">
            {p.triggered.map(t => (
              <li key={t}>
                <Zap />
                {t}
              </li>
            ))}
          </ul>
        )}
        <div className="ag-receipt-f">
          {p.paidThrough && (
            <span>
              <Check /> Paid through {p.paidThrough}
            </span>
          )}
          {p.sentTo && (
            <span>
              <MessageSquare /> Receipt texted to <span className="mono">{p.sentTo}</span>
            </span>
          )}
          <span className="ag-receipt-sp" />
          {p.links?.map(l => (
            <button key={l.route} type="button" className="ag-more" onClick={() => go(l.route)}>
              {l.label} <ArrowUpRight />
            </button>
          ))}
          {action?.undo && (
            <button type="button" className="ag-more" disabled={action.undone} onClick={() => undoAction(s, action.id)}>
              <Undo2 /> {action.undone ? "Undone" : "Undo"}
            </button>
          )}
        </div>
      </div>
    </Frame>
  );
});
