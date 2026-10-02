import React, { useEffect, useMemo, useState } from "react";
import { Plus, Pause, Play, DoorOpen, Wrench, KeyRound, RefreshCw, Send, Building2, Car, Footprints, Warehouse, Sparkles, ArrowDownLeft, ArrowUpRight, Ban, Unlock, TriangleAlert } from "lucide-react";
import { Page, PageHeader, Section, Stat, StatRow, Chips } from "../kit";
import { Avatar, Button, Drawer, Pill, Seg, type Tone } from "../../ui";
import { clock, commit, go, toast, useDemo } from "../../state/store";
import { UNIT_BY_ID } from "../../data/facility";
import { OPERATOR } from "../../data/tenants";
import { ACCESS_CODES, GATES, GATE_BY_ID, GATE_EVENTS, HOLIDAYS, WEEK_HOURS, ZONES, ZONE_BY_ID, addAccessCode, allCodes, newCode, nextGateEvent, pushGateEvent, type AccessCode, type GateDevice, type GateEvent, type ZoneId } from "../../data/gate";
import { DrawerHead, Field, MultiChips, Switch } from "./a/kit";
import { setOverlock } from "./a/units";

const GATE_ICON: Record<string, React.ReactNode> = { G1: <Car />, G2: <Car />, PED: <Footprints />, D1: <Building2 />, RV: <Warehouse />, OFF: <DoorOpen /> };
const EV_TONE: Record<GateEvent["kind"], Tone> = { entry: "neutral", exit: "neutral", fallback: "warn", denied: "bad", system: "warn", open: "info" };
const EV_LABEL: Record<GateEvent["kind"], string> = { entry: "Entry", exit: "Exit", fallback: "Keypad exit", denied: "Denied", system: "Alert", open: "Opened" };

