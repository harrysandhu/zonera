import React, { useEffect, useState } from "react";
import { Users, ReceiptText, Wallet, ScanLine, IdCard, ShieldCheck, FileSignature, Check, ArrowUpRight, Banknote, CreditCard, Landmark, Nfc, MessageSquare, Circle, Clock3 } from "lucide-react";
import { Avatar, Button, Pill, UnitStatusPill } from "../../ui";
import { go, useDemo } from "../../state/store";
import { TENANT_BY_ID } from "../../data/tenants";
import { UNIT_BY_ID } from "../../data/facility";
import { money, protectionLabel, type LedgerRow } from "../data";
import { fmt } from "../../state/store";
import { Frame, Rows, stateOf, type WP } from "./index";

// ---------------------------------------------------------------- choice

export interface ChoiceOpt {
  id: string;
  title: string;
  sub?: string;
  meta?: string;
  metaTone?: "warn" | "bad" | "ok";
  badge?: string;
  avatar?: string;
  icon?: React.ReactNode;
}

export function Choice(w: WP<{ title: string; meta?: string; options: ChoiceOpt[]; layout?: "list" | "buttons"; detail?: [string, string][]; icon?: React.ReactNode; note?: string }, string>) {
  const { p, active, locked, answer } = w;
  const st = stateOf(w, "Chosen");
  const chosen = p.options.find(o => o.id === answer);
  if (p.layout === "buttons") {
    return (
      <Frame
        icon={p.icon ?? <Check />}
        title={p.title}
        meta={p.meta}
        {...st}
        doneLabel={chosen?.title}
        foot={
          !locked ? (
            <>
              {p.options
                .slice()
                .reverse()
                .map((o, i) => (
                  <Button key={o.id} data-auto={"opt:" + o.id} variant={i === p.options.length - 1 ? "primary" : "default"} disabled={!active} onClick={() => w.respond(o.id)}>
                    {o.title}
                  </Button>
                ))}
            </>
          ) : undefined
        }
      >
        {p.detail && <Rows rows={p.detail.map(([k, v]) => [k, v])} />}
        {p.note && <p className="ag-w-note">{p.note}</p>}
      </Frame>
    );
  }
  const list = locked && chosen ? [chosen] : p.options;
  return (
    <Frame icon={p.icon ?? <Users />} title={p.title} meta={locked ? undefined : p.meta} {...st} flush>
      <div className="ag-opts" role="listbox">
        {list.map(o => (
          <button
            key={o.id}
            type="button"
            role="option"
            aria-selected={answer === o.id}
            data-auto={"opt:" + o.id}
            className={`ag-opt ${answer === o.id ? "is-on" : ""}`}
            disabled={!active}
            onClick={() => w.respond(o.id)}
          >
            {o.avatar ? <Avatar name={o.avatar} size="sm" /> : o.icon ? <span className="ag-opt-ic">{o.icon}</span> : null}
            <span className="ag-opt-t">
              <b>
                {o.title}
                {o.badge && <span className="ag-badge">{o.badge}</span>}
              </b>
              {o.sub && <small>{o.sub}</small>}
            </span>
            {o.meta && <span className={`ag-opt-m ${o.metaTone ? "is-" + o.metaTone : ""}`}>{o.meta}</span>}
            {answer === o.id ? <Check className="ag-opt-check" /> : <span className="ag-opt-radio" />}
          </button>
        ))}
        {locked && chosen && p.options.length > 1 && <div className="ag-opts-more">{p.options.length - 1} other{p.options.length > 2 ? "s" : ""} not chosen</div>}
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------- tenant card

export function TenantCard(w: WP<{ id: string; title?: string }>) {
  useDemo();
  const t = TENANT_BY_ID.get(w.p.id);
  if (!t) return null;
  const u = UNIT_BY_ID.get(t.unitIds[0]);
  return (
    <Frame icon={<Users />} title={w.p.title ?? "Tenant"} meta={t.id} state="info">
      <div className="ag-tcard">
        <Avatar name={t.name} />
        <div className="ag-tcard-t">
          <b>{t.name}</b>
          <small>
            <span className="mono">{t.unitIds.join(", ")}</span> · {u ? u.size.replace("x", "×") : ""} · {t.phone}
          </small>
        </div>
        {u && <UnitStatusPill status={u.status} />}
      </div>
      <Rows
        rows={[
          ["Rent", money(t.rent) + "/mo"],
          ["Balance", <span className={t.balance > 0 ? "is-warn" : ""}>{money(t.balance)}</span>],
          ["Days late", t.daysLate ? String(t.daysLate) : "—"],
          ["Autopay", t.autopay ? t.card ?? "On" : "Off"],
        ]}
      />
      <button type="button" className="ag-more" onClick={() => go("ops/tenants/" + t.id)}>
        Open profile <ArrowUpRight />
      </button>
    </Frame>
  );
}

// ---------------------------------------------------------------- ledger

export function Ledger(w: WP<{ title: string; meta?: string; rows: LedgerRow[]; foot?: string }>) {
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
}

// ---------------------------------------------------------------- payment

export interface PaymentProps {
  title?: string;
  payer: string;
  amount: number;
  method: "cash" | "card" | "check" | "card-present";
  methods?: ("cash" | "card" | "check" | "card-present")[];
  lines: { label: string; amount: number }[];
  receiptTo?: string;
  cta?: string;
  card?: string; // card that the reader will read
  after?: string; // a line under the total, e.g. "Paid through Oct 13"
}

const METHOD: Record<string, { label: string; icon: React.ReactNode }> = {
  cash: { label: "Cash", icon: <Banknote /> },
  card: { label: "Card on file", icon: <CreditCard /> },
  check: { label: "Check", icon: <Landmark /> },
  "card-present": { label: "Card reader", icon: <Nfc /> },
};

export function Payment(w: WP<PaymentProps, { method: string; amount: number; sms: boolean; card?: string }>) {
  const { p, active, locked, answer } = w;
  const [method, setMethod] = useState(p.method);
  const [sms, setSms] = useState(!!p.receiptTo);
  const [reader, setReader] = useState<"idle" | "wait" | "ok">("idle");
  const total = p.lines.reduce((s, l) => s + l.amount, 0);
  const st = stateOf(w, answer ? `${money(answer.amount)} · ${METHOD[answer.method]?.label ?? answer.method}` : "Recorded");

  const submit = async () => {
    if (method === "card-present") {
      setReader("wait");
      await new Promise(r => setTimeout(r, 1700));
      setReader("ok");
      await new Promise(r => setTimeout(r, 650));
    }
    w.respond({ method, amount: total, sms, card: method === "card-present" ? p.card : undefined });
  };

  return (
    <Frame
      icon={<Wallet />}
      title={p.title ?? "Record payment"}
      meta={p.payer}
      {...st}
      foot={
        !locked ? (
          <>
            {p.receiptTo && (
              <label className="ag-check">
                <input type="checkbox" checked={sms} onChange={e => setSms(e.target.checked)} disabled={!active} />
                <span>
                  Text receipt to <span className="mono">{p.receiptTo}</span>
                </span>
              </label>
            )}
            <Button variant="primary" data-auto="submit" disabled={!active || reader !== "idle"} onClick={submit}>
              {p.cta ?? `Record ${money(total)}`}
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="ag-pay">
        <div className="ag-pay-amt">
          <span className="eyebrow">Amount</span>
          <b className="tnum">{money(total)}</b>
          {p.after && <small>{p.after}</small>}
        </div>
        {!locked && (p.methods?.length ?? 0) > 1 && (
          <div className="ag-seg" role="group" aria-label="Method">
            {p.methods!.map(m => (
              <button key={m} type="button" data-auto={"method:" + m} aria-pressed={method === m} disabled={!active} onClick={() => setMethod(m)}>
                {METHOD[m].icon}
                {METHOD[m].label}
              </button>
            ))}
          </div>
        )}
        <Rows rows={p.lines.map(l => [l.label, money(l.amount)])} total={["Total", money(total)]} />
        {reader !== "idle" && (
          <div className={`ag-reader ${reader === "ok" ? "is-ok" : ""}`}>
            {reader === "wait" ? <span className="ag-spin" /> : <Check />}
            <span>{reader === "wait" ? "Waiting for card on the counter reader…" : `${p.card ?? "Card"} approved`}</span>
          </div>
        )}
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------- receipt

export function Receipt(w: WP<{ no: string; payer: string; unit: string; lines: { label: string; amount: number }[]; method: string; balance: number; paidThrough?: string; sentTo?: string }>) {
  const { p } = w;
  const total = p.lines.reduce((s, l) => s + l.amount, 0);
  return (
    <Frame icon={<ReceiptText />} title="Receipt" meta={p.no} state="info">
      <div className="ag-receipt">
        <div className="ag-receipt-h">
          <div>
            <b>{p.payer}</b>
            <small>
              <span className="mono">{p.unit}</span> · Zonera Alder Lake · Oct 2, 2026
            </small>
          </div>
          <div className="ag-receipt-amt tnum">{money(total)}</div>
        </div>
        <Rows rows={[...p.lines.map(l => [l.label, money(l.amount)] as [string, string]), ["Method", p.method]]} total={["Balance", money(p.balance)]} />
        <div className="ag-receipt-f">
          {p.paidThrough && (
            <span>
              <Check /> Paid through {p.paidThrough}
            </span>
          )}
          {p.sentTo && (
            <span>
              <MessageSquare /> Texted to <span className="mono">{p.sentTo}</span> · delivered
            </span>
          )}
        </div>
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------- ID scan

export function IdScan(w: WP<{ name: string; fields: [string, string][]; doc: string }, boolean>) {
  const { p, active, locked } = w;
  const [phase, setPhase] = useState<"wait" | "scan" | "done">(locked ? "done" : "wait");
  const [n, setN] = useState(locked ? p.fields.length : 0);
  useEffect(() => {
    if (phase !== "scan") return;
    let i = 0;
    const t = window.setInterval(() => {
      i++;
      setN(i);
      if (i >= p.fields.length) {
        window.clearInterval(t);
        window.setTimeout(() => setPhase("done"), 300);
      }
    }, 260);
    return () => window.clearInterval(t);
  }, [phase]);
  const st = stateOf(w, "Verified");
  return (
    <Frame
      icon={<ScanLine />}
      title="Scan ID"
      meta={p.doc}
      {...st}
      foot={
        !locked ? (
          phase === "wait" ? (
            <Button variant="primary" data-auto="scan" disabled={!active} onClick={() => setPhase("scan")}>
              <ScanLine /> Scan license
            </Button>
          ) : (
            <Button variant="primary" data-auto="submit" disabled={!active || phase !== "done"} onClick={() => w.respond(true)}>
              Use these details
            </Button>
          )
        ) : undefined
      }
    >
      <div className={`ag-id ag-id--${phase}`}>
        <div className="ag-id-card" aria-hidden>
          <div className="ag-id-top">
            <span>DRIVER LICENSE</span>
            <span>CA</span>
          </div>
          <div className="ag-id-body">
            <div className="ag-id-photo">
              <IdCard />
            </div>
            <div className="ag-id-lines">
              <i style={{ width: "72%" }} />
              <i style={{ width: "54%" }} />
              <i style={{ width: "86%" }} />
              <i style={{ width: "40%" }} />
            </div>
          </div>
          <div className="ag-id-mrz">{phase === "wait" ? "Place license on the scanner" : "IDUSAD4471882<<<<<<<<<<<<"}</div>
          {phase === "scan" && <span className="ag-id-beam" />}
        </div>
        <dl className="ag-id-fields">
          {p.fields.map(([k, v], i) => (
            <div key={k} className={i < n ? "is-on" : ""}>
              <dt>{k}</dt>
              <dd>{i < n ? v : <span className="ag-skel" />}</dd>
            </div>
          ))}
          {phase === "done" && (
            <div className="is-on ag-id-ok">
              <dt>Checks</dt>
              <dd>
                <Check /> Barcode matches front · not expired · 18+
              </dd>
            </div>
          )}
        </dl>
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------- prefilled form

export interface FormField {
  key: string;
  label: string;
  value: string;
  required?: boolean;
  hint?: string;
  source?: string; // where the agent got it
  half?: boolean;
  placeholder?: string;
}

export function Form(w: WP<{ title: string; meta?: string; fields: FormField[]; cta: string; note?: string }, Record<string, string>>) {
  const { p, active, locked, answer } = w;
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(p.fields.map(f => [f.key, f.value])));
  const missing = p.fields.filter(f => f.required && !vals[f.key]?.trim());
  const st = stateOf(w, "Confirmed");
  if (locked) {
    const a = answer ?? vals;
    return (
      <Frame icon={<FileSignature />} title={p.title} {...st}>
        <Rows rows={p.fields.map(f => [f.label, a[f.key] || "—"])} />
      </Frame>
    );
  }
  return (
    <Frame
      icon={<FileSignature />}
      title={p.title}
      meta={p.meta}
      {...st}
      foot={
        <>
          {missing.length > 0 && <span className="ag-foot-hint">{missing.length} field{missing.length > 1 ? "s" : ""} left</span>}
          <Button variant="primary" data-auto="submit" disabled={!active || missing.length > 0} onClick={() => w.respond(vals)}>
            {p.cta}
          </Button>
        </>
      }
    >
      <div className="ag-form">
        {p.fields.map(f => (
          <label key={f.key} className={`ag-field ${f.half ? "is-half" : ""} ${f.required && !vals[f.key] ? "is-need" : ""}`}>
            <span className="ag-field-l">
              {f.label}
              {f.source && <em>{f.source}</em>}
              {f.required && !vals[f.key] && <em className="is-need">Needed</em>}
            </span>
            <input className="z-input" data-auto={f.key} value={vals[f.key]} placeholder={f.placeholder} disabled={!active} onChange={e => setVals(v => ({ ...v, [f.key]: e.target.value }))} />
            {f.hint && <small>{f.hint}</small>}
          </label>
        ))}
      </div>
      {p.note && <p className="ag-w-note">{p.note}</p>}
    </Frame>
  );
}

// ---------------------------------------------------------------- protection

export function Protection(w: WP<{ options: { id: number; label: string; cover: string; price: number; note: string; popular?: boolean }[]; recommended?: number }, number>) {
  const { p, active, locked, answer } = w;
  const st = stateOf(w, answer !== undefined ? protectionLabel(answer) : "Chosen");
  const opts = [...p.options, { id: 0, label: "Decline", cover: "Own policy", price: 0, note: "Needs proof of renter's or homeowner's insurance" }];
  return (
    <Frame icon={<ShieldCheck />} title="Protection plan" meta="Required by the lease: a plan or proof of insurance" {...st}>
      <div className={`ag-prot ${locked ? "is-locked" : ""}`}>
        {opts.map(o => (
          <button
            type="button"
            key={o.id}
            data-auto={"opt:" + o.id}
            className={`ag-prot-o ${answer === o.id ? "is-on" : ""} ${locked && answer !== o.id ? "is-dim" : ""}`}
            disabled={!active}
            onClick={() => w.respond(o.id)}
          >
            <span className="ag-prot-h">
              <b>{o.label}</b>
              {o.id === p.recommended && !locked && <span className="ag-badge">Most chosen</span>}
            </span>
            <span className="ag-prot-p tnum">{o.price ? `${money(o.price)}/mo` : "$0"}</span>
            <span className="ag-prot-c">{o.cover}</span>
            <small>{o.note}</small>
          </button>
        ))}
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------- e-sign live status

export interface EsignStep {
  label: string;
  at?: string;
  state: "done" | "active" | "todo";
}

export function Esign(w: WP<{ doc: string; title: string; pages: number; to: string; signer: string; steps: EsignStep[]; signed: boolean; summary: string[] }>) {
  const { p } = w;
  const running = !p.signed;
  return (
    <Frame icon={<FileSignature />} title={p.title} meta={p.doc} state={running ? "live" : "done"} doneLabel="Signed">
      <div className="ag-esign">
        <div className="ag-doc" aria-hidden>
          <div className="ag-doc-h">
            <b>Rental agreement</b>
            <span>{p.doc}</span>
          </div>
          <i style={{ width: "88%" }} />
          <i style={{ width: "94%" }} />
          <i style={{ width: "76%" }} />
          <i style={{ width: "90%" }} />
          <i style={{ width: "62%" }} />
          <div className="ag-doc-sig">
            <span className={p.signed ? "is-on" : ""}>{p.signer}</span>
            <small>Signature</small>
          </div>
          <div className="ag-doc-pg">1 / {p.pages}</div>
        </div>
        <div className="ag-esign-r">
          <ol className="ag-steps">
            {p.steps.map((s, i) => (
              <li key={i} className={`is-${s.state}`}>
                <span className="ag-steps-i">{s.state === "done" ? <Check /> : s.state === "active" ? <span className="ag-spin" /> : <Circle />}</span>
                <span className="ag-steps-l">{s.label}</span>
                <span className="mono">{s.at ?? ""}</span>
              </li>
            ))}
          </ol>
          <div className="ag-esign-sum">
            <span className="eyebrow">Plain-language summary sent with it</span>
            <ul>
              {p.summary.map(s => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
          <div className="ag-esign-to">
            <Clock3 /> Sent by text to <span className="mono">{p.to}</span>
          </div>
        </div>
      </div>
    </Frame>
  );
}

export { Pill };
