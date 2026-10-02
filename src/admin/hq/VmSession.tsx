import React from "react";
import { ArrowLeft, KeyRound, Power, Video } from "lucide-react";
import { go, toast } from "../../state/store";
import { Button, Pill } from "../../ui";
import { fde, useFde } from "../fde/engine";
import { VMS, VM_BY_ID } from "../fde/data/vms";
import { TASK_BY_ID } from "../fde/data/deal";
import { RoleBadge, Terminal, BrowserStream, TaskState } from "../fde/widgets";
import type { Role } from "../fde/types";
import "../../styles/admin-workspace.css";

// One VM, full screen: what the agent is typing, what its browser sees, and the
// policy that fences it in.

const POLICY: Record<Role, { read: string; write: string; secrets: string; egress: string; extra?: string }> = {
  analyst: { read: "deal_context.brennan.*", write: "plans.brennan.requirements", secrets: "none", egress: "none" },
  architect: { read: "plans.brennan.* · catalog.*", write: "plans.brennan.* · staging.alder_lake.config", secrets: "none", egress: "none" },
  builder: { read: "public data · staging.alder_lake.units", write: "staging.alder_lake.storefront · twin", secrets: "none", egress: "county parcel API · google business · alderlakestorage.com" },
  migrator: { read: "legacy_import.brennan.*", write: "staging.alder_lake.*", secrets: "keystone/brennan · read · ttl 4h", egress: "brennan.keystonesm.net", extra: "computer_use: chromium sandbox · downloads only to /work · no clipboard" },
  integrator: { read: "staging.alder_lake.*", write: "staging.alder_lake.integrations", secrets: "pdk/alder-lake · stripe/connect (scoped)", egress: "api.pdk.io · api.stripe.com · carrier API · smtp" },
  validator: { read: "legacy_import.brennan.* · staging.alder_lake.* · pdk (read)", write: "reports.brennan.validation", secrets: "pdk/alder-lake · read", egress: "api.pdk.io (read) · api.stripe.com ($0 auth)" },
};

