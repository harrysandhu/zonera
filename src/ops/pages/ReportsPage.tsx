import React, { useEffect, useState } from "react";
import { Sparkles, FileText, Download, Send, RefreshCw, Table2, LayoutGrid, AlarmClock, ArrowLeftRight, Tags, KeyRound, Receipt, Plus, CalendarClock } from "lucide-react";
import { Page, PageHeader, Section, Stat, StatRow, KV } from "../kit";
import { Avatar, Button, Pill } from "../../ui";
import { BarChart, LineChart, MeterList } from "../../ui/charts";
import { askAgent, fmt, go, toast, useDemo } from "../../state/store";
import { UNITS, UNIT_BY_ID, occupancy } from "../../data/facility";
import { DELINQUENT, LEADS, MONTHLY, SEPT_LAST_YEAR, TENANTS, tenantForUnit } from "../../data/tenants";
import { GATE_EVENTS, GATE_BY_ID, KIND_TEXT } from "../../data/gate";
import { Switch } from "./a/kit";
import { PairBarChart } from "./a/charts";
import { SIZES, sizeLabel } from "./a/units";

interface ReportDef { id: string; title: string; desc: string; cadence: string; icon: React.ReactNode }

const REPORTS: ReportDef[] = [
  { id: "owner", title: "Owner report", desc: "Revenue, occupancy and collections vs last year", cadence: "Monthly · 1st, 6:00 am", icon: <FileText /> },
  { id: "rentroll", title: "Rent roll", desc: "Every unit, tenant, rate and balance", cadence: "Live", icon: <Table2 /> },
  { id: "occupancy", title: "Occupancy by size", desc: "Where you're full and where you're soft", cadence: "Weekly · Mondays", icon: <LayoutGrid /> },
  { id: "delinquency", title: "Delinquency aging", desc: "Balances by age, lien status", cadence: "Daily · 6:00 am", icon: <AlarmClock /> },
  { id: "moves", title: "Move-ins and move-outs", desc: "Net rentals by month", cadence: "Monthly", icon: <ArrowLeftRight /> },
  { id: "ecri", title: "Rate change candidates", desc: "Tenants furthest below street rate", cadence: "Quarterly", icon: <Tags /> },
  { id: "gate", title: "Gate access audit", desc: "Every entry, exit and denied attempt", cadence: "On demand", icon: <KeyRound /> },
  { id: "fees", title: "Fees and protection", desc: "Admin fees, late fees, protection premiums", cadence: "Monthly", icon: <Receipt /> },
];

const PERIOD = "September 2026";
const plans = () => TENANTS.filter(t => t.protection > 0).length;
const attach = () => Math.round((plans() / TENANTS.length) * 100);

export default function ReportsPage({ id }: { id?: string }) {
  useDemo();
  const [sel, setSel] = useState<string>(id && REPORTS.some(r => r.id === id) ? id : "owner");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (id && REPORTS.some(r => r.id === id)) setSel(id);
  }, [id]);
  const def = REPORTS.find(r => r.id === sel)!;
  const fname = `alder-lake-${def.id}-${sel === "owner" ? "2026-09" : "2026-10-02"}`;

  const refresh = () => {
    setBusy(true);
    window.setTimeout(() => {
      setBusy(false);
      toast({ title: `${def.title} refreshed`, body: "Rebuilt from the live ledger, rent roll and gate log.", tone: "ok" });
    }, 1400);
  };

  return (
    <Page className="pa-reports">
      <PageHeader
        title="Reports"
        sub="Written by the agent from your ledger, rent roll and gate logs"
        ask="Generate the September owner report vs last year"
        actions={
          <Button icon={<Plus />} onClick={() => askAgent("Break revenue down by unit size")}>
            Custom report
          </Button>
        }
      />

      <div className="pa-rep">
        <nav className="pa-gal" aria-label="Reports">
          {REPORTS.map(r => (
            <button key={r.id} aria-current={sel === r.id ? "true" : undefined} onClick={() => setSel(r.id)}>
              <span className="pa-gal-ic">{r.icon}</span>
              <span className="pa-gal-t">
                <b>{r.title}</b>
                <span>{r.desc}</span>
                <em className="mono">{r.cadence}</em>
              </span>
            </button>
          ))}
        </nav>

        <article className={`pa-doc ${busy ? "busy" : ""}`} key={sel}>
          <header className="pa-doc-h">
            <div>
              <div className="eyebrow">{sel === "owner" ? `Owner report · ${PERIOD}` : `${def.title} · as of Oct 2, 2026`}</div>
              <h2>{sel === "owner" ? `Alder Lake, ${PERIOD}` : def.title}</h2>
              <p>
                {sel === "owner" ? "Generated Oct 1, 6:00 am · refreshed today 9:44 am" : `${def.desc} · generated just now`}
              </p>
            </div>
            <div className="pa-doc-a">
              <Button size="sm" variant="ghost" iconOnly icon={<RefreshCw />} aria-label="Refresh" onClick={refresh} />
              <Button size="sm" icon={<Download />} onClick={() => toast({ title: "PDF ready", body: `${fname}.pdf · 6 pages`, tone: "ok" })}>
                PDF
              </Button>
              <Button size="sm" icon={<Download />} onClick={() => toast({ title: "CSV exported", body: `${fname}.csv`, tone: "ok" })}>
                CSV
              </Button>
              {sel === "owner" && (
                <Button size="sm" variant="primary" icon={<Send />} onClick={() => toast({ title: "Sent to Daniel Osei", body: `${PERIOD} owner report, PDF and CSV, to daniel@oseiholdings.com.`, tone: "ok" })}>
                  Send to owner
                </Button>
              )}
            </div>
          </header>
          {busy ? <Skeleton /> : sel === "owner" ? <OwnerReport /> : <OtherReport id={sel} />}
        </article>
      </div>
    </Page>
  );
}

