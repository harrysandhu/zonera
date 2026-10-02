import React, { useEffect, useReducer } from "react";
import { Play, ArrowUpRight, Bot, User, Building2, Hand, CircleDot, ChevronRight, ShieldCheck, Clock } from "lucide-react";
import { go } from "../../state/store";
import { Button, Pill, Avatar } from "../../ui";
import { BarChart, MeterList } from "../../ui/charts";
import { Page, PageHeader, Section } from "../../ops/kit";
import { fde, useFde, startFde, stage, overallProgress, runningVms, clockAt, elapsed, portfolioDelta, ownerProgress, STAGES, type FeedEvent } from "../fde/engine";
import { StageRail, Ring, RoleBadge } from "../fde/widgets";
import { SUMMARY, ONBOARDINGS, FLEET, GO_LIVES, FACILITIES, ALDER_LAKE } from "../fde/data/portfolio";
import { DEAL, SOURCES } from "../fde/data/deal";
import { CHECKS, N } from "../fde/data/vms";
import { useStanding, queueItems } from "./Queue";
import type { Role, Stage } from "../fde/types";
import "../../styles/admin-pages.css";

// Mission control: the opening shot. One SDR, the whole portfolio, and the onboarding
// that started when Jordan's last call ended.

const nf = (n: number) => n.toLocaleString("en-US");

export function MissionControl() {
  useFde();
  useStanding();
  const live = portfolioDelta.live;
  const facilities = SUMMARY.facilities + live;
  const vms = FLEET.length + runningVms().length;

  return (
    <Page className="sa-mc">
      <PageHeader
        title="Mission control"
        sub="Every facility, onboarding and agent on Zonera, in one place."
        actions={
          <span className="sa-mc-clock" title="Story clock">
            <i className={fde.run === "running" ? "on" : fde.run === "live" ? "ok" : ""} />
            <span className="mono">{clockAt()}</span>
          </span>
        }
      />

      <section className="sa-mc-band">
        <div className="sa-mc-punch">
          <span className="sa-mc-eyebrow">Portfolio</span>
          <h2>
            <span className="tnum">1</span> SDR <em>·</em>{" "}
            <span key={facilities} className={`tnum ${live ? "sa-mc-bump" : ""}`}>
              {nf(facilities)}
            </span>{" "}
            facilities
          </h2>
          <span className="sa-mc-who">
            <Avatar name="Jordan Lee" size="sm" /> Jordan Lee runs sales and every onboarding. Agents do the implementation.
          </span>
        </div>
        <dl className="sa-mc-kpis">
          <div>
            <dt>ARR</dt>
            <dd className="tnum">${((SUMMARY.arr + live * ALDER_LAKE.mrr * 12) / 1e6).toFixed(2)}M</dd>
            <small className="mono">{nf(SUMMARY.orgs)} operators</small>
          </div>
          <div>
            <dt>In flight</dt>
            <dd className="tnum">{ONBOARDINGS.length - live}</dd>
            <small className="mono">onboardings</small>
          </div>
          <div>
            <dt>Call to live</dt>
            <dd className="tnum">
              {SUMMARY.medianHours}
              <span>h</span>
            </dd>
            <small className="mono">median</small>
          </div>
          <div>
            <dt>Human touches</dt>
            <dd className="tnum">{SUMMARY.touches.toFixed(1)}</dd>
            <small className="mono">per facility</small>
          </div>
          <div>
            <dt>Agent VMs</dt>
            <dd className="tnum">{vms}</dd>
            <small className="mono">running now</small>
          </div>
        </dl>
      </section>

      <div className="sa-mc-row sa-mc-row--hero">
        <HeroCard />
        <Section
          title="Footprint"
          className="sa-mc-mapcard"
          action={
            <span className="sa-mc-legend">
              <span>
                <i className="sa-mc-lg sa-mc-lg--fac" />
                {nf(facilities)} live
              </span>
              <span>
                <i className="sa-mc-lg sa-mc-lg--ob" />
                {ONBOARDINGS.length - live} onboarding
              </span>
            </span>
          }
        >
          <UsMap live={fde.run === "live"} label={fde.run === "live" ? "Live" : fde.run === "running" ? STAGES.find(s => s.id === stage())?.label ?? "" : "Call ended"} />
        </Section>
      </div>

      <div className="sa-mc-row sa-mc-row--feed">
        <LiveActivity />
        <div className="sa-mc-side">
          <NeedsYou />
          <Pipeline />
        </div>
      </div>

      <div className="sa-mc-row sa-mc-row--charts">
        <Section title="Go-lives per week" action={<span className="sa-mc-note mono">{GO_LIVES[GO_LIVES.length - 1] + live} this week</span>}>
          <GoLives />
        </Section>
        <Section title="Migrated from" action={<span className="sa-mc-note mono">{nf(facilities)} facilities</span>}>
          <MigratedFrom />
        </Section>
      </div>
    </Page>
  );
}

