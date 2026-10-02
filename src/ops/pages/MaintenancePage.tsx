import React, { useEffect, useState } from "react";
import { Plus, Sparkles, Clock, Radio, User, Wrench, Phone, Star, MessageSquare, ShieldAlert, ArrowRight, Check } from "lucide-react";
import { Page, PageHeader, Section, Stat, StatRow, KV } from "../kit";
import { Avatar, Button, Drawer, Pill, Seg, type Tone } from "../../ui";
import { askAgent, clock, commit, fmt, go, toast, useDemo } from "../../state/store";
import { UNITS, UNIT_BY_ID } from "../../data/facility";
import { OPERATOR, tenantForUnit } from "../../data/tenants";
import { GATE_BY_ID } from "../../data/gate";
import { PREVENTIVE, STAFF, VENDORS, VENDOR_BY_ID, WORK_ORDERS, type WOCategory, type WOPriority, type WOStatus, type WorkOrder } from "../../data/maintenance";
import { DrawerHead, Field, Switch } from "./a/kit";
import { createWorkOrder } from "./a/units";

const COLS: { id: WOStatus; label: string }[] = [
  { id: "new", label: "New" },
  { id: "scheduled", label: "Scheduled" },
  { id: "progress", label: "In progress" },
  { id: "done", label: "Done" },
];
const STATUS_TEXT: Record<WOStatus, string> = { new: "New", scheduled: "Scheduled", progress: "In progress", done: "Done" };
const PRIO_TONE: Record<WOPriority, Tone> = { urgent: "bad", high: "warn", normal: "neutral", low: "neutral" };
const NEXT: Record<WOStatus, { to: WOStatus; label: string } | null> = {
  new: { to: "scheduled", label: "Schedule" },
  scheduled: { to: "progress", label: "Start work" },
  progress: { to: "done", label: "Mark done" },
  done: null,
};

function who(w: WorkOrder) {
  return w.vendorId ? VENDOR_BY_ID.get(w.vendorId)!.name : w.assignee ?? "Unassigned";
}

export function moveWorkOrder(w: WorkOrder, to: WOStatus) {
  if (w.status === to) return;
  w.status = to;
  w.log.push({ at: clock(), text: `Moved to ${STATUS_TEXT[to].toLowerCase()} by ${OPERATOR.name}` });
  const extra: string[] = [];
  if (to === "scheduled" && w.due === "Today" && w.vendorId) {
    w.due = "Today 3:00 pm";
    w.log.push({ at: clock(), text: `Texted ${VENDOR_BY_ID.get(w.vendorId)!.contact}, booked 3:00 pm, gate code sent`, agent: true });
    extra.push(`${VENDOR_BY_ID.get(w.vendorId)!.name} booked for 3:00 pm with a gate code.`);
  }
  if (to === "done") {
    if (w.unitId) {
      const u = UNIT_BY_ID.get(w.unitId);
      if (u && u.status === "maintenance") {
        u.status = "vacant";
        w.log.push({ at: clock(), text: `${u.id} back on the storefront at ${fmt.money(u.rate)}/mo`, agent: true });
        extra.push(`${u.id} is back on the storefront.`);
      }
    }
    if (w.gateId) {
      const g = GATE_BY_ID.get(w.gateId as never);
      if (g && g.status !== "online") {
        g.status = "online";
        g.note = "Exit sensor repaired · loop detectors healthy";
        g.workOrder = undefined;
        w.log.push({ at: clock(), text: `${g.short} back online, keypad fallback off`, agent: true });
        extra.push(`${g.short} is back online.`);
      }
    }
  }
  commit({ kind: "maintenance", text: `${w.id} ${w.title} · ${STATUS_TEXT[to].toLowerCase()}${extra.length ? " · " + extra.join(" ") : ""}`, who: OPERATOR.name });
  toast({ title: `${w.id} · ${STATUS_TEXT[to]}`, body: extra.join(" ") || `${w.title} · ${w.location}`, tone: to === "done" ? "ok" : "info" });
}

