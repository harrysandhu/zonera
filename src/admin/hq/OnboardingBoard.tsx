import React, { useState } from "react";
import { Cpu, Hand, X, ArrowUpRight, Clock, CircleCheck, ChevronDown } from "lucide-react";
import { go } from "../../state/store";
import { Button, Pill, Seg, Drawer } from "../../ui";
import { Page, PageHeader, Section, Stat, StatRow } from "../../ops/kit";
import { fde, useFde, stage, overallProgress, runningVms, elapsed, portfolioDelta, STAGES } from "../fde/engine";
import { RoleBadge } from "../fde/widgets";
import { ONBOARDINGS, FLEET, FACILITIES, GO_LIVES } from "../fde/data/portfolio";
import { OWNER_ITEMS } from "../fde/data/deal";
import type { Onboarding, Stage, FlowState } from "../fde/types";
import "../../styles/admin-pages.css";

// Onboarding board: every onboarding in flight, by stage. Brennan's card is live from the engine.

const COLS: Stage[] = ["context", "plan", "collect", "migrate", "validate", "live"];
const FLOW: FlowState[] = ["DRAFT", "DETAILS_COMPLETE", "PLAN_CONFIGURED", "CONTRACT_GENERATED", "AWAITING_SIGNING", "AWAITING_PAYMENT", "ONBOARDING_IN_PROGRESS", "ACTIVE"];
const LABEL = Object.fromEntries(STAGES.map(s => [s.id, s.label])) as Record<Stage, string>;
const nf = (n: number) => n.toLocaleString("en-US");

/** The waiting reason, phrased for this onboarding's own legacy system and gate. */
export function waitLabel(o: Onboarding): string | undefined {
  const w = o.waitingOn;
  if (!w) return undefined;
  const legacy = o.from === "Spreadsheets / paper" ? "rent roll upload" : o.from === "Other" ? "legacy login" : `${o.from.replace(/ \d.*$/, "")} login`;
  const gate = o.gate === "None" ? "payments processor" : o.gate;
  if (w === "Owner: Keystone login") return `Owner: ${legacy}`;
  if (w === "Vendor: OpenTech API key") return o.gate === "None" ? "Vendor: processor transfer" : `Vendor: ${gate} API key`;
  if (w === "Vendor: PTI dealer") return o.gate === "None" ? "Vendor: processor transfer" : `Vendor: ${gate} dealer`;
  return w;
}

const WHY: Record<string, string> = {
  Owner: "The owner's portal has one open item. The agent reminds them at 9 am and 4 pm, then texts. Nothing else is blocked on a person.",
  Vendor: "Emailed the vendor with the owner copied. The integrator's VM is released while it waits and resumes when the reply lands. Nudge scheduled after 18 hours.",
  Bank: "Two micro-deposits were sent to verify the payout account. Usually one business day. Payouts start once they match.",
  You: "The validator escalated one decision. Everything else keeps running.",
};

function hours(age: string) {
  return age === "now" ? 0 : parseInt(age, 10) || 0;
}

/** Brennan, read from the live engine. */
function brennan(): Onboarding & { live: boolean } {
  const base = ONBOARDINGS.find(o => o.hero)!;
  const openItems = Object.values(fde.items).filter(i => i.state === "open").length;
  let waitingOn: string | undefined;
  if (fde.exc.dup?.state === "open") waitingOn = "You: 1 decision";
  else if (fde.tasks.T10?.state === "waiting") waitingOn = "Vendor: PDK API key";
  else if (openItems && fde.run === "running") waitingOn = `Owner: ${openItems} item${openItems === 1 ? "" : "s"}`;
  return {
    ...base,
    stage: stage(),
    state: fde.flow,
    progress: overallProgress(),
    vms: runningVms().length,
    touches: fde.touches,
    age: fde.run === "idle" ? "now" : elapsed(),
    waitingOn,
    live: fde.run === "live",
  };
}

/** Facilities that went live this week, as board cards. */
const LIVE_WEEK: Onboarding[] = FACILITIES.filter(f => f.status === "trial" && f.org !== "Brennan Storage Co.")
  .sort((a, b) => b.since.localeCompare(a.since))
  .slice(0, 6)
  .map((f, i) => ({
    id: f.id,
    org: f.org.endsWith(" LLC") ? f.name : f.org,
    facilities: 1,
    units: f.units,
    stage: "live" as Stage,
    state: "ACTIVE" as FlowState,
    progress: 1,
    from: f.from,
    gate: f.gate,
    vms: 0,
    touches: f.touches,
    age: `${f.hoursToLive}h`,
    waitingOn: undefined,
    hero: false,
    _day: ["Thu", "Thu", "Wed", "Tue", "Tue", "Mon"][i],
  }));

