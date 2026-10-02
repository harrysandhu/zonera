import React, { useMemo, useState } from "react";
import { Search, ArrowLeft, ArrowUpRight, Check, Minus, X as XIcon, ChevronDown } from "lucide-react";
import { go, toast } from "../../state/store";
import { Button, Pill, Avatar, type Tone } from "../../ui";
import { Page, PageHeader, Section, Stat, StatRow, Chips, KV, Empty } from "../../ops/kit";
import { fde, useFde, portfolioDelta, stage, STAGES, elapsed } from "../fde/engine";
import { FACILITIES, ALDER_LAKE, SUMMARY } from "../fde/data/portfolio";
import { DEAL } from "../fde/data/deal";
import { N } from "../fde/data/vms";
import type { PortfolioFacility, FacilityStatus } from "../fde/types";
import "../../styles/admin-pages.css";

// Facilities: every site on Zonera. Alder Lake joins the list the moment it cuts over.

const nf = (n: number) => n.toLocaleString("en-US");
const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
const STATUS: Record<FacilityStatus, { label: string; tone: Tone }> = {
  live: { label: "Live", tone: "ok" },
  trial: { label: "Trial", tone: "accent" },
  "churn-risk": { label: "At risk", tone: "bad" },
  onboarding: { label: "Onboarding", tone: "violet" },
};
const DEMO = ["F-11042", "F-10000", "F-10001"];

type Filter = "all" | "live" | "trial" | "churn-risk";

function list(): PortfolioFacility[] {
  return portfolioDelta.live ? [ALDER_LAKE, ...FACILITIES] : FACILITIES;
}

export function Facilities() {
  useFde();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [limit, setLimit] = useState(50);
  const all = list();
  const needle = q.trim().toLowerCase();
  const rows = useMemo(
    () =>
      all.filter(f => (filter === "all" || f.status === filter) && (!needle || `${f.name} ${f.org} ${f.city} ${f.state} ${f.id} ${f.from} ${f.gate}`.toLowerCase().includes(needle))),
    [all, filter, needle],
  );
  const count = (s: Filter) => (s === "all" ? all.length : all.filter(f => f.status === s).length);
  const units = all.reduce((a, f) => a + f.units, 0);
  const occ = all.reduce((a, f) => a + f.occupancy * f.units, 0) / units;
  const states = new Set(all.map(f => f.state)).size;

  return (
    <Page className="sa-fa">
      <PageHeader title="Facilities" sub={`${nf(all.length)} facilities across ${states} states and ${nf(SUMMARY.orgs)} operators.`} />

      <StatRow>
        <Stat label="Facilities" value={nf(all.length)} sub={`${count("trial")} in trial`} />
        <Stat label="Units" value={nf(units)} sub="under management" />
        <Stat label="Occupancy" value={`${(occ * 100).toFixed(1)}%`} sub="unit-weighted" />
        <Stat label="MRR" value={money(SUMMARY.mrr + portfolioDelta.live * ALDER_LAKE.mrr)} sub={`ARR $${((SUMMARY.arr + portfolioDelta.live * ALDER_LAKE.mrr * 12) / 1e6).toFixed(2)}M`} />
      </StatRow>

      <div className="sa-fa-tools">
        <label className="sa-fa-search">
          <Search size={14} />
          <input
            className="z-input"
            value={q}
            placeholder="Search name, operator, city, legacy system…"
            onChange={e => {
              setQ(e.target.value);
              setLimit(50);
            }}
          />
          {q && (
            <button aria-label="Clear search" onClick={() => setQ("")}>
              <XIcon size={13} />
            </button>
          )}
        </label>
        <Chips
          value={filter}
          onChange={v => {
            setFilter(v);
            setLimit(50);
          }}
          options={[
            { value: "all", label: "All", count: count("all") },
            { value: "live", label: "Live", count: count("live") },
            { value: "trial", label: "Trial", count: count("trial") },
            { value: "churn-risk", label: "At risk", count: count("churn-risk") },
          ]}
        />
      </div>

      <Section flush>
        <div className="z-table-wrap">
          <table className="z-table sa-fa-table">
            <thead>
              <tr>
                <th>Facility</th>
                <th>Status</th>
                <th>Location</th>
                <th className="num">Units</th>
                <th className="num">Occupancy</th>
                <th>Plan</th>
                <th className="num">MRR</th>
                <th>Migrated from</th>
                <th>Gate</th>
                <th>Health</th>
                <th className="num">Touches</th>
                <th className="num">Call → live</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, limit).map(f => (
                <tr key={f.id} onClick={() => go(`admin/facility/${f.id}`)} className={f.id === ALDER_LAKE.id ? "is-new" : ""}>
                  <td>
                    <div className="sa-fa-name">
                      <b>
                        {f.name}
                        {f.id === ALDER_LAKE.id && <span className="sa-fa-new">New today</span>}
                      </b>
                      <small>
                        <span className="mono">{f.id}</span> · {f.org}
                      </small>
                    </div>
                  </td>
                  <td>
                    <Pill tone={STATUS[f.status].tone} dot>
                      {STATUS[f.status].label}
                    </Pill>
                  </td>
                  <td className="muted">
                    {f.city}, {f.state}
                  </td>
                  <td className="num">{nf(f.units)}</td>
                  <td className="num">{(f.occupancy * 100).toFixed(1)}%</td>
                  <td className="muted">{f.plan}</td>
                  <td className="num">{money(f.mrr)}</td>
                  <td>{f.from}</td>
                  <td className="muted">{f.gate}</td>
                  <td>
                    <span className="sa-fa-health">
                      <span>
                        <i style={{ width: `${f.health}%` }} className={f.health < 55 ? "bad" : f.health < 80 ? "mid" : ""} />
                      </span>
                      <em className="mono">{f.health}</em>
                    </span>
                  </td>
                  <td className="num mono">{f.touches}</td>
                  <td className="num mono">{f.hoursToLive}h</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <Empty title="No facilities match" body="Try a city, an operator or a legacy system like SiteLink." />}
        </div>
        <div className="sa-fa-pager">
          <span className="mono faint">
            {nf(Math.min(limit, rows.length))} of {nf(rows.length)}
          </span>
          {rows.length > limit && (
            <Button size="sm" icon={<ChevronDown />} onClick={() => setLimit(l => l + 50)}>
              Show 50 more
            </Button>
          )}
        </div>
      </Section>
    </Page>
  );
}

