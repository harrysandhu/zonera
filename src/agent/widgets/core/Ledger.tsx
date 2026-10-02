import React from "react";
import { ReceiptText } from "lucide-react";
import { fmt } from "../../../state/store";
import { money } from "../../data";
import { defineWidget, Frame } from "../frame";
import type { LedgerProps } from "./types";

// W13 · Charges, payments and fees with a running balance. Display only.
export const Ledger = defineWidget<LedgerProps, void>(function Ledger(w) {
  const { rows } = w.p;
  const bal = rows[rows.length - 1]?.balance ?? 0;
  return (
    <Frame icon={<ReceiptText />} title={w.p.title} meta={w.p.meta} state="info" flush>
      <div className="ag-ledger">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th className="num">Charge</th>
              <th className="num">Paid</th>
              <th className="num">Balance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={r.flag ? "is-" + r.flag : ""}>
                <td className="mono">{fmt.short(r.date)}</td>
                <td>
                  {r.desc}
                  {r.flag === "dup" && <span className="ag-badge ag-badge--bad">Duplicate</span>}
                  {r.flag === "new" && <span className="ag-badge">New</span>}
                  {r.flag === "late" && <span className="ag-badge ag-badge--warn">Fee</span>}
                </td>
                <td className="num">{r.charge ? money(r.charge) : ""}</td>
                <td className="num">{r.payment ? money(r.payment) : ""}</td>
                <td className="num">{money(r.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="ag-ledger-f">
          <span>{w.p.foot ?? "Balance due"}</span>
          <b className={bal > 0 ? "is-warn" : ""}>{money(bal)}</b>
        </div>
      </div>
    </Frame>
  );
});