// ---- hero: Brennan --------------------------------------------------------------------

function HeroCard() {
  const run = fde.run;
  const c2 = SOURCES.find(s => s.id === "c2")!;
  const st = stage();

  if (run === "idle") {
    return (
      <section className="sa-mc-hero sa-mc-hero--idle">
        <div className="sa-mc-hero-top">
          <Pill tone="accent" dot live>
            Call ended · 6:12 pm
          </Pill>
          <span className="mono faint">c2 · {c2.duration}</span>
        </div>
        <div className="sa-mc-hero-t">
          <h2>A call just ended</h2>
          <p>
            <b>Brennan Storage Co.</b> · {c2.title} with Gail Brennan and Priya Raman
          </p>
        </div>
        <p className="sa-mc-hero-sum">{c2.summary}</p>
        <dl className="sa-mc-facts">
          <div>
            <dt>Facilities</dt>
            <dd>{DEAL.facilities.map(f => `${f.name} ${f.units}`).join(" · ")}</dd>
          </div>
          <div>
            <dt>Moving from</dt>
            <dd>Keystone 8.4 · PDK gate</dd>
          </div>
          <div>
            <dt>Terms</dt>
            <dd>Professional · $999/mo · 60 days free</dd>
          </div>
          <div>
            <dt>Deadline</dt>
            <dd>Live before the Oct 5 autopay run</dd>
          </div>
        </dl>
        <StageRail current="context" />
        <div className="sa-mc-hero-a">
          <Button
            variant="accent"
            icon={<Play />}
            onClick={() => {
              startFde();
              go("admin/onboard/brennan");
            }}
          >
            Start FDE
          </Button>
          <Button onClick={() => go("admin/onboard/brennan")}>Open workspace</Button>
          <span className="sa-mc-hero-h faint">8 agent VMs ready · no implementation call</span>
        </div>
      </section>
    );
  }

  if (run === "live") {
    const passed = CHECKS.filter(c => fde.checks[c.id] === "pass" || fde.checks[c.id] === "fixed").length;
    return (
      <section className="sa-mc-hero sa-mc-hero--live">
        <div className="sa-mc-hero-top">
          <Pill tone="ok" dot>
            Live
          </Pill>
          <span className="mono faint">cut over {DEAL.cutoverAt}</span>
        </div>
        <div className="sa-mc-hero-t">
          <h2>Alder Lake is live</h2>
          <p>
            <b>Brennan Storage Co.</b> · moved off Keystone before the gate opened
          </p>
        </div>
        <div className="sa-mc-big">
          Live in <b className="tnum">{elapsed()}</b> · <b className="tnum">{fde.touches}</b> human touch{fde.touches === 1 ? "" : "es"}
        </div>
        <StageRail current="live" />
        <div className="sa-mc-metrics">
          <Metric label="Checks passed" value={`${passed}/${CHECKS.length}`} sub="independent validator" />
          <Metric label="Tenants moved" value={nf(N.tenants)} sub={`${nf(N.ledger)} ledger lines`} />
          <Metric label="Autopays kept" value={`${N.autopay}/${N.autopay}`} sub="no card re-entered" />
          <Metric label="Agent VMs" value="0" sub="8 released at cutover" />
        </div>
        <div className="sa-mc-hero-a">
          <Button variant="primary" onClick={() => go("ops/overview")}>
            Open operator console <ArrowUpRight />
          </Button>
          <Button onClick={() => go("admin/onboard/brennan")}>Open workspace</Button>
        </div>
      </section>
    );
  }

  const p = overallProgress();
  const vms = runningVms();
  const o = ownerProgress();
  const last = fde.feed[0];
  return (
    <section className="sa-mc-hero sa-mc-hero--run">
      <div className="sa-mc-hero-top">
        <Pill tone="accent" dot live>
          {STAGES.find(s => s.id === st)?.label}
        </Pill>
        <span className="mono faint">
          {clockAt()} · T+{elapsed()}
        </span>
      </div>
      <div className="sa-mc-hero-t">
        <h2>Brennan Storage Co.</h2>
        <p>3 facilities · 461 units · Keystone 8.4 → PDK · flow <span className="mono">{fde.flow}</span></p>
      </div>
      <StageRail current={st} />
      <div className="sa-mc-metrics">
        <div className="sa-mc-metric sa-mc-metric--ring">
          <Ring value={p} size={40} stroke={4} />
          <div>
            <small>Progress</small>
            <b className="tnum">{Math.round(p * 100)}%</b>
          </div>
        </div>
        <Metric label="Agent VMs running" value={String(vms.length)} sub={vms.length ? vms.slice(0, 3).join(" ") : "between tasks"} mono />
        <Metric label="Owner checklist" value={`${o.done}/${o.total || 11}`} sub={o.total && o.done < o.total ? `${o.minutes} min of Gail's time left` : "nothing waiting on Gail"} />
        <Metric label="Human touches" value={String(fde.touches)} sub="after the call" />
      </div>
      {last && (
        <div className="sa-mc-last">
          <WhoIcon who={last.who} />
          <span className="mono faint">{last.at}</span>
          <span className="sa-mc-last-t">{last.text}</span>
        </div>
      )}
      <div className="sa-mc-hero-a">
        <Button variant="primary" onClick={() => go("admin/onboard/brennan")}>
          Open workspace <ArrowUpRight />
        </Button>
        <Button onClick={() => go("admin/fleet")}>Watch the VMs</Button>
      </div>
    </section>
  );
}

