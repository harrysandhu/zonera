import React, { useEffect, useRef, useState } from "react";
import { CreditCard, Banknote, Check, Lock, LockOpen, MessageSquare, Mail, Sparkles, RotateCcw, CalendarX, CircleCheck, Receipt } from "lucide-react";
import { Button, Modal, Seg } from "../../../ui";
import { commit, toast, clock, askAgent, go } from "../../../state/store";
import { OPERATOR, type Tenant } from "../../../data/tenants";
import { UNIT_BY_ID } from "../../../data/facility";
import { openCharges, recordPayment, pushLedger, nextBillDate, UPDATE_LINKS, TODAY, clockMin, longDate } from "../../../data/ledger";
import { addComm } from "../../../data/comms";
import { MOVE_OUTS, scheduleMoveOut } from "../../../data/leases";
import { startOutboundCall } from "../../../calls/api";
import { ModalShell, money, Field } from "./ui";

const slug = (t: Tenant) => (t.unitIds[0] ?? "").toLowerCase().replace("-", "");
export const isLocked = (t: Tenant) => t.unitIds.some(id => UNIT_BY_ID.get(id)?.status === "overlocked");

// ---- Take payment ----------------------------------------------------------------

type Method = "cash" | "card" | "new" | "check" | "ach";

export function TakePaymentModal({ t, open, onClose, onViewLedger }: { t: Tenant; open: boolean; onClose: () => void; onViewLedger?: () => void }) {
  const locked = isLocked(t);
  const due = Math.max(0, t.balance);
  const hasCard = !!t.card;
  const [amount, setAmount] = useState(due ? due.toFixed(2) : t.rent.toFixed(2));
  const [method, setMethod] = useState<Method>(hasCard && t.autopay ? "card" : "cash");
  const [unlock, setUnlock] = useState(true);
  const [receipt, setReceipt] = useState(true);
  const [autopay, setAutopay] = useState(!t.autopay);
  const [check, setCheck] = useState("1042");
  const [done, setDone] = useState<null | { receipt: string; amount: number; method: string; unlocked: string[]; balance: number }>(null);

  useEffect(() => {
    if (open) {
      setAmount(due ? due.toFixed(2) : t.rent.toFixed(2));
      setMethod(hasCard && t.autopay ? "card" : "cash");
      setUnlock(true);
      setReceipt(true);
      setAutopay(!t.autopay);
      setDone(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, t.id]);

  const amt = Math.max(0, +amount || 0);
  const charges = openCharges(t);
  let left = amt;
  const applied = charges.map(c => {
    const a = Math.min(left, c.amount);
    left = +(left - a).toFixed(2);
    return { ...c, applied: a };
  });
  const after = +(t.balance - amt).toFixed(2);
  const methodLabel =
    method === "cash" ? "Cash at the office" : method === "card" ? `Card · ${t.card}` : method === "new" ? "Card · Visa •• 7713" : method === "check" ? `Check · #${check}` : "ACH · bank transfer";
  const short = method === "cash" ? "cash" : method === "check" ? "check" : method === "ach" ? "ACH" : "card";

  const submit = () => {
    if (!amt) return;
    const res = recordPayment(t, amt, methodLabel, { unlock });
    if (method === "new" && autopay) {
      t.card = "Visa •• 7713";
      t.autopay = true;
      pushLedger(t.id, { date: TODAY, min: clockMin(), kind: "info", text: "Autopay turned on", detail: "Visa •• 7713 saved", amount: 0, by: OPERATOR.name });
    } else if (autopay && !t.autopay) {
      UPDATE_LINKS.set(t.id, clock());
      addComm(t.id, { channel: "sms", dir: "out", who: "Zonera agent", body: `Here's a secure link to add a card and turn on autopay for ${t.unitIds[0]}: zonera.co/u/${slug(t)}. It takes about a minute.`, status: "Delivered" });
    }
    if (receipt) {
      addComm(t.id, {
        channel: "sms",
        dir: "out",
        who: "Zonera agent",
        body: `Thanks, ${t.first}. We received ${money(amt, true)} (${short}) for ${t.unitIds[0]}. Your balance is ${money(Math.max(0, res.balance), true)}${res.unlocked.length ? " and your gate code is active again" : ""}. Receipt ${res.receipt}.`,
        status: "Delivered",
      });
    }
    if (res.unlocked.length) addComm(t.id, { channel: "system", who: OPERATOR.name, body: `${res.unlocked.join(", ")} overlock removed · gate code restored` });
    commit();
    toast({
      title: "Payment recorded",
      body: `${money(amt, true)} ${short} from ${t.name}${res.unlocked.length ? ` · ${res.unlocked.join(", ")} unlocked` : ""}`,
      tone: "ok",
    });
    setDone({ receipt: res.receipt, amount: amt, method: methodLabel, unlocked: res.unlocked, balance: res.balance });
  };

  if (!open) return null;
  return (
    <Modal open={open} onClose={onClose}>
      {done ? (
        <ModalShell title="Payment recorded" onClose={onClose} icon={<CircleCheck />} foot={
          <>
            {onViewLedger && (
              <Button onClick={() => (onClose(), onViewLedger())}>
                <Receipt /> View ledger
              </Button>
            )}
            <Button variant="primary" onClick={onClose}>Done</Button>
          </>
        }>
          <div className="pb-done">
            <div className="pb-done-amt">{money(done.amount, true)}</div>
            <p className="muted">{done.method} · <span className="mono">{done.receipt}</span></p>
            <ul className="pb-done-list">
              <li><Check size={14} /> Applied to {t.unitIds[0]} · balance now <b className="tnum">{money(Math.max(0, done.balance), true)}</b>{done.balance < 0 ? ` (${money(-done.balance, true)} credit)` : ""}</li>
              {done.unlocked.length > 0 && <li><LockOpen size={14} /> Overlock removed on {done.unlocked.join(", ")} · gate code <span className="mono">{t.gateCode}</span> active</li>}
              {receipt && <li><MessageSquare size={14} /> Receipt texted to {t.phone}</li>}
              {autopay && method === "new" && <li><CreditCard size={14} /> Autopay on · Visa •• 7713 · next charge {longDate(nextBillDate(t))}</li>}
              {autopay && method !== "new" && <li><CreditCard size={14} /> Autopay link texted</li>}
            </ul>
          </div>
        </ModalShell>
      ) : (
        <ModalShell
          title="Take payment"
          sub={<>{t.name} · <span className="mono">{t.unitIds.join(", ")}</span>{t.daysLate ? ` · ${t.daysLate} days past due` : " · paid up"}</>}
          onClose={onClose}
          icon={<Banknote />}
          foot={
            <>
              <Button onClick={onClose}>Cancel</Button>
              <Button variant="primary" onClick={submit} disabled={!amt}>
                Record {money(amt, true)} payment
              </Button>
            </>
          }
        >
          <div className="pb-pay">
            <Field label="Amount">
              <div className="pb-amt">
                <span>$</span>
                <input className="tnum" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} aria-label="Amount" />
                <div className="pb-amt-q">
                  {due > 0 && <button type="button" aria-pressed={amt === due} onClick={() => setAmount(due.toFixed(2))}>Balance {money(due)}</button>}
                  <button type="button" aria-pressed={amt === t.rent && due !== t.rent} onClick={() => setAmount(t.rent.toFixed(2))}>One month {money(t.rent)}</button>
                </div>
              </div>
            </Field>
            <Field label="Method">
              <Seg<Method>
                value={method}
                onChange={setMethod}
                options={[
                  { value: "cash", label: "Cash" },
                  ...(hasCard ? [{ value: "card" as Method, label: t.card!.replace("Mastercard", "MC") }] : []),
                  { value: "new", label: "New card" },
                  { value: "check", label: "Check" },
                  { value: "ach", label: "ACH" },
                ]}
              />
            </Field>
            {method === "new" && (
              <div className="pb-cardform">
                <input className="z-input mono" defaultValue="4242 4242 4242 7713" aria-label="Card number" />
                <input className="z-input mono" defaultValue="09 / 29" aria-label="Expiry" />
                <input className="z-input mono" defaultValue="•••" aria-label="CVC" />
              </div>
            )}
            {method === "check" && (
              <Field label="Check number">
                <input className="z-input mono" value={check} onChange={e => setCheck(e.target.value)} style={{ maxWidth: 160 }} />
              </Field>
            )}
            {!hasCard && t.name === "Matthew Okafor" && method === "cash" && <p className="pb-hint">No card on file. Visa •• 3310 expired in August.</p>}

            <div className="pb-apply">
              <div className="pb-apply-h">
                <span>Applies to</span>
                <span className="mono faint">oldest first</span>
              </div>
              {applied.length === 0 && <div className="pb-apply-r faint"><span>Nothing open · goes to account credit</span><span /></div>}
              {applied.map((c, i) => (
                <div className={`pb-apply-r ${c.applied < c.amount ? "part" : ""}`} key={i}>
                  <span>
                    {c.text}
                    <small className="mono">{c.date.slice(5).replace("-", "/")}</small>
                  </span>
                  <span className="tnum">
                    {c.applied < c.amount && <s className="faint">{money(c.amount, true)}</s>} {money(c.applied, true)}
                  </span>
                </div>
              ))}
              <div className="pb-apply-t">
                <span>{after < 0 ? "Account credit after payment" : "Balance after payment"}</span>
                <b className="tnum">{money(Math.abs(after), true)}</b>
              </div>
            </div>

            <div className="pb-checks">
              {locked && (
                <label>
                  <input type="checkbox" checked={unlock} onChange={e => setUnlock(e.target.checked)} />
                  <span>
                    Remove overlock on {t.unitIds.join(", ")} and restore gate code
                    {after > 0 && <small> · only if paid in full</small>}
                  </span>
                </label>
              )}
              <label>
                <input type="checkbox" checked={receipt} onChange={e => setReceipt(e.target.checked)} />
                <span>Text receipt to {t.phone}</span>
              </label>
              {!t.autopay && (
                <label>
                  <input type="checkbox" checked={autopay} onChange={e => setAutopay(e.target.checked)} />
                  <span>{method === "new" ? "Save this card and turn on autopay" : "Text a link to set up autopay"}</span>
                </label>
              )}
            </div>
          </div>
        </ModalShell>
      )}
    </Modal>
  );
}

// ---- Send message (AI-drafted) ---------------------------------------------------------

type Purpose = "reminder" | "card" | "receipt" | "custom";

function draftFor(t: Tenant, p: Purpose, ch: "sms" | "email") {
  const unit = t.unitIds[0];
  const locked = isLocked(t);
  const next = nextBillDate(t);
  if (p === "reminder") {
    if (t.balance > 0)
      return {
        subject: `Your balance for ${unit}`,
        body: `Hi ${t.first}, your balance for ${unit} is ${money(t.balance)}${t.daysLate ? `, ${t.daysLate} days past due` : ""}. You can pay at zonera.co/p/${slug(t)} or at the office, 9–6 Mon–Sat.${locked ? " Your gate code turns back on as soon as it's paid." : ""}${ch === "email" ? `\n\nIf something's going on, reply here and we can set up a plan.\n\nPriya, Zonera Alder Lake` : ""}`,
      };
    return { subject: `You're all set on ${unit}`, body: `Hi ${t.first}, you're paid up on ${unit}. Your next charge is ${money(t.rent)} on ${longDate(next)}.` };
  }
  if (p === "card")
    return {
      subject: "Add a card for autopay",
      body: `Hi ${t.first}, here's a secure link to ${t.card ? "update your card" : "add a card and turn on autopay"} for ${unit}: zonera.co/u/${slug(t)}. It takes about a minute${t.autopay ? "" : ", and rent goes through on its own after that"}.`,
    };
  if (p === "receipt")
    return { subject: `Statement for ${unit}`, body: `Hi ${t.first}, your current balance for ${unit} is ${money(t.balance, true)}. Next charge: ${money(t.rent, true)} on ${longDate(next)}. Your full statement is at zonera.co/s/${slug(t)}.` };
  return { subject: `About ${unit}`, body: `Hi ${t.first}, ` };
}

export function MessageModal({ t, open, onClose, initial = "reminder" }: { t: Tenant; open: boolean; onClose: () => void; initial?: Purpose }) {
  const [ch, setCh] = useState<"sms" | "email">("sms");
  const [purpose, setPurpose] = useState<Purpose>(initial);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [typing, setTyping] = useState(false);
  const token = useRef(0);

  const draft = async (p: Purpose, c: "sms" | "email") => {
    const d = draftFor(t, p, c);
    setSubject(d.subject);
    const my = ++token.current;
    setTyping(true);
    setBody("");
    for (let i = 1; i <= d.body.length; i += 2) {
      if (token.current !== my) return;
      setBody(d.body.slice(0, i));
      await new Promise(r => setTimeout(r, 9));
    }
    if (token.current === my) {
      setBody(d.body);
      setTyping(false);
    }
  };

  useEffect(() => {
    if (open) {
      setPurpose(initial);
      setCh("sms");
      draft(initial, "sms");
    } else token.current++;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, t.id]);

  const send = () => {
    token.current++;
    addComm(t.id, { channel: ch, dir: "out", who: OPERATOR.name, subject: ch === "email" ? subject : undefined, body, status: "Delivered" });
    if (purpose === "card") UPDATE_LINKS.set(t.id, clock());
    t.lastContact = `Oct 2 · ${ch === "sms" ? "SMS" : "Email"}`;
    commit({ kind: "agent", text: `${ch === "sms" ? "Texted" : "Emailed"} ${t.name} · ${purpose === "reminder" ? "payment reminder" : purpose === "card" ? "card update link" : purpose === "receipt" ? "statement" : "message"}`, who: OPERATOR.name });
    toast({ title: ch === "sms" ? "Text sent" : "Email sent", body: `To ${t.name} · ${ch === "sms" ? t.phone : t.email}`, tone: "ok" });
    onClose();
  };

  if (!open) return null;
  const n = body.length;
  return (
    <Modal open={open} onClose={onClose}>
      <ModalShell
        title={`Message ${t.first}`}
        sub={ch === "sms" ? t.phone : t.email}
        icon={ch === "sms" ? <MessageSquare /> : <Mail />}
        onClose={onClose}
        foot={
          <>
            <span className="pb-mod-note mono">{ch === "sms" ? `${n} chars · ${Math.max(1, Math.ceil(n / 160))} segment${n > 160 ? "s" : ""}` : ""}</span>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={send} disabled={!body.trim() || typing}>
              Send {ch === "sms" ? "text" : "email"}
            </Button>
          </>
        }
      >
        <div className="pb-msg">
          <div className="pb-msg-row">
            <Seg value={ch} onChange={c => (setCh(c), draft(purpose, c))} options={[{ value: "sms", label: "SMS" }, { value: "email", label: "Email" }]} />
            <div className="ok-chips">
              {(
                [
                  ["reminder", t.balance > 0 ? "Payment reminder" : "Account update"],
                  ["card", t.autopay ? "Card update link" : "Autopay link"],
                  ["receipt", "Statement"],
                  ["custom", "Blank"],
                ] as [Purpose, string][]
              ).map(([v, l]) => (
                <button key={v} type="button" aria-pressed={purpose === v} onClick={() => (setPurpose(v), draft(v, ch))}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          {ch === "email" && <input className="z-input" value={subject} onChange={e => setSubject(e.target.value)} aria-label="Subject" />}
          <div className="pb-msg-box">
            <textarea className="z-input" rows={ch === "email" ? 7 : 5} value={body} onChange={e => (token.current++, setTyping(false), setBody(e.target.value))} aria-label="Message" />
            <div className="pb-msg-ai">
              <Sparkles size={13} />
              <span>{typing ? "Zonera is drafting from the account…" : `Drafted by Zonera from ${t.first}'s account. Edit anything.`}</span>
              <button type="button" onClick={() => draft(purpose, ch)} disabled={typing}>
                <RotateCcw size={12} /> Redraft
              </button>
            </div>
          </div>
        </div>
      </ModalShell>
    </Modal>
  );
}

// ---- Lock out / remove overlock ---------------------------------------------------------

export function setOverlock(t: Tenant, on: boolean) {
  const ids = t.unitIds.filter(id => UNIT_BY_ID.has(id));
  for (const id of ids) {
    const u = UNIT_BY_ID.get(id)!;
    u.status = on ? "overlocked" : t.balance > 0 ? "delinquent" : "occupied";
  }
  pushLedger(t.id, { date: TODAY, min: clockMin(), kind: "info", text: on ? "Unit overlocked" : "Overlock removed", detail: on ? "Gate code suspended until paid" : "Gate code restored", amount: 0, by: OPERATOR.name });
  addComm(t.id, { channel: "system", who: OPERATOR.name, body: on ? `${ids.join(", ")} overlocked · gate code suspended until paid` : `${ids.join(", ")} overlock removed · gate code restored` });
  if (on) addComm(t.id, { channel: "sms", dir: "out", who: "Zonera agent", body: `${ids.join(", ")} has been overlocked and your gate code is paused. Pay ${money(t.balance)} online or at the office to restore access.`, status: "Delivered" });
  commit({ kind: on ? "alert" : "gate", text: `${ids.join(", ")} ${on ? "overlocked · gate code suspended" : "overlock removed · gate code restored"} · ${t.name}`, who: OPERATOR.name });
  toast({ title: on ? `${ids.join(", ")} overlocked` : `Overlock removed on ${ids.join(", ")}`, body: on ? `Gate code suspended. ${t.first} was texted.` : `Gate code ${t.gateCode} works again.`, tone: on ? "warn" : "ok" });
}

export function LockModal({ t, open, onClose }: { t: Tenant; open: boolean; onClose: () => void }) {
  if (!open) return null;
  const locked = isLocked(t);
  return (
    <Modal open={open} onClose={onClose}>
      <ModalShell
        title={locked ? `Remove overlock on ${t.unitIds.join(", ")}` : `Overlock ${t.unitIds.join(", ")}`}
        sub={t.name}
        icon={locked ? <LockOpen /> : <Lock />}
        onClose={onClose}
        foot={
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant={locked ? "primary" : "danger"} onClick={() => (setOverlock(t, !locked), onClose())}>
              {locked ? "Remove overlock" : "Overlock unit"}
            </Button>
          </>
        }
      >
        <ul className="pb-steps">
          {locked ? (
            <>
              <li>Restores gate code <span className="mono">{t.gateCode}</span> at every gate</li>
              <li>Logs the removal on the ledger and the unit</li>
              {t.balance > 0 && <li className="warn">Balance is still {money(t.balance)}. The unit will show as past due.</li>}
            </>
          ) : (
            <>
              <li>Suspends gate code <span className="mono">{t.gateCode}</span> at every gate right away</li>
              <li>Adds the unit to today's overlock list for the lock check</li>
              <li>Texts {t.first} at {t.phone} with the balance and how to pay</li>
              {t.balance <= 0 && <li className="warn">{t.first} has no balance. Overlocking a paid-up tenant needs a reason on file.</li>}
            </>
          )}
        </ul>
      </ModalShell>
    </Modal>
  );
}

// ---- Schedule move-out ---------------------------------------------------------------

export function MoveOutModal({ t, open, onClose }: { t: Tenant; open: boolean; onClose: () => void }) {
  const [date, setDate] = useState("2026-10-31");
  const [reason, setReason] = useState("Moving away");
  if (!open) return null;
  const paidThrough = (() => {
    const nb = nextBillDate(t);
    const d = new Date(nb + "T12:00:00");
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  })();
  const extra = date > paidThrough;
  return (
    <Modal open={open} onClose={onClose}>
      <ModalShell
        title="Schedule move-out"
        sub={<>{t.name} · <span className="mono">{t.unitIds.join(", ")}</span></>}
        icon={<CalendarX />}
        onClose={onClose}
        foot={
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => {
                scheduleMoveOut(t, date, reason);
                toast({ title: "Move-out scheduled", body: `${t.unitIds[0]} · ${longDate(date)}. ${t.first} will get the checklist by email.`, tone: "ok" });
                onClose();
              }}
            >
              Schedule move-out
            </Button>
          </>
        }
      >
        <div className="pb-pay">
          <div className="pb-2col">
            <Field label="Move-out date">
              <input className="z-input" type="date" value={date} min={TODAY} onChange={e => setDate(e.target.value)} />
            </Field>
            <Field label="Reason">
              <select className="z-input" value={reason} onChange={e => setReason(e.target.value)}>
                {["Moving away", "No longer needs storage", "Moving to a different size", "Price", "Facility issue", "Other"].map(r => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="pb-apply">
            <div className="pb-apply-h"><span>Final bill preview</span><span className="mono faint">California, no proration required</span></div>
            <div className="pb-apply-r"><span>Paid through</span><span className="mono">{longDate(paidThrough)}</span></div>
            <div className="pb-apply-r"><span>Open balance</span><span className="tnum">{money(Math.max(0, t.balance), true)}</span></div>
            {extra && <div className="pb-apply-r"><span>Next charge before move-out</span><span className="tnum">{money(t.rent, true)}</span></div>}
            <div className="pb-apply-t"><span>Due before move-out</span><b className="tnum">{money(Math.max(0, t.balance) + (extra ? t.rent : 0), true)}</b></div>
          </div>
          <ul className="pb-steps">
            <li>Gate access ends {longDate(date)} at 10:00 pm</li>
            <li>Inspection added to the schedule; unit re-lists after it passes</li>
            <li>{t.first} gets a move-out checklist and the final statement by email</li>
          </ul>
        </div>
      </ModalShell>
    </Modal>
  );
}

// ---- One hook for every page that acts on a tenant ------------------------------------------

export function useTenantActions(t: Tenant | undefined, opts: { onViewLedger?: () => void } = {}) {
  const [modal, setModal] = useState<null | "pay" | "msg" | "card" | "lock" | "moveout">(null);
  const close = () => setModal(null);
  const call = (purpose?: string) => {
    if (!t) return;
    startOutboundCall({
      name: t.name,
      phone: t.phone,
      tenantId: t.id,
      purpose: purpose ?? (t.balance > 0 ? `collect the ${money(t.balance)} balance on ${t.unitIds[0]}` : `check in about ${t.unitIds[0]}`),
    });
  };
  const transfer = () => t && askAgent(t.name === "Sofia Reyes" ? "Move Sofia Reyes from C-108 to C-117, the 10×10" : `Transfer ${t.name} from ${t.unitIds[0]} to a different unit`);
  const ask = () => t && askAgent(`What's going on with ${t.name}'s account (${t.unitIds.join(", ")})?`);
  const el = t ? (
    <>
      <TakePaymentModal t={t} open={modal === "pay"} onClose={close} onViewLedger={opts.onViewLedger} />
      <MessageModal t={t} open={modal === "msg" || modal === "card"} initial={modal === "card" ? "card" : "reminder"} onClose={close} />
      <LockModal t={t} open={modal === "lock"} onClose={close} />
      <MoveOutModal t={t} open={modal === "moveout"} onClose={close} />
    </>
  ) : null;
  return {
    el,
    pay: () => setModal("pay"),
    message: () => setModal("msg"),
    cardLink: () => setModal("card"),
    lock: () => setModal("lock"),
    moveOut: () => setModal("moveout"),
    call,
    transfer,
    ask,
    hasMoveOut: t ? MOVE_OUTS.has(t.id) : false,
    viewLease: () => t && go("ops/leases/" + t.id),
  };
}
