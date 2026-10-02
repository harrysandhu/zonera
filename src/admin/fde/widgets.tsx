import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Play, RotateCcw, Bot, Gauge, Lock, MousePointer2, FileSearch, Workflow, Boxes, DatabaseZap, Plug, ShieldCheck, Eye, EyeOff, type LucideIcon } from "lucide-react";
import { go } from "../../state/store";
import { TENANTS } from "../../data/tenants";
import { fde, useFde, startFde, resetFde, setSpeed, setAutopilot, clockAt, elapsed, STAGES, stage, type TaskState } from "./engine";
import { VM_BY_ID } from "./data/vms";
import { TASK_BY_ID, LINE_BY_ID, SOURCE_BY_ID } from "./data/deal";
import type { Role, Stage, Cite as CiteT, Frame } from "./types";

// Shared HQ widgets (prefix sa-). Used by the workspace, VM session, fleet and mission control.

export const ROLE: Record<Role, { label: string; icon: LucideIcon; tone: string }> = {
  analyst: { label: "Analyst", icon: FileSearch, tone: "violet" },
  architect: { label: "Architect", icon: Workflow, tone: "accent" },
  builder: { label: "Builder", icon: Boxes, tone: "pine" },
  migrator: { label: "Migrator", icon: DatabaseZap, tone: "warn" },
  integrator: { label: "Integrator", icon: Plug, tone: "info" },
  validator: { label: "Validator", icon: ShieldCheck, tone: "ok" },
};

export function RoleBadge({ role, compact }: { role: Role; compact?: boolean }) {
  const r = ROLE[role];
  const I = r.icon;
  return (
    <span className={`sa-role sa-role--${r.tone}`} title={`fde-${role}`}>
      <I size={12} />
      {!compact && r.label}
    </span>
  );
}

const TASK_LABEL: Record<TaskState, string> = { hidden: "", blocked: "Blocked", queued: "Queued", running: "Running", waiting: "Waiting on vendor", done: "Done" };
export function TaskState({ state }: { state: TaskState }) {
  return (
    <span className={`sa-ts sa-ts--${state}`}>
      <i />
      {TASK_LABEL[state]}
    </span>
  );
}

/** Progress ring. */
export function Ring({ value, size = 44, stroke = 4, label }: { value: number; size?: number; stroke?: number; label?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className="sa-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.max(0, Math.min(1, value)))}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset .6s cubic-bezier(.2,.8,.2,1)" }}
        />
      </svg>
      {label !== undefined && <b>{label}</b>}
    </span>
  );
}

export function StageRail({ current = stage(), compact }: { current?: Stage; compact?: boolean }) {
  const idx = STAGES.findIndex(s => s.id === current);
  return (
    <ol className={`sa-rail ${compact ? "sa-rail--compact" : ""}`}>
      {STAGES.map((s, i) => (
        <li key={s.id} className={i < idx || current === "live" ? "done" : i === idx ? "now" : ""}>
          <i />
          <span>{s.label}</span>
        </li>
      ))}
    </ol>
  );
}

/** A citation back into the sales context. Hover for the quote; click to jump there. */
export function Cite({ cite, onJump }: { cite: CiteT; onJump?: (line: string) => void }) {
  const src = SOURCE_BY_ID.get(cite.source);
  const line = LINE_BY_ID.get(cite.line);
  const label = src?.kind === "email" ? "email" : `call ${cite.source.slice(1)}`;
  return (
    <button type="button" className="sa-cite" title={`“${cite.quote}”`} onClick={() => onJump?.(cite.line)}>
      <span>{label}</span>
      <span className="mono">{line?.t}</span>
    </button>
  );
}

// ---- terminal ---------------------------------------------------------------------

const PROMPT: Record<string, string> = { cmd: "$", tool: "▸", out: " ", ok: "✓", warn: "!", note: "·", think: "~", boot: "◦" };