function Metric({ label, value, sub, mono }: { label: string; value: string; sub?: string; mono?: boolean }) {
  return (
    <div className="sa-mc-metric">
      <small>{label}</small>
      <b className="tnum">{value}</b>
      {sub && <span className={mono ? "mono" : ""}>{sub}</span>}
    </div>
  );
}

// ---- US dot map -------------------------------------------------------------------------
// Albers equal-area conic (the usual US projection), a land mask from a simplified outline
// of the lower 48, and a dot grid. Facilities snap to the grid and darken it by density.

const US: [number, number][] = [
  [-124.7, 48.4], [-123.2, 48.15], [-122.75, 49.0], [-95.15, 49.0], [-95.15, 49.38], [-94.8, 49.3], [-94.6, 48.7], [-93.0, 48.6], [-91.4, 48.1], [-89.6, 47.98],
  [-92.1, 46.75], [-90.5, 46.6], [-89.0, 46.85], [-88.0, 47.45], [-87.6, 46.9], [-87.4, 46.5], [-86.6, 46.45], [-85.5, 46.7], [-84.95, 46.75], [-84.35, 46.5],
  [-83.9, 45.99], [-84.73, 45.87], [-85.45, 46.1], [-86.25, 45.95], [-87.05, 45.75], [-87.6, 45.1], [-88.0, 44.52], [-87.65, 44.1], [-87.9, 43.04], [-87.6, 41.85],
  [-87.2, 41.62], [-86.9, 41.72], [-86.5, 42.1], [-86.2, 42.8], [-86.45, 43.7], [-86.25, 44.6], [-85.6, 45.15], [-85.0, 45.4], [-84.75, 45.78], [-84.45, 45.65],
  [-83.8, 45.42], [-83.4, 45.05], [-83.3, 44.3], [-83.9, 43.65], [-83.4, 43.95], [-82.95, 44.05], [-82.42, 42.97], [-82.5, 42.6], [-83.1, 42.3], [-83.45, 41.73],
  [-82.7, 41.45], [-81.7, 41.5], [-80.08, 42.13], [-78.9, 42.88], [-79.05, 43.25], [-77.6, 43.25], [-76.5, 43.45], [-76.3, 44.2], [-75.5, 44.7], [-74.7, 45.0],
  [-71.5, 45.0], [-71.1, 45.3], [-70.3, 45.9], [-70.0, 46.7], [-69.25, 47.45], [-68.3, 47.35], [-67.8, 47.07], [-67.8, 45.7], [-67.0, 44.9], [-68.0, 44.4],
  [-68.8, 44.4], [-69.8, 43.8], [-70.25, 43.65], [-70.7, 43.05], [-70.8, 42.7], [-70.6, 42.6], [-71.05, 42.35], [-70.55, 41.75], [-70.0, 42.05], [-69.95, 41.7],
  [-70.4, 41.55], [-71.1, 41.5], [-71.5, 41.37], [-72.9, 41.25], [-73.65, 40.98], [-74.0, 40.5], [-74.05, 40.1], [-74.4, 39.4], [-74.95, 38.93], [-75.05, 38.6],
  [-75.25, 38.0], [-75.95, 37.15], [-76.0, 36.9], [-75.75, 36.2], [-75.5, 35.6], [-75.55, 35.25], [-76.6, 34.6], [-77.4, 34.5], [-77.95, 33.9], [-78.6, 33.85],
  [-79.2, 33.3], [-79.9, 32.75], [-80.6, 32.4], [-81.1, 31.95], [-81.3, 31.3], [-81.45, 30.7], [-81.4, 30.4], [-81.3, 29.9], [-80.9, 29.0], [-80.6, 28.4],
  [-80.4, 27.6], [-80.05, 26.7], [-80.15, 25.8], [-80.4, 25.2], [-80.9, 25.15], [-81.2, 25.4], [-81.75, 26.1], [-82.1, 26.7], [-82.65, 27.5], [-82.75, 28.2],
  [-82.65, 28.9], [-83.1, 29.25], [-83.7, 29.95], [-84.4, 30.0], [-85.0, 29.65], [-85.4, 29.7], [-86.2, 30.35], [-87.2, 30.35], [-88.1, 30.35], [-88.4, 30.4],
  [-89.6, 30.2], [-89.25, 29.4], [-89.4, 29.0], [-90.0, 29.2], [-90.6, 29.1], [-91.3, 29.3], [-92.3, 29.55], [-93.85, 29.7], [-94.8, 29.3], [-95.3, 28.9],
  [-96.4, 28.4], [-97.3, 27.7], [-97.4, 26.9], [-97.2, 25.95], [-98.3, 26.1], [-99.1, 26.5], [-99.5, 27.5], [-100.5, 28.7], [-100.9, 29.35], [-101.4, 29.77],
  [-102.4, 29.78], [-103.1, 28.97], [-104.5, 29.65], [-104.9, 30.4], [-106.0, 31.4], [-106.5, 31.78], [-108.2, 31.78], [-108.2, 31.33], [-111.07, 31.33], [-114.8, 32.5],
  [-114.7, 32.72], [-117.12, 32.53], [-117.25, 32.85], [-117.4, 33.2], [-117.9, 33.6], [-118.3, 33.72], [-118.5, 34.0], [-119.2, 34.15], [-119.7, 34.4], [-120.45, 34.45],
  [-120.65, 34.9], [-120.9, 35.4], [-121.5, 35.9], [-121.9, 36.35], [-121.95, 36.6], [-121.8, 36.85], [-122.4, 37.2], [-122.5, 37.75], [-122.95, 38.0], [-123.05, 38.3],
  [-123.7, 38.9], [-123.8, 39.6], [-124.1, 40.1], [-124.4, 40.45], [-124.1, 41.0], [-124.2, 41.75], [-124.5, 42.8], [-124.1, 43.7], [-124.0, 44.6], [-123.95, 45.5],
  [-123.95, 46.2], [-124.05, 46.65], [-124.15, 47.2], [-124.4, 47.8],
];