// ---- detail -----------------------------------------------------------------------------------

function hash(s: string) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h;
}
function stripeId(f: PortfolioFacility) {
  if (f.org === "Brennan Storage Co.") return "sub_1Q8bRnN4tL2kV7wX";
  const a = hash(f.id).toString(36), b = hash(f.org).toString(36);
  return `sub_1Q8${(a + b).slice(0, 14)}`;
}
const FIRST = ["Dana", "Marcus", "Elena", "Victor", "Hannah", "Tom", "Rosa", "Kevin", "Amara", "Luis", "Grace", "Owen", "Nina", "Caleb", "Iris", "Sam"];
const LAST = ["Holloway", "Ortiz", "Nguyen", "Park", "Becker", "Shah", "Morales", "Kim", "Reyes", "Okoro", "Walsh", "Chen", "Duarte", "Fischer"];
function person(seed: number) {
  return `${FIRST[seed % FIRST.length]} ${LAST[(seed >>> 4) % LAST.length]}`;
}
function addDays(iso: string, d: number) {
  const t = new Date(iso + "T12:00:00");
  t.setDate(t.getDate() + d);
  return t.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function FacilityDetail({ id }: { id: string }) {
  useFde();
  const isAlder = id === ALDER_LAKE.id;
  const base = isAlder ? ALDER_LAKE : FACILITIES.find(f => f.id === id);
  if (!base)
    return (
      <Page className="sa-fa">
        <Empty title={`No facility ${id}`} body="It may have been merged or removed." action={<Button onClick={() => go("admin/facilities")}>All facilities</Button>} />
      </Page>
    );
  const f: PortfolioFacility = isAlder && !portfolioDelta.live ? { ...base, status: "onboarding", since: "—", touches: fde.touches } : isAlder ? { ...base, touches: fde.touches || base.touches } : base;
  const brennan = f.org === "Brennan Storage Co.";
  const st = STATUS[f.status];
  const demo = DEMO.includes(f.id);
  const seed = hash(f.id);
  const autopay = Math.round(f.units * f.occupancy * 0.58);
  const onboarding = isAlder && !portfolioDelta.live;
  const stageLabel = STAGES.find(s => s.id === stage())?.label ?? "Context";

  const openConsole = () => {
    if (demo) go("ops/overview");
    else toast({ title: "Operator console is demo-only", body: `The console opens for Alder Lake, Dolores and Pier 7 in this demo. ${f.name} runs the same console in production.`, tone: "info" });
  };

  const sub: [React.ReactNode, React.ReactNode][] = brennan
    ? [
        ["Plan", "Professional · $999/mo for up to 5 facilities"],
        ["Covers", "3 of 5 facilities · Alder Lake, Dolores, Pier 7"],
        ["Stripe", <span className="mono">{stripeId(f)}</span>],
        ["Status", onboarding && !fde.subscription ? <Pill tone="neutral">Created at signing</Pill> : <Pill tone="accent" dot>Trialing · 60 days free</Pill>],
        ["Trial ends", DEAL.trialEnds],
        ["First invoice", DEAL.firstInvoice],
        ["Term", "12 months · price locked 24 months"],
        ["Payouts", "Sierra Pacific Credit Union ••••0918"],
      ]
    : [
        ["Plan", f.plan === "Starter" ? "Starter · $499/mo" : f.plan === "Professional" ? "Professional · $999/mo for up to 5 facilities" : "Enterprise · portfolio pricing"],
        ["This facility", `${money(f.mrr)}/mo`],
        ["Stripe", <span className="mono">{stripeId(f)}</span>],
        ["Status", f.status === "trial" ? <Pill tone="accent" dot>Trialing · ends {addDays(f.since, 60)}</Pill> : <Pill tone={f.status === "churn-risk" ? "bad" : "ok"} dot>{f.status === "churn-risk" ? "Active · health below 55" : "Active · renews monthly"}</Pill>],
        ["Customer since", f.since === "—" ? "—" : addDays(f.since, 0)],
        ["Term", f.plan === "Enterprise" ? "24 months" : "12 months"],
      ];

  const legacy = f.from === "Spreadsheets / paper" ? "Spreadsheets · imported, originals archived" : `${f.from === "Keystone" ? "Keystone 8.4" : f.from} · ${onboarding ? "read-only during migration" : "archived read-only"}`;
  const integrations: [React.ReactNode, React.ReactNode][] = [
    ["Gate", f.gate === "None" ? <span className="faint">No gate system</span> : <Ok text={`${f.gate}${brennan ? " · site 4471" : ""} · ${onboarding && !fde.mails.includes("dealerReply") ? "waiting on dealer key" : "codes synced"}`} done={!(onboarding && !fde.mails.includes("dealerReply"))} />],
    ["Payments", <Ok text={`Stripe · ${brennan && isAlder ? N.autopay : autopay} autopays as network tokens`} done={!onboarding || fde.tasks.T9?.state === "done"} />],
    ["Phones", <Ok text={`Zonera Voice · after hours${brennan ? " (530) 555-0142" : ""}`} done={!onboarding || fde.tasks.T12?.state === "done"} />],
    ["Legacy source", legacy],
  ];

  const users = brennan
    ? [
        { name: "Gail Brennan", role: "Owner", sub: "gail@brennanstorage.com · all facilities" },
        { name: "Priya Raman", role: "Manager", sub: "Alder Lake · no payouts, no owner reports" },
      ]
    : [
        { name: person(seed), role: "Owner", sub: `${f.plan === "Enterprise" ? "portfolio admin" : "all facilities"}` },
        { name: person(seed >>> 7), role: "Manager", sub: `${f.name.split(" ")[0]} · no financials` },
      ];

  return (
    <Page className="sa-fa">
      <button className="sa-fa-back" onClick={() => go("admin/facilities")}>
        <ArrowLeft size={14} /> Facilities
      </button>
      <PageHeader
        title={
          <span className="sa-fa-title">
            {f.name}
            <Pill tone={st.tone} dot live={onboarding}>
              {onboarding ? `Onboarding · ${stageLabel}` : st.label}
            </Pill>
          </span>
        }
        sub={
          <>
            <span className="mono">{f.id}</span> · {f.org} · {f.city}, {f.state} · {f.plan}
          </>
        }
        actions={
          <>
            {brennan && (
              <Button onClick={() => go("admin/onboard/brennan")}>
                Onboarding workspace
              </Button>
            )}
            <Button variant="primary" onClick={openConsole}>
              Open operator console <ArrowUpRight />
            </Button>
          </>
        }
      />

      <StatRow>
        <Stat label="Units" value={nf(f.units)} sub={`${Math.round(f.units * f.occupancy)} occupied`} />
        <Stat label="Occupancy" value={`${(f.occupancy * 100).toFixed(1)}%`} sub="by unit count" />
        <Stat label="MRR" value={money(f.mrr)} sub={brennan ? "share of $999 plan" : f.plan} />
        <Stat label="Health" value={f.health} sub={f.health >= 90 ? "healthy" : f.health >= 55 ? "watch" : "at risk"} />
        <Stat label="Call to live" value={onboarding ? elapsed() : `${f.hoursToLive}h`} sub={onboarding ? "and counting" : `${f.touches} human touch${f.touches === 1 ? "" : "es"}`} />
      </StatRow>

      <div className="sa-fa-grid">
        <Section title="Subscription">
          <KV items={sub} />
        </Section>
        <Section title="Integrations">
          <KV items={integrations} />
        </Section>
        <Section title="Onboarding">
          <KV
            items={[
              ["Migrated from", f.from === "Keystone" ? "Keystone Storage Manager 8.4" : f.from],
              ["Call to live", onboarding ? `${elapsed()} so far` : `${f.hoursToLive} hours`],
              ["Human touches", onboarding ? `${fde.touches} so far` : String(f.touches)],
              ["Cut over", onboarding ? "Scheduled 5:45 am, before the gate opens" : isAlder ? DEAL.cutoverAt : f.since === "—" ? "—" : addDays(f.since, 0)],
              ["Verified by", "Independent validator · two-key rule"],
              ["Owner time", brennan ? "About 9 minutes in the portal" : `About ${6 + (seed % 9)} minutes in the portal`],
            ]}
          />
        </Section>
        <Section title="Users">
          <ul className="sa-fa-users">
            {users.map(u => (
              <li key={u.name}>
                <Avatar name={u.name} size="sm" />
                <div>
                  <b>{u.name}</b>
                  <small>{u.sub}</small>
                </div>
                <Pill tone={u.role === "Owner" ? "neutral" : "accent"}>{u.role}</Pill>
              </li>
            ))}
          </ul>
        </Section>
        <Section title="Agent permissions" className="sa-fa-wide">
          <ul className="sa-fa-perms">
            <Perm kind="allow" title="Operator agent" body="Rents and reserves units, takes payments, issues and revokes gate codes." />
            <Perm kind="allow" title="Collections agent" body={brennan ? "Text day 1, $25 fee day 6, overlock day 10, lien notice day 14." : "Runs the owner's late-payment playbook as confirmed in onboarding."} />
            <Perm kind="limit" title="Rates" body={brennan ? "Existing rents held until April 2027. New move-ins at street rate." : "Agent proposes changes; the owner approves every notice."} />
            <Perm kind="deny" title="Payouts and bank details" body="No agent can change where money goes. Owner only, with 2FA." />
            <Perm kind="deny" title="Onboarding VMs" body={onboarding ? "8 VMs hold staging-only roles until cutover, then are destroyed." : "None. VMs were destroyed at cutover and legacy credentials revoked."} />
          </ul>
        </Section>
      </div>
    </Page>
  );
}

function Ok({ text, done }: { text: string; done: boolean }) {
  return (
    <span className={`sa-fa-ok ${done ? "" : "is-wait"}`}>
      <i />
      {text}
    </span>
  );
}

function Perm({ kind, title, body }: { kind: "allow" | "limit" | "deny"; title: string; body: string }) {
  const I = kind === "allow" ? Check : kind === "limit" ? Minus : XIcon;
  return (
    <li className={`sa-fa-perm sa-fa-perm--${kind}`}>
      <span>
        <I size={12} />
      </span>
      <div>
        <b>{title}</b>
        <p>{body}</p>
      </div>
    </li>
  );
}
