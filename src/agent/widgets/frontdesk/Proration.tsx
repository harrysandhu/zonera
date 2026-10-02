import React, { useMemo, useState } from "react";
import { Calculator, CalendarDays } from "lucide-react";
import { Button } from "../../../ui";
import { defineWidget, Frame, stateOf } from "../frame";
import { effectiveBillingDay, ordinal, prorate } from "./prorate";
import type { ProrationAnswer, ProrationProps } from "./types";
import { longLabel, mon, dayNum, usd } from "./util";
import "../../../styles/agent-frontdesk.css";

// W21 · Proration. Line-by-line math with real day counts (October has 31
// days), an editable effective date and, for move-ins, the billing day.
// Totals: due today (or refund) and the next bill.
// Movie mode: optional "type:date:<iso>", optional "bill:first" / "bill:anniversary", "submit".

export const Proration = defineWidget<ProrationProps, ProrationAnswer>(function Proration(w) {
  const { p, active, answer } = w;
  const [date, setDate] = useState(p.spec.date);
  const [billing, setBilling] = useState(p.spec.billing);
  const spec = { ...p.spec, date: date || p.spec.date, billing };
  const res = useMemo(() => prorate(spec), [date, billing, JSON.stringify(p.spec)]);
  const refund = res.total < 0;
  const end = p.spec.mode === "end";
  const day = +spec.date.slice(8, 10);
  const bd = effectiveBillingDay(spec);
  const totalText = usd(Math.abs(res.total));
  const cta = (p.cta ?? (refund ? "Approve refund of {total}" : "Approve {total}")).replace("{total}", totalText);
  const summary = answer ? `${answer.total < 0 ? "Refund " : ""}${usd(Math.abs(answer.total))}${answer.total < 0 ? "" : " due today"} · ${longLabel(answer.date).replace(/, \d{4}$/, "")}${answer.next ? ` · next bill ${usd(answer.next.amount)} on ${mon(answer.next.date)} ${dayNum(answer.next.date)}` : ""}` : undefined;

  return (
    <Frame
      icon={<Calculator />}
      title={p.title ?? "Proration"}
      meta={p.meta}
      tier={p.tier}
      {...stateOf(w, summary)}
      foot={
        <>
          {p.settle && <span className="agf-foot-sum faint">{p.settle}</span>}
          <Button variant="primary" data-auto="submit" disabled={!active} onClick={() => w.respond({ ...res, date: spec.date, billing })}>
            {cta}
          </Button>
        </>
      }
    >
      <div className="agf-pro">
        <div className="agf-pro-ctl">
          <label className="agf-date">
            <span className="ag-lbl">{p.dateLabel ?? "Effective date"}</span>
            <span className="agf-date-in">
              <CalendarDays />
              <input type="date" data-auto="date" value={date} min={p.min} max={p.max} disabled={!active || p.editableDate === false} onChange={e => e.target.value && setDate(e.target.value)} />
            </span>
          </label>
          {p.allowBilling && (
            <div className="agf-bill">
              <span className="ag-lbl">Billing</span>
              <div className="ag-seg" role="group" aria-label="Billing day">
                <button type="button" data-auto="bill:anniversary" aria-pressed={billing !== "first"} disabled={!active} onClick={() => setBilling("anniversary")}>
                  Bill on the {ordinal(day)}
                </button>
                <button type="button" data-auto="bill:first" aria-pressed={billing === "first"} disabled={!active} onClick={() => setBilling("first")}>
                  Align to the 1st
                </button>
              </div>
            </div>
          )}
          {!p.allowBilling && !end && <span className="agf-pro-cycle mono">Bills on the {ordinal(bd)} · {res.period.cycleDays}-day cycle</span>}
          {end && <span className="agf-pro-cycle mono">{res.period.cycleDays}-day cycle · {res.period.days} unused</span>}
        </div>
        <table className="agf-pro-t">
          <tbody>
            {res.rows.map(r => (
              <tr key={r.id} className={`is-${r.kind}`}>
                <td>
                  <b>{r.label}</b>
                  {r.span && <small className="mono">{r.span}</small>}
                </td>
                <td className="agf-pro-f mono">{r.formula}</td>
                <td className="num tnum">{r.kind === "waived" ? <s>{usd(0)}</s> : usd(r.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className={`agf-pro-total ${refund ? "is-refund" : ""}`}>
              <td colSpan={2}>{refund ? "Refund" : end ? "Due" : "Due today"}</td>
              <td className="num tnum">{totalText}</td>
            </tr>
            {res.next && (
              <tr className="agf-pro-next">
                <td colSpan={2}>
                  Next bill · {mon(res.next.date)} {dayNum(res.next.date)}
                </td>
                <td className="num tnum">{usd(res.next.amount)}</td>
              </tr>
            )}
          </tfoot>
        </table>
        {p.note && <p className="ag-w-note">{p.note}</p>}
      </div>
    </Frame>
  );
});