const rad = Math.PI / 180;
const P1 = 29.5 * rad, P2 = 45.5 * rad, P0 = 37.5 * rad, L0 = -96 * rad;
const n = (Math.sin(P1) + Math.sin(P2)) / 2;
const C = Math.cos(P1) ** 2 + 2 * n * Math.sin(P1);
const rho0 = Math.sqrt(C - 2 * n * Math.sin(P0)) / n;
function albers(lon: number, lat: number): [number, number] {
  const rho = Math.sqrt(C - 2 * n * Math.sin(lat * rad)) / n;
  const th = n * (lon * rad - L0);
  return [rho * Math.sin(th), rho0 - rho * Math.cos(th)];
}

const MAP = (() => {
  const W = 1000, PAD = 14, STEP = 10.5;
  const raw = US.map(([lo, la]) => albers(lo, la));
  const xs = raw.map(p => p[0]), ys = raw.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const k = (W - PAD * 2) / (maxX - minX);
  const H = Math.round((maxY - minY) * k + PAD * 2);
  const proj = (lon: number, lat: number): [number, number] => {
    const [x, y] = albers(lon, lat);
    return [(x - minX) * k + PAD, (maxY - y) * k + PAD];
  };
  const poly = US.map(([lo, la]) => proj(lo, la));
  const inside = (x: number, y: number) => {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  const cols = Math.floor(W / STEP), rows = Math.floor(H / STEP);
  const ox = (W - (cols - 1) * STEP) / 2, oy = (H - (rows - 1) * STEP) / 2;
  const cell = (x: number, y: number) => [Math.round((x - ox) / STEP), Math.round((y - oy) / STEP)] as const;
  const at = (c: number, r: number) => [+(ox + c * STEP).toFixed(1), +(oy + r * STEP).toFixed(1)] as const;
  let land = "";
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const [x, y] = at(c, r);
      if (inside(x, y)) land += `M${x} ${y}h0`;
    }
  // Every facility gets its own dot: snap to the nearest free cell, spiralling outward,
  // so metros grow into blobs sized by how many facilities they have.
  const taken = new Map<string, number>();
  const ring: [number, number][] = [];
  for (let d = 0; d <= 7; d++) for (let dc = -d; dc <= d; dc++) for (let dr = -d; dr <= d; dr++) if (Math.max(Math.abs(dc), Math.abs(dr)) === d) ring.push([dc, dr]);
  ring.sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]));
  FACILITIES.forEach(f => {
    if (f.state === "AK" || f.state === "HI") return;
    const [c0, r0] = cell(...proj(f.lon, f.lat));
    for (const [dc, dr] of ring) {
      const key = `${c0 + dc},${r0 + dr}`;
      if (taken.has(key)) continue;
      taken.set(key, Math.max(Math.abs(dc), Math.abs(dr)));
      break;
    }
  });
  const lv = ["", "", ""];
  taken.forEach((d, key) => {
    const [c, r] = key.split(",").map(Number);
    const [x, y] = at(c, r);
    lv[d === 0 ? 2 : d === 1 ? 1 : 0] += `M${x} ${y}h0`;
  });
  // Onboardings in flight: a deterministic spread of sites, away from Alder Lake.
  const picks: [number, number][] = [];
  for (let i = 0; i < FACILITIES.length && picks.length < 14; i += 73) {
    const f = FACILITIES[(i * 7) % FACILITIES.length];
    if (f.state === "AK" || f.state === "HI" || f.org === "Brennan Storage Co.") continue;
    const p = proj(f.lon, f.lat);
    if (picks.some(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < 60)) continue;
    picks.push(p);
  }
  return { W, H, land, lv, picks, alder: proj(ALDER_LAKE.lon, ALDER_LAKE.lat), step: STEP };
})();

