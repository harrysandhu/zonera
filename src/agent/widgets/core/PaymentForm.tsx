import React, { useState } from "react";
import { Wallet, Banknote, CreditCard, Landmark, Nfc, Check, FileCheck2, Plus } from "lucide-react";
import { Button } from "../../../ui";
import { money } from "../../data";
import { defineWidget, Frame, Rows, stateOf, Toggle } from "../frame";
import type { PayMethod, PaymentFormAnswer, PaymentFormProps } from "./types";

const METHOD: Record<PayMethod, { label: string; icon: React.ReactNode }> = {
  cash: { label: "Cash", icon: <Banknote /> },
  card: { label: "Card on file", icon: <CreditCard /> },
  "new-card": { label: "New card", icon: <Plus /> },
  ach: { label: "ACH", icon: <Landmark /> },
  check: { label: "Check", icon: <FileCheck2 /> },
  reader: { label: "Card reader", icon: <Nfc /> },
};
export const methodLabel = (m: PayMethod) => METHOD[m]?.label ?? m;

// W14 · Amount, method, allocation, receipt delivery.
// Movie mode: optional "method:<m>", optional "receipt", then "submit".
export const PaymentForm = defineWidget<PaymentFormProps, PaymentFormAnswer>(function PaymentForm(w) {
  const { p, active, locked, answer } = w;
  const [method, setMethod] = useState<PayMethod>(p.method);
  const [sms, setSms] = useState(!!p.receiptTo);
  const [reader, setReader] = useState<"idle" | "wait" | "ok">("idle");
  const total = p.lines.reduce((s, l) => s + l.amount, 0);

  const submit = async () => {
    if (method === "reader") {
      setReader("wait");
      await new Promise(r => setTimeout(r, 1700));
      setReader("ok");
      await new Promise(r => setTimeout(r, 650));
    }
    w.respond({ method, amount: total, sms, card: method === "reader" || method === "card" ? p.card : undefined });
  };

  return (
    <Frame
      icon={<Wallet />}
      title={p.title ?? "Record payment"}
      meta={p.payer}
      tier="Ask first"
      {...stateOf(w, answer ? `${money(answer.amount)} · ${methodLabel(answer.method)}${answer.sms ? " · receipt texted" : ""}` : undefined)}
      foot={
        <>
          {p.receiptTo && <Toggle on={sms} onChange={setSms} disabled={!active} auto="receipt" label={<>Text receipt to <span className="mono">{p.receiptTo}</span></>} />}
          <Button variant="primary" data-auto="submit" disabled={!active || reader !== "idle"} onClick={submit}>
            {p.cta ?? `Record ${money(total)} ${method === "cash" ? "cash" : ""}`.trim()}
          </Button>
        </>
      }
    >
      <div className="ag-pay">
        <div className="ag-pay-amt">
          <span className="ag-lbl">Amount</span>
          <b className="tnum">{money(total)}</b>
          {p.after && <small>{p.after}</small>}
        </div>
        {!locked && (p.methods?.length ?? 0) > 1 && (
          <div className="ag-seg ag-seg--wrap" role="group" aria-label="Method">
            {p.methods!.map(m => (
              <button key={m} type="button" data-auto={"method:" + m} aria-pressed={method === m} disabled={!active} onClick={() => setMethod(m)}>
                {METHOD[m].icon}
                {METHOD[m].label}
              </button>
            ))}
          </div>
        )}
        <div>
          <span className="ag-lbl">Applied to</span>
          <Rows rows={p.lines.map(l => [l.label, money(l.amount)])} total={["Total", money(total)]} />
        </div>
        {reader !== "idle" && (
          <div className={`ag-reader ${reader === "ok" ? "is-ok" : ""}`}>
            {reader === "wait" ? <span className="ag-spin" /> : <Check />}
            <span>{reader === "wait" ? "Waiting for the card on the counter reader…" : `${p.card ?? "Card"} approved`}</span>
          </div>
        )}
      </div>
    </Frame>
  );
});
