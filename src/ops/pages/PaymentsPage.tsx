import React, { useMemo, useState } from "react";
import { Download, Banknote, Send, Phone, Check, RotateCcw, Landmark, ChevronRight, CreditCard } from "lucide-react";
import { Page, PageHeader, Section, Stat, StatRow, Chips, Empty } from "../kit";
import { Button, Pill, Modal } from "../../ui";
import { BarChart } from "../../ui/charts";
import { clock, commit, go, toast, useDemo } from "../../state/store";
import { TENANTS, TENANT_BY_ID, MONTHLY, OPERATOR, type Tenant } from "../../data/tenants";
import { transactions, failedAutopay, UPDATE_LINKS, recordRefund, TODAY, addDays, fmtMin, shortDate, longDate, type Txn } from "../../data/ledger";
import { addComm } from "../../data/comms";
import { ENDED } from "../../data/leases";
import { startOutboundCall } from "../../calls/api";
import { useTenantActions } from "./b/actions";
import { money, SearchBox, TenantCell, UnitTag, ModalShell, LatePill } from "./b/ui";

type Filter = "all" | "autopay" | "card" | "cash" | "ach" | "failed" | "refund";

// Seed: the agent texted Grace a reminder at 9:38 (see her thread).
{
  const grace = TENANTS.find(t => t.name === "Grace Lindqvist");
  if (grace && !UPDATE_LINKS.has(grace.id)) UPDATE_LINKS.set(grace.id, "9:38 am");
}

const REFUNDS = (() => {
  const dup = TENANTS.find(t => t.autopay && t.daysLate === 0 && t.card && !["Matthew Alvarez", "Matthew Cho", "Sofia Reyes", "Ben Carter"].includes(t.name) && t.rent > 120);
  const ended = ENDED[0];
  return [
    { id: "RF-1", tenantId: dup?.id, name: dup?.name ?? "", unit: dup?.unitIds[0] ?? "", amount: dup?.rent ?? 0, reason: "Duplicate autopay", detail: `Charged twice on Sep 30 · ${dup?.card}`, method: `Autopay · ${dup?.card}`, done: false },
    { id: "RF-2", tenantId: undefined, name: ended.name, unit: ended.unitId, amount: 36.5, reason: "Move-out credit", detail: `Unused protection after move-out ${shortDate(ended.end!)}`, method: "Card on file", done: false },
  ];
})();
const REFUNDED: { name: string; amount: number; reason: string; at: string }[] = [{ name: "Naomi Reid", amount: 25, reason: "Admin fee waived after storefront error", at: "Sep 26" }];

function classify(x: Txn): Filter {
  if (x.kind === "failed") return "failed";
  if (x.kind === "refund") return "refund";
  if (x.kind === "autopay") return "autopay";
  if (/Cash/i.test(x.method)) return "cash";
  if (/ACH|Check/i.test(x.method)) return "ach";
  return "card";
}

