import React, { useEffect, useMemo, useRef, useState } from "react";
import { Play, ExternalLink, Phone, Mail as MailIcon, KeyRound, Send, Upload, CheckCircle2, ListChecks, FormInput, PenLine, CreditCard, Sparkles, ArrowUpRight, CircleAlert, MonitorPlay, TerminalSquare, Pin, PinOff, type LucideIcon } from "lucide-react";
import { go } from "../../state/store";
import { Button, Pill, Avatar } from "../../ui";
import { fde, useFde, startFde, stage, overallProgress, clockAt, elapsed, ownerProgress, taskProgress, resolveException, runningVms, type TaskState as TS } from "../fde/engine";
import { DEAL, PEOPLE, SOURCES, REQUIREMENTS, OWNER_ITEMS, TASKS, MAILS, EXCEPTIONS, LINE_BY_ID, REQ_BY_ID } from "../fde/data/deal";
import { VMS, VM_BY_ID, CHECKS } from "../fde/data/vms";
import { StageRail, Ring, Cite, RoleBadge, TaskState, Terminal, BrowserStream, VmCard, ROLE } from "../fde/widgets";
import type { ItemKind, Stage } from "../fde/types";
import "../../styles/admin-workspace.css";

// The hero screen. Left: what was said. Center: what the agents made of it.
// Right: the agents doing it, live.

type Tab = "reqs" | "owner" | "plan" | "validate" | "mail" | "activity";
const FOLLOW: Record<Stage, Tab> = { context: "reqs", plan: "owner", collect: "owner", migrate: "plan", validate: "validate", live: "validate" };

const KIND_ICON: Record<ItemKind, LucideIcon> = {
  credential: KeyRound,
  delegate: Send,
  upload: Upload,
  confirm: CheckCircle2,
  choice: ListChecks,
  form: FormInput,
  sign: PenLine,
  pay: CreditCard,
};
const KIND_LABEL: Record<ItemKind, string> = { credential: "Credential", delegate: "Delegate", upload: "Upload", confirm: "Confirm", choice: "Choice", form: "Form", sign: "Sign", pay: "Pay" };

