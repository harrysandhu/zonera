import React, { useMemo, useState } from "react";
import {
  ArrowLeft, Phone, MessageSquare, Banknote, Copy, Eye, EyeOff, Sparkles, Lock, LockOpen, ArrowRightLeft, CalendarX, FileText, KeyRound, Mail, StickyNote,
  PhoneIncoming, PhoneOutgoing, Bell, CreditCard, CircleAlert, ArrowUpRight, Download, ShieldCheck, Image, Receipt, FileSignature, IdCard, Play, Pause, ChevronDown, ChevronRight, Check,
  DoorOpen, CircleSlash, ScrollText, Send,
} from "lucide-react";
import { Avatar, Button, Pill, StatusSwatch, Modal, type Tone } from "../../../ui";
import { Section, KV, Chips } from "../../kit";
import { FacilityView } from "../../../three/FacilityView";
import { go, nav, useDemo, toast, commit, askAgent } from "../../../state/store";
import { UNIT_BY_ID, SIZE_INFO } from "../../../data/facility";
import { OPERATOR, type Tenant } from "../../../data/tenants";
import { ledgerFor, lifetime, nextBillDate, billingDay, longDate, shortDate, fmtMin, paymentRecord, openCharges, waiveFee, PLAN_NAME, PREMIUM, TODAY, ordinal, UPDATE_LINKS, daysBetween, type LedgerEntry } from "../../../data/ledger";
import { commsFor, addComm, CHANNEL_LABEL, type Comm } from "../../../data/comms";
import { leaseFor, MOVE_OUTS, sizeLabel } from "../../../data/leases";
import { startOutboundCall } from "../../../calls/api";
import { useTenantActions, isLocked } from "./actions";
import { gateHistory, readFor, documentsFor, type StepAction } from "./insight";
import { money, tenure, Tabs, Menu, AgentBox, ModalShell } from "./ui";

type Tab = "overview" | "ledger" | "lease" | "gate" | "comms" | "docs";