const UsMap = React.memo(function UsMap({ live, label }: { live: boolean; label: string }) {
  const { W, H, land, lv, picks, alder, step } = MAP;
  return (
    <div className="sa-mc-map" style={{ aspectRatio: `${W} / ${H}` }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" role="img" aria-label="Facilities on Zonera across the US">
        <path d={land} className="sa-mc-map-land" strokeWidth={step * 0.4} />
        <path d={lv[0]} className="sa-mc-map-f1" strokeWidth={step * 0.48} />
        <path d={lv[1]} className="sa-mc-map-f2" strokeWidth={step * 0.52} />
        <path d={lv[2]} className="sa-mc-map-f3" strokeWidth={step * 0.56} />
        {picks.map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r={5} className="sa-mc-map-ring">
              <animate attributeName="r" values="5;18" dur="2.4s" begin={`${-(i * 0.37) % 2.4}s`} repeatCount="indefinite" />
              <animate attributeName="opacity" values=".7;0" dur="2.4s" begin={`${-(i * 0.37) % 2.4}s`} repeatCount="indefinite" />
            </circle>
            <circle cx={x} cy={y} r={5} className="sa-mc-map-ob" />
          </g>
        ))}
        <g className={live ? "sa-mc-map-hero is-live" : "sa-mc-map-hero"}>
          <circle cx={alder[0]} cy={alder[1]} r={7} className="sa-mc-map-ring">
            <animate attributeName="r" values="6;22" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values=".6;0" dur="2s" repeatCount="indefinite" />
          </circle>
          <circle cx={alder[0]} cy={alder[1]} r={6.5} className="sa-mc-map-dot" />
          <line x1={alder[0] + 8} y1={alder[1]} x2={alder[0] + 34} y2={alder[1]} className="sa-mc-map-lead" />
        </g>
      </svg>
      <span className={`sa-mc-map-label ${live ? "is-live" : ""}`} style={{ left: `${((alder[0] + 38) / W) * 100}%`, top: `${(alder[1] / H) * 100}%` }}>
        <b>Alder Lake</b>
        <span>{label}</span>
      </span>
    </div>
  );
});

