import React, { useState } from "react";
import { Download, MessageSquare, Lock, FileWarning, Phone, X, Gavel, ShieldCheck, Scale, CircleCheck } from "lucide-react";
import { Page, PageHeader, Section, Stat, StatRow } from "../kit";
import { Avatar, Button, Pill } from "../../ui";
import { BarChart } from "../../ui/charts";
import { askAgent, commit, go, toast, useDemo, clock } from "../../state/store";
import { TENANTS, OPERATOR, SEPT_LAST_YEAR, type Tenant } from "../../data/tenants";
import { UNIT_BY_ID } from "../../data/facility";
import { pushLedger, TODAY, addDays, clockMin, shortDate } from "../../data/ledger";
import { addComm } from "../../data/comms";
import { logLease } from "../../data/leases";
import { startOutboundCall } from "../../calls/api";
import { STAGES, LIEN, stageOf, nextLine, ADVANCE_LABEL, type Stage } from "./b/lien";
import { money } from "./b/ui";

const BUCKETS = [
  { label: "1–15", lo: 1, hi: 15 },
  { label: "16–30", lo: 16, hi: 30 },
  { label: "31–45", lo: 31, hi: 45 },
  { label: "46–60", lo: 46, hi: 60 },
  { label: "60+", lo: 61, hi: 9999 },
];

const isLocked = (t: Tenant) => t.unitIds.some(id => UNIT_BY_ID.get(id)?.status === "overlocked");

function overlock(t: Tenant) {
  for (const id of t.unitIds) {
    const u = UNIT_BY_ID.get(id);
    if (u) u.status = "overlocked";
  }
  pushLedger(t.id, { date: TODAY, min: clockMin(), kind: "info", text: "Unit overlocked", detail: "Gate code suspended until paid", amount: 0, by: OPERATOR.name });
  addComm(t.id, { channel: "system", who: OPERATOR.name, body: `${t.unitIds.join(", ")} overlocked · gate code suspended until paid` });
  addComm(t.id, { channel: "sms", dir: "out", who: "Zonera agent", body: `${t.unitIds[0]} has been overlocked and your gate code is paused. Pay ${money(t.balance)} online or at the office to restore access.`, status: "Delivered" });
  LIEN.delete(t.id);
}

function sendPrelien(t: Tenant) {
  LIEN.set(t.id, { stage: "prelien", sent: TODAY });
  addComm(t.id, { channel: "letter", dir: "out", who: "Zonera agent", subject: "Preliminary lien notice · §21703", body: `Itemized balance ${money(t.balance, true)}. Right to use ${t.unitIds[0]} ends ${shortDate(addDays(TODAY, 14))} unless paid. Sent by certified mail and email to the occupant and alternate address, with a blank Declaration in Opposition to Lien Sale.`, status: "Mailed" });
  logLease(t.id, { text: "Preliminary lien notice sent", who: OPERATOR.name, meta: "Certified mail + email · §21703" });
}