export function Terminal({ vmId, max, className = "" }: { vmId: string; max?: number; className?: string }) {
  useFde();
  const vm = fde.vms[vmId];
  const ref = useRef<HTMLDivElement>(null);
  const lines = max ? vm.lines.slice(-max) : vm.lines;
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [vm.lines.length]);
  return (
    <div ref={ref} className={`sa-term ${className}`} aria-live="polite">
      {lines.length === 0 && <div className="sa-term-l sa-term-l--note">VM not started</div>}
      {lines.map(l =>
        l.text ? (
          <div key={l.id} className={`sa-term-l sa-term-l--${l.kind}`}>
            <span className="sa-term-p">{PROMPT[l.kind]}</span>
            <span className="sa-term-t">{l.text}</span>
          </div>
        ) : (
          <div key={l.id} className="sa-term-gap" />
        ),
      )}
      {(vm.state === "running" || vm.state === "booting") && <span className="sa-term-caret" />}
    </div>
  );
}

// ---- browser stream: the agent driving the legacy PMS ---------------------------------

export function BrowserStream({ vmId, className = "" }: { vmId: string; className?: string }) {
  useFde();
  const vm = fde.vms[vmId];
  const f = vm.frame;
  const def = VM_BY_ID.get(vmId);
  return (
    <div className={`sa-browser ${className}`}>
      <div className="sa-browser-bar">
        <span className="sa-browser-dots">
          <i />
          <i />
          <i />
        </span>
        <span className="sa-browser-url">
          <Lock size={11} />
          <span className="mono">{f?.url ?? "about:blank"}</span>
        </span>
        <span className="sa-browser-tag">
          <Bot size={12} /> {def?.profile} · computer use
        </span>
      </div>
      <div className="sa-browser-view">{f ? <Keystone frame={f} /> : <div className="sa-browser-idle">{vm.state === "off" ? "Waiting for the Keystone login" : "Idle"}</div>}</div>
    </div>
  );
}