export function OnboardingBoard() {
  useFde();
  const [view, setView] = useState<"board" | "table">("board");
  const [open, setOpen] = useState<Onboarding | null>(null);
  const [more, setMore] = useState<Record<string, boolean>>({});
  const b = brennan();
  const others = ONBOARDINGS.filter(o => !o.hero);
  const all = [b, ...others];
  const inflight = all.filter(o => o.stage !== "live");
  const owners = inflight.filter(o => waitLabel(o)?.startsWith("Owner")).length;
  const vendors = inflight.filter(o => /^(Vendor|Bank)/.test(waitLabel(o) ?? "")).length;
  const ages = others.map(o => hours(o.age)).sort((x, y) => x - y);
  const median = ages[Math.floor(ages.length / 2)];
  const liveWeek = GO_LIVES[GO_LIVES.length - 1] + portfolioDelta.live;

  const pick = (o: Onboarding) => (o.hero ? go("admin/onboard/brennan") : o.stage === "live" ? go(`admin/facility/${o.id}`) : setOpen(o));

  const column = (s: Stage) => {
    if (s === "live") return [...(b.live ? [b] : []), ...LIVE_WEEK];
    return all.filter(o => o.stage === s).sort((x, y) => (x.hero ? -1 : y.hero ? 1 : y.progress - x.progress));
  };

  return (
    <Page className="sa-bd" wide>
      <PageHeader
        title="Onboarding"
        sub={`${inflight.length} onboardings in flight. Agents do the implementation; the only waits are owners and vendors.`}
        actions={<Seg value={view} onChange={setView} ariaLabel="View" options={[{ value: "board", label: "Board" }, { value: "table", label: "Table" }]} />}
      />

      <StatRow>
        <Stat label="In flight" value={inflight.length} sub={`${liveWeek} went live this week`} />
        <Stat label="Waiting on owners" value={owners} sub="portal items, reminded twice a day" />
        <Stat label="Waiting on vendors" value={vendors} sub="gate dealers, banks" />
        <Stat label="Median age" value={`${median}h`} sub="since the sales call" />
      </StatRow>

      {view === "board" ? (
        <div className="sa-bd-board">
          {COLS.map(s => {
            const cards = column(s);
            const shown = more[s] ? cards : cards.slice(0, 7);
            return (
              <section key={s} className={`sa-bd-col ${s === "live" ? "sa-bd-col--live" : ""}`}>
                <header className="sa-bd-colh">
                  <span className={`sa-bd-dot sa-bd-dot--${s}`} />
                  <b>{s === "live" ? "Live this week" : LABEL[s]}</b>
                  <em className="mono">{s === "live" ? liveWeek : cards.length}</em>
                </header>
                <div className="sa-bd-cards">
                  {shown.map(o => (
                    <Card key={o.id} o={o} onOpen={() => pick(o)} />
                  ))}
                  {cards.length > shown.length && (
                    <button className="sa-bd-more" onClick={() => setMore(m => ({ ...m, [s]: true }))}>
                      <ChevronDown size={13} /> {cards.length - shown.length} more
                    </button>
                  )}
                  {s === "live" && <div className="sa-bd-tail mono">+{liveWeek - cards.length} more facilities this week</div>}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <Section flush>
          <div className="z-table-wrap">
            <table className="z-table sa-bd-table">
              <thead>
                <tr>
                  <th>Organization</th>
                  <th>Stage</th>
                  <th>State</th>
                  <th>Progress</th>
                  <th className="num">Facilities</th>
                  <th className="num">Units</th>
                  <th>From → gate</th>
                  <th className="num">VMs</th>
                  <th>Waiting on</th>
                  <th className="num">Touches</th>
                  <th className="num">Age</th>
                </tr>
              </thead>
              <tbody>
                {[...all]
                  .sort((x, y) => (x.hero ? -1 : y.hero ? 1 : COLS.indexOf(x.stage) - COLS.indexOf(y.stage) || y.progress - x.progress))
                  .map(o => (
                    <tr key={o.id} onClick={() => pick(o)} className={o.hero ? "is-hero" : ""}>
                      <td>
                        <b className="sa-bd-org">{o.org}</b>
                        {o.hero && <span className="sa-bd-watch">Watching</span>}
                      </td>
                      <td>{o.stage === "live" ? "Live" : LABEL[o.stage]}</td>
                      <td className="mono sa-bd-state">{o.state}</td>
                      <td>
                        <span className="sa-bd-prog sa-bd-prog--inline">
                          <i style={{ width: `${Math.round(o.progress * 100)}%` }} />
                        </span>
                        <span className="mono sa-bd-pct">{Math.round(o.progress * 100)}%</span>
                      </td>
                      <td className="num">{o.facilities}</td>
                      <td className="num">{nf(o.units)}</td>
                      <td className="muted">
                        {o.from} → {o.gate}
                      </td>
                      <td className="num mono">{o.vms}</td>
                      <td>{waitLabel(o) ? <WaitChip text={waitLabel(o)!} /> : <span className="faint">—</span>}</td>
                      <td className="num mono">{o.touches}</td>
                      <td className="num mono">{o.age}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      <Drawer open={!!open} onClose={() => setOpen(null)} width={480}>
        {open && <Detail o={open} onClose={() => setOpen(null)} />}
      </Drawer>
    </Page>
  );
}

function WaitChip({ text }: { text: string }) {
  const [who, ...rest] = text.split(":");
  return (
    <span className={`sa-bd-wait sa-bd-wait--${who.toLowerCase()}`}>
      <b>{who}</b>
      {rest.join(":").trim()}
    </span>
  );
}

function Card({ o, onOpen }: { o: Onboarding & { _day?: string; live?: boolean }; onOpen: () => void }) {
  const w = waitLabel(o);
  const isLive = o.stage === "live";
  return (
    <button type="button" className={`sa-bd-card ${o.hero ? "is-hero" : ""} ${isLive ? "is-live" : ""}`} onClick={onOpen}>
      <div className="sa-bd-card-h">
        <b>{o.org}</b>
        {o.hero && (fde.run === "running" ? <span className="sa-bd-pulse" title="Running" /> : <ArrowUpRight size={13} />)}
      </div>
      <div className="sa-bd-meta">
        {o.facilities} {o.facilities === 1 ? "facility" : "facilities"} · {nf(o.units)} units
      </div>
      <div className="sa-bd-from mono">
        {o.from} → {o.gate}
      </div>
      {isLive ? (
        <div className="sa-bd-livel">
          <CircleCheck size={13} /> {o.hero ? `Live in ${o.age}` : `Live ${o._day} · ${o.age} from call`}
        </div>
      ) : (
        <div className="sa-bd-progrow">
          <span className="sa-bd-prog">
            <i style={{ width: `${Math.max(2, Math.round(o.progress * 100))}%` }} />
          </span>
          <span className="mono">{Math.round(o.progress * 100)}%</span>
        </div>
      )}
      {w && <WaitChip text={w} />}
      <div className="sa-bd-f">
        <span title="Agent VMs">
          <Cpu size={12} /> {o.vms}
        </span>
        <span title="Human touches">
          <Hand size={12} /> {o.touches}
        </span>
        <span className="sa-bd-age" title="Since the sales call">
          <Clock size={12} /> {o.age}
        </span>
      </div>
    </button>
  );
}

function Detail({ o, onClose }: { o: Onboarding; onClose: () => void }) {
  const w = waitLabel(o);
  const who = w?.split(":")[0];
  const vms = FLEET.filter(v => v.org === o.org).slice(0, o.vms || 0);
  const at = FLOW.indexOf(o.state);
  return (
    <div className="sa-bd-dr">
      <header className="sa-bd-dr-h">
        <div>
          <span className="mono faint">{o.id}</span>
          <h2>{o.org}</h2>
          <p>
            {o.facilities} {o.facilities === 1 ? "facility" : "facilities"} · {nf(o.units)} units · {o.from} → {o.gate}
          </p>
        </div>
        <Button variant="ghost" size="sm" iconOnly aria-label="Close" onClick={onClose} icon={<X />} />
      </header>
      <div className="sa-bd-dr-b">
        <div className="sa-bd-dr-prog">
          <div>
            <Pill tone="accent" dot live>
              {LABEL[o.stage]}
            </Pill>
            <span className="mono">{Math.round(o.progress * 100)}%</span>
          </div>
          <span className="sa-bd-prog">
            <i style={{ width: `${Math.round(o.progress * 100)}%` }} />
          </span>
        </div>

        {w && (
          <div className="sa-bd-dr-wait">
            <small>Waiting on</small>
            <WaitChip text={w} />
            <p>{WHY[who ?? ""] ?? ""}</p>
          </div>
        )}

        <div className="sa-bd-dr-sec">
          <h3>State machine</h3>
          <ol className="sa-bd-flow">
            {FLOW.map((f, i) => (
              <li key={f} className={i < at ? "done" : i === at ? "now" : ""}>
                <i />
                <span className="mono">{f}</span>
                {i === at && <em>current</em>}
              </li>
            ))}
          </ol>
        </div>

        <div className="sa-bd-dr-sec">
          <h3>Details</h3>
          <dl className="sa-bd-kv">
            <dt>Migrating from</dt>
            <dd>{o.from}</dd>
            <dt>Gate</dt>
            <dd>{o.gate === "None" ? "No gate system" : o.gate}</dd>
            <dt>Human touches</dt>
            <dd className="mono">{o.touches}</dd>
            <dt>Since the sales call</dt>
            <dd className="mono">{o.age}</dd>
          </dl>
        </div>

        <div className="sa-bd-dr-sec">
          <h3>Agent VMs · {o.vms}</h3>
          {vms.length ? (
            <ul className="sa-bd-vms">
              {vms.map(v => (
                <li key={v.id}>
                  <RoleBadge role={v.role} compact />
                  <span className="mono">{v.id}</span>
                  <span className="sa-bd-vms-t">{v.task}</span>
                  <span className="mono faint">{v.cpu}%</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="faint sa-bd-none">No VM running. It boots when the owner or vendor answers.</p>
          )}
        </div>
      </div>
      <footer className="sa-bd-dr-f">
        <span className="faint">Read only. Agents own this onboarding.</span>
        <Button onClick={() => go("admin/fleet")}>Agent fleet</Button>
      </footer>
    </div>
  );
}