export function Workspace({ id }: { id: string }) {
  useFde();
  const st = stage();
  const [tab, setTab] = useState<Tab>("reqs");
  const [follow, setFollow] = useState(true);
  const [source, setSource] = useState("c1");
  const [jump, setJump] = useState<{ line: string; n: number } | null>(null);

  // Follow the story: the center tab tracks the stage until the presenter clicks a tab.
  useEffect(() => {
    if (follow) setTab(FOLLOW[st]);
  }, [st, follow]);

  // The transcript follows whatever line the analyst is reading.
  const reading = fde.focusLine;
  useEffect(() => {
    if (!reading) return;
    const src = reading.split("-")[0];
    if (src && src !== source) setSource(src);
  }, [reading]);

  const jumpTo = (line: string) => {
    setSource(line.split("-")[0]);
    setJump({ line, n: Date.now() });
  };

  const pick = (t: Tab) => {
    setFollow(false);
    setTab(t);
  };

  const o = ownerProgress();
  const t = taskProgress();
  const dupOpen = fde.exc.dup.state === "open";
  const visibleReqs = REQUIREMENTS.filter(r => fde.reqs.includes(r.id));

  return (
    <div className="sa-ws">
      <header className="sa-ws-head">
        <div className="sa-ws-id">
          <div className="sa-ws-title">
            <h1>{DEAL.org}</h1>
            <span className="sa-ws-flow mono">{fde.flow}</span>
          </div>
          <div className="sa-ws-meta">
            <span>3 facilities · 461 units</span>
            <span className="sa-ws-dot" />
            <span>
              {DEAL.legacy} → Zonera
            </span>
            <span className="sa-ws-dot" />
            <span>Gate: {DEAL.gate}</span>
            <span className="sa-ws-dot" />
            <span>Professional · $999/mo</span>
          </div>
        </div>
        <div className="sa-ws-rail">
          <StageRail current={st} />
        </div>
        <div className="sa-ws-kpis">
          <div className="sa-ws-kpi">
            <small>Story clock</small>
            <b className="mono">{clockAt()}</b>
            <em className="mono">T+{elapsed()}</em>
          </div>
          <div className="sa-ws-kpi">
            <small>Human touches</small>
            <b className="mono">{fde.touches}</b>
            <em>{fde.touches ? "Jordan, 1 decision" : "none yet"}</em>
          </div>
          <Ring value={overallProgress()} size={46} label={`${Math.round(overallProgress() * 100)}`} />
        </div>
        <div className="sa-ws-actions">
          {fde.run === "idle" ? (
            <Button variant="accent" size="sm" icon={<Play size={14} />} onClick={startFde}>
              Start the FDE
            </Button>
          ) : fde.run === "live" ? (
            <Button variant="primary" size="sm" icon={<ArrowUpRight size={14} />} onClick={() => go("ops/overview")}>
              Open Alder Lake console
            </Button>
          ) : null}
          <Button size="sm" icon={<ExternalLink size={14} />} onClick={() => go("onboard/home")} disabled={!fde.portalSent}>
            View as Gail
          </Button>
        </div>
      </header>

      {dupOpen && (
        <button className="sa-ws-alert" onClick={() => pick("validate")}>
          <CircleAlert size={15} />
          <b>Needs you</b>
          <span>{EXCEPTIONS.dup.title}</span>
          <em>Review</em>
        </button>
      )}

      <div className="sa-ws-cols">
        {/* ---- Context ---- */}
        <section className="sa-ws-col sa-ws-ctx" aria-label="Sales context">
          <div className="sa-ws-col-h">
            <h2>Context</h2>
            <span className="faint">{SOURCES.filter(s => !s.late || fde.mails.includes("followup")).length} sources</span>
          </div>
          <div className="sa-ws-srcs" role="tablist">
            {SOURCES.map(s => {
              const hidden = s.late && !fde.mails.includes("followup");
              return (
                <button key={s.id} role="tab" aria-selected={source === s.id} className={hidden ? "sa-ws-src--off" : ""} disabled={hidden} onClick={() => setSource(s.id)}>
                  {s.kind === "call" ? <Phone size={12} /> : <MailIcon size={12} />}
                  {s.kind === "call" ? `Call ${s.id.slice(1)}` : "Email"}
                  {s.late && !hidden && <i className="sa-ws-new">new</i>}
                </button>
              );
            })}
          </div>
          <Transcript id={source} reading={reading} jump={jump} />
        </section>

        {/* ---- Plan ---- */}
        <section className="sa-ws-col sa-ws-plan" aria-label="What the agents made of it">
          <div className="sa-ws-tabs" role="tablist">
            <TabBtn on={tab === "reqs"} onClick={() => pick("reqs")} label="Requirements" n={visibleReqs.length} />
            <TabBtn on={tab === "owner"} onClick={() => pick("owner")} label="Checklist" n={o.total ? `${o.done}/${o.total}` : 0} />
            <TabBtn on={tab === "plan"} onClick={() => pick("plan")} label="Plan" n={t.total ? `${t.done}/${t.total}` : 0} />
            <TabBtn on={tab === "validate"} onClick={() => pick("validate")} label="Validation" n={Object.values(fde.checks).filter(c => c !== "pending").length || 0} hot={dupOpen} />
            <TabBtn on={tab === "mail"} onClick={() => pick("mail")} label="Mail" n={0} />
            <TabBtn on={tab === "activity"} onClick={() => pick("activity")} label="Activity" n={0} />
            <button className={`sa-ws-follow ${follow ? "on" : ""}`} onClick={() => setFollow(f => !f)} title={follow ? "Following the onboarding. Click to stop" : "Follow the onboarding as it moves"} aria-label="Follow">
              {follow ? <Pin size={12} /> : <PinOff size={12} />}
            </button>
          </div>
          <div className="sa-ws-pane">
            {tab === "reqs" && <Requirements onJump={jumpTo} />}
            {tab === "owner" && <OwnerChecklist onJump={jumpTo} />}
            {tab === "plan" && <PlanTasks />}
            {tab === "validate" && <Validation />}
            {tab === "mail" && <MailPane />}
            {tab === "activity" && <Activity />}
          </div>
        </section>

        {/* ---- Fleet ---- */}
        <section className="sa-ws-col sa-ws-fleet" aria-label="Agents at work">
          <FleetPane />
        </section>
      </div>
    </div>
  );
}