// ---- live activity --------------------------------------------------------------------------
// Brennan's engine feed, merged with the rest of the portfolio ticking along.

type Row = { key: string; tick: number; t: number; who: FeedEvent["who"]; text: string; org?: string; role?: Role; vm?: string; hero?: boolean };

type Synth = Omit<Row, "key" | "tick" | "t">;
const SYNTH: Synth[] = (() => {
  const out: Synth[] = [];
  const extra: Synth[] = [
    { who: "owner", text: "Owner signed the MSA", org: "Highland Self Storage" },
    { who: "system", text: "Went live · 31h from the call · 0 human touches", org: "Ridgeline Storage" },
    { who: "vendor", text: "PTI dealer issued an API key · site 2281", org: "Mesa Self Storage" },
    { who: "owner", text: "Owner shared the SiteLink login (vaulted, read-only)", org: "Lakeside Self Storage" },
    { who: "system", text: "Went live · 27h from the call · 1 human touch", org: "Coastal Storage Co." },
    { who: "vendor", text: "Bank micro-deposits verified", org: "Highland Self Storage" },
    { who: "owner", text: "Owner uploaded the lease (11 pages)", org: "Oak Hollow Self Storage" },
    { who: "system", text: "Went live · 38h from the call · 0 human touches", org: "Redwood Self Storage" },
  ];
  const step = Math.max(1, Math.floor(FLEET.length / 22));
  for (let i = 0, e = 0; i < FLEET.length && out.length < 30; i += step) {
    const v = FLEET[i];
    out.push({ who: "agent", vm: v.id, role: v.role, text: v.task, org: v.org });
    if (i % (step * 3) === 0 && e < extra.length) out.push(extra[e++]);
  }
  return out;
})();