function Skeleton() {
  return (
    <div className="pa-doc-b">
      <div className="z-shimmer" style={{ height: 96 }} />
      <div className="z-shimmer" style={{ height: 14, width: "70%" }} />
      <div className="z-shimmer" style={{ height: 14, width: "84%" }} />
      <div className="z-shimmer" style={{ height: 14, width: "52%" }} />
      <div className="z-shimmer" style={{ height: 220 }} />
    </div>
  );
}

function OwnerReport() {
  const sept = MONTHLY[MONTHLY.length - 1];
  const aug = MONTHLY[MONTHLY.length - 2];
  const yoy = sept.revenue / SEPT_LAST_YEAR.revenue - 1;
  const mom = sept.revenue / aug.revenue - 1;
  const occ = sept.occupancy;
  const occPts = (occ - SEPT_LAST_YEAR.occupancy) * 100;
  const delinq = DELINQUENT.length / TENANTS.length;
  const pastDue = DELINQUENT.reduce((s, t) => s + t.balance, 0);
  const rent = TENANTS.reduce((s, t) => s + t.rent, 0);
  const prot = TENANTS.reduce((s, t) => s + (t.protection === 2000 ? 12 : t.protection === 5000 ? 18 : t.protection === 10000 ? 29 : 0), 0);
  const fees = Math.max(0, sept.revenue - rent - prot);
  const occupied = UNITS.filter(u => u.tenantId);
  const street = occupied.reduce((s, u) => s + u.rate, 0);
  const gap = rent / street - 1;
  const under = occupied.filter(u => {
    const t = tenantForUnit(u);
    return t && t.rent / u.rate - 1 < -0.15;
  });
  const uplift = under.reduce((s, u) => s + Math.round((u.rate - tenantForUnit(u)!.rent) * 0.5), 0);
  const ten20 = UNITS.filter(u => u.size === "10x20" && u.status !== "maintenance");
  const ten20rate = ten20.filter(u => !["vacant", "reserved"].includes(u.status)).length / ten20.length;
  const dana = DELINQUENT.find(t => t.last === "Whitfield");
  const gains = MONTHLY.reduce((n, m, i) => (i && m.occupancy > MONTHLY[i - 1].occupancy ? n + 1 : 0), 0);
  const [sched, setSched] = useState(true);

  return (
    <div className="pa-doc-b">
      <StatRow>
        <Stat label="Revenue" value={fmt.money(sept.revenue)} delta={`+${(yoy * 100).toFixed(1)}%`} tone="ok" sub={`vs ${fmt.money(SEPT_LAST_YEAR.revenue)}`} />
        <Stat label="Occupancy" value={fmt.pct(occ)} delta={`+${occPts.toFixed(1)} pts`} tone="ok" sub={`vs ${fmt.pct(SEPT_LAST_YEAR.occupancy)}`} />
        <Stat label="Move-ins" value={String(sept.moveIns)} delta={`+${sept.moveIns - SEPT_LAST_YEAR.moveIns}`} tone="ok" sub={`vs ${SEPT_LAST_YEAR.moveIns}`} />
        <Stat label="Move-outs" value={String(sept.moveOuts)} delta={`${sept.moveOuts - SEPT_LAST_YEAR.moveOuts >= 0 ? "±" : ""}${sept.moveOuts - SEPT_LAST_YEAR.moveOuts}`} tone="neutral" sub={`vs ${SEPT_LAST_YEAR.moveOuts}`} />
        <Stat label="Delinquency" value={fmt.pct(delinq)} delta={`+${((delinq - SEPT_LAST_YEAR.delinquency) * 100).toFixed(1)} pts`} tone="bad" sub={`vs ${fmt.pct(SEPT_LAST_YEAR.delinquency)}`} />
      </StatRow>

      <section className="pa-narr">
        <div className="pa-narr-h">
          <span className="pa-narr-ic">
            <Sparkles size={13} />
          </span>
          <b>Summary</b>
          <span className="faint">Written by Zonera · checked against the ledger</span>
          <button className="pa-link" onClick={() => askAgent("Rewrite the September owner report summary for a first-time investor")}>
            Rewrite
          </button>
        </div>
        <ol>
          <li>
            <p>
            Revenue was <b>{fmt.money(sept.revenue)}</b>, up <b>{(yoy * 100).toFixed(1)}%</b> on September 2025 and {(mom * 100).toFixed(1)}% on August. Occupancy closed at <b>{fmt.pct(occ)}</b>, {occPts.toFixed(1)} points above last year and the {ordinal(gains)} straight month of gains.
            </p>
          </li>
          <li>
            <p>
            Rate changes did most of the work. In-place rent is still <b>{Math.abs(gap * 100).toFixed(1)}% below street</b>, and {under.length} tenants sit more than 15% under. Closing half that gap in January adds about <b>{fmt.money(uplift)}</b> a month.
            </p>
          </li>
          <li>
            <p>
            10×20s are the soft spot at <b>{fmt.pct(ten20rate, 0)}</b> with {UNITS.filter(u => u.size === "10x20" && u.status === "vacant").length} available. The $1 first-month promo started Sep 20; {LEADS.filter(l => l.size === "10x20")[0]?.name ?? "one lead"} reserved one for Oct 12.
            </p>
          </li>
          <li>
            <p>
            Delinquency rose to <b>{fmt.pct(delinq)}</b> of tenants ({fmt.pct(SEPT_LAST_YEAR.delinquency)} a year ago), {fmt.money(pastDue)} in total.{" "}
            {dana ? (
              <>
                {fmt.money(dana.balance)} sits with{" "}
                <button className="pa-plain pa-u" onClick={() => go("ops/tenants/" + dana.id)}>
                  {dana.name}
                </button>{" "}
                ({dana.unitIds[0]}, {dana.daysLate} days); the lien notice goes out Oct 5. The other {DELINQUENT.length - 1} are under 30 days and on the reminder schedule.
              </>
            ) : (
              "All balances are under 30 days."
            )}
            </p>
          </li>
          <li>
            <p>Coming up in October: Gate 2 exit sensor repair, quarterly HVAC service in Building D, and {LEADS.length} reservations due to move in.</p>
          </li>
        </ol>
      </section>

      <div className="pa-grid pa-grid--rep">
        <Section title="Revenue" action={<span className="pa-meta">12 months · {fmt.money(MONTHLY.reduce((s, m) => s + m.revenue, 0))}</span>}>
          <BarChart data={MONTHLY.map(m => ({ label: m.m, value: m.revenue, note: `${m.m} ${m.y}` }))} format={v => fmt.money(v)} yFormat={v => "$" + Math.round(v / 1000) + "k"} height={200} />
        </Section>
        <Section title="Occupancy" action={<span className="pa-meta">month end · by unit</span>}>
          <LineChart data={MONTHLY.map(m => ({ label: m.m, value: m.occupancy, note: `${m.m} ${m.y}` }))} format={v => (v * 100).toFixed(1) + "%"} domain={[0.82, 0.9]} height={200} />
        </Section>
        <Section
          title="Move-ins and move-outs"
          action={
            <span className="pa-legend">
              <span>
                <i className="pa-sw--a" />
                Move-ins
              </span>
              <span>
                <i className="pa-sw--b" />
                Move-outs
              </span>
            </span>
          }
        >
          <PairBarChart data={MONTHLY.map(m => ({ label: m.m, a: m.moveIns, b: m.moveOuts, note: `${m.m} ${m.y}` }))} aLabel="Move-ins" bLabel="Move-outs" height={200} />
        </Section>
        <Section title="Where September's revenue came from" action={<span className="pa-meta">{fmt.money(sept.revenue)}</span>}>
          <MeterList
            format={v => (v * 100).toFixed(1) + "%"}
            rows={[
              { label: "Rent", value: rent / sept.revenue, sub: fmt.money(rent) },
              { label: "Protection", value: prot / sept.revenue, sub: fmt.money(prot) + ` · ${plans()} plans`, tone: "neutral" },
              { label: "Fees", value: fees / sept.revenue, sub: fmt.money(fees) + " · admin and late fees", tone: "neutral" },
            ]}
          />
          <p className="ov-note pa-mix-note">Protection attach rate is {attach()}%, up from {attach() - 8}% after checkout started recommending a plan.</p>
        </Section>
      </div>

      <Section title="Month by month" flush>
        <div className="z-table-wrap">
          <table className="z-table pa-table">
            <thead>
              <tr>
                <th>Month</th>
                <th className="num">Revenue</th>
                <th className="num">Change</th>
                <th className="num">Occupancy</th>
                <th className="num">Move-ins</th>
                <th className="num">Move-outs</th>
                <th className="num">Net</th>
              </tr>
            </thead>
            <tbody>
              {MONTHLY.slice()
                .reverse()
                .map((m, i, arr) => {
                  const prev = arr[i + 1];
                  const ch = prev ? m.revenue / prev.revenue - 1 : null;
                  return (
                    <tr key={m.m + m.y} className={i === 0 ? "pa-hl" : ""}>
                      <td>
                        {m.m} {m.y}
                      </td>
                      <td className="num mono">{fmt.money(m.revenue)}</td>
                      <td className={`num mono ${ch !== null && ch < 0 ? "bad" : "faint"}`}>{ch === null ? "—" : (ch >= 0 ? "+" : "") + (ch * 100).toFixed(1) + "%"}</td>
                      <td className="num mono">{fmt.pct(m.occupancy)}</td>
                      <td className="num mono">{m.moveIns}</td>
                      <td className="num mono">{m.moveOuts}</td>
                      <td className="num mono">{m.moveIns - m.moveOuts > 0 ? "+" : ""}{m.moveIns - m.moveOuts}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Delivery" action={<Switch on={sched} label="Scheduled delivery" onChange={v => (setSched(v), toast({ title: v ? "Owner report scheduled" : "Schedule paused", body: v ? "Sends on the 1st of every month at 6:00 am." : "Send it by hand from here.", tone: "info" }))} />}>
        <div className="pa-deliv">
          <span className="pa-deliv-ic">
            <CalendarClock size={15} />
          </span>
          <div>
            <b>{sched ? "1st of every month, 6:00 am" : "Paused"}</b>
            <span>PDF and CSV · next send Nov 1</span>
          </div>
          <div className="pa-deliv-to">
            {["Daniel Osei", "Priya Raman"].map(n => (
              <span key={n} className="pa-chip-p">
                <Avatar name={n} size="sm" />
                {n}
                <span className="faint">{n === "Daniel Osei" ? "owner" : "manager"}</span>
              </span>
            ))}
          </div>
        </div>
      </Section>
    </div>
  );
}

function ordinal(n: number) {
  return ["zeroth", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth", "eleventh"][n] ?? n + "th";
}

function OtherReport({ id }: { id: string }) {
  if (id === "rentroll") {
    const rows = UNITS.filter(u => u.tenantId).slice(0, 24);
    const rent = TENANTS.reduce((s, t) => s + t.rent, 0);
    return (
      <div className="pa-doc-b">
        <StatRow>
          <Stat label="Occupied units" value={String(UNITS.filter(u => u.tenantId).length)} />
          <Stat label="Monthly rent" value={fmt.money(rent)} />
          <Stat label="Past due" value={fmt.money(DELINQUENT.reduce((s, t) => s + t.balance, 0))} tone="warn" delta={`${DELINQUENT.length} tenants`} />
        </StatRow>
        <ReportTable
          head={["Unit", "Tenant", "Size", "Rent", "Street", "Balance", "Since"]}
          num={[3, 4, 5]}
          rows={rows.map(u => {
            const t = tenantForUnit(u)!;
            return [<span className="mono pa-id">{u.id}</span>, t.name, <span className="mono">{sizeLabel(u.size)}</span>, fmt.money(t.rent), fmt.money(u.rate), t.balance ? <span className="bad">{fmt.money(t.balance)}</span> : "—", fmt.short(t.moveIn) + " " + t.moveIn.slice(2, 4)];
          })}
          foot={`Showing 24 of ${UNITS.filter(u => u.tenantId).length} · the CSV has every row`}
        />
      </div>
    );
  }
  if (id === "occupancy") {
    const mix = SIZES.map(size => {
      const all = UNITS.filter(u => u.size === size && u.status !== "maintenance");
      const taken = all.filter(u => !["vacant", "reserved"].includes(u.status)).length;
      return { size, total: all.length, taken, free: all.filter(u => u.status === "vacant").length, rate: taken / all.length, street: all[0]?.rate ?? 0 };
    });
    const occ = occupancy();
    return (
      <div className="pa-doc-b">
        <StatRow>
          <Stat label="By unit" value={fmt.pct(occ.byUnit)} />
          <Stat label="By sq ft" value={fmt.pct(occ.bySqft)} />
          <Stat label="Available" value={String(occ.vacant)} />
        </StatRow>
        <Section title="Occupancy by size">
          <MeterList rows={mix.map(m => ({ label: sizeLabel(m.size), value: m.rate, tone: m.rate < 0.85 ? "warn" : "accent" }))} />
        </Section>
        <ReportTable head={["Size", "Units", "Occupied", "Available", "Occupancy"]} num={[1, 2, 3, 4]} rows={mix.map(m => [<span className="mono">{sizeLabel(m.size)}</span>, m.total, m.taken, m.free, fmt.pct(m.rate)])} />
      </div>
    );
  }
  if (id === "delinquency") {
    const b = (a: number, z: number) => DELINQUENT.filter(t => t.daysLate >= a && t.daysLate <= z);
    const sum = (l: typeof DELINQUENT) => l.reduce((s, t) => s + t.balance, 0);
    return (
      <div className="pa-doc-b">
        <StatRow>
          <Stat label="1–30 days" value={fmt.money(sum(b(1, 30)))} delta={`${b(1, 30).length} tenants`} tone="warn" />
          <Stat label="31–60 days" value={fmt.money(sum(b(31, 60)))} delta={`${b(31, 60).length} tenants`} tone="bad" />
          <Stat label="60+ days" value={fmt.money(sum(b(61, 999)))} delta={`${b(61, 999).length} tenants`} tone="neutral" />
        </StatRow>
        <ReportTable
          head={["Tenant", "Unit", "Days", "Balance", "Status", "Last contact"]}
          num={[2, 3]}
          rows={DELINQUENT.map(t => {
            const u = UNIT_BY_ID.get(t.unitIds[0]);
            return [
              <button className="pa-plain" onClick={() => go("ops/tenants/" + t.id)}>
                {t.name}
              </button>,
              <span className="mono">{t.unitIds[0]}</span>,
              t.daysLate,
              fmt.money(t.balance),
              u?.status === "overlocked" ? <Pill tone="bad">Overlocked</Pill> : <Pill tone="warn">Reminders</Pill>,
              <span className="muted">{t.lastContact ?? "—"}</span>,
            ];
          })}
        />
      </div>
    );
  }
  if (id === "moves") {
    return (
      <div className="pa-doc-b">
        <StatRow>
          <Stat label="Move-ins · 12 mo" value={String(MONTHLY.reduce((s, m) => s + m.moveIns, 0))} />
          <Stat label="Move-outs · 12 mo" value={String(MONTHLY.reduce((s, m) => s + m.moveOuts, 0))} />
          <Stat label="Net" value={"+" + MONTHLY.reduce((s, m) => s + m.moveIns - m.moveOuts, 0)} tone="ok" />
        </StatRow>
        <Section title="By month" action={<span className="pa-legend"><span><i className="pa-sw--a" />Move-ins</span><span><i className="pa-sw--b" />Move-outs</span></span>}>
          <PairBarChart data={MONTHLY.map(m => ({ label: m.m, a: m.moveIns, b: m.moveOuts, note: `${m.m} ${m.y}` }))} aLabel="Move-ins" bLabel="Move-outs" height={220} />
        </Section>
      </div>
    );
  }
  if (id === "ecri") {
    const rows = UNITS.filter(u => u.tenantId)
      .map(u => ({ u, t: tenantForUnit(u)! }))
      .filter(x => x.t.daysLate === 0)
      .map(x => ({ ...x, gap: x.t.rent / x.u.rate - 1 }))
      .sort((a, b) => a.gap - b.gap)
      .slice(0, 15);
    const lift = rows.reduce((s, r) => s + Math.round((r.u.rate - r.t.rent) * 0.5), 0);
    return (
      <div className="pa-doc-b">
        <StatRow>
          <Stat label="Candidates" value={String(rows.length)} sub="paid up, 12+ months" />
          <Stat label="Proposed lift" value={fmt.money(lift) + "/mo"} tone="ok" delta="half the gap" />
          <Stat label="Notice period" value="30 days" sub="California" />
        </StatRow>
        <ReportTable
          head={["Tenant", "Unit", "Rent", "Street", "Gap", "Proposed"]}
          num={[2, 3, 4, 5]}
          rows={rows.map(r => [r.t.name, <span className="mono">{r.u.id}</span>, fmt.money(r.t.rent), fmt.money(r.u.rate), <span className="warn-t">{(r.gap * 100).toFixed(0)}%</span>, fmt.money(r.t.rent + Math.round((r.u.rate - r.t.rent) * 0.5))])}
          foot={
            <Button size="sm" icon={<Sparkles />} onClick={() => askAgent("Run a rate review on tenants more than 15% below street")}>
              Preview notices with the agent
            </Button>
          }
        />
      </div>
    );
  }
  if (id === "gate") {
    return (
      <div className="pa-doc-b">
        <StatRow>
          <Stat label="Events today" value={String(GATE_EVENTS.length)} />
          <Stat label="Denied" value={String(GATE_EVENTS.filter(e => e.kind === "denied").length)} tone="bad" />
          <Stat label="Keypad exits" value={String(GATE_EVENTS.filter(e => e.kind === "fallback").length)} tone="warn" />
        </StatRow>
        <ReportTable
          head={["Time", "Device", "Who", "Unit", "Event"]}
          rows={GATE_EVENTS.slice(0, 30).map(e => [<span className="mono">{e.at}</span>, GATE_BY_ID.get(e.gate)?.short, e.who, <span className="mono">{e.unitId ?? "—"}</span>, KIND_TEXT[e.kind]])}
          foot={`Showing the latest 30 of ${GATE_EVENTS.length}`}
        />
      </div>
    );
  }
  const rows: [string, number, string][] = [
    ["Admin fees · 12 move-ins", 12 * 25, "$25 each"],
    ["Late fees", 186, "8 tenants · $15 after 5 days, $45 after 30"],
    ["Protection premiums", 2419, `${plans()} plans · carrier remits monthly`],
    ["Overlock and cut-lock fees", 0, "waived for 2 tenants"],
  ];
  return (
    <div className="pa-doc-b">
      <StatRow>
        <Stat label="Fees and premiums · Sep" value={fmt.money(rows.reduce((s, r) => s + r[1], 0))} />
        <Stat label="Protection attach rate" value={attach() + "%"} tone="ok" delta="+8 pts" sub="YoY" />
        <Stat label="Sales tax due" value="$0" sub="storage rent exempt in CA" />
      </StatRow>
      <Section title="September">
        <KV items={rows.map(r => [r[0], <span><b className="tnum">{fmt.money(r[1])}</b> <span className="faint">· {r[2]}</span></span>])} />
      </Section>
    </div>
  );
}

function ReportTable({ head, rows, num = [], foot }: { head: string[]; rows: React.ReactNode[][]; num?: number[]; foot?: React.ReactNode }) {
  return (
    <Section flush>
      <div className="z-table-wrap">
        <table className="z-table pa-table">
          <thead>
            <tr>
              {head.map((h, i) => (
                <th key={h} className={num.includes(i) ? "num" : ""}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (
                  <td key={j} className={num.includes(j) ? "num tnum" : ""}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {foot && <div className="pa-pager">{typeof foot === "string" ? <span className="mono faint">{foot}</span> : foot}</div>}
    </Section>
  );
}