export default function DelinquencyPage(_p: { id?: string }) {
  useDemo();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const late = TENANTS.filter(t => t.daysLate > 0).sort((a, b) => b.daysLate - a.daysLate);
  const total = late.reduce((s, t) => s + t.balance, 0);
  const rentRoll = TENANTS.reduce((s, t) => s + t.rent, 0);
  const rate = total / rentRoll;
  const lockedN = late.filter(isLocked).length;
  const inLien = late.filter(t => ["prelien", "notice", "auction"].includes(stageOf(t))).length;
  const buckets = BUCKETS.map(b => {
    const ts = late.filter(t => t.daysLate >= b.lo && t.daysLate <= b.hi);
    return { ...b, n: ts.length, amt: ts.reduce((s, t) => s + t.balance, 0) };
  });
  const selected = late.filter(t => sel.has(t.id));
  const toggle = (id: string) => setSel(s => {
    const n = new Set(s);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const bulk = (what: "remind" | "overlock" | "prelien" | "call") => {
    const list = selected;
    if (!list.length) return;
    if (what === "remind") {
      for (const t of list) {
        addComm(t.id, { channel: "sms", dir: "out", who: "Zonera agent", body: `Hi ${t.first}, your balance for ${t.unitIds[0]} is ${money(t.balance)} (${t.daysLate} days past due). Pay at zonera.co/p/${t.unitIds[0].toLowerCase().replace("-", "")} or reply PLAN to set up a payment plan.`, status: "Delivered" });
        t.lastContact = "Oct 2 · SMS reminder";
      }
      commit({ kind: "agent", text: `Payment reminders texted to ${list.length} past-due tenants`, who: OPERATOR.name });
      toast({ title: `Reminders sent to ${list.length}`, body: "Personalized SMS with balance and pay link.", tone: "ok" });
    }
    if (what === "overlock") {
      const el = list.filter(t => !isLocked(t));
      el.forEach(overlock);
      commit({ kind: "alert", text: `Overlocked ${el.length} unit${el.length === 1 ? "" : "s"}: ${el.map(t => t.unitIds[0]).join(", ")}`, who: OPERATOR.name });
      toast({ title: `${el.length} unit${el.length === 1 ? "" : "s"} overlocked`, body: el.length ? `${el.map(t => t.unitIds[0]).join(", ")} · gate codes suspended, tenants texted` : "Selected units were already overlocked.", tone: "warn" });
    }
    if (what === "prelien") {
      const el = list.filter(t => t.daysLate >= 14 && ["pastdue", "overlocked"].includes(stageOf(t)) || (LIEN.get(t.id)?.draft ?? false));
      el.forEach(sendPrelien);
      commit({ kind: "alert", text: `Preliminary lien notices sent to ${el.length} tenant${el.length === 1 ? "" : "s"} (§21703)`, who: OPERATOR.name });
      toast({ title: `${el.length} pre-lien notice${el.length === 1 ? "" : "s"} sent`, body: el.length ? "Certified mail and email, 14 days to pay. Tracking numbers on each profile." : "Only tenants 14+ days late are eligible.", tone: el.length ? "ok" : "warn" });
    }
    if (what === "call") {
      startOutboundCall({ name: list.length === 1 ? list[0].name : `${list.length} past-due tenants`, phone: list.length === 1 ? list[0].phone : undefined, tenantId: list.length === 1 ? list[0].id : undefined, purpose: list.length === 1 ? `collect the ${money(list[0].balance)} balance` : "payment reminder campaign, one call at a time" });
    }
    setSel(new Set());
  };

  const advance = (t: Tenant) => {
    const st = stageOf(t);
    if (st === "pastdue") {
      overlock(t);
      commit({ kind: "alert", text: `${t.unitIds[0]} overlocked · ${t.name}`, who: OPERATOR.name });
      toast({ title: `${t.unitIds[0]} overlocked`, body: `Gate code suspended. ${t.first} was texted.`, tone: "warn" });
    } else if (st === "overlocked" || (st === "prelien" && LIEN.get(t.id)?.draft)) {
      if (t.daysLate < 14) {
        toast({ title: "Not eligible yet", body: `California requires 14 days past due before a preliminary lien notice. ${t.first} is at ${t.daysLate}.`, tone: "warn" });
        return;
      }
      sendPrelien(t);
      commit({ kind: "alert", text: `Preliminary lien notice sent · ${t.unitIds[0]} ${t.name}`, who: OPERATOR.name });
      toast({ title: "Pre-lien notice sent", body: `${t.name} · certified mail and email · cure by ${shortDate(addDays(TODAY, 14))}`, tone: "ok" });
    } else if (st === "prelien") {
      toast({ title: "Waiting on the notice period", body: `${t.first} has until ${shortDate(addDays(LIEN.get(t.id)!.sent!, 14))} to pay before a notice of sale can go out.`, tone: "info" });
    } else if (st === "notice") {
      askAgent(`Schedule the lien sale for ${t.name} (${t.unitIds[0]})`);
    } else {
      go("ops/tenants/" + t.id);
    }
  };

  return (
    <Page>
      <PageHeader
        title="Delinquency"
        sub={`${late.length} tenants past due · ${money(total)} outstanding`}
        ask="Run the delinquency sweep"
        actions={
          <Button icon={<Download />} onClick={() => toast({ title: "Aging report exported", body: `delinquency-aging-2026-10-02.csv · ${late.length} rows`, tone: "info" })}>
            Export
          </Button>
        }
      />

      <StatRow>
        <Stat label="Past due" value={money(total)} delta={`${late.length} tenants`} tone="warn" sub={`${((late.length / TENANTS.length) * 100).toFixed(1)}% of tenants`} />
        <Stat label="Delinquency rate" value={`${(rate * 100).toFixed(1)}%`} delta={`${rate > SEPT_LAST_YEAR.delinquency ? "+" : "−"}${(Math.abs(rate - SEPT_LAST_YEAR.delinquency) * 100).toFixed(1)} pts`} tone={rate > SEPT_LAST_YEAR.delinquency ? "bad" : "ok"} sub="of rent roll vs last Oct" />
        <Stat label="Overlocked" value={lockedN} delta={`${late.filter(t => !isLocked(t) && t.daysLate >= 15).length} eligible`} tone="neutral" sub="not yet locked" />
        <Stat label="In lien process" value={inLien} delta={`${late.filter(t => stageOf(t) === "auction").length} sale`} tone="neutral" sub="scheduled" />
        <Stat label="Recovered · Sep" value="$4,186" delta="78%" tone="ok" sub="of August past due" />
      </StatRow>

      <div className="pb-dq-grid">
        <Section title="Aging" action={<span className="pb-legend">balance by days past due</span>}>
          <BarChart data={buckets.map(b => ({ label: b.label, value: b.amt, note: `${b.label} days · ${b.n} tenant${b.n === 1 ? "" : "s"}` }))} format={v => money(v)} yFormat={v => "$" + (v >= 1000 ? (v / 1000).toFixed(1).replace(".0", "") + "k" : v)} height={176} />
          <table className="pb-aging">
            <tbody>
              {buckets.map(b => (
                <tr key={b.label}>
                  <td className="mono">{b.label} days</td>
                  <td className="num mono faint">{b.n}</td>
                  <td className="num">{money(b.amt)}</td>
                  <td className="num mono faint">{total ? Math.round((b.amt / total) * 100) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="California lien process" action={<span className="pb-legend">Bus. &amp; Prof. Code §§21700–21716</span>}>
          <ol className="pb-law">
            <li>
              <span className="mono">Day 1</span>
              <div><b>Rent due</b><small>Reminder by SMS on the due date.</small></div>
            </li>
            <li>
              <span className="mono">Day 6</span>
              <div><b>Late fee</b><small>$45 per the rental agreement.</small></div>
            </li>
            <li>
              <span className="mono">Day 14</span>
              <div><b>Preliminary lien notice</b><small>Eligible after 14 consecutive days unpaid. Itemized balance, a termination date at least 14 days out, and a blank Declaration in Opposition. Sent to the occupant and the alternate address (§§21703–21704).</small></div>
            </li>
            <li>
              <span className="mono">+14 days</span>
              <div><b>Notice of lien sale</b><small>If unpaid by the date in the preliminary notice. The occupant can stop the sale by returning the declaration (§§21705–21706).</small></div>
            </li>
            <li>
              <span className="mono">Sale</span>
              <div><b>Public sale, online allowed</b><small>Advertised in advance; any surplus is held for the occupant (§§21707–21708).</small></div>
            </li>
          </ol>
          <ul className="pb-checks-law">
            <li><ShieldCheck size={14} /> SCRA active-duty check before any sale</li>
            <li><ShieldCheck size={14} /> DMV lienholder search for vehicles and boats</li>
            <li><Scale size={14} /> Zonera drafts notices; a person approves every lien step</li>
          </ul>
        </Section>
      </div>

      <section className="pb-board-wrap">
        <div className="pb-board-h">
          <div>
            <h2>Lien pipeline</h2>
            <span className="faint">Select tenants to act on them together. Paying in full removes them from the board.</span>
          </div>
          {selected.length > 0 ? (
            <div className="pb-bulk">
              <b>{selected.length} selected</b>
              <Button size="sm" icon={<MessageSquare />} onClick={() => bulk("remind")}>Text reminder</Button>
              <Button size="sm" icon={<Lock />} onClick={() => bulk("overlock")}>Overlock</Button>
              <Button size="sm" icon={<FileWarning />} onClick={() => bulk("prelien")}>Send pre-lien notices</Button>
              <Button size="sm" icon={<Phone />} onClick={() => bulk("call")}>Call with Zonera Voice</Button>
              <Button size="sm" variant="ghost" iconOnly icon={<X />} aria-label="Clear selection" onClick={() => setSel(new Set())} />
            </div>
          ) : (
            <Button size="sm" onClick={() => setSel(new Set(late.filter(t => stageOf(t) === "pastdue").map(t => t.id)))}>Select all past due</Button>
          )}
        </div>
        <div className="pb-board">
          {STAGES.map(st => {
            const col = late.filter(t => stageOf(t) === st.id);
            const allOn = col.length > 0 && col.every(t => sel.has(t.id));
            return (
              <div className="pb-lane" key={st.id}>
                <div className="pb-lane-h">
                  <label className="pb-lane-all" title="Select column">
                    <input
                      type="checkbox"
                      checked={allOn}
                      disabled={!col.length}
                      onChange={() =>
                        setSel(s => {
                          const n = new Set(s);
                          col.forEach(t => (allOn ? n.delete(t.id) : n.add(t.id)));
                          return n;
                        })
                      }
                    />
                  </label>
                  <div>
                    <b>{st.label}</b>
                    <small>{st.hint}</small>
                  </div>
                  <span className="pb-lane-n mono">{col.length}</span>
                </div>
                <div className="pb-lane-sum mono">{money(col.reduce((s, t) => s + t.balance, 0))}</div>
                <div className="pb-lane-b">
                  {col.map(t => {
                    const nx = nextLine(t);
                    return (
                      <article key={t.id} className={`pb-card ${sel.has(t.id) ? "on" : ""} ${t.name === "Dana Whitfield" || t.name === "Matthew Okafor" ? "pb-card--story" : ""}`}>
                        <div className="pb-card-h">
                          <input type="checkbox" checked={sel.has(t.id)} onChange={() => toggle(t.id)} aria-label={`Select ${t.name}`} />
                          <button className="pb-card-who" onClick={() => go("ops/tenants/" + t.id)}>
                            <Avatar name={t.name} size="sm" />
                            <b>{t.name}</b>
                          </button>
                        </div>
                        <div className="pb-card-m">
                          <span className="mono">{t.unitIds[0]}</span>
                          <span className="tnum"><b>{money(t.balance)}</b></span>
                          <span className={`mono ${t.daysLate > 30 ? "pb-bad" : "pb-warn"}`}>{t.daysLate}d</span>
                        </div>
                        <div className={`pb-card-n ${nx.tone ? "pb-card-n--" + nx.tone : ""}`}>{nx.text}</div>
                        {st.id !== "auction" && (
                          <button className="pb-card-a" onClick={() => advance(t)}>
                            {st.id === "prelien" && LIEN.get(t.id)?.draft ? "Approve & send" : ADVANCE_LABEL[st.id]} →
                          </button>
                        )}
                        {st.id === "auction" && (
                          <button className="pb-card-a" onClick={() => go("ops/tenants/" + t.id)}>
                            <Gavel size={12} /> Open file →
                          </button>
                        )}
                      </article>
                    );
                  })}
                  {col.length === 0 && (
                    <div className="pb-lane-empty">
                      <CircleCheck size={14} /> Nobody here
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <p className="pb-foot-note">Last sweep by Zonera at 6:00 am · next at 6:00 am tomorrow · {clock()} now</p>
    </Page>
  );
}

export type { Stage };