export function TenantProfile({ t }: { t: Tenant }) {
  useDemo();
  const [tab, setTab] = useState<Tab>((nav.params.tab as Tab) ?? "overview");
  const [reveal, setReveal] = useState(false);
  const acts = useTenantActions(t, { onViewLedger: () => setTab("ledger") });
  const unitId = t.unitIds[0];
  const u = UNIT_BY_ID.get(unitId);
  const locked = isLocked(t);
  const ledger = ledgerFor(t);
  const comms = commsFor(t);
  const mo = MOVE_OUTS.get(t.id);
  const next = nextBillDate(t);
  const lease = leaseFor(t);
  const lastGate = gateHistory(t).find(g => g.kind !== "Denied");

  const copy = (v: string, what: string) => {
    try {
      navigator.clipboard?.writeText(v);
    } catch {
      /* sandboxed */
    }
    toast({ title: `${what} copied`, body: v, tone: "info" }, 2200);
  };

  const tags: { label: string; tone: Tone }[] = [];
  if (locked) tags.push({ label: "Overlocked", tone: "bad" });
  if (t.daysLate) tags.push({ label: `${t.daysLate} days past due`, tone: t.daysLate > 30 ? "bad" : "warn" });
  if (mo) tags.push({ label: `Moving out ${shortDate(mo.date)}`, tone: "violet" });
  tags.push(t.autopay ? { label: "Autopay", tone: "neutral" } : { label: "Autopay off", tone: "neutral" });
  if (t.business) tags.push({ label: "Business", tone: "info" });
  if (t.name === "Matthew Okafor") tags.push({ label: "Pays cash", tone: "neutral" });
  if (t.name === "Sofia Reyes") tags.push({ label: "Upsize lead", tone: "info" });

  return (
    <div className="ok-page pb-prof">
      <button className="pb-back" onClick={() => go("ops/tenants")}>
        <ArrowLeft size={14} /> Tenants
      </button>

      <header className="pb-prof-h">
        <Avatar name={t.name} size="lg" className="pb-prof-av" />
        <div className="pb-prof-id">
          <div className="pb-prof-name">
            <h1>{t.name}</h1>
            <span className="mono faint">{t.id}</span>
          </div>
          <div className="pb-prof-contact">
            <button onClick={() => copy(t.phone, "Phone")} title="Copy phone">
              <Phone size={13} />
              <span className="mono">{t.phone}</span>
              <Copy size={12} className="pb-copy" />
            </button>
            <button onClick={() => copy(t.email, "Email")} title="Copy email">
              <Mail size={13} />
              <span>{t.email}</span>
              <Copy size={12} className="pb-copy" />
            </button>
            {t.business && <span className="pb-prof-biz">{t.business}</span>}
            <span className="faint">Since {longDate(t.moveIn)} · {tenure(t.moveIn)}</span>
          </div>
          <div className="pb-prof-tags">
            {tags.map(g => (
              <Pill key={g.label} tone={g.tone} dot={g.tone !== "neutral"}>
                {g.label}
              </Pill>
            ))}
          </div>
        </div>
        <div className="pb-prof-act">
          <button className="ok-ask" onClick={acts.ask}>
            <Sparkles size={14} />
            <span>Ask Zonera about {t.first}</span>
          </button>
          <Button onClick={acts.message} icon={<MessageSquare />}>Message</Button>
          <Button onClick={() => acts.call()} icon={<Phone />}>Call</Button>
          <Menu
            items={[
              { label: locked ? "Remove overlock" : "Lock out (overlock)", icon: locked ? <LockOpen size={15} /> : <Lock size={15} />, onClick: acts.lock, danger: !locked },
              { label: "Transfer to another unit", icon: <ArrowRightLeft size={15} />, onClick: acts.transfer, hint: "Agent" },
              { label: mo ? "Change move-out" : "Schedule move-out", icon: <CalendarX size={15} />, onClick: acts.moveOut },
              null,
              { label: "Send card update link", icon: <CreditCard size={15} />, onClick: acts.cardLink },
              { label: "Open lease", icon: <FileSignature size={15} />, onClick: acts.viewLease },
              { label: "View on digital twin", icon: <ArrowUpRight size={15} />, onClick: () => go("ops/facility", { unit: unitId }) },
            ]}
          />
          <Button variant="primary" onClick={acts.pay} icon={<Banknote />}>
            Take payment
          </Button>
        </div>
      </header>

      <div className="pb-facts">
        <div className={`pb-fact ${t.balance > 0 ? "pb-fact--due" : ""}`}>
          <span className="pb-fact-l">Balance</span>
          <b className="pb-fact-v">{money(t.balance, true)}</b>
          <span className="pb-fact-s">{t.balance > 0 ? <><i className="pb-dot pb-dot--bad" />{t.daysLate} days late</> : t.balance < 0 ? "Account credit" : <><i className="pb-dot pb-dot--ok" />Paid up</>}</span>
        </div>
        <div className="pb-fact">
          <span className="pb-fact-l">Monthly</span>
          <b className="pb-fact-v">{money(t.rent)}</b>
          <span className="pb-fact-s">Due the {ordinal(billingDay(t))} · next {shortDate(next)}</span>
        </div>
        <div className="pb-fact">
          <span className="pb-fact-l">Unit{t.unitIds.length > 1 ? "s" : ""}</span>
          <b className="pb-fact-v mono">{t.unitIds.join(", ")}</b>
          <span className="pb-fact-s">{u && <StatusSwatch status={u.status} />} <span className="faint">{u ? u.size.replace("x", "×") : ""}</span></span>
        </div>
        <div className="pb-fact">
          <span className="pb-fact-l">Gate code</span>
          <b className="pb-fact-v mono pb-code">
            <span>{reveal ? t.gateCode : "••••"}</span>
            <button aria-label={reveal ? "Hide code" : "Show code"} onClick={() => setReveal(r => !r)}>
              {reveal ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </b>
          <span className="pb-fact-s">{locked ? <><i className="pb-dot pb-dot--bad" />Suspended</> : <><i className="pb-dot pb-dot--ok" />Active{lastGate ? ` · used ${lastGate.date === TODAY ? fmtMin(lastGate.min) : shortDate(lastGate.date)}` : ""}</>}</span>
        </div>
        <div className="pb-fact">
          <span className="pb-fact-l">Protection</span>
          <b className="pb-fact-v">{PLAN_NAME[t.protection]}</b>
          <span className="pb-fact-s">{t.protection ? `${money(t.protection)} coverage · ${money(PREMIUM[t.protection])}/mo` : "Own insurance"}</span>
        </div>
        <div className="pb-fact">
          <span className="pb-fact-l">Autopay</span>
          <b className="pb-fact-v">{t.autopay ? "On" : "Off"}</b>
          <span className="pb-fact-s">{t.autopay ? t.card : t.name === "Matthew Okafor" ? "Card expired 08/26" : t.card ? `${t.card} saved` : "No card on file"}</span>
        </div>
      </div>

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        items={[
          { value: "overview", label: "Overview" },
          { value: "ledger", label: "Ledger", count: ledger.filter(e => e.kind !== "info").length },
          { value: "lease", label: "Lease" },
          { value: "gate", label: "Gate activity" },
          { value: "comms", label: "Communications", count: comms.length },
          { value: "docs", label: "Documents", count: documentsFor(t).length },
        ]}
      />

      {tab === "overview" && <OverviewTab t={t} acts={acts} setTab={setTab} />}
      {tab === "ledger" && <LedgerTab t={t} ledger={ledger} acts={acts} />}
      {tab === "lease" && <LeaseTab t={t} lease={lease} />}
      {tab === "gate" && <GateTab t={t} />}
      {tab === "comms" && <CommsTab t={t} comms={comms} acts={acts} />}
      {tab === "docs" && <DocsTab t={t} />}
      {acts.el}
    </div>
  );
}

type Acts = ReturnType<typeof useTenantActions>;

// ---- Overview -------------------------------------------------------------------------

function OverviewTab({ t, acts, setTab }: { t: Tenant; acts: Acts; setTab: (t: Tab) => void }) {
  const unitId = t.unitIds[0];
  const u = UNIT_BY_ID.get(unitId);
  const read = readFor(t);
  const record = paymentRecord(t, 12);
  const lease = leaseFor(t);
  const run = (a: StepAction) => {
    if (a === "pay") acts.pay();
    else if (a === "card") acts.cardLink();
    else if (a === "call") acts.call();
    else if (a === "message") acts.message();
    else if (a === "transfer") acts.transfer();
    else if (a === "moveout") askAgent(`Move out ${t.name} from ${unitId} after today's inspection`);
    else if (a === "lien") go("ops/delinquency");
    else if (a === "callAlt") startOutboundCall({ name: lease.alt.name, phone: lease.alt.phone, tenantId: t.id, purpose: `reach ${t.first} about the ${unitId} balance (alternate contact)` });
    else if (a === "plan") askAgent(`Offer ${t.name} a payment plan for the ${money(t.balance)} balance on ${unitId}`);
    else if (a === "rates") go("ops/rates");
    else if (a === "lock") acts.lock();
  };

  const timeline = useMemo(() => {
    const items: { date: string; min: number; icon: React.ReactNode; text: React.ReactNode; tone?: string }[] = [];
    for (const e of ledgerFor(t)) {
      if (e.kind === "payment") items.push({ date: e.date, min: e.min, icon: <CreditCard />, text: <><b>Paid {money(-e.amount, true)}</b> · {(e.method ?? "").replace("Autopay · ", "autopay · ")}</>, tone: "ok" });
      else if (e.kind === "failed") items.push({ date: e.date, min: e.min, icon: <CircleAlert />, text: <><b>Autopay declined</b> · {e.detail}</>, tone: "bad" });
      else if (e.kind === "fee") items.push({ date: e.date, min: e.min, icon: <Receipt />, text: <><b>Late fee</b> {money(e.amount)}</> });
      else if (e.kind === "info" && e.text !== "Moved in") items.push({ date: e.date, min: e.min, icon: e.text.includes("lock") ? <Lock /> : <ScrollText />, text: <><b>{e.text}</b>{e.detail ? ` · ${e.detail}` : ""}</>, tone: e.text === "Unit overlocked" ? "bad" : undefined });
      else if (e.kind === "info") items.push({ date: e.date, min: e.min, icon: <DoorOpen />, text: <><b>Moved in</b> · {e.detail}</> });
    }
    for (const c of commsFor(t)) {
      if (c.channel === "system") continue;
      const icon = c.channel === "call" ? (c.dir === "in" ? <PhoneIncoming /> : <PhoneOutgoing />) : c.channel === "sms" ? <MessageSquare /> : c.channel === "email" ? <Mail /> : c.channel === "note" ? <StickyNote /> : <Send />;
      const label = c.channel === "call" ? `${c.dir === "in" ? "Inbound" : "AI"} call · ${c.call?.outcome}` : c.channel === "note" ? `Note from ${c.who}` : `${CHANNEL_LABEL[c.channel]} ${c.dir === "in" ? `from ${t.first}` : "sent"}`;
      items.push({ date: c.date, min: c.min, icon, text: <><b>{label}</b> · <span className="pb-tl-q">{c.subject ?? c.call?.summary ?? c.body}</span></>, tone: c.who.startsWith("Zonera") ? "agent" : undefined });
    }
    return items.sort((a, b) => (a.date === b.date ? b.min - a.min : a.date < b.date ? 1 : -1)).slice(0, 9);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, t.balance, commsFor(t).length, ledgerFor(t).length]);

  return (
    <div className="pb-ov">
      <div className="pb-col">
        <AgentBox title="Zonera's read" action={<span className="pb-agent-t mono">updated {fmtMin(9 * 60 + 40)}</span>}>
          {read.lines.map((l, i) => (
            <p key={i}>{l}</p>
          ))}
          {read.steps.length > 0 && (
            <ul className="pb-steps-ai">
              {read.steps.map((s, i) => (
                <li key={i}>
                  <span className="pb-step-n mono">{i + 1}</span>
                  <span>{s.text}</span>
                  <Button size="sm" variant={i === 0 ? "primary" : "default"} onClick={() => run(s.action)}>
                    {s.label}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </AgentBox>

        <Section title="Recent activity" action={<Button size="sm" variant="ghost" onClick={() => setTab("comms")}>All communications <ChevronRight /></Button>}>
          <ol className="pb-tl">
            {timeline.map((i, k) => (
              <li key={k} className={i.tone ? `pb-tl--${i.tone}` : ""}>
                <span className="pb-tl-ic">{i.icon}</span>
                <p>{i.text}</p>
                <span className="pb-tl-t mono">{i.date === TODAY ? fmtMin(i.min) : shortDate(i.date)}{i.date.slice(0, 4) !== "2026" ? ` ’${i.date.slice(2, 4)}` : ""}</span>
              </li>
            ))}
          </ol>
        </Section>
      </div>

      <div className="pb-col">
        <Section title="Unit" action={<Button size="sm" variant="ghost" onClick={() => go("ops/facility", { unit: unitId })}>Digital twin <ArrowUpRight /></Button>} className="pb-unitcard">
          <div className="pb-mini3d">
            <FacilityView
              mode="ops"
              selected={unitId}
              fly
              zoom={u?.kind === "climate" ? 2.4 : 2.9}
              view={{ zoom: 1.05, az: 0.62, el: 0.66, x: -5, z: 0 }}
              labels={[{ key: unitId, unitId, lift: u?.kind === "climate" ? 4 : 2, children: <span className="pb-3dl mono">{unitId}</span> }]}
            />
          </div>
          {u && (
            <KV
              items={[
                ["Unit", <span key="u"><span className="mono">{unitId}</span> · <StatusSwatch status={u.status} /></span>],
                ["Size", `${SIZE_INFO[u.size].label} · ${SIZE_INFO[u.size].sqft || u.w * u.d} sq ft`],
                ["Type", u.kind === "climate" ? `Climate controlled · floor ${u.floor}` : u.kind === "parking" ? "RV & boat parking" : `Drive-up · faces ${u.facing}`],
                ["Rate", <span key="r" className="tnum">{money(t.rent - PREMIUM[t.protection])} in place · {money(u.rate)} street</span>],
              ]}
            />
          )}
        </Section>

        <Section title="Payment record" action={<span className="pb-legend mono">last {record.length} months</span>}>
          <div className="pb-rec">
            {record.map(r => {
              const cls = r.late === null ? "open" : r.late === 0 ? "ok" : r.late <= 5 ? "soft" : "late";
              return (
                <div key={r.due} className={`pb-rec-c pb-rec--${cls}`} title={`${shortDate(r.due)} · ${r.late === null ? "open" : r.late === 0 ? "on time" : `${r.late} days after due`}`}>
                  <i />
                  <span className="mono">{["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"][+r.due.slice(5, 7) - 1]}</span>
                </div>
              );
            })}
          </div>
          <div className="pb-rec-k">
            <span><i className="pb-rec--ok" />On time</span>
            <span><i className="pb-rec--soft" />1–5 days</span>
            <span><i className="pb-rec--late" />Late fee</span>
            <span><i className="pb-rec--open" />Open</span>
          </div>
        </Section>

        <Section title="Details">
          <KV
            items={[
              ["Address", lease.address],
              ["Alternate contact", <span key="a">{lease.alt.name}{lease.alt.rel ? <span className="faint"> · {lease.alt.rel} · {lease.alt.phone}</span> : null}</span>],
              ["ID", <span key="i" className="pb-kv-i"><ShieldCheck size={13} /> {lease.idDoc}</span>],
              ["Signed", lease.signed ? `${lease.signed.via} · ${longDate(lease.signed.date)}` : "—"],
              ["Lease", <button key="l" className="pb-link" onClick={() => go("ops/leases/" + t.id)}>{lease.number}</button>],
            ]}
          />
        </Section>
      </div>
    </div>
  );
}

// ---- Ledger -----------------------------------------------------------------------------

function LedgerTab({ t, ledger, acts }: { t: Tenant; ledger: (LedgerEntry & { balance: number })[]; acts: Acts }) {
  const [filter, setFilter] = useState<"all" | "charges" | "payments" | "notes">("all");
  const [all, setAll] = useState(false);
  const life = lifetime(t);
  const rows = ledger
    .slice()
    .reverse()
    .filter(e => (filter === "all" ? true : filter === "charges" ? e.amount > 0 : filter === "payments" ? e.kind === "payment" || e.kind === "failed" || e.kind === "refund" || e.kind === "credit" : e.kind === "info" || e.kind === "fee"));
  const shown = all ? rows : rows.slice(0, 36);
  const openFee = openCharges(t).find(c => c.text === "Late fee");
  return (
    <div className="pb-stack">
      <div className="ok-stats pb-stats4">
        <div className="ok-stat">
          <div className="ok-stat-l">Balance</div>
          <div className="ok-stat-v">{money(t.balance, true)}</div>
          <div className="ok-stat-f">{t.daysLate ? <span className="ok-delta ok-delta--bad">{t.daysLate} days late</span> : <span className="ok-delta ok-delta--ok">current</span>}</div>
        </div>
        <div className="ok-stat">
          <div className="ok-stat-l">Paid to date</div>
          <div className="ok-stat-v">{money(life.paid)}</div>
          <div className="ok-stat-f"><span className="faint">{life.payments} payments since {shortDate(t.moveIn)} ’{t.moveIn.slice(2, 4)}</span></div>
        </div>
        <div className="ok-stat">
          <div className="ok-stat-l">Late fees</div>
          <div className="ok-stat-v">{money(life.fees)}</div>
          <div className="ok-stat-f"><span className="faint">{life.lateCount} charged</span></div>
        </div>
        <div className="ok-stat">
          <div className="ok-stat-l">Next charge</div>
          <div className="ok-stat-v">{money(t.rent)}</div>
          <div className="ok-stat-f"><span className="faint">{longDate(nextBillDate(t))} · {t.autopay ? "autopay" : "manual"}</span></div>
        </div>
      </div>
      <Section
        flush
        title={
          <Chips
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All", count: ledger.length },
              { value: "charges", label: "Charges" },
              { value: "payments", label: "Payments" },
              { value: "notes", label: "Fees & events" },
            ]}
          />
        }
        action={
          <div className="pb-row">
            {openFee && (
              <Button size="sm" onClick={() => (waiveFee(t), toast({ title: "Late fee waived", body: `${money(45)} credited to ${t.name}`, tone: "ok" }))}>
                Waive late fee
              </Button>
            )}
            <Button size="sm" icon={<Download />} onClick={() => toast({ title: "Statement exported", body: `${t.name.replace(" ", "_")}_ledger.csv · ${ledger.length} lines`, tone: "info" })}>
              Export
            </Button>
            <Button size="sm" variant="primary" icon={<Banknote />} onClick={acts.pay}>
              Take payment
            </Button>
          </div>
        }
      >
        <div className="z-table-wrap">
          <table className="z-table pb-ledger">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Reference</th>
                <th className="num">Charge</th>
                <th className="num">Payment</th>
                <th className="num">Balance</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(e => (
                <tr key={e.id} className={`pb-l--${e.kind} ${e.live ? "pb-new" : ""}`}>
                  <td className="mono pb-l-d">
                    {shortDate(e.date)}
                    <span className="faint"> ’{e.date.slice(2, 4)}</span>
                    {e.date === TODAY && e.min > 0 && <span className="faint"> {fmtMin(e.min)}</span>}
                  </td>
                  <td className="pb-l-t">
                    <span>{e.text}</span>
                    {e.kind === "failed" && <Pill tone="bad">Declined</Pill>}
                    {e.live && <Pill tone="accent">New</Pill>}
                    {(e.detail || e.method) && <small>{[e.method, e.detail, e.by && e.kind !== "rent" ? e.by : null].filter(Boolean).join(" · ")}</small>}
                  </td>
                  <td className="mono faint">{e.ref ?? ""}</td>
                  <td className="num">{e.amount > 0 ? money(e.amount, true) : ""}</td>
                  <td className="num pb-l-pay">{e.amount < 0 ? money(-e.amount, true) : e.kind === "failed" ? <s className="faint">{money(t.rent, true)}</s> : ""}</td>
                  <td className="num pb-l-bal">{e.kind === "info" ? "" : money(e.balance, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length > shown.length && (
          <button className="pb-more" onClick={() => setAll(true)}>
            Show {rows.length - shown.length} earlier lines <ChevronDown size={13} />
          </button>
        )}
      </Section>
    </div>
  );
}

// ---- Lease ------------------------------------------------------------------------------

function LeaseTab({ t, lease }: { t: Tenant; lease: ReturnType<typeof leaseFor> }) {
  const status = lease.status === "ending" ? { l: `Ending ${shortDate(lease.end!)}`, tone: "violet" as Tone } : { l: "Active", tone: "ok" as Tone };
  return (
    <div className="pb-ov pb-ov--lease">
      <Section title="Rental agreement" action={<Button size="sm" variant="primary" onClick={() => go("ops/leases/" + t.id)}>Open lease <ArrowUpRight /></Button>}>
        <div className="pb-lease-sum">
          <div className="pb-lease-doc" onClick={() => go("ops/leases/" + t.id)} role="button" tabIndex={0}>
            <div className="pb-lease-page">
              <b>Self-Service Storage Rental Agreement</b>
              <span className="mono">{lease.number}</span>
              <i /><i /><i className="s" /><i /><i /><i className="s" /><i /><i />
              <em>{t.name}</em>
            </div>
          </div>
          <KV
            items={[
              ["Status", <Pill key="s" tone={status.tone} dot>{status.l}</Pill>],
              ["Term", `Month to month from ${longDate(lease.start)}`],
              ["Rent", <span key="r" className="tnum">{money(lease.base, true)} + {money(lease.premium, true)} protection = <b>{money(lease.rent, true)}</b>/mo</span>],
              ["Due", `The ${ordinal(lease.billingDay)} of each month · late after 5 days ($45)`],
              ["Unit", <span key="u"><span className="mono">{lease.unitId}</span> · {sizeLabel(lease.unitId)}</span>],
              ["Signed", lease.signed ? <span key="g">{lease.signed.via} · {longDate(lease.signed.date)} {fmtMin(lease.signed.min)} · <span className="mono faint">{lease.signed.ip}</span></span> : "—"],
              ["Countersigned", lease.countersigned?.who ?? "—"],
            ]}
          />
        </div>
      </Section>
      <Section title="Addenda" action={<span className="pb-legend mono">{lease.addenda.length}</span>}>
        <ul className="pb-list">
          {lease.addenda.map(a => (
            <li key={a.id}>
              <FileText size={15} className="faint" />
              <div>
                <b>{a.title}</b>
                <small>{a.note ? `${a.note} · ` : ""}{longDate(a.date)}</small>
              </div>
              <Pill tone={a.status === "Draft" ? "warn" : a.status === "Signed" || a.status === "Acknowledged" ? "ok" : "neutral"}>{a.status}</Pill>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

// ---- Gate activity ---------------------------------------------------------------------

function GateTab({ t }: { t: Tenant }) {
  const rows = gateHistory(t);
  const locked = isLocked(t);
  const visits = rows.filter(r => r.kind === "Entry");
  const last30 = visits.filter(v => daysBetween(v.date, TODAY) <= 30);
  const denied = rows.filter(r => r.kind === "Denied");
  // 8 weeks × 7 days grid, Monday first, ending this week.
  const end = new Date(TODAY + "T12:00:00");
  const dow = (end.getDay() + 6) % 7;
  const start = new Date(end);
  start.setDate(end.getDate() - dow - 7 * 7);
  const cells: { date: string; n: number; d: boolean; future: boolean }[] = [];
  for (let i = 0; i < 56; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    cells.push({ date: iso, n: visits.filter(v => v.date === iso).length, d: denied.some(v => v.date === iso), future: iso > TODAY });
  }
  const hours = Array.from({ length: 17 }, (_, i) => visits.filter(v => Math.floor(v.min / 60) === i + 6).length);
  const maxH = Math.max(1, ...hours);
  const peak = hours.indexOf(Math.max(...hours)) + 6;
  return (
    <div className="pb-stack">
      <div className="ok-stats pb-stats4">
        <div className="ok-stat">
          <div className="ok-stat-l">Code</div>
          <div className="ok-stat-v mono" style={{ fontSize: 20 }}>{locked ? "Suspended" : "Active"}</div>
          <div className="ok-stat-f"><span className="faint">{locked ? "Overlocked · denied at every gate" : "Gate hours · 6:00 am – 10:00 pm"}</span></div>
        </div>
        <div className="ok-stat">
          <div className="ok-stat-l">Visits · 30 days</div>
          <div className="ok-stat-v">{last30.length}</div>
          <div className="ok-stat-f"><span className="faint">{visits.length} in 8 weeks</span></div>
        </div>
        <div className="ok-stat">
          <div className="ok-stat-l">Usual time</div>
          <div className="ok-stat-v">{visits.length ? fmtMin(peak * 60).replace(":00", "") : "—"}</div>
          <div className="ok-stat-f"><span className="faint">most entries</span></div>
        </div>
        <div className="ok-stat">
          <div className="ok-stat-l">Denied attempts</div>
          <div className="ok-stat-v">{denied.length}</div>
          <div className="ok-stat-f">{denied[0] ? <span className="ok-delta ok-delta--bad">last {denied[0].date === TODAY ? fmtMin(denied[0].min) : shortDate(denied[0].date)}</span> : <span className="faint">none</span>}</div>
        </div>
      </div>
      <div className="pb-ov">
        <Section title="Visits" action={<span className="pb-legend mono">last 8 weeks</span>}>
          <div className="pb-heat">
            <div className="pb-heat-d mono">
              {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                <span key={i}>{d}</span>
              ))}
            </div>
            <div className="pb-heat-g">
              {cells.map(c => (
                <span
                  key={c.date}
                  className={`pb-heat-c ${c.future ? "f" : ""} ${c.d ? "d" : ""} ${c.date === TODAY ? "t" : ""}`}
                  data-n={Math.min(3, c.n)}
                  title={`${shortDate(c.date)} · ${c.n} visit${c.n === 1 ? "" : "s"}${c.d ? " · denied" : ""}`}
                />
              ))}
            </div>
          </div>
          <div className="pb-heat-k">
            <span>Less</span>
            {[0, 1, 2, 3].map(n => (
              <span key={n} className="pb-heat-c" data-n={n} />
            ))}
            <span>More</span>
            <span className="pb-heat-dk"><span className="pb-heat-c d" data-n={0} /> Denied</span>
          </div>
          <div className="pb-hours">
            {hours.map((h, i) => (
              <div key={i} className="pb-hours-b" title={`${fmtMin((i + 6) * 60)} · ${h}`}>
                <i style={{ height: `${Math.max(3, (h / maxH) * 100)}%`, opacity: h ? 1 : 0.35 }} />
              </div>
            ))}
          </div>
          <div className="pb-hours-x mono">
            <span>6a</span>
            <span>10a</span>
            <span>2p</span>
            <span>6p</span>
            <span>10p</span>
          </div>
        </Section>
        <Section title="Gate log" flush action={<Button size="sm" variant="ghost" onClick={() => go("ops/gate")}>Gate access <ArrowUpRight /></Button>}>
          <div className="pb-gatelog">
            <table className="z-table">
              <tbody>
                {rows.slice(0, 18).map((r, i) => (
                  <tr key={i}>
                    <td className="mono faint">{r.date === TODAY ? "Today" : shortDate(r.date)} {fmtMin(r.min)}</td>
                    <td>
                      <span className={`pb-gk pb-gk--${r.kind === "Denied" ? "bad" : r.kind === "Entry" ? "in" : "out"}`}>
                        {r.kind === "Denied" ? <CircleSlash size={13} /> : <KeyRound size={13} />}
                        {r.kind}
                      </span>
                    </td>
                    <td>{r.gate}</td>
                    <td className="faint">{r.note ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </div>
    </div>
  );
}

// ---- Communications -----------------------------------------------------------------------

function Wave({ seed, playing }: { seed: string; playing: boolean }) {
  const bars = useMemo(() => {
    let h = 7;
    for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return Array.from({ length: 64 }, (_, i) => {
      h = (h * 1103515245 + 12345) >>> 0;
      return 0.18 + ((h >>> 16) % 100) / 125 + (i % 9 === 0 ? 0.1 : 0);
    });
  }, [seed]);
  return (
    <div className={`pb-wave ${playing ? "on" : ""}`}>
      {bars.map((b, i) => (
        <i key={i} style={{ height: `${Math.min(1, b) * 100}%`, animationDelay: `${(i % 16) * 0.06}s` }} />
      ))}
    </div>
  );
}

function CallCard({ c, first }: { c: Comm; first: string }) {
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const call = c.call!;
  const tone: Tone = call.sentiment === "positive" ? "ok" : call.sentiment === "negative" ? "bad" : "neutral";
  return (
    <div className="pb-call">
      <div className="pb-call-h">
        <button className="pb-play" aria-label={playing ? "Pause" : "Play recording"} onClick={() => setPlaying(p => !p)}>
          {playing ? <Pause size={13} /> : <Play size={13} />}
        </button>
        <Wave seed={c.id} playing={playing} />
        <span className="mono faint">{call.duration}</span>
      </div>
      <div className="pb-call-m">
        <Pill tone="accent"><Sparkles /> Zonera Voice</Pill>
        <Pill>{call.outcome}</Pill>
        <Pill tone={tone} dot>{call.sentiment[0].toUpperCase() + call.sentiment.slice(1)}</Pill>
      </div>
      <p className="pb-call-s">{call.summary}</p>
      {call.transcript && (
        <>
          <button className="pb-link pb-call-t" onClick={() => setOpen(o => !o)}>
            {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Transcript · {call.transcript.length} turns
          </button>
          {open && (
            <ol className="pb-tx">
              {call.transcript.map((l, i) => (
                <li key={i} className={l.who}>
                  <span className="mono">{l.who === "agent" ? "Zonera" : first}</span>
                  <p>{l.text}</p>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
}

function CommsTab({ t, comms, acts }: { t: Tenant; comms: Comm[]; acts: Acts }) {
  const [f, setF] = useState<"all" | "sms" | "email" | "call" | "note">("all");
  const [note, setNote] = useState("");
  const list = comms.filter(c => (f === "all" ? true : f === "note" ? c.channel === "note" || c.channel === "system" || c.channel === "letter" : c.channel === f));
  const count = (ch: string) => comms.filter(c => c.channel === ch).length;
  const save = () => {
    if (!note.trim()) return;
    addComm(t.id, { channel: "note", who: OPERATOR.name, body: note.trim() });
    commit();
    setNote("");
    toast({ title: "Note saved", body: `On ${t.name}'s profile`, tone: "ok" }, 2400);
  };
  let lastDay = "";
  return (
    <div className="pb-comms">
      <div className="pb-comms-bar">
        <Chips
          value={f}
          onChange={setF}
          options={[
            { value: "all", label: "All", count: comms.length },
            { value: "sms", label: "SMS", count: count("sms") },
            { value: "email", label: "Email", count: count("email") },
            { value: "call", label: "Calls", count: count("call") },
            { value: "note", label: "Notes & events" },
          ]}
        />
        <div className="pb-row">
          <Button size="sm" icon={<Phone />} onClick={() => acts.call()}>Call with Zonera Voice</Button>
          <Button size="sm" variant="primary" icon={<MessageSquare />} onClick={acts.message}>New message</Button>
        </div>
      </div>
      <div className="pb-note-in">
        <StickyNote size={15} className="faint" />
        <input value={note} onChange={e => setNote(e.target.value)} onKeyDown={e => e.key === "Enter" && save()} placeholder={`Add a note about ${t.first}…`} />
        <Button size="sm" onClick={save} disabled={!note.trim()}>Save note</Button>
      </div>
      <ol className="pb-thread">
        {list.map(c => {
          const day = c.date;
          const head = day !== lastDay;
          lastDay = day;
          const icon = c.channel === "call" ? (c.dir === "in" ? <PhoneIncoming /> : <PhoneOutgoing />) : c.channel === "sms" ? <MessageSquare /> : c.channel === "email" ? <Mail /> : c.channel === "note" ? <StickyNote /> : c.channel === "letter" ? <Send /> : <Bell />;
          const agent = c.who.startsWith("Zonera");
          return (
            <React.Fragment key={c.id}>
              {head && <li className="pb-thread-day mono">{day === TODAY ? "Today" : longDate(day)}</li>}
              <li className={`pb-msg-i pb-msg--${c.channel} ${c.dir === "in" ? "in" : "out"} ${c.live ? "pb-new" : ""}`}>
                <span className={`pb-msg-ic ${agent ? "agent" : ""}`}>{icon}</span>
                <div className="pb-msg-c">
                  <div className="pb-msg-h">
                    <b>{c.dir === "in" ? t.name : c.who}</b>
                    <span className="faint">
                      {CHANNEL_LABEL[c.channel]}
                      {c.dir === "in" ? " · inbound" : c.channel === "call" ? " · outbound" : ""}
                    </span>
                    {c.status && <span className={`pb-msg-st ${/Returned|not opened|Failed/.test(c.status) ? "bad" : ""}`}>{/Returned|not opened|Failed/.test(c.status) ? null : <Check size={11} />}{c.status}</span>}
                    <span className="pb-msg-t mono">{fmtMin(c.min)}</span>
                  </div>
                  {c.subject && <div className="pb-msg-sub">{c.subject}</div>}
                  {c.channel === "call" ? <CallCard c={c} first={t.first} /> : <p className={c.channel === "sms" ? `pb-bubble ${c.dir === "in" ? "in" : ""}` : "pb-msg-body"}>{c.body}</p>}
                </div>
              </li>
            </React.Fragment>
          );
        })}
      </ol>
    </div>
  );
}

// ---- Documents --------------------------------------------------------------------------

function DocsTab({ t }: { t: Tenant }) {
  const docs = documentsFor(t);
  const [preview, setPreview] = useState<null | (typeof docs)[number]>(null);
  const ICON: Record<string, React.ReactNode> = { lease: <FileSignature />, addendum: <FileText />, id: <IdCard />, notice: <ScrollText />, receipt: <Receipt />, photo: <Image /> };
  return (
    <Section flush title="Documents" action={<Button size="sm" icon={<Download />} onClick={() => toast({ title: "Preparing download", body: `${docs.length} files for ${t.name} · zip`, tone: "info" })}>Download all</Button>}>
      <ul className="pb-docs">
        {docs.map(d => (
          <li key={d.id}>
            <span className="pb-doc-ic">{ICON[d.kind]}</span>
            <div>
              <b>
                {d.title}
                {d.restricted && <Pill>Managers only</Pill>}
              </b>
              <small>{d.meta}</small>
            </div>
            <span className="mono faint">{d.size}</span>
            <Button size="sm" variant="ghost" onClick={() => (d.kind === "lease" ? go("ops/leases/" + t.id) : setPreview(d))}>
              View
            </Button>
          </li>
        ))}
      </ul>
      <Modal open={!!preview} onClose={() => setPreview(null)}>
        {preview && (
          <ModalShell title={preview.title} sub={preview.meta} onClose={() => setPreview(null)} icon={ICON[preview.kind]} foot={<Button variant="primary" onClick={() => setPreview(null)}>Close</Button>}>
            {preview.kind === "photo" ? (
              <div className="pb-photos">
                {["Door, closed", "Interior, empty", "Door, lock on"].map(c => (
                  <figure key={c}>
                    <div className="pb-photo" />
                    <figcaption className="mono">{c}</figcaption>
                  </figure>
                ))}
              </div>
            ) : preview.kind === "id" ? (
              <div className="pb-idcard">
                <div className="pb-idcard-p" />
                <div>
                  <b>California driver license</b>
                  <span className="mono">•••• •••• {leaseFor(t).idDoc.slice(-4)}</span>
                  <span>{t.name.toUpperCase()}</span>
                  <span className="faint">Verified by Persona on {longDate(t.moveIn)} · face match 98%</span>
                </div>
              </div>
            ) : (
              <div className="pb-notice">
                <b>Zonera Alder Lake · 2200 Shoreline Drive, Alder Lake, CA 96150</b>
                <p>{longDate(TODAY)}</p>
                <p>To: {t.name}, {leaseFor(t).address}</p>
                <p>
                  {preview.title.startsWith("Rent change")
                    ? `This is notice that the monthly rent for unit ${t.unitIds[0]} will change as shown (${preview.meta.split(" · ")[0]}), effective on your next billing date at least 30 days from this notice. All other terms of your rental agreement stay the same.`
                    : preview.title.startsWith("Overlock")
                      ? `Your account for unit ${t.unitIds[0]} is past due. Under section 6 of your rental agreement, the unit has been overlocked and gate access is suspended until the balance is paid. Pay online at zonera.co or at the office, 9–6 Mon–Sat.`
                      : preview.title.startsWith("Preliminary")
                        ? `Preliminary lien notice under California Business and Professions Code §21703. Itemized balance for unit ${t.unitIds[0]}: ${money(t.balance, true)}. Your right to use the storage space will terminate on the date stated below unless all sums due are paid. A blank Declaration in Opposition to Lien Sale is enclosed.`
                        : preview.title.startsWith("Receipt")
                          ? `Received with thanks: ${preview.meta}. Applied to unit ${t.unitIds[0]}. Current balance ${money(Math.max(0, t.balance), true)}.`
                          : `${preview.title} for unit ${t.unitIds[0]}, signed electronically by ${t.name}. ${preview.meta}.`}
                </p>
              </div>
            )}
          </ModalShell>
        )}
      </Modal>
    </Section>
  );
}

export { UPDATE_LINKS };