export function VmSession({ id }: { id: string }) {
  useFde();
  const def = VM_BY_ID.get(id) ?? VMS[0];
  const vm = fde.vms[def.id];
  const p = POLICY[def.role];
  const tasks = def.scripts.map(s => TASK_BY_ID.get(s.task)!).filter(Boolean);
  const tools = vm.lines.filter(l => l.kind === "tool" || l.kind === "cmd").slice(-14).reverse();
  const totalSteps = def.scripts.reduce((a, s) => a + s.steps.length, 0) + 3;
  const pct = Math.min(1, vm.lines.filter(l => l.text).length / totalSteps);

  return (
    <div className="sa-vs">
      <div className="sa-vs-picker" role="toolbar" aria-label="VMs in this onboarding">
        {VMS.map(v => (
          <button key={v.id} aria-pressed={v.id === def.id} onClick={() => go(`admin/vm/${v.id}`)}>
            <i className={fde.vms[v.id].state} />
            <span className="mono">{v.id}</span>
            <span className="faint">{v.label}</span>
          </button>
        ))}
      </div>
      <header className="sa-vs-head">
        <Button size="sm" variant="ghost" iconOnly aria-label="Back to onboarding" icon={<ArrowLeft size={15} />} onClick={() => go("admin/onboard/brennan")} />
        <h1>{def.id}</h1>
        <RoleBadge role={def.role} />
        <Pill tone={vm.state === "running" || vm.state === "booting" ? "accent" : vm.state === "done" ? "ok" : "neutral"} dot live={vm.state === "running"}>
          {vm.state === "off" ? "Not booted" : vm.state[0].toUpperCase() + vm.state.slice(1)}
        </Pill>
        <span className="sa-vs-sub">
          {def.label} · Brennan Storage Co.{def.parent ? ` · sub-agent of ${def.parent}` : ""}
        </span>
        <div className="sa-vs-a">
          <Button size="sm" icon={<Video size={14} />} onClick={() => toast({ title: "Recording saved", body: `${def.id} · signed · attached to the onboarding audit log`, tone: "ok" })}>
            Recording
          </Button>
          <Button size="sm" variant="danger" icon={<Power size={14} />} onClick={() => toast({ title: "Kill switch is live in production", body: "In the demo, VMs finish their scripts.", tone: "info" })}>
            Stop VM
          </Button>
        </div>
      </header>
      <div className="sa-vs-body">
        <div className="sa-vs-main">
          {def.browser && <BrowserStream vmId={def.id} />}
          <Terminal vmId={def.id} />
          <div className="sa-vs-scrub">
            <span className="mono">{vm.bootedAt ?? "—"}</span>
            <span className="sa-vs-scrub-bar">
              <i style={{ width: `${pct * 100}%` }} />
            </span>
            <span>Recording · every tool call signed</span>
          </div>
        </div>
        <aside className="sa-vs-side">
          <div className="sa-vs-block">
            <h3>Machine</h3>
            <dl className="sa-vs-meta">
              <dt>Harness</dt>
              <dd className="mono">codex · profile {def.profile}</dd>
              <dt>MicroVM</dt>
              <dd className="mono">
                {def.vcpu} vCPU · {def.memGb} GB · {def.region}
              </dd>
              <dt>Tools</dt>
              <dd className="mono">shell · fs · psql · http{def.browser ? " · browser · computer" : ""} · vault · email</dd>
              <dt>Usage</dt>
              <dd className="mono">
                {(vm.tokens / 1000).toFixed(1)}k tokens · {vm.cpu}% cpu
              </dd>
              <dt>Booted</dt>
              <dd className="mono">{vm.bootedAt ?? "not yet"}</dd>
            </dl>
          </div>
          <div className="sa-vs-block">
            <h3>Tasks on this VM</h3>
            <ul className="sa-vs-tools">
              {tasks.map(t => (
                <li key={t.id}>
                  <TaskState state={fde.tasks[t.id].state} />
                  <span style={{ fontFamily: "var(--f-ui)", fontSize: 12.5 }}>
                    <span className="mono faint">{t.id}</span> {t.title}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="sa-vs-block">
            <h3>Access policy · enforced outside the model</h3>
            <pre className="sa-vs-policy">
              <b>role</b>: {def.profile}@brennan{"\n"}
              <b>database</b>:{"\n"}
              {"  "}read:  {p.read}
              {"\n"}
              {"  "}write: {p.write}
              {"\n"}
              {"  "}prod:  <em>deny</em> · promotion only via validator + approval{"\n"}
              <b>secrets</b>: {p.secrets}
              {"\n"}
              <b>egress</b>: {p.egress}
              {"\n"}
              {p.extra && (
                <>
                  <b>sandbox</b>: {p.extra}
                  {"\n"}
                </>
              )}
              <b>pii</b>: card numbers <em>never</em> · tokens only{"\n"}
              <b>audit</b>: <u>full recording · every call signed</u>
            </pre>
          </div>
          {p.secrets !== "none" && (
            <div className="sa-vs-block">
              <h3>Vault lease</h3>
              <div className="sa-vs-lease">
                <KeyRound size={15} />
                <div>
                  <span className="mono">{p.secrets.split(" · ")[0]}</span>
                  <small>{fde.run === "live" ? "Revoked at cutover · 5:45 am" : vm.state === "off" ? "Not issued" : "Active · scoped · auto-revokes when the job ends"}</small>
                </div>
              </div>
            </div>
          )}
          <div className="sa-vs-block">
            <h3>Recent tool calls</h3>
            {tools.length ? (
              <ul className="sa-vs-tools">
                {tools.map(l => (
                  <li key={l.id}>
                    <span className="mono">{l.at.split(" ").slice(1, 2).join("")}</span>
                    <span title={l.text}>{l.text}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="faint" style={{ fontSize: 12.5 }}>
                No calls yet.
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
