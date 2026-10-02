import React, { useEffect, useState } from "react";
import { Box, TerminalSquare, Database, KeyRound, Video, Globe, ArrowUpRight } from "lucide-react";
import { go } from "../../state/store";
import { Button } from "../../ui";
import { Page, PageHeader, Section, Stat, StatRow, Chips } from "../../ops/kit";
import { fde, useFde, runningVms } from "../fde/engine";
import { VmCard, RoleBadge, ROLE } from "../fde/widgets";
import { VMS, VM_BY_ID } from "../fde/data/vms";
import { FLEET, ONBOARDINGS } from "../fde/data/portfolio";
import type { Role } from "../fde/types";
import "../../styles/admin-pages.css";

// Agent fleet: every microVM working right now. Brennan's eight on top, the portfolio below.

const ROLES: Role[] = ["analyst", "architect", "builder", "migrator", "integrator", "validator"];

const EXPLAIN = [
  { icon: Box, title: "Isolated microVM", sub: "one per task, destroyed after" },
  { icon: TerminalSquare, title: "Codex harness", sub: "pinned role profile" },
  { icon: Database, title: "Scoped DB role", sub: "staging writes only" },
  { icon: KeyRound, title: "Vault leases", sub: "short TTL, revoked at cutover" },
  { icon: Video, title: "Full recording", sub: "terminal, browser, every call" },
];

/** Gentle, deterministic drift so the table reads as live telemetry. */
function drift(i: number, t: number) {
  return Math.sin(t * 0.8 + i * 1.7) * 6 + Math.sin(t * 0.33 + i) * 4;
}

const fmtTok = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : `${Math.round(n / 1000)}k`);

export function Fleet() {
  useFde();
  const [role, setRole] = useState<Role | "all">("all");
  const [t, setT] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setT(x => x + 1), 1600);
    return () => window.clearInterval(id);
  }, []);

  const running = runningVms();
  const heroBrowsers = running.filter(id => VM_BY_ID.get(id)?.browser).length;
  const heroTokens = Object.values(fde.vms).reduce((a, v) => a + v.tokens, 0);
  const rows = FLEET.map((v, i) => ({ ...v, cpuNow: Math.max(4, Math.min(99, Math.round(v.cpu + drift(i, t)))), tokNow: v.tokens + t * (400 + (i % 7) * 180) }));
  const tokens = rows.reduce((a, v) => a + v.tokNow, 0) + heroTokens + 412_000_000;
  const avgCpu = Math.round(rows.reduce((a, v) => a + v.cpuNow, 0) / rows.length);
  const shown = role === "all" ? rows : rows.filter(v => v.role === role);
  const heroUp = VMS.filter(v => fde.vms[v.id].state !== "off").length;

  return (
    <Page className="sa-fl">
      <PageHeader
        title="Agent fleet"
        sub="Every agent works in its own microVM with a role profile, scoped credentials and a full recording."
        actions={
          <span className="sa-fl-live">
            <i /> {FLEET.length + running.length} running
          </span>
        }
      />

      <StatRow>
        <Stat label="VMs running" value={FLEET.length + running.length} sub={`${ONBOARD_COUNT} onboardings`} />
        <Stat label="Browser sessions" value={FLEET.filter(v => v.browser).length + heroBrowsers} sub="legacy systems, computer use" />
        <Stat label="Tokens today" value={fmtTok(tokens)} sub="across all roles" />
        <Stat label="Regions" value="3" sub="us-west-2 · us-east-1 · us-east-2" />
        <Stat label="Avg CPU" value={`${avgCpu}%`} sub="per VM" />
      </StatRow>

      <div className="sa-fl-explain">
        {EXPLAIN.map(e => (
          <div key={e.title}>
            <e.icon size={15} />
            <span>
              <b>{e.title}</b>
              <small>{e.sub}</small>
            </span>
          </div>
        ))}
      </div>

      <Section
        title={
          <div className="sa-fl-sh">
            <h2>Brennan Storage Co.</h2>
            <span className="mono faint">
              {VMS.length} VMs · {running.length} running · {heroUp - running.length > 0 ? `${heroUp - running.length} idle or done` : fde.run === "idle" ? "waiting for the go" : "all busy"}
            </span>
          </div>
        }
        action={
          <Button size="sm" onClick={() => go("admin/onboard/brennan")}>
            Open workspace <ArrowUpRight />
          </Button>
        }
      >
        <div className="sa-fl-grid">
          {VMS.map(v => (
            <VmCard key={v.id} id={v.id} />
          ))}
        </div>
      </Section>

      <Section
        title={
          <div className="sa-fl-sh">
            <h2>Portfolio</h2>
            <span className="mono faint">
              {shown.length} of {FLEET.length} VMs
            </span>
          </div>
        }
        flush
      >
        <div className="sa-fl-tools">
          <Chips
            value={role}
            onChange={setRole}
            options={[{ value: "all" as const, label: "All", count: FLEET.length }, ...ROLES.map(r => ({ value: r, label: ROLE[r].label, count: FLEET.filter(v => v.role === r).length }))]}
          />
        </div>
        <div className="z-table-wrap">
          <table className="z-table sa-fl-table">
            <thead>
              <tr>
                <th>VM</th>
                <th>Role</th>
                <th>Organization</th>
                <th>Task</th>
                <th>CPU</th>
                <th className="num">Tokens</th>
                <th className="num">Uptime</th>
                <th>Region</th>
                <th>Browser</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(v => (
                <tr key={v.id}>
                  <td className="mono">{v.id}</td>
                  <td>
                    <RoleBadge role={v.role} />
                  </td>
                  <td>{v.org}</td>
                  <td className="muted sa-fl-task">{v.task}</td>
                  <td>
                    <span className="sa-fl-cpu">
                      <span>
                        <i style={{ width: `${v.cpuNow}%` }} />
                      </span>
                      <em className="mono">{v.cpuNow}%</em>
                    </span>
                  </td>
                  <td className="num mono">{fmtTok(v.tokNow)}</td>
                  <td className="num mono">{v.uptime}</td>
                  <td className="mono faint">{v.region}</td>
                  <td>{v.browser ? <Globe size={14} className="sa-fl-br" aria-label="Browser session" /> : <span className="faint">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </Page>
  );
}

const ONBOARD_COUNT = ONBOARDINGS.filter(o => o.vms > 0).length + 1;