export default function PaymentsPage(_p: { id?: string }) {
  useDemo();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(40);
  const [pick, setPick] = useState(false);
  const [chosen, setChosen] = useState<Tenant | undefined>();
  const acts = useTenantActions(chosen);

  const tx = transactions(addDays(TODAY, -31));
  const paid = tx.filter(x => x.kind === "payment" || x.kind === "autopay");
  const today = paid.filter(x => x.date === TODAY);
  const oct = paid.filter(x => x.date >= "2026-10-01");
  const autos = tx.filter(x => x.kind === "autopay").length;
  const fails = tx.filter(x => x.kind === "failed").length;
  const failed = failedAutopay();
  const sept = MONTHLY[MONTHLY.length - 1];

  // Daily collections, last 30 days.
  const days = Array.from({ length: 30 }, (_, i) => addDays(TODAY, i - 29));
  const series = days.map(d => ({ label: String(+d.slice(8)), value: paid.filter(x => x.date === d).reduce((s, x) => s + x.amount, 0), note: d === TODAY ? "Today so far" : longDate(d) }));

  // Payouts: card, autopay and ACH settle in two days; cash is deposited the next morning.
  const payouts = Array.from({ length: 6 }, (_, i) => {
    const d = addDays(TODAY, -i);
    const src = addDays(d, -2);
    const amt = paid.filter(x => x.date === src && !/Cash/i.test(x.method)).reduce((s, x) => s + x.amount, 0);
    return { date: d, amount: +(amt * 0.971).toFixed(2), gross: amt, fees: +(amt * 0.029).toFixed(2), status: i === 0 ? "In transit" : "Paid" };
  }).filter(p => p.gross > 0);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return tx.filter(x => (filter === "all" ? true : classify(x) === filter)).filter(x => !s || x.name.toLowerCase().includes(s) || x.unitId.toLowerCase().includes(s) || (x.ref ?? "").toLowerCase().includes(s));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, q, tx.length]);

  const sendLinks = (list: Tenant[]) => {
    const fresh = list.filter(t => !UPDATE_LINKS.has(t.id) || UPDATE_LINKS.get(t.id) === "9:38 am");
    for (const t of fresh) {
      UPDATE_LINKS.set(t.id, clock());
      addComm(t.id, { channel: "sms", dir: "out", who: "Zonera agent", body: `Hi ${t.first}, your autopay for ${t.unitIds[0]} (${money(t.rent)}) didn't go through. Update your card at zonera.co/u/${t.unitIds[0].toLowerCase().replace("-", "")} and we'll retry right away.`, status: "Delivered" });
    }
    commit({ kind: "payment", text: `Card update links sent to ${fresh.length} tenant${fresh.length === 1 ? "" : "s"} with failed autopay`, who: OPERATOR.name });
    toast({ title: `Sent ${fresh.length} update link${fresh.length === 1 ? "" : "s"}`, body: "SMS with a secure card link. Zonera retries the charge as soon as a card is updated.", tone: "ok" });
  };

  const choose = (t: Tenant) => {
    setChosen(t);
    setPick(false);
    acts.pay();
  };

  return (
    <Page>
      <PageHeader
        title="Payments"
        sub="Friday, October 2 · payouts to Chase •• 6612"
        ask="Fix last night's autopay failures"
        actions={
          <>
            <Button icon={<Download />} onClick={() => toast({ title: "Export ready", body: `payments-sep-oct-2026.csv · ${tx.length} rows`, tone: "info" })}>Export</Button>
            <Button variant="primary" icon={<Banknote />} onClick={() => setPick(true)}>Record payment</Button>
          </>
        }
      />

      <StatRow>
        <Stat label="Collected today" value={money(today.reduce((s, x) => s + x.amount, 0), true)} delta={`${today.length} payments`} tone="ok" sub={`last ${today[0] ? fmtMin(today[0].min) : "—"}`} />
        <Stat label="Collected · Oct to date" value={money(oct.reduce((s, x) => s + x.amount, 0))} delta={`${oct.length} payments`} tone="neutral" sub="2 days" />
        <Stat label="Collected · Sep" value={money(sept.revenue)} delta="+1.4%" tone="ok" sub="vs Aug" spark={MONTHLY.map(m => m.revenue)} />
        <Stat label="Autopay success" value={`${((autos / Math.max(1, autos + fails)) * 100).toFixed(1)}%`} delta={`${fails} declined`} tone={fails > 4 ? "warn" : "ok"} sub="last 30 days" />
        <Stat label="Failed autopay" value={money(failed.reduce((s, t) => s + t.balance, 0))} delta={`${failed.length} open`} tone="warn" sub={`${failed.filter(t => UPDATE_LINKS.has(t.id)).length} links sent`} />
      </StatRow>

      <div className="pb-pay-grid">
        <div className="pb-col">
          <Section title="Collections" action={<span className="pb-legend">last 30 days · {money(series.reduce((s, d) => s + d.value, 0))}</span>}>
            <BarChart data={series} format={v => money(v)} yFormat={v => "$" + (v >= 1000 ? (v / 1000).toFixed(v % 1000 ? 1 : 0) + "k" : v)} height={190} />
          </Section>

          <Section
            flush
            title={
              <Chips<Filter>
                value={filter}
                onChange={v => (setFilter(v), setLimit(40))}
                options={[
                  { value: "all", label: "All", count: tx.length },
                  { value: "autopay", label: "Autopay", count: tx.filter(x => classify(x) === "autopay").length },
                  { value: "card", label: "Card", count: tx.filter(x => classify(x) === "card").length },
                  { value: "cash", label: "Cash", count: tx.filter(x => classify(x) === "cash").length },
                  { value: "ach", label: "ACH", count: tx.filter(x => classify(x) === "ach").length },
                  { value: "failed", label: "Declined", count: fails },
                ]}
              />
            }
            action={<SearchBox value={q} onChange={setQ} placeholder="Search" width={150} />}
          >
            {rows.length === 0 ? (
              <Empty title="No transactions" body="Nothing matches this filter." />
            ) : (
              <div className="z-table-wrap">
                <table className="z-table pb-tt">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Tenant</th>
                      <th>Unit</th>
                      <th>Method</th>
                      <th>Type</th>
                      <th className="num">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, limit).map(x => (
                      <tr key={x.id} className={`pb-row-link ${x.live ? "pb-new" : ""}`} onClick={() => go("ops/tenants/" + x.tenantId)}>
                        <td className="mono pb-ten">{x.date === TODAY ? "Today" : shortDate(x.date)} {fmtMin(x.min)}</td>
                        <td><TenantCell t={{ name: x.name }} /></td>
                        <td><UnitTag id={x.unitId} /></td>
                        <td className="pb-lc">
                          {x.method.replace("Autopay · ", "").replace("Card · ", "")}
                          {x.ref && <small className="pb-ref mono">{x.ref}</small>}
                        </td>
                        <td>
                          {x.kind === "failed" ? <Pill tone="bad" dot>Declined</Pill> : x.kind === "refund" ? <Pill tone="violet">Refund</Pill> : x.kind === "autopay" ? <Pill>Autopay</Pill> : <Pill tone="info">{classify(x) === "cash" ? "Cash" : classify(x) === "ach" ? (/Check/.test(x.method) ? "Check" : "ACH") : "Card"}</Pill>}
                        </td>
                        <td className={`num ${x.kind === "failed" ? "faint" : ""}`}>{x.kind === "failed" ? <s>{money(TENANT_BY_ID.get(x.tenantId)?.rent ?? 0, true)}</s> : x.kind === "refund" ? `−${money(Math.abs(x.amount), true)}` : money(x.amount, true)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {rows.length > limit && (
              <button className="pb-more" onClick={() => setLimit(l => l + 80)}>
                Show {Math.min(80, rows.length - limit)} more of {rows.length}
              </button>
            )}
          </Section>
        </div>

        <div className="pb-col">
          <Section
            title="Failed autopay"
            action={
              <Button size="sm" variant="primary" icon={<Send />} onClick={() => sendLinks(failed)} disabled={failed.length === 0 || failed.every(t => UPDATE_LINKS.has(t.id) && UPDATE_LINKS.get(t.id) !== "9:38 am")}>
                Send update links
              </Button>
            }
            flush
          >
            {failed.length === 0 ? (
              <Empty title="All autopay charges went through" />
            ) : (
              <ul className="pb-fails">
                {failed.map(t => {
                  const sent = UPDATE_LINKS.get(t.id);
                  return (
                    <li key={t.id}>
                      <button className="pb-fails-who" onClick={() => go("ops/tenants/" + t.id)}>
                        <TenantCell t={t} sub={<><span className="mono">{t.unitIds[0]}</span> · {t.name === "Grace Lindqvist" ? "card expired" : "declined by issuer"}</>} />
                      </button>
                      <div className="pb-fails-r">
                        <b className="tnum">{money(t.balance, true)}</b>
                        <LatePill days={t.daysLate} />
                      </div>
                      <div className="pb-fails-a">
                        {sent ? (
                          <span className="pb-sent"><Check size={12} /> Link sent {sent}</span>
                        ) : (
                          <Button size="sm" onClick={() => sendLinks([t])}>Send link</Button>
                        )}
                        <Button size="sm" variant="ghost" iconOnly icon={<Phone />} aria-label={`Call ${t.name}`} onClick={() => startOutboundCall({ name: t.name, phone: t.phone, tenantId: t.id, purpose: `update the card for ${t.unitIds[0]} autopay` })} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          <Section title="Payouts" action={<span className="pb-legend">Stripe · T+2</span>} flush>
            <ul className="pb-payouts">
              {payouts.map(p => (
                <li key={p.date}>
                  <span className="pb-po-ic"><Landmark size={14} /></span>
                  <div>
                    <b className="tnum">{money(p.amount, true)}</b>
                    <small>{longDate(p.date)} · Chase •• 6612 · fees {money(p.fees, true)}</small>
                  </div>
                  <Pill tone={p.status === "Paid" ? "ok" : "info"} dot>{p.status}</Pill>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Refunds" action={<span className="pb-legend">{REFUNDS.filter(r => !r.done).length} to review</span>} flush>
            <ul className="pb-payouts">
              {REFUNDS.map(r => (
                <li key={r.id}>
                  <span className="pb-po-ic"><RotateCcw size={14} /></span>
                  <div>
                    <b>{r.name} · <span className="tnum">{money(r.amount, true)}</span></b>
                    <small>{r.reason} · {r.detail}</small>
                  </div>
                  {r.done ? (
                    <Pill tone="ok">Refunded</Pill>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => {
                        const t = r.tenantId ? TENANT_BY_ID.get(r.tenantId) : undefined;
                        if (t) recordRefund(t, r.amount, "duplicate charge", r.method);
                        else commit({ kind: "payment", text: `Refunded ${money(r.amount, true)} to ${r.name} · ${r.reason.toLowerCase()}`, who: OPERATOR.name });
                        r.done = true;
                        REFUNDED.unshift({ name: r.name, amount: r.amount, reason: r.reason, at: "Today" });
                        toast({ title: "Refund sent", body: `${money(r.amount, true)} to ${r.name}. Arrives in 5–10 business days.`, tone: "ok" });
                      }}
                    >
                      Refund
                    </Button>
                  )}
                </li>
              ))}
              {REFUNDED.filter(x => !REFUNDS.some(r => r.name === x.name)).map(x => (
                <li key={x.name + x.at} className="pb-done-row">
                  <span className="pb-po-ic"><Check size={14} /></span>
                  <div>
                    <b>{x.name} · <span className="tnum">{money(x.amount, true)}</span></b>
                    <small>{x.reason} · {x.at}</small>
                  </div>
                  <Pill tone="ok">Refunded</Pill>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </div>

      <Modal open={pick} onClose={() => setPick(false)}>
        <TenantPicker onPick={choose} onClose={() => setPick(false)} />
      </Modal>
      {acts.el}
    </Page>
  );
}

function TenantPicker({ onPick, onClose }: { onPick: (t: Tenant) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const s = q.trim().toLowerCase();
  const list = (s ? TENANTS.filter(t => t.name.toLowerCase().includes(s) || t.unitIds.some(u => u.toLowerCase().includes(s))) : TENANTS.filter(t => t.balance > 0).sort((a, b) => b.daysLate - a.daysLate)).slice(0, 8);
  return (
    <ModalShell title="Record a payment" sub="Who is paying?" icon={<CreditCard />} onClose={onClose}>
      <div className="pb-pick">
        <SearchBox value={q} onChange={setQ} placeholder="Name or unit, e.g. Matthew or A-122" />
        <div className="eyebrow">{s ? "Matches" : "Past due"}</div>
        <ul>
          {list.map(t => (
            <li key={t.id}>
              <button onClick={() => onPick(t)}>
                <TenantCell t={t} sub={<><span className="mono">{t.unitIds.join(", ")}</span>{t.business ? ` · ${t.business}` : ""}</>} />
                <span className={`tnum ${t.balance > 0 ? "" : "faint"}`}>{money(t.balance, true)}</span>
                <ChevronRight size={14} className="faint" />
              </button>
            </li>
          ))}
          {list.length === 0 && <li className="faint pb-pick-none">No tenant matches “{q}”.</li>}
        </ul>
      </div>
    </ModalShell>
  );
}
