import React, { useState } from "react";
import { Sparkles, ArrowUpRight, CreditCard, KeyRound, Wrench, CircleCheck, DoorOpen, Phone, UserPlus, Bell, ChevronRight } from "lucide-react";
import { Page, PageHeader, Section, Stat, StatRow } from "../kit";
import { Button, Pill, Seg, StatusSwatch } from "../../ui";
import { BarChart, LineChart, MeterList } from "../../ui/charts";
import { activity, askAgent, fmt, go, useDemo, type Activity } from "../../state/store";
import { UNITS, occupancy, type UnitSize, type UnitStatus } from "../../data/facility";
import { DELINQUENT, MONTHLY, SEPT_LAST_YEAR, TENANTS } from "../../data/tenants";
import { FacilityView } from "../../three/FacilityView";
import "../../styles/ops-overview.css";

const SIZES: UnitSize[] = ["5x5", "5x10", "10x10", "10x15", "10x20", "10x30", "12x40"];
const STATUS_ORDER: UnitStatus[] = ["vacant", "reserved", "delinquent", "overlocked", "maintenance", "occupied"];

const TODAY = [
  { t: "9:42 am", title: "Maya Chen moved in online", meta: "A-126 · 10×10 · lease signed", done: true },
  { t: "11:00 am", title: "Walk-in tour, Jordan Lee", meta: "Looking for a 10×10 today" },
  { t: "1:00 pm", title: "HVAC service, Building D", meta: "Lakeside Mechanical · temporary gate code" },
  { t: "3:30 pm", title: "Move-out inspection, Ben Carter", meta: "B-141 · prepaid through Oct 31" },
  { t: "5:00 pm", title: "Lien sale prep", meta: "A-131 · Dana Whitfield · 47 days past due" },
];

const FEED_ICON: Record<Activity["kind"], React.ReactNode> = {
  gate: <KeyRound />, payment: <CreditCard />, agent: <Sparkles />, movein: <DoorOpen />, moveout: <DoorOpen />, alert: <Bell />, lead: <UserPlus />, call: <Phone />, lease: <CircleCheck />, rate: <ArrowUpRight />, maintenance: <Wrench />,
};