/** Keystone Storage Manager 8.4, circa 2012. A deliberately dated UI the agent has to drive. */
function Keystone({ frame }: { frame: Frame }) {
  const ref = useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = useState({ x: 40, y: 40, click: 0 });
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || !frame.focus) return;
    const el = root.querySelector<HTMLElement>(`[data-f="${frame.focus}"]`);
    if (!el) return;
    const a = root.getBoundingClientRect();
    const b = el.getBoundingClientRect();
    setCursor(c => ({ x: b.left - a.left + Math.min(b.width * 0.6, 60), y: b.top - a.top + b.height * 0.6, click: c.click + 1 }));
  }, [frame.screen, frame.focus]);

  const rows = TENANTS.slice(0, 14);

  let body: React.ReactNode;
  if (frame.screen === "login") {
    body = (
      <div className="ks-login">
        <div className="ks-login-box">
          <div className="ks-login-h">Keystone Storage Manager</div>
          <div className="ks-login-b">
            <label>
              User name
              <span className={`ks-input ${frame.focus === "user" ? "ks-focus" : ""}`} data-f="user">
                {frame.typed ?? ""}
              </span>
            </label>
            <label>
              Password
              <span className={`ks-input ${frame.focus === "pass" ? "ks-focus" : ""}`} data-f="pass">
                {frame.focus === "pass" || frame.focus === "signin" ? "••••••••••" : ""}
              </span>
            </label>
            <span className={`ks-btn ${frame.focus === "signin" ? "ks-focus" : ""}`} data-f="signin">
              Sign in
            </span>
          </div>
          <div className="ks-login-f">© 2012 Keystone Software, Inc. · Version 8.4.2201 · Best viewed in Internet Explorer 9</div>
        </div>
      </div>
    );
  } else {
    const tab = frame.screen === "home" ? "Home" : frame.screen === "deposits" ? "Setup" : frame.screen === "ledger" || frame.screen === "docs" ? "Tenants" : "Reports";
    body = (
      <>
        <div className="ks-head">
          <b>Keystone Storage Manager 8.4</b>
          <span>Brennan Storage Co. · Alder Lake · User: gail.brennan</span>
        </div>
        <div className="ks-menu">
          {["Home", "Tenants", "Units", "Reports", "Setup", "Help"].map(t => (
            <span key={t} className={t === tab ? "on" : t === "Reports" && frame.focus === "reports" ? "ks-focus" : ""} data-f={t === "Reports" ? "reports" : undefined}>
              {t}
            </span>
          ))}
        </div>
        <div className="ks-body">
          {frame.screen === "home" && (
            <div className="ks-grid2">
              <fieldset>
                <legend>Today's activity · 09/30/2026</legend>
                <table className="ks-t">
                  <tbody>
                    <tr><td>Move-ins</td><td>2</td></tr>
                    <tr><td>Move-outs</td><td>1</td></tr>
                    <tr><td>Payments</td><td>$4,318.00</td></tr>
                    <tr><td>Past due</td><td>12</td></tr>
                  </tbody>
                </table>
              </fieldset>
              <fieldset>
                <legend>Reminders</legend>
                <p>Gate codes must also be entered in the gate system.</p>
                <p>Run month-end before 10/01.</p>
              </fieldset>
            </div>
          )}
          {frame.screen === "reports" && (
            <fieldset className="ks-form">
              <legend>Report criteria</legend>
              <div><span>Report</span><span className="ks-input">Rent Roll (detailed)</span></div>
              <div><span>Site</span><span className={`ks-input ${frame.focus === "site" ? "ks-focus" : ""}`} data-f="site">Alder Lake ▾</span></div>
              <div><span>As of</span><span className="ks-input">09/30/2026</span></div>
              <div><span /><span className={`ks-btn ${frame.focus === "run" ? "ks-focus" : ""}`} data-f="run">Run report</span></div>
            </fieldset>
          )}
          {(frame.screen === "rentroll" || frame.screen === "ledger" || frame.screen === "docs") && (
            <>
              <div className="ks-bar">
                <b>{frame.screen === "rentroll" ? "Rent Roll · Alder Lake · As of 09/30/2026" : frame.screen === "ledger" ? "Ledger history (all tenants)" : "Tenant documents"}</b>
                <span>Page {frame.url.includes("page=") ? frame.url.split("page=")[1] : "1"} of {frame.screen === "rentroll" ? 7 : frame.screen === "ledger" ? 302 : 28}</span>
                <span className={`ks-btn ${frame.focus === "export" || frame.focus === "dl" ? "ks-focus" : ""}`} data-f={frame.screen === "docs" ? "dl" : "export"}>
                  {frame.screen === "docs" ? "Download selected" : "Export ▾"}
                </span>
              </div>
              <table className="ks-t ks-t--grid" data-f="rows">
                <thead>
                  {frame.screen === "rentroll" ? (
                    <tr><th>Unit</th><th>Tenant</th><th>Rent</th><th>Balance</th><th>Paid thru</th><th>Gate</th></tr>
                  ) : frame.screen === "ledger" ? (
                    <tr><th>Date</th><th>Tenant</th><th>Unit</th><th>Description</th><th>Amount</th></tr>
                  ) : (
                    <tr><th /><th>Tenant</th><th>Document</th><th>Pages</th><th>Uploaded</th></tr>
                  )}
                </thead>
                <tbody>
                  {rows.map((t, i) =>
                    frame.screen === "rentroll" ? (
                      <tr key={t.id}><td>{t.unitIds[0]}</td><td><u>{t.last.toUpperCase()}, {t.first}</u></td><td>{t.rent.toFixed(2)}</td><td>{t.balance.toFixed(2)}</td><td>{t.daysLate ? "08/31/2026" : "09/30/2026"}</td><td>{t.gateCode}</td></tr>
                    ) : frame.screen === "ledger" ? (
                      <tr key={t.id}><td>09/{String(28 - (i % 27)).padStart(2, "0")}/2026</td><td>{t.last.toUpperCase()}, {t.first}</td><td>{t.unitIds[0]}</td><td>{i % 4 === 3 ? "Late fee" : t.autopay ? "Autopay - card" : "Payment - cash"}</td><td>{i % 4 === 3 ? "25.00" : (-t.rent).toFixed(2)}</td></tr>
                    ) : (
                      <tr key={t.id}><td>☑</td><td>{t.last.toUpperCase()}, {t.first}</td><td><u>{i % 3 === 2 ? "Drivers_License.jpg" : "Rental_Agreement.pdf"}</u></td><td>{i % 3 === 2 ? 1 : 14}</td><td>{t.moveIn.replace(/^(\d+)-(\d+)-(\d+)$/, "$2/$3/$1")}</td></tr>
                    ),
                  )}
                </tbody>
              </table>
            </>
          )}
          {frame.screen === "deposits" && (
            <fieldset className="ks-form">
              <legend>Deposit accounts</legend>
              <div><span>Bank</span><span className={`ks-input ${frame.focus === "acct" ? "ks-focus" : ""}`} data-f="acct">Sierra Pacific Credit Union</span></div>
              <div><span>Routing</span><span className="ks-input">*****4108</span></div>
              <div><span>Account</span><span className="ks-input">*******0918</span></div>
              <div><span>Sweep</span><span className="ks-input">Daily, 5:00 PM</span></div>
            </fieldset>
          )}
        </div>
      </>
    );
  }

  return (
    <div className="ks" ref={ref}>
      {body}
      <span key={cursor.click} className="ks-cursor" style={{ transform: `translate(${cursor.x}px, ${cursor.y}px)` }}>
        <MousePointer2 size={18} />
        <i />
      </span>
    </div>
  );
}