const feedState = { rows: [] as Row[], tick: 0, idx: 0, seen: new Map<number, { tick: number; t: number }>() };
function pushSynth(t = Date.now()) {
  const s = SYNTH[feedState.idx++ % SYNTH.length];
  feedState.tick++;
  feedState.rows.unshift({ ...s, key: `s${feedState.tick}`, tick: feedState.tick, t });
  if (feedState.rows.length > 30) feedState.rows.length = 30;
}
// Seed the last half minute so the feed opens full.
for (let i = 12; i > 0; i--) pushSynth(Date.now() - i * 2600 - (i % 3) * 700);

function age(t: number) {
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  return s < 3 ? "now" : s < 60 ? `${s}s` : `${Math.floor(s / 60)}m`;
}

function LiveActivity() {
  const [, bump] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    const t = window.setInterval(() => {
      pushSynth();
      bump();
    }, 2500);
    return () => window.clearInterval(t);
  }, []);
  const engine: Row[] = fde.feed.slice(0, 20).map(e => {
    let seen = feedState.seen.get(e.id);
    if (!seen) {
      seen = { tick: feedState.tick + 0.5, t: Date.now() };
      feedState.seen.set(e.id, seen);
    }
    return { key: `f${e.id}`, tick: seen.tick, t: seen.t, who: e.who, text: e.text, org: "Brennan Storage Co.", hero: true, vm: e.ref };
  });
  const rows = [...engine, ...feedState.rows].sort((a, b) => b.tick - a.tick).slice(0, 13);
  return (
    <Section
      title="Live activity"
      className="sa-mc-feedcard"
      action={
        <span className="sa-mc-feed-h">
          <span className="mono faint">{FLEET.length + runningVms().length} VMs reporting</span>
          <Pill tone="accent" dot live>
            Live
          </Pill>
        </span>
      }
    >
      <ol className="sa-mc-feed">
        {rows.map(r => (
          <li key={r.key} className={r.hero ? "is-hero" : ""}>
            <span className="sa-mc-feed-i">{r.role ? <RoleBadge role={r.role} compact /> : <WhoIcon who={r.who} />}</span>
            <span className="sa-mc-feed-x">
              {r.vm && !r.hero && <span className="mono sa-mc-feed-vm">{r.vm}</span>}
              {r.text}
            </span>
            <span className="sa-mc-feed-o">{r.hero ? <b>Brennan</b> : r.org}</span>
            <span className="sa-mc-feed-t mono">{age(r.t)}</span>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function WhoIcon({ who }: { who: FeedEvent["who"] }) {
  const I = who === "agent" ? Bot : who === "owner" ? User : who === "vendor" ? Building2 : who === "human" ? Hand : CircleDot;
  return (
    <span className={`sa-mc-who-i sa-mc-who-i--${who}`} title={who}>
      <I size={12} />
    </span>
  );
}

// ---- needs you preview -------------------------------------------------------------------------

function NeedsYou() {
  const items = queueItems();
  return (
    <Section
      title={
        <h2 className="sa-mc-nh">
          Needs you <span className={`sa-mc-count ${items.some(i => i.hot) ? "hot" : ""}`}>{items.length}</span>
        </h2>
      }
      action={
        <button className="sa-mc-link" onClick={() => go("admin/queue")}>
          Open queue <ChevronRight size={13} />
        </button>
      }
    >
      {items.length === 0 ? (
        <div className="sa-mc-calm">
          <ShieldCheck size={15} /> Nothing needs a person right now.
        </div>
      ) : (
        <ul className="sa-mc-needs">
          {items.slice(0, 3).map(i => (
            <li key={i.id}>
              <button onClick={() => go("admin/queue")} className={i.hot ? "is-hot" : ""}>
                <i />
                <span>
                  <b>{i.title}</b>
                  <small>{i.org}</small>
                </span>
                <ChevronRight size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="sa-mc-foot mono">
        <Clock size={12} /> 214 auto-resolved this week · 9 escalated
      </p>
    </Section>
  );
}

// ---- pipeline -------------------------------------------------------------------------------------

const PIPE: Stage[] = ["context", "plan", "collect", "migrate", "validate"];

function Pipeline() {
  const st = stage();
  const counts = PIPE.map(s => ({ s, n: ONBOARDINGS.filter(o => !o.hero && o.stage === s).length + (fde.run !== "live" && st === s ? 1 : 0) }));
  const max = Math.max(...counts.map(c => c.n));
  return (
    <Section title="Pipeline by stage" action={<button className="sa-mc-link" onClick={() => go("admin/onboarding")}>Board <ChevronRight size={13} /></button>}>
      <ul className="sa-mc-pipe">
        {counts.map(c => (
          <li key={c.s} className={fde.run !== "live" && st === c.s ? "is-hero" : ""}>
            <span className="sa-mc-pipe-l">{STAGES.find(x => x.id === c.s)?.label}</span>
            <span className="sa-mc-pipe-t">
              <i style={{ width: `${(c.n / max) * 100}%` }} />
            </span>
            <span className="sa-mc-pipe-v tnum">{c.n}</span>
            {fde.run !== "live" && st === c.s ? <span className="sa-mc-pipe-b">Brennan</span> : <span />}
          </li>
        ))}
      </ul>
    </Section>
  );
}

// ---- charts ----------------------------------------------------------------------------------------

function GoLives() {
  const live = portfolioDelta.live;
  const end = new Date(2026, 9, 2);
  const data = GO_LIVES.map((v, i) => {
    const d = new Date(end.getTime() - (GO_LIVES.length - 1 - i) * 7 * 86400000);
    const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    // Chart keys are labels, so unlabeled weeks get a unique run of zero-width spaces.
    const shown = (GO_LIVES.length - 1 - i) % 5 === 0;
    return { label: shown ? label : "\u200b".repeat(i + 1), value: v + (i === GO_LIVES.length - 1 ? live : 0), note: `Week of ${label}` };
  });
  return <BarChart data={data} height={262} format={v => `${v} facilities`} yFormat={v => String(v)} />;
}

function MigratedFrom() {
  const live = portfolioDelta.live;
  const rows = SUMMARY.from
    .map(([name, count]) => ({ name, count: count + (name === "Keystone" ? live : 0) }))
    .sort((a, b) => (a.name === "Other" ? 1 : b.name === "Other" ? -1 : b.count - a.count));
  const total = rows.reduce((a, r) => a + r.count, 0);
  const max = Math.max(...rows.map(r => r.count));
  return (
    <div className="sa-mc-from">
      <MeterList
        format={v => nf(Math.round(v * max))}
        rows={rows.map(r => ({
          label: r.name === "Spreadsheets / paper" ? "Spreadsheets" : r.name,
          value: r.count / max,
          tone: r.name === "Keystone" ? "accent" : "neutral",
          sub: undefined,
        }))}
      />
      <p className="sa-mc-foot">
        {Math.round(((rows.find(r => r.name === "SiteLink")?.count ?? 0) / total) * 100)}% came from SiteLink. Browser agents migrate from any of them without an export.
      </p>
    </div>
  );
}