function TabBtn({ on, onClick, label, n, hot }: { on: boolean; onClick: () => void; label: string; n: number | string; hot?: boolean }) {
  return (
    <button role="tab" aria-selected={on} onClick={onClick} className={hot ? "hot" : ""}>
      {label}
      {n ? <em className="mono">{n}</em> : null}
    </button>
  );
}

// ---- Context column ---------------------------------------------------------------

function Transcript({ id, reading, jump }: { id: string; reading: string; jump: { line: string; n: number } | null }) {
  useFde();
  const src = SOURCES.find(s => s.id === id)!;
  const ref = useRef<HTMLDivElement>(null);
  const cited = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const r of REQUIREMENTS) if (fde.reqs.includes(r.id)) for (const c of r.cites) m.set(c.line, [...(m.get(c.line) ?? []), r.id]);
    return m;
  }, [fde.reqs.length]);

  const target = jump?.line ?? reading;
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>(`[data-line="${target}"]`);
    if (el && ref.current) {
      const top = el.offsetTop - ref.current.clientHeight / 3;
      ref.current.scrollTo({ top, behavior: "smooth" });
    }
  }, [target, jump?.n, id]);

  return (
    <div className="sa-ws-tr" ref={ref}>
      <div className="sa-ws-tr-card">
        <b>{src.title}</b>
        <span className="faint">
          {src.when}
          {src.duration ? ` · ${src.duration}` : ""}
        </span>
        <div className="sa-ws-tr-people">
          {src.people.map(p => (
            <span key={p}>
              <Avatar name={PEOPLE[p].name} size="sm" />
              {PEOPLE[p].name}
              <small>{PEOPLE[p].org === "Zonera" ? "Zonera" : PEOPLE[p].role.split(",")[0]}</small>
            </span>
          ))}
        </div>
        <p>{src.summary}</p>
      </div>
      {src.lines.map(l => {
        const reqs = cited.get(l.id);
        const isReading = reading === l.id;
        const isJump = jump?.line === l.id;
        return (
          <div key={l.id} data-line={l.id} className={`sa-ws-line ${reqs ? "cited" : ""} ${isReading ? "reading" : ""} ${isJump ? "jumped" : ""} ${l.who === "jordan" ? "us" : ""}`}>
            <span className="sa-ws-line-t mono">{l.t}</span>
            <div>
              <b>{PEOPLE[l.who].name.split(" ")[0]}</b>
              <p>{l.text}</p>
              {reqs && (
                <span className="sa-ws-line-r">
                  {reqs.map(r => (
                    <i key={r} className="mono">
                      {r}
                    </i>
                  ))}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---- Center panes -------------------------------------------------------------------

function Requirements({ onJump }: { onJump: (l: string) => void }) {
  useFde();
  const shown = fde.reqs.map(id => REQ_BY_ID.get(id)!).filter(Boolean);
  if (!shown.length)
    return (
      <PaneEmpty
        title={fde.run === "idle" ? "Nothing extracted yet" : "Reading the calls…"}
        body={fde.run === "idle" ? "Start the FDE and the analyst reads both calls and the email thread." : "Requirements appear as the analyst finds them, each with the line it came from."}
      />
    );
  return (
    <ol className="sa-ws-reqs">
      {shown.map(r => (
        <li key={r.id} className={r.late ? "late" : ""}>
          <span className="sa-ws-req-id mono">{r.id}</span>
          <div className="sa-ws-req-b">
            <div className="sa-ws-req-t">
              <b>{r.title}</b>
              {r.late && <Pill tone="accent">From email · re-planned</Pill>}
            </div>
            <p>{r.detail}</p>
            <div className="sa-ws-req-f">
              <span className="sa-ws-cat">{r.category}</span>
              <span className="sa-ws-cap">
                <Sparkles size={11} /> {r.capability}
              </span>
              <span className="sa-ws-req-cites">
                {r.cites.map(c => (
                  <Cite key={c.line} cite={c} onJump={onJump} />
                ))}
              </span>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function OwnerChecklist({ onJump }: { onJump: (l: string) => void }) {
  useFde();
  const shown = OWNER_ITEMS.filter(i => fde.items[i.id].state !== "hidden");
  const o = ownerProgress();
  if (!shown.length) return <PaneEmpty title="No checklist yet" body="The architect compiles one from the requirements. There is no template: every item exists because of something said on a call." />;
  return (
    <div className="sa-ws-own">
      <div className="sa-ws-own-sum">
        <div>
          <b>
            {o.done} of {o.total} done
          </b>
          <span className="faint">{o.minutes ? `about ${o.minutes} min of Gail's time left` : "nothing left for Gail"}</span>
        </div>
        <div className="sa-ws-own-vs">
          <span className="faint">Replaces the fixed 7-item template</span>
          <span className="mono">customer export · unit export · facility map · billing inputs · branding · signer · go-live config</span>
        </div>
      </div>
      <ul className="sa-ws-items">
        {shown.map(i => {
          const s = fde.items[i.id];
          const I = KIND_ICON[i.kind];
          return (
            <li key={i.id} className={`st-${s.state} ${i.late ? "late" : ""}`}>
              <span className="sa-ws-item-ic">
                <I size={14} />
              </span>
              <div className="sa-ws-item-b">
                <div className="sa-ws-item-t">
                  <b>{i.title}</b>
                  {i.late && <Pill tone="accent">New</Pill>}
                </div>
                <p>{i.why}</p>
                <div className="sa-ws-item-f">
                  <span className="mono faint">
                    {i.id} · {KIND_LABEL[i.kind]} · {i.group === "needs" ? "needs Gail" : "quick confirm"}
                  </span>
                  {i.cite && <Cite cite={i.cite} onJump={onJump} />}
                </div>
              </div>
              <span className={`sa-ws-item-s sa-ws-item-s--${s.state}`}>{s.state === "done" ? `Done · ${s.at?.split(" ").slice(1).join(" ")}` : s.state === "waiting" ? "Agent finding it" : "With Gail"}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PlanTasks() {
  useFde();
  const shown = TASKS.filter(t => fde.tasks[t.id].state !== "hidden");
  if (!fde.planned) return <PaneEmpty title="No plan yet" body="Once the requirements are in, the architect compiles 22 tasks across 8 VMs." />;
  const ORDER: TS[] = ["running", "waiting", "queued", "blocked", "done"];
  const sorted = [...shown].sort((a, b) => ORDER.indexOf(fde.tasks[a.id].state) - ORDER.indexOf(fde.tasks[b.id].state));
  return (
    <table className="sa-ws-tasks">
      <thead>
        <tr>
          <th>Task</th>
          <th>VM</th>
          <th>State</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map(t => {
          const s = fde.tasks[t.id].state;
          return (
            <tr key={t.id} className={`st-${s}`}>
              <td>
                <div className="sa-ws-task-t">
                  <span className="mono faint">{t.id}</span>
                  <span>{t.title}</span>
                  {t.late && <Pill tone="accent">New</Pill>}
                </div>
                {t.needs.length > 0 && s !== "done" && (
                  <div className="sa-ws-task-n">
                    <em>needs</em>
                    {t.needs.map(n => (
                      <span key={n} className={`mono ${(n.startsWith("O") ? fde.items[n]?.state === "done" : fde.tasks[n]?.state === "done") ? "ok" : ""}`}>
                        {n}
                      </span>
                    ))}
                  </div>
                )}
              </td>
              <td>
                <button className="sa-ws-vmchip" onClick={() => go(`admin/vm/${t.vm}`)}>
                  <RoleBadge role={t.role} compact />
                  <span className="mono">{t.vm}</span>
                </button>
              </td>
              <td>
                <TaskState state={s} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

const CHECK_LABEL: Record<string, string> = { pending: "Pending", running: "Running", pass: "Match", fixed: "Fixed with evidence", flag: "Flagged" };

function Validation() {
  useFde();
  const e = fde.exc;
  return (
    <div className="sa-ws-val">
      <div className="sa-ws-val-h">
        <div>
          <b>Two-key rule</b>
          <span className="faint">
            Written by <span className="mono">vm-4d90</span> (migrator) · checked by <span className="mono">vm-6c3b</span> (validator). The agent that writes data never validates it.
          </span>
        </div>
      </div>
      {e.dup.state !== "hidden" && <Decision />}
      <table className="sa-ws-checks">
        <thead>
          <tr>
            <th>Check</th>
            <th>Source</th>
            <th>Target</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
          {CHECKS.map(c => {
            const s = fde.checks[c.id];
            return (
              <tr key={c.id} className={`ck-${s}`}>
                <td>{c.label}</td>
                <td className="faint">{c.source}</td>
                <td className="mono faint">{c.target}</td>
                <td>
                  <span className={`sa-ws-ck sa-ws-ck--${s}`}>
                    <i />
                    {CHECK_LABEL[s]}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {e.size.state !== "hidden" && (
        <div className="sa-ws-sms">
          <div className="sa-ws-sms-h">
            <b>Routed to the owner's team, not to HQ</b>
            <span className="faint">{EXCEPTIONS.size.title}</span>
          </div>
          {fde.mails.includes("priyaSms") && (
            <div className="sa-ws-bubble out">
              <span>{MAILS.priyaSms.body}</span>
              <small>Zonera → Priya · {MAILS.priyaSms.when.split(" · ")[1]}</small>
            </div>
          )}
          {fde.mails.includes("priyaReply") && (
            <div className="sa-ws-bubble in">
              <span>{MAILS.priyaReply.body}</span>
              <small>Priya · {MAILS.priyaReply.when.split(" · ")[1]}</small>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Decision() {
  useFde();
  const ex = EXCEPTIONS.dup;
  const s = fde.exc.dup;
  return (
    <div className={`sa-ws-dec ${s.state === "resolved" ? "done" : ""}`}>
      <div className="sa-ws-dec-h">
        <CircleAlert size={15} />
        <b>{s.state === "resolved" ? "Decided" : "Needs you"}</b>
        <span>{ex.title}</span>
      </div>
      <p>{ex.detail}</p>
      <ul>
        {ex.evidence.map(x => (
          <li key={x}>{x}</li>
        ))}
      </ul>
      <div className="sa-ws-dec-rec">
        <Sparkles size={13} />
        <span>
          <b>Validator recommends:</b> {ex.recommendation}
        </span>
      </div>
      {s.state === "resolved" ? (
        <div className="sa-ws-dec-done">
          <Avatar name="Jordan Lee" size="sm" /> Jordan Lee chose <b>{ex.options.find(o => o.id === s.choice)?.label}</b> · {s.at}
        </div>
      ) : (
        <div className="sa-ws-dec-a">
          {ex.options.map(o => (
            <Button key={o.id} size="sm" variant={o.primary ? "primary" : "default"} onClick={() => resolveException("dup", o.id)}>
              {o.label}
            </Button>
          ))}
          <span className="faint">This is the only decision in this onboarding that needs a person.</span>
        </div>
      )}
    </div>
  );
}

function MailPane() {
  useFde();
  if (!fde.mails.length) return <PaneEmpty title="No mail yet" body="Agents email the owner, chase vendors and text the manager. Every message shows up here." />;
  return (
    <ul className="sa-ws-mail">
      {[...fde.mails].reverse().map(id => {
        const m = MAILS[id];
        return (
          <li key={id} className={m.dir}>
            <div className="sa-ws-mail-h">
              <span className={`sa-ws-mail-dir ${m.dir}`}>{m.dir === "out" ? "Sent" : "Received"}</span>
              <b>{m.subject}</b>
              <span className="faint">{m.when}</span>
            </div>
            <div className="sa-ws-mail-who faint">
              {m.from} → {m.to}
            </div>
            <p>{m.body}</p>
          </li>
        );
      })}
    </ul>
  );
}

function Activity() {
  useFde();
  return (
    <ul className="sa-ws-act">
      {fde.feed.map(f => (
        <li key={f.id} className={`who-${f.who}`}>
          <span className="mono faint">{f.at.split(" ").slice(1).join(" ")}</span>
          <i />
          <span>{f.text}</span>
          {f.ref && (
            <button className="mono" onClick={() => go(`admin/vm/${f.ref}`)}>
              {f.ref}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

function PaneEmpty({ title, body }: { title: string; body: string }) {
  return (
    <div className="sa-ws-empty">
      <b>{title}</b>
      <p>{body}</p>
      {fde.run === "idle" && (
        <Button variant="accent" size="sm" icon={<Play size={14} />} onClick={startFde}>
          Start the FDE
        </Button>
      )}
    </div>
  );
}

// ---- Fleet column ---------------------------------------------------------------------

function FleetPane() {
  useFde();
  const [pinned, setPinned] = useState<string | null>(null);
  const [auto, setAuto] = useState("vm-0a1c");
  const lastSwitch = useRef(0);

  // Follow the VM that most recently printed, but don't flicker: hold each for ~2.5s,
  // and prefer a browser VM while one is driving Keystone.
  const running = runningVms();
  const latest = useMemo(() => {
    let best = "";
    let id = -1;
    for (const v of VMS) {
      const run = fde.vms[v.id];
      const l = run.lines[run.lines.length - 1];
      if (l && l.id > id && (run.state === "running" || run.state === "booting")) {
        id = l.id;
        best = v.id;
      }
    }
    const browser = VMS.find(v => v.id === "vm-4d90" && fde.vms[v.id].state === "running");
    return browser ? browser.id : best;
  }, [Object.values(fde.vms).reduce((a, v) => a + v.lines.length, 0)]);

  useEffect(() => {
    if (!latest || latest === auto) return;
    const now = Date.now();
    if (now - lastSwitch.current < 2500) return;
    lastSwitch.current = now;
    setAuto(latest);
  }, [latest]);

  const focus = pinned ?? auto;
  const def = VM_BY_ID.get(focus)!;
  const vm = fde.vms[focus];
  const [view, setView] = useState<"browser" | "term">("browser");
  const showBrowser = def.browser && view === "browser";

  return (
    <div className="sa-ws-fl">
      <div className="sa-ws-col-h">
        <h2>Agents</h2>
        <span className="faint">
          {running.length} running · {VMS.filter(v => fde.vms[v.id].state !== "off").length} of {VMS.length} booted
        </span>
      </div>
      <div className="sa-ws-focus">
        <div className="sa-ws-focus-h">
          <RoleBadge role={def.role} />
          <b className="mono">{focus}</b>
          <span className="faint sa-ws-focus-l">{def.label}</span>
          {def.browser && (
            <span className="sa-ws-views">
              <button aria-pressed={view === "browser"} onClick={() => setView("browser")} title="Browser">
                <MonitorPlay size={13} />
              </button>
              <button aria-pressed={view === "term"} onClick={() => setView("term")} title="Terminal">
                <TerminalSquare size={13} />
              </button>
            </span>
          )}
          <button className={`sa-ws-pin ${pinned ? "on" : ""}`} onClick={() => setPinned(pinned ? null : focus)} title={pinned ? "Unpin: follow activity" : "Pin this VM"}>
            {pinned ? <Pin size={13} /> : <PinOff size={13} />}
          </button>
          <button className="sa-ws-open" onClick={() => go(`admin/vm/${focus}`)} title="Open session">
            <ArrowUpRight size={14} />
          </button>
        </div>
        {showBrowser ? (
          <div className="sa-ws-focus-b">
            <BrowserStream vmId={focus} className="sa-ws-browser" />
            <Terminal vmId={focus} max={5} className="sa-ws-term-mini" />
          </div>
        ) : (
          <Terminal vmId={focus} className="sa-ws-term" />
        )}
        <div className="sa-ws-focus-f mono">
          <span>{vm.state}</span>
          <span>{vm.cpu}% cpu</span>
          <span>{(vm.tokens / 1000).toFixed(1)}k tokens</span>
          <span>
            {def.vcpu} vCPU · {def.memGb} GB · {def.region}
          </span>
        </div>
      </div>
      <div className="sa-ws-vms">
        {VMS.map(v => (
          <div key={v.id} className={`sa-ws-vmrow ${v.id === focus ? "on" : ""}`}>
            <VmCard id={v.id} onOpen={() => setPinned(v.id)} />
          </div>
        ))}
      </div>
    </div>
  );
}

export { ROLE };