export default function OverviewPage() {
  useDemo();
  const [range, setRange] = useState<"mtd" | "12m">("12m");
  const occ = occupancy();
  const late = TENANTS.filter(t => t.daysLate > 0);
  const lateDollars = late.reduce((s, t) => s + t.balance, 0);
  const monthlyRent = TENANTS.reduce((s, t) => s + t.rent, 0);
  const sept = MONTHLY[MONTHLY.length - 1];
  const aug = MONTHLY[MONTHLY.length - 2];
  const yoy = sept.revenue / SEPT_LAST_YEAR.revenue - 1;
  const inPlace = TENANTS.reduce((s, t) => s + t.rent, 0) / TENANTS.length;
  const street = UNITS.reduce((s, u) => s + u.rate, 0) / UNITS.length;
  const okafor = TENANTS.find(t => t.last === "Okafor");
  const failed = TENANTS.filter(t => t.autopay && t.daysLate > 0).slice(0, 5);
  const counts = STATUS_ORDER.map(s => ({ s, n: UNITS.filter(u => u.status === s).length }));
  const months = range === "12m" ? MONTHLY : MONTHLY.slice(-3);

  const mix = SIZES.map(size => {
    const all = UNITS.filter(u => u.size === size && u.status !== "maintenance");
    const taken = all.filter(u => u.status !== "vacant" && u.status !== "reserved").length;
    return { size, total: all.length, rate: taken / Math.max(1, all.length), free: all.filter(u => u.status === "vacant").length };
  });

  const attention = [
    {
      icon: <CreditCard />,
      text: okafor && okafor.balance > 0 ? (
        <>
          <b>{okafor.name}</b> is {okafor.daysLate} days past due on A-122 ({fmt.money(okafor.balance)}). Unit is overlocked.
        </>
      ) : (
        <>
          <b>Matthew Okafor</b> is paid up. A-122 is unlocked.
        </>
      ),
      action: okafor && okafor.balance > 0 ? "Take payment" : "View",
      run: () => (okafor && okafor.balance > 0 ? askAgent("Matthew came in and paid $240 cash") : go("ops/tenants/" + okafor?.id)),
    },
    {
      icon: <Bell />,
      text: (
        <>
          <b>{failed.length} autopay charges</b> failed overnight ({fmt.money(failed.reduce((s, t) => s + t.balance, 0))}). Cards expired or declined.
        </>
      ),
      action: "Send update links",
      run: () => askAgent("Fix last night's autopay failures"),
    },
    {
      icon: <Wrench />,
      text: (
        <>
          <b>Gate 2 exit sensor</b> has been offline since 8:52 am. Exits are falling back to the keypad.
        </>
      ),
      action: "Open work order",
      run: () => go("ops/maintenance"),
    },
  ];

  return (
    <Page className="ov">
      <PageHeader
        title="Overview"
        sub="Alder Lake · Friday, October 2"
        actions={
          <>
            <Seg value={range} onChange={setRange} options={[{ value: "mtd", label: "Last 3 months" }, { value: "12m", label: "12 months" }]} />
            <Button>Export</Button>
          </>
        }
      />

      <section className="ov-brief">
        <div className="ov-brief-h">
          <span className="ov-brief-ic">
            <Sparkles size={14} />
          </span>
          <div>
            <b>3 things need you today</b>
            <span>The agent handled 14 tasks since 6:00 am. Review them in the activity feed.</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => askAgent("What needs my attention today?")}>
            Open briefing <ChevronRight />
          </Button>
        </div>
        <ul className="ov-brief-list">
          {attention.map((a, i) => (
            <li key={i}>
              <span className="ov-brief-li">{a.icon}</span>
              <p>{a.text}</p>
              <Button size="sm" onClick={a.run}>
                {a.action}
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <StatRow>
        <Stat label="Occupancy" value={fmt.pct(occ.byUnit)} delta={`${occ.byUnit - aug.occupancy >= 0 ? "+" : ""}${((occ.byUnit - aug.occupancy) * 100).toFixed(1)} pts`} tone="ok" sub="vs Aug" spark={MONTHLY.map(m => m.occupancy)} />
        <Stat label="Revenue · Sep" value={fmt.money(sept.revenue)} delta={`+${(yoy * 100).toFixed(1)}%`} tone="ok" sub="YoY" spark={MONTHLY.map(m => m.revenue)} />
        <Stat label="Past due" value={fmt.money(lateDollars)} delta={`${late.length} tenants`} tone="warn" sub={`${((late.length / TENANTS.length) * 100).toFixed(1)}% of tenants`} />
        <Stat label="Move-ins · Sep" value={`${sept.moveIns}`} delta={`${sept.moveIns - sept.moveOuts >= 0 ? "+" : ""}${sept.moveIns - sept.moveOuts} net`} tone="ok" sub={`${sept.moveOuts} move-outs`} />
        <Stat label="Avg rent vs street" value={`${fmt.money(inPlace)}`} delta={`−${fmt.money(street - inPlace)}`} tone="neutral" sub={`street ${fmt.money(street)}`} />
      </StatRow>

      <div className="ov-grid ov-grid--charts">
        <Section title="Revenue" action={<span className="ov-legend tnum">{fmt.money(months.reduce((s, m) => s + m.revenue, 0))} total</span>}>
          <BarChart data={months.map(m => ({ label: m.m, value: m.revenue, note: `${m.m} ${m.y}` }))} format={v => fmt.money(v)} yFormat={v => "$" + Math.round(v / 1000) + "k"} height={220} />
        </Section>
        <Section title="Occupancy" action={<span className="ov-legend tnum">by unit count</span>}>
          <LineChart data={months.map(m => ({ label: m.m, value: m.occupancy, note: `${m.m} ${m.y}` }))} format={v => (v * 100).toFixed(1) + "%"} domain={[0.82, 0.9]} height={220} />
        </Section>
      </div>

      <div className="ov-grid ov-grid--three">
        <Section title="Today" action={<span className="ov-legend">5 events</span>}>
          <ol className="ov-today">
            {TODAY.map(e => (
              <li key={e.t} className={e.done ? "done" : ""}>
                <span className="ov-today-t mono">{e.t}</span>
                <span className="ov-today-dot" />
                <div>
                  <b>{e.title}</b>
                  <span>{e.meta}</span>
                </div>
              </li>
            ))}
          </ol>
        </Section>
        <Section title="Activity" action={<Pill tone="ok" dot live>Live</Pill>}>
          <ul className="ov-feed">
            {activity.slice(0, 7).map(a => (
              <li key={a.id}>
                <span className={`ov-feed-ic ${a.kind === "agent" ? "ov-feed-ic--agent" : ""}`}>{FEED_ICON[a.kind]}</span>
                <p>{a.text}</p>
                <span className="ov-feed-t mono">{a.at}</span>
              </li>
            ))}
          </ul>
        </Section>
        <Section title="Occupancy by size" action={<span className="ov-legend">{occ.vacant} available</span>}>
          <MeterList
            format={v => (v * 100).toFixed(0) + "%"}
            rows={mix.map(m => ({ label: m.size.replace("x", "×"), value: m.rate, tone: m.rate < 0.85 ? "warn" : "accent" }))}
          />
          <p className="ov-note">10×20s are the soft spot at {(mix.find(m => m.size === "10x20")!.rate * 100).toFixed(0)}%.</p>
        </Section>
      </div>

      <Section
        title="Facility"
        className="ov-twin"
        action={
          <Button size="sm" onClick={() => go("ops/facility")}>
            Open digital twin <ArrowUpRight />
          </Button>
        }
      >
        <div className="ov-twin-b">
          <div className="ov-twin-v">
            <FacilityView mode="ops" view={{ zoom: 1.15, az: 0.62, el: 0.66, x: -5, z: 0 }} />
          </div>
          <ul className="ov-twin-l">
            {counts.map(c => (
              <li key={c.s}>
                <StatusSwatch status={c.s} />
                <span className="tnum">{c.n}</span>
              </li>
            ))}
            <li className="ov-twin-tot">
              <span>Total units</span>
              <span className="tnum">{UNITS.length}</span>
            </li>
          </ul>
        </div>
      </Section>
    </Page>
  );
}