export default function MaintenancePage({ id }: { id?: string }) {
  useDemo();
  const [open, setOpen] = useState<string | null>(id && WORK_ORDERS.some(w => w.id === id) ? id : null);
  const [creating, setCreating] = useState(id === "new");
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<WOStatus | null>(null);

  useEffect(() => {
    if (id && WORK_ORDERS.some(w => w.id === id)) setOpen(id);
    if (id === "new") setCreating(true);
  }, [id]);

  const openWOs = WORK_ORDERS.filter(w => w.status !== "done");
  const dueToday = openWOs.filter(w => w.due.startsWith("Today")).length;
  const offline = UNITS.filter(u => u.status === "maintenance").length;
  const spend = WORK_ORDERS.reduce((s, w) => s + (w.cost ?? 0), 0);
  const vendorsToday = new Set(openWOs.filter(w => w.vendorId && w.due.startsWith("Today")).map(w => w.vendorId)).size;
  const current = WORK_ORDERS.find(w => w.id === open) ?? null;

  return (
    <Page className="pa-maint">
      <PageHeader
        title="Maintenance"
        sub={`${openWOs.length} open work orders · ${offline} unit${offline === 1 ? "" : "s"} offline · ${vendorsToday} vendors on site today`}
        ask="C-112's door is jammed. Get it fixed and let the tenant know."
        actions={
          <Button variant="primary" icon={<Plus />} onClick={() => setCreating(true)}>
            New work order
          </Button>
        }
      />

      <StatRow>
        <Stat label="Open work orders" value={String(openWOs.length)} delta={`${openWOs.filter(w => w.priority === "urgent" || w.priority === "high").length} high or urgent`} tone="warn" sub="" />
        <Stat label="Due today" value={String(dueToday)} delta={`${vendorsToday} vendors`} tone="neutral" sub="on site" />
        <Stat label="Units offline" value={String(offline)} delta={offline ? UNITS.filter(u => u.status === "maintenance").map(u => u.id).join(", ") : "none"} tone={offline ? "bad" : "ok"} sub={offline ? `${fmt.money(UNITS.filter(u => u.status === "maintenance").reduce((s, u) => s + u.rate, 0))}/mo lost` : ""} />
        <Stat label="Time to close" value="1.6 days" delta="−0.4d" tone="ok" sub="vs Aug" spark={[2.6, 2.4, 2.5, 2.1, 2.2, 1.9, 2.0, 1.8, 1.7, 1.6]} />
        <Stat label="Spend · 30 days" value={fmt.money(spend)} delta={`${WORK_ORDERS.filter(w => w.cost).length} invoices`} tone="neutral" sub="QuickBooks synced" />
      </StatRow>

      <div className="pa-board">
        {COLS.map(c => {
          const list = WORK_ORDERS.filter(w => w.status === c.id);
          return (
            <div
              key={c.id}
              className={`pa-col ${over === c.id ? "over" : ""}`}
              onDragOver={e => {
                e.preventDefault();
                setOver(c.id);
              }}
              onDragLeave={() => setOver(o => (o === c.id ? null : o))}
              onDrop={e => {
                e.preventDefault();
                const w = WORK_ORDERS.find(x => x.id === drag);
                if (w) moveWorkOrder(w, c.id);
                setDrag(null);
                setOver(null);
              }}
            >
              <div className="pa-col-h">
                <span className={`pa-col-dot pa-col-dot--${c.id}`} />
                <b>{c.label}</b>
                <em className="mono">{list.length}</em>
                {c.id === "new" && <Button size="sm" variant="ghost" iconOnly icon={<Plus />} aria-label="New work order" onClick={() => setCreating(true)} />}
              </div>
              <div className="pa-col-b">
                {list.map(w => (
                  <button
                    key={w.id}
                    className={`pa-card ${drag === w.id ? "drag" : ""} ${w.status === "done" ? "done" : ""}`}
                    draggable
                    onDragStart={e => {
                      setDrag(w.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => {
                      setDrag(null);
                      setOver(null);
                    }}
                    onClick={() => setOpen(w.id)}
                  >
                    <div className="pa-card-h">
                      <span className="mono">{w.id}</span>
                      {w.status !== "done" && (w.priority === "urgent" || w.priority === "high") && <Pill tone={PRIO_TONE[w.priority]}>{w.priority === "urgent" ? "Urgent" : "High"}</Pill>}
                      {w.status === "done" && <Check size={14} className="pa-card-ok" />}
                    </div>
                    <b className="pa-card-t">{w.title}</b>
                    <span className="pa-card-l">{w.location}</span>
                    <div className="pa-card-f">
                      <span className="pa-card-who">
                        <Avatar name={who(w)} size="sm" />
                        <span>{who(w)}</span>
                      </span>
                      <span className={`mono pa-card-due ${w.status !== "done" && w.due.startsWith("Today") ? "today" : ""}`}>
                        {w.source === "Sensor" ? <Radio size={11} /> : w.source === "Agent" || w.source === "Preventive" ? <Sparkles size={11} /> : <Clock size={11} />}
                        {w.status === "done" ? w.due : w.due.replace("Today ", "")}
                      </span>
                    </div>
                  </button>
                ))}
                {!list.length && <div className="pa-col-empty">Drop a card here</div>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="pa-grid pa-grid--maint">
        <Section title="Preventive schedule" flush action={<span className="pa-meta">{PREVENTIVE.length} recurring tasks</span>}>
          <div className="z-table-wrap">
            <table className="z-table pa-table">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Every</th>
                  <th>Last done</th>
                  <th>Next</th>
                  <th>Owner</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {PREVENTIVE.map(p => (
                  <tr key={p.task}>
                    <td>{p.task}</td>
                    <td className="muted">{p.cadence}</td>
                    <td className="mono muted pa-sm">{p.last}</td>
                    <td>
                      <span className="pa-next">
                        <span className="mono pa-sm">{p.next}</span>
                        {p.state === "overdue" && <Pill tone="bad">Overdue</Pill>}
                        {p.state === "today" && <Pill tone="info">Today</Pill>}
                        {p.state === "due" && <Pill>This week</Pill>}
                      </span>
                    </td>
                    <td className="muted">{p.owner}</td>
                    <td className="pa-act-c">
                      {p.state === "overdue" ? (
                        <Button
                          size="sm"
                          onClick={() => {
                            p.state = "ok";
                            createWorkOrder({ title: p.task, location: "All buildings", category: "Safety", priority: "high", assignee: p.owner, due: "Today", notes: "Monthly check, one day overdue. 14 extinguishers: office, A–C ends, D floors 1–2.", source: "Preventive" });
                          }}
                        >
                          Create work order
                        </Button>
                      ) : (
                        <span className="faint pa-sm">{p.state === "ok" ? "On track" : p.state === "today" ? "WO-2049" : "Scheduled"}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Vendors" action={<span className="pa-meta">{VENDORS.length} approved · 1 in-house</span>}>
          <ul className="pa-vendors">
            {VENDORS.map(v => {
              const n = WORK_ORDERS.filter(w => w.vendorId === v.id && w.status !== "done").length;
              return (
                <li key={v.id}>
                  <Avatar name={v.name} size="sm" />
                  <div className="pa-vendor-m">
                    <b>{v.name}</b>
                    <span>
                      {v.trade} · {v.contact}
                    </span>
                  </div>
                  <span className="pa-vendor-r mono">
                    <Star size={11} />
                    {v.rating.toFixed(1)}
                  </span>
                  <span className="pa-vendor-s mono">{n ? `${n} open` : v.response}</span>
                  {v.coiWarn ? (
                    <Button size="sm" icon={<ShieldAlert />} className="pa-coi" onClick={() => toast({ title: "Insurance certificate requested", body: `${v.contact} has a link to upload a new COI. Expires ${v.coi}.`, tone: "info" })}>
                      COI {v.coi.replace(", 2026", "")}
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" iconOnly icon={<Phone />} aria-label={`Call ${v.name}`} onClick={() => toast({ title: `Calling ${v.contact}`, body: `${v.name} · ${v.phone}`, tone: "call" })} />
                  )}
                </li>
              );
            })}
            <li>
              <Avatar name={STAFF[0].name} size="sm" />
              <div className="pa-vendor-m">
                <b>{STAFF[0].name}</b>
                <span>In-house · {STAFF[0].role}</span>
              </div>
              <span className="pa-vendor-r mono">
                <User size={11} />
                staff
              </span>
              <span className="pa-vendor-s mono">{WORK_ORDERS.filter(w => w.assignee === STAFF[0].name && w.status !== "done").length} open</span>
              <Button size="sm" variant="ghost" iconOnly icon={<MessageSquare />} aria-label="Message Marco" onClick={() => toast({ title: "Message sent to Marco", tone: "ok" })} />
            </li>
          </ul>
        </Section>
      </div>

      <WODrawer w={current} onClose={() => setOpen(null)} />
      <NewWODrawer open={creating} onClose={() => setCreating(false)} onCreated={wid => setOpen(wid)} />
    </Page>
  );
}

function WODrawer({ w, onClose }: { w: WorkOrder | null; onClose: () => void }) {
  return (
    <Drawer open={!!w} onClose={onClose} width={500}>
      {w && <WODetail w={w} onClose={onClose} />}
    </Drawer>
  );
}

function WODetail({ w, onClose }: { w: WorkOrder; onClose: () => void }) {
  useDemo();
  const v = w.vendorId ? VENDOR_BY_ID.get(w.vendorId) : undefined;
  const t = w.unitId ? tenantForUnit(w.unitId) : undefined;
  const next = NEXT[w.status];
  const idx = COLS.findIndex(c => c.id === w.status);
  return (
    <>
      <DrawerHead
        title={
          <span className="pa-wo-title">
            <span className="mono faint">{w.id}</span> {w.title}
          </span>
        }
        sub={w.location}
        onClose={onClose}
      />
      <div className="pa-form">
        <ol className="pa-steps">
          {COLS.map((c, i) => (
            <li key={c.id} className={i < idx ? "done" : i === idx ? "on" : ""}>
              <button onClick={() => moveWorkOrder(w, c.id)}>
                <i>{i < idx ? <Check size={11} /> : null}</i>
                {c.label}
              </button>
            </li>
          ))}
        </ol>
        <p className="pa-wo-notes">{w.notes}</p>
        <KV
          items={[
            ["Priority", <Pill tone={PRIO_TONE[w.priority]}>{w.priority[0].toUpperCase() + w.priority.slice(1)}</Pill>],
            ["Category", w.category],
            [
              "Assigned",
              v ? (
                <span>
                  {v.name} · {v.contact} <span className="mono faint">{v.phone}</span>
                </span>
              ) : (
                w.assignee ?? "Unassigned"
              ),
            ],
            ["Due", <span className="mono">{w.due}</span>],
            ["Opened", <span>{w.opened} · {w.source.toLowerCase()}</span>],
            ...(w.unitId
              ? ([
                  [
                    "Unit",
                    <button className="pa-plain mono" onClick={() => go("ops/units/" + w.unitId)}>
                      {w.unitId}
                    </button>,
                  ],
                ] as [React.ReactNode, React.ReactNode][])
              : []),
            ...(t ? ([["Tenant", <button className="pa-plain" onClick={() => go("ops/tenants/" + t.id)}>{t.name}</button>]] as [React.ReactNode, React.ReactNode][]) : []),
            ...(w.cost ? ([["Cost", <span className="tnum">{fmt.money(w.cost)}</span>]] as [React.ReactNode, React.ReactNode][]) : []),
          ]}
        />
        <div>
          <div className="pa-ud-sec-h">Activity</div>
          <ol className="pa-tl">
            {w.log
              .slice()
              .reverse()
              .map((l, i) => (
                <li key={i} className={l.agent ? "agent" : ""}>
                  <span className="pa-tl-dot">{l.agent ? <Sparkles size={10} /> : null}</span>
                  <p>{l.text}</p>
                  <span className="mono faint">{l.at}</span>
                </li>
              ))}
          </ol>
        </div>
      </div>
      <div className="pa-foot pa-foot--split">
        <Button variant="ghost" icon={<Sparkles />} className="pa-ud-ask" onClick={() => askAgent(`Follow up on ${w.id}, ${w.title.toLowerCase()} at ${w.location}`)}>
          Ask agent
        </Button>
        <span style={{ flex: 1 }} />
        {v && w.status !== "done" && (
          <Button icon={<MessageSquare />} onClick={() => {
            w.log.push({ at: clock(), text: `Texted ${v.contact} for an ETA`, agent: true });
            commit();
            toast({ title: `Texted ${v.contact}`, body: `Asked for an ETA on ${w.id}.`, tone: "ok" });
          }}>
            Text vendor
          </Button>
        )}
        {next && (
          <Button variant="primary" icon={next.to === "done" ? <Check /> : <ArrowRight />} onClick={() => moveWorkOrder(w, next.to)}>
            {next.label}
          </Button>
        )}
      </div>
    </>
  );
}

const CATS: WOCategory[] = ["Doors", "Gates & access", "HVAC", "Lighting", "Pest", "Cleaning", "Safety", "Other"];
const CAT_VENDOR: Partial<Record<WOCategory, string>> = { Doors: "basin-door", "Gates & access": "tahoe-gate", HVAC: "lakeside-mech", Pest: "sierra-pest", Lighting: "alder-electric" };

function NewWODrawer({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const [title, setTitle] = useState("");
  const [loc, setLoc] = useState("");
  const [cat, setCat] = useState<WOCategory>("Doors");
  const [prio, setPrio] = useState<WOPriority>("normal");
  const [assign, setAssign] = useState<string>("basin-door");
  const [due, setDue] = useState("Today");
  const [notes, setNotes] = useState("");
  const [notify, setNotify] = useState(true);
  useEffect(() => {
    setAssign(CAT_VENDOR[cat] ?? "staff:Marco Ruiz");
  }, [cat]);
  const unit = UNIT_BY_ID.get(loc.trim().toUpperCase());
  const tenant = unit ? tenantForUnit(unit) : undefined;
  const valid = title.trim().length > 2 && loc.trim().length > 0;
  const reset = () => {
    setTitle("");
    setLoc("");
    setNotes("");
    setPrio("normal");
    setCat("Doors");
  };
  return (
    <Drawer open={open} onClose={onClose} width={480}>
      <DrawerHead title="New work order" sub="The agent books the vendor, issues a gate code and keeps the tenant posted." onClose={onClose} />
      <div className="pa-form">
        <button
          className="pa-suggest"
          onClick={() => {
            setTitle("Light flickering in hallway");
            setLoc("D-214");
            setCat("Lighting");
            setPrio("normal");
            setDue("Tomorrow");
            setNotes("Tenant mentioned it on a call this morning. Fixture outside D-214, floor 2.");
          }}
        >
          <Sparkles size={14} />
          <span>
            <b>From this morning's calls</b>
            <span>Hallway light flickering outside D-214, floor 2</span>
          </span>
          <span className="pa-link">Use</span>
        </button>
        <Field label="What needs doing">
          <input className="z-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Roll-up door won't close" />
        </Field>
        <div className="pa-form-row">
          <Field label="Where" hint={unit ? `${unit.size.replace("x", "×")} · ${unit.status === "vacant" ? "available, will come off the storefront" : tenant ? tenant.name : unit.status}` : "A unit id like C-112, or a place"}>
            <input className="z-input" value={loc} onChange={e => setLoc(e.target.value)} placeholder="C-112, Gate 2, Building D" list="pa-locs" />
            <datalist id="pa-locs">
              {["Gate 1", "Gate 2", "Building A", "Building B", "Building C", "Building D", "RV & Boat lot", "Office", "Lane A–B", "Lane B–C"].map(x => (
                <option key={x} value={x} />
              ))}
            </datalist>
          </Field>
          <Field label="Category">
            <select className="z-input pa-select" value={cat} onChange={e => setCat(e.target.value as WOCategory)}>
              {CATS.map(c => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Priority">
          <Seg value={prio} onChange={setPrio} options={[{ value: "low", label: "Low" }, { value: "normal", label: "Normal" }, { value: "high", label: "High" }, { value: "urgent", label: "Urgent" }]} />
        </Field>
        <div className="pa-form-row">
          <Field label="Assign to">
            <select className="z-input pa-select" value={assign} onChange={e => setAssign(e.target.value)}>
              {VENDORS.map(v => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
              {STAFF.slice(0, 2).map(s => (
                <option key={s.name} value={"staff:" + s.name}>
                  {s.name} (in-house)
                </option>
              ))}
            </select>
          </Field>
          <Field label="Due">
            <select className="z-input pa-select" value={due} onChange={e => setDue(e.target.value)}>
              {["Today", "Tomorrow", "Mon, Oct 5", "This week", "Next week"].map(d => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Notes">
          <textarea className="z-input" rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="What you saw, access notes, photos to follow" />
        </Field>
        {tenant && (
          <div className="pa-row-sw">
            <div>
              <b>Keep {tenant.first} posted</b>
              <span>Texts when the visit is booked and when it's done</span>
            </div>
            <Switch on={notify} onChange={setNotify} label="Notify tenant" />
          </div>
        )}
      </div>
      <div className="pa-foot">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          icon={<Wrench />}
          disabled={!valid}
          onClick={() => {
            const staff = assign.startsWith("staff:") ? assign.slice(6) : undefined;
            const wo = createWorkOrder({
              title: title.trim(),
              location: unit ? `${unit.id} · Building ${unit.building}` : loc.trim(),
              unitId: unit?.id,
              gateId: /gate 2/i.test(loc) ? "G2" : /gate 1/i.test(loc) ? "G1" : undefined,
              category: cat,
              priority: prio,
              vendorId: staff ? undefined : assign,
              assignee: staff,
              due,
              notes: notes || "Created from the maintenance board.",
            });
            if (tenant && notify) wo.log.push({ at: clock(), text: `Texted ${tenant.first}: we're on it, visit time to follow`, agent: true });
            reset();
            onClose();
            onCreated(wo.id);
          }}
        >
          Create work order
        </Button>
      </div>
    </Drawer>
  );
}