// ---- VM card ---------------------------------------------------------------------------

export function VmCard({ id, onOpen }: { id: string; onOpen?: () => void }) {
  useFde();
  const def = VM_BY_ID.get(id)!;
  const vm = fde.vms[id];
  const last = [...vm.lines].reverse().find(l => l.text);
  const task = vm.task ? TASK_BY_ID.get(vm.task) : undefined;
  return (
    <button type="button" className={`sa-vm sa-vm--${vm.state}`} onClick={onOpen ?? (() => go(`admin/vm/${id}`))}>
      <div className="sa-vm-h">
        <RoleBadge role={def.role} compact />
        <b className="mono">{id}</b>
        <span className="sa-vm-label">{def.label}</span>
        <span className={`sa-vm-state sa-vm-state--${vm.state}`}>{vm.state === "off" ? "Off" : vm.state === "booting" ? "Booting" : vm.state === "running" ? "Running" : vm.state === "idle" ? "Idle" : "Done"}</span>
      </div>
      <div className="sa-vm-task">{task ? task.title : vm.state === "off" ? "Waiting for work" : "No task"}</div>
      <div className="sa-vm-last mono">{last ? `${PROMPT[last.kind]} ${last.text}` : "—"}</div>
      <div className="sa-vm-f">
        <span className="sa-vm-cpu">
          <i style={{ width: `${vm.cpu}%` }} />
        </span>
        <span className="mono">{vm.cpu}% cpu</span>
        <span className="mono">{(vm.tokens / 1000).toFixed(1)}k tok</span>
      </div>
    </button>
  );
}

// ---- presenter dock --------------------------------------------------------------------

export function SimDock() {
  useFde();
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === ".") setHidden(h => !h);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  if (hidden) return null;
  return (
    <div className="sa-dock" role="group" aria-label="Simulation controls">
      <span className="sa-dock-l">
        <Gauge size={13} /> Sim
      </span>
      <span className="sa-dock-clock mono">
        {clockAt()} <em>T+{elapsed()}</em>
      </span>
      {fde.run === "idle" ? (
        <button className="sa-dock-go" onClick={() => startFde()}>
          <Play size={12} /> Start
        </button>
      ) : (
        <span className={`sa-dock-st ${fde.run}`}>{fde.run === "live" ? "Live" : "Running"}</span>
      )}
      <span className="sa-dock-seg">
        {[1, 2, 4, 8].map(n => (
          <button key={n} aria-pressed={fde.speed === n} onClick={() => setSpeed(n)}>
            {n}×
          </button>
        ))}
      </span>
      <button className="sa-dock-btn" aria-pressed={fde.autopilot} onClick={() => setAutopilot(!fde.autopilot)} title="Gail and Jordan act on their own">
        {fde.autopilot ? <Eye size={13} /> : <EyeOff size={13} />} Autopilot
      </button>
      <button className="sa-dock-btn" onClick={() => resetFde()} title="Reset the onboarding" aria-label="Reset">
        <RotateCcw size={13} />
      </button>
    </div>
  );
}