export default function GatePage({ id }: { id?: string }) {
  useDemo();
  const [live, setLive] = useState(true);
  const [filter, setFilter] = useState<"all" | "vendor" | "tenant" | "suspended">("all");
  const [showAll, setShowAll] = useState(false);
  const [creating, setCreating] = useState(id === "new");
  const [holidays, setHolidays] = useState(() => HOLIDAYS.map(h => h.on));
  const [afterHours, setAfterHours] = useState(true);

  useEffect(() => {
    if (!live) return;
    let t: number;
    const tick = () => {
      GATE_EVENTS.unshift(nextGateEvent(clock()));
      if (GATE_EVENTS.length > 200) GATE_EVENTS.length = 200;
      commit();
      t = window.setTimeout(tick, 3200 + Math.random() * 2600);
    };
    t = window.setTimeout(tick, 2200);
    return () => window.clearTimeout(t);
  }, [live]);

  useEffect(() => {
    if (id === "new") setCreating(true);
  }, [id]);

  const codes = allCodes();
  const entries = GATE_EVENTS.filter(e => e.kind === "entry").length;
  const exits = GATE_EVENTS.filter(e => e.kind === "exit" || e.kind === "fallback").length;
  const fallback = GATE_EVENTS.filter(e => e.kind === "fallback").length;
  const denied = GATE_EVENTS.filter(e => e.kind === "denied").length;
  const active = codes.filter(c => c.status === "active").length;
  const vendorToday = ACCESS_CODES.filter(c => c.type === "vendor" && c.window.startsWith("Today") && c.status !== "expired").length;
  const online = GATES.filter(g => g.status === "online").length;

  const shown = useMemo(() => {
    const list = codes.filter(c => (filter === "all" ? true : filter === "vendor" ? c.type !== "tenant" : filter === "tenant" ? c.type === "tenant" : c.status === "suspended"));
    return list;
  }, [codes, filter]);
  const rows = showAll ? shown : shown.slice(0, 10);

  const openGate = (g: GateDevice) => {
    pushGateEvent({ at: clock(), gate: g.id, kind: "open", who: OPERATOR.name, note: "Opened remotely" });
    commit({ kind: "gate", text: `${g.short} opened remotely`, who: OPERATOR.name });
    toast({ title: `${g.short} opened`, body: "Closes again in 20 seconds.", tone: "info" });
  };

  return (
    <Page className="pa-gate">
      <PageHeader
        title="Gate access"
        sub={`6 devices · ${active} active codes · gate hours 6:00 am – 10:00 pm`}
        ask="Make a gate code for the HVAC tech, 1–5pm today, Building D only"
        actions={
          <Button variant="primary" icon={<Plus />} onClick={() => setCreating(true)}>
            New access code
          </Button>
        }
      />

      <StatRow>
        <Stat label="Entries today" value={String(entries)} delta={`${GATE_EVENTS.filter(e => e.kind === "entry" && e.gate === "D1").length} at Door D1`} tone="neutral" sub="since 6:00 am" />
        <Stat label="Exits today" value={String(exits)} delta={`${fallback} by keypad`} tone={fallback ? "warn" : "neutral"} sub="Gate 2 fallback" />
        <Stat label="Denied" value={String(denied)} delta="code suspended" tone={denied ? "bad" : "neutral"} sub="overlocked" />
        <Stat label="Active codes" value={String(active)} delta={`${vendorToday} vendor`} tone="neutral" sub="windows today" />
        <Stat label="Devices online" value={`${online} of ${GATES.length}`} delta={online < GATES.length ? GATES.filter(g => g.status !== "online").map(g => g.short).join(", ") : "all healthy"} tone={online < GATES.length ? "warn" : "ok"} sub={online < GATES.length ? "degraded" : ""} />
      </StatRow>

      <div className="pa-grid pa-grid--gate">
        <Section title="Devices" action={<span className="pa-meta">PTI controller · synced {clock()}</span>}>
          <div className="pa-devs">
            {GATES.map(g => (
              <div key={g.id} className={`pa-dev pa-dev--${g.status}`}>
                <div className="pa-dev-h">
                  <span className="pa-dev-ic">{GATE_ICON[g.id]}</span>
                  <div>
                    <b>{g.name}</b>
                    <span>{g.hardware}</span>
                  </div>
                  <Pill tone={g.status === "online" ? "ok" : g.status === "degraded" ? "warn" : "bad"} dot>
                    {g.status === "online" ? "Online" : g.status === "degraded" ? "Degraded" : "Offline"}
                  </Pill>
                </div>
                <p className="pa-dev-n">
                  {g.status !== "online" && <TriangleAlert size={13} />}
                  {g.note}
                </p>
                <div className="pa-dev-f">
                  <span className="pa-dev-bars" title="Events per hour since 6 am">
                    {hourly(g.id).map((v, i) => (
                      <i key={i} style={{ height: 3 + Math.min(21, v * 3) }} />
                    ))}
                  </span>
                  <span className="mono faint">{GATE_EVENTS.filter(e => e.gate === g.id).length} today</span>
                  {g.workOrder ? (
                    <Button size="sm" icon={<Wrench />} onClick={() => go("ops/maintenance/" + g.workOrder)}>
                      {g.workOrder}
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => openGate(g)}>
                      {g.id === "OFF" ? "Unlock" : "Open"}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="Live activity"
          className="pa-live"
          action={
            <span className="pa-live-a">
              {live ? (
                <Pill tone="ok" dot live>
                  Live
                </Pill>
              ) : (
                <Pill>Paused</Pill>
              )}
              <Button size="sm" variant="ghost" iconOnly icon={live ? <Pause /> : <Play />} aria-label={live ? "Pause" : "Resume"} onClick={() => setLive(l => !l)} />
            </span>
          }
        >
          <ul className="pa-stream">
            {GATE_EVENTS.slice(0, 40).map(e => {
              const g = GATE_BY_ID.get(e.gate);
              return (
                <li key={e.id} className={e.fresh ? "fresh" : ""}>
                  <span className="pa-stream-t mono">{e.at.replace(/ (am|pm)$/, "")}</span>
                  <span className={`pa-stream-ic pa-stream-ic--${e.kind}`}>
                    {e.kind === "entry" ? <ArrowDownLeft /> : e.kind === "denied" ? <Ban /> : e.kind === "system" ? <TriangleAlert /> : e.kind === "open" ? <Unlock /> : <ArrowUpRight />}
                  </span>
                  <div className="pa-stream-m">
                    <b>
                      {e.tenantId ? (
                        <button className="pa-plain" onClick={() => go("ops/tenants/" + e.tenantId)}>
                          {e.who}
                        </button>
                      ) : (
                        e.who
                      )}
                      {e.unitId && <span className="mono faint"> {e.unitId}</span>}
                    </b>
                    <span>
                      {g?.short}
                      {e.note ? ` · ${e.note}` : ""}
                    </span>
                  </div>
                  <Pill tone={EV_TONE[e.kind]}>{EV_LABEL[e.kind]}</Pill>
                </li>
              );
            })}
          </ul>
        </Section>
      </div>

      <Section
        flush
        title="Access codes"
        action={
          <span className="pa-sec-a">
            <Chips
              value={filter}
              onChange={v => {
                setFilter(v);
                setShowAll(false);
              }}
              options={[
                { value: "all", label: "All", count: codes.length },
                { value: "vendor", label: "Vendors & staff", count: codes.filter(c => c.type !== "tenant").length },
                { value: "tenant", label: "Tenants", count: codes.filter(c => c.type === "tenant").length },
                { value: "suspended", label: "Locked out", count: codes.filter(c => c.status === "suspended").length },
              ]}
            />
          </span>
        }
      >
        <div className="z-table-wrap">
          <table className="z-table pa-table pa-codes">
            <thead>
              <tr>
                <th>Holder</th>
                <th>Type</th>
                <th>Code</th>
                <th>Zones</th>
                <th>Window</th>
                <th>Status</th>
                <th className="num">Uses today</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map(c => (
                <CodeRow key={c.id} c={c} />
              ))}
            </tbody>
          </table>
        </div>
        {shown.length > 10 && (
          <div className="pa-pager">
            <span className="mono faint">{showAll ? `All ${shown.length}` : `10 of ${shown.length}`}</span>
            <Button size="sm" variant="ghost" onClick={() => setShowAll(s => !s)}>
              {showAll ? "Show fewer" : `Show all ${shown.length}`}
            </Button>
          </div>
        )}
      </Section>

      <div className="pa-grid pa-grid--2">
        <Section title="Hours and holidays" action={<span className="pa-meta">America/Los_Angeles</span>}>
          <table className="pa-mini">
            <thead>
              <tr>
                <th />
                <th>Gate</th>
                <th>Office</th>
              </tr>
            </thead>
            <tbody>
              {WEEK_HOURS.map(w => (
                <tr key={w.day}>
                  <td>{w.day}</td>
                  <td className="mono">{w.gate}</td>
                  <td className="mono">{w.office}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pa-sub-h">Holiday schedule</div>
          <ul className="pa-hol">
            {HOLIDAYS.map((h, i) => (
              <li key={h.date}>
                <span className="mono pa-hol-d">{h.date}</span>
                <div>
                  <b>{h.name}</b>
                  <span>
                    Gate {h.gate} · office {h.office.toLowerCase()}
                  </span>
                </div>
                <Switch
                  on={holidays[i]}
                  label={h.name}
                  onChange={v => {
                    setHolidays(a => a.map((x, j) => (j === i ? v : x)));
                    toast({ title: `${h.name} hours ${v ? "on" : "off"}`, body: v ? "Tenants get a reminder 3 days before." : "Regular hours apply that day.", tone: "info" });
                  }}
                />
              </li>
            ))}
          </ul>
          <div className="pa-row-sw">
            <div>
              <b>After-hours access</b>
              <span>12 tenants pay $15/mo for 24-hour entry at Gate 1</span>
            </div>
            <Switch on={afterHours} label="After-hours access" onChange={v => (setAfterHours(v), toast({ title: v ? "After-hours access on" : "After-hours access off", tone: "info" }))} />
          </div>
        </Section>

        <Section title="Zones" action={<span className="pa-meta">{ZONES.length} zones</span>}>
          <ul className="pa-zones">
            {ZONES.map(z => {
              const n = codes.filter(c => c.zones.includes(z.id) && c.status !== "expired").length;
              return (
                <li key={z.id}>
                  <div className="pa-zone-h">
                    <b>{z.name}</b>
                    <span className="mono faint">{n} codes</span>
                  </div>
                  <span className="pa-zone-s">{z.covers} · {z.rule}</span>
                  <div className="pa-zone-g">
                    {z.gates.map(g => {
                      const d = GATE_BY_ID.get(g)!;
                      return (
                        <span key={g} className={`pa-tag ${d.status !== "online" ? "pa-tag--warn" : ""}`}>
                          <i />
                          {d.short}
                        </span>
                      );
                    })}
                    <span className="pa-zone-hours mono">{z.hours}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </Section>
      </div>

      <NewCodeDrawer open={creating} onClose={() => setCreating(false)} />
    </Page>
  );
}

function hourly(gate: string) {
  const now = Math.floor(toMin(clock()) / 60);
  const out: number[] = [];
  for (let h = 6; h <= Math.max(9, now); h++) out.push(GATE_EVENTS.filter(e => e.gate === gate && Math.floor(toMin(e.at) / 60) === h).length);
  return out.slice(-6);
}

function CodeRow({ c }: { c: AccessCode }) {
  const tone: Tone = c.status === "active" ? "ok" : c.status === "scheduled" ? "info" : c.status === "suspended" ? "bad" : "neutral";
  const unit = c.unitIds?.[0] ? UNIT_BY_ID.get(c.unitIds[0]) : undefined;
  return (
    <tr>
      <td>
        <span className="pa-holder">
          <Avatar name={c.holder} size="sm" />
          <span>
            {c.tenantId ? (
              <button className="pa-plain" onClick={() => go("ops/tenants/" + c.tenantId)}>
                {c.holder}
              </button>
            ) : (
              c.holder
            )}
            <small>{c.type === "tenant" ? c.unitIds?.join(", ") : c.company}{c.note && c.type !== "tenant" ? ` · ${c.note}` : ""}</small>
          </span>
        </span>
      </td>
      <td className="muted">{c.type === "tenant" ? "Tenant" : c.type === "vendor" ? "Vendor" : "Staff"}</td>
      <td>
        <span className={`mono pa-code ${c.status === "suspended" || c.status === "expired" ? "pa-code--off" : ""}`}>{c.code}</span>
      </td>
      <td>
        <span className="pa-zone-list">
          {c.zones.map(z => (
            <span key={z} className="pa-tag pa-tag--sm">
              {ZONE_BY_ID.get(z)!.name.replace(" · Climate", "").replace("Drive-up lot", "Lot").replace("RV & Boat lot", "RV lot")}
            </span>
          ))}
        </span>
      </td>
      <td className={c.window.startsWith("Today") ? "" : "muted"}>{c.window}</td>
      <td>
        <Pill tone={tone} dot>
          {c.status === "suspended" ? "Locked out" : c.status[0].toUpperCase() + c.status.slice(1)}
        </Pill>
        {c.note && c.type === "tenant" && <span className="pa-code-note">{c.note}</span>}
      </td>
      <td className="num mono">{c.uses}</td>
      <td className="pa-act-c">
        {c.type === "tenant" && unit ? (
          c.status === "suspended" ? (
            <Button size="sm" onClick={() => setOverlock(unit, false)}>
              Restore
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setOverlock(unit, true)}>
              Suspend
            </Button>
          )
        ) : c.status === "expired" ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              c.status = "scheduled";
              c.window = "Tomorrow · 9:00 am–12:00 pm";
              commit({ kind: "gate", text: `Reissued gate code for ${c.holder} · ${c.company}`, who: OPERATOR.name });
              toast({ title: `Code reissued for ${c.holder}`, body: `${c.code} · tomorrow 9:00 am–12:00 pm. Sent by SMS.`, tone: "ok" });
            }}
          >
            Reissue
          </Button>
        ) : c.type === "staff" ? (
          <Button size="sm" variant="ghost" iconOnly icon={<RefreshCw />} aria-label="Rotate code" onClick={() => toast({ title: `Rotated ${c.holder}'s code`, body: "New code sent by SMS.", tone: "ok" })} />
        ) : (
          <>
            <Button size="sm" variant="ghost" iconOnly icon={<Send />} aria-label="Resend" onClick={() => toast({ title: `Code resent to ${c.holder}`, body: `${c.code} · ${c.window}`, tone: "ok" })} />
            <Button
              size="sm"
              variant="ghost"
              className="z-btn--danger"
              onClick={() => {
                c.status = "expired";
                commit({ kind: "gate", text: `Revoked gate code for ${c.holder} · ${c.company}`, who: OPERATOR.name });
                toast({ title: `Revoked ${c.holder}'s code`, body: `${c.code} stops working immediately.`, tone: "warn" });
              }}
            >
              Revoke
            </Button>
          </>
        )}
      </td>
    </tr>
  );
}

function toMin(t: string) {
  const m = /(\d+):(\d+)\s*(am|pm)/.exec(t);
  return m ? ((+m[1] % 12) + (m[3] === "pm" ? 12 : 0)) * 60 + +m[2] : 0;
}

const DAYS = ["Today", "Tomorrow", "Mon, Oct 5", "Tue, Oct 6"];
const TIMES = ["6:00 am", "7:00 am", "8:00 am", "9:00 am", "10:00 am", "11:00 am", "12:00 pm", "1:00 pm", "2:00 pm", "3:00 pm", "4:00 pm", "5:00 pm", "6:00 pm", "8:00 pm", "10:00 pm"];

function NewCodeDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [type, setType] = useState<"vendor" | "staff" | "tenant">("vendor");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [zones, setZones] = useState<ZoneId[]>(["lot"]);
  const [day, setDay] = useState("Today");
  const [from, setFrom] = useState("1:00 pm");
  const [to, setTo] = useState("5:00 pm");
  const [code, setCode] = useState(newCode());
  const [sms, setSms] = useState(true);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) setCode(newCode());
  }, [open]);

  const fillHvac = () => {
    setType("vendor");
    setName("Dev Patel");
    setCompany("Lakeside Mechanical");
    setPhone("(530) 555-0144");
    setZones(["lot", "climate"]);
    setDay("Today");
    setFrom("1:00 pm");
    setTo("5:00 pm");
    setNote("HVAC filters, WO-2049");
  };

  const reset = () => {
    setName("");
    setCompany("");
    setPhone("");
    setZones(["lot"]);
    setNote("");
  };

  const window_ = type === "staff" ? "6:00 am – 10:00 pm" : `${day} · ${from.replace(/ (am|pm)$/, from.slice(-2) === to.slice(-2) ? "" : " $1")}–${to}`;
  const valid = name.trim().length > 1 && zones.length > 0;

  const create = () => {
    const ac = addAccessCode({
      holder: name.trim(),
      company: company.trim() || (type === "staff" ? "Staff" : undefined),
      phone,
      type: type === "tenant" ? "vendor" : type,
      code,
      zones,
      window: type === "tenant" ? `${day} · guest` : window_,
      status: type === "staff" || (day === "Today" && toMin(from) <= toMin(clock())) ? "active" : "scheduled",
      note: note || undefined,
      createdBy: OPERATOR.name,
    });
    commit({ kind: "gate", text: `New gate code for ${ac.holder}${ac.company ? " · " + ac.company : ""} · ${zones.map(z => ZONE_BY_ID.get(z)!.name).join(", ")} · ${ac.window}`, who: OPERATOR.name });
    toast({ title: `Code ${code} created`, body: `${ac.holder} · ${ac.window}${sms && phone ? ". Sent by SMS to " + phone + "." : "."}`, tone: "ok" });
    reset();
    onClose();
  };

  return (
    <Drawer open={open} onClose={onClose} width={480}>
      <DrawerHead title="New access code" sub="Codes work only inside their zones and window, then expire on their own." onClose={onClose} />
      <div className="pa-form">
        <button className="pa-suggest" onClick={fillHvac}>
          <Sparkles size={14} />
          <span>
            <b>Suggested from today's work orders</b>
            <span>Lakeside Mechanical · HVAC, Building D · 1:00–5:00 pm</span>
          </span>
          <span className="pa-link">Use</span>
        </button>
        <Field label="Who is it for">
          <Seg value={type} onChange={setType} options={[{ value: "vendor", label: "Vendor" }, { value: "staff", label: "Staff" }, { value: "tenant", label: "Tenant's guest" }]} />
        </Field>
        <div className="pa-form-row">
          <Field label="Name">
            <input className="z-input" value={name} onChange={e => setName(e.target.value)} placeholder="Dev Patel" />
          </Field>
          <Field label={type === "tenant" ? "Guest of" : "Company"}>
            <input className="z-input" value={company} onChange={e => setCompany(e.target.value)} placeholder={type === "tenant" ? "Tenant name or unit" : "Lakeside Mechanical"} />
          </Field>
        </div>
        <Field label="Mobile">
          <input className="z-input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(530) 555-0100" />
        </Field>
        <Field label="Zones" hint={zones.includes("office") ? "Office access is staff-only by default." : undefined}>
          <MultiChips value={zones} onChange={setZones} options={ZONES.map(z => ({ value: z.id, label: z.name }))} />
        </Field>
        {type !== "staff" ? (
          <div className="pa-form-row pa-form-row--3">
            <Field label="Day">
              <select className="z-input pa-select" value={day} onChange={e => setDay(e.target.value)}>
                {DAYS.map(d => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </Field>
            <Field label="From">
              <select className="z-input pa-select" value={from} onChange={e => setFrom(e.target.value)}>
                {TIMES.map(d => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </Field>
            <Field label="Until">
              <select className="z-input pa-select" value={to} onChange={e => setTo(e.target.value)}>
                {TIMES.map(d => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </Field>
          </div>
        ) : (
          <Field label="Window">
            <div className="pa-ud-vendor">Gate hours, every day · until removed</div>
          </Field>
        )}
        <Field label="Note">
          <input className="z-input" value={note} onChange={e => setNote(e.target.value)} placeholder="What they're here for" />
        </Field>
        <div className="pa-code-big">
          <div>
            <span className="eyebrow">Code</span>
            <b className="mono">{code}</b>
          </div>
          <Button size="sm" variant="ghost" icon={<RefreshCw />} onClick={() => setCode(newCode())}>
            New code
          </Button>
        </div>
        <div className="pa-row-sw">
          <div>
            <b>Text the code</b>
            <span>Includes the window, gate map and a link that expires with the code</span>
          </div>
          <Switch on={sms} onChange={setSms} label="Text the code" />
        </div>
      </div>
      <div className="pa-foot">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" icon={<KeyRound />} disabled={!valid} onClick={create}>
          Create code
        </Button>
      </div>
    </Drawer>
  );
}

