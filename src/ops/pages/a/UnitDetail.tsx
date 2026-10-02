import React, { useEffect, useState } from "react";
import { Sparkles, Lock, LockOpen, Wrench, UserPlus, ArrowUpRight, CreditCard, MessageSquare, KeyRound, ChevronLeft, CircleSlash } from "lucide-react";
import { Avatar, Button, Drawer, Pill, Seg, UnitStatusPill } from "../../../ui";
import { askAgent, fmt, go, useDemo } from "../../../state/store";
import { UNIT_BY_ID, SIZE_INFO } from "../../../data/facility";
import { tenantForUnit } from "../../../data/tenants";
import { unitGateLog } from "../../../data/gate";
import { WORK_ORDERS, VENDORS, type WOCategory, type WOPriority } from "../../../data/maintenance";
import { DrawerHead, Field } from "./kit";
import { KIND_LABEL, buildingName, createWorkOrder, holdForLead, leadsForUnit, releaseHold, setOverlock, sizeLabel } from "./units";

const ISSUE_VENDOR: Partial<Record<WOCategory, string>> = { Doors: "basin-door", "Gates & access": "tahoe-gate", HVAC: "lakeside-mech", Pest: "sierra-pest", Lighting: "alder-electric" };
const ISSUES: WOCategory[] = ["Doors", "Lighting", "Pest", "Cleaning", "Other"];

export function UnitDetail({ unitId, onClose, variant = "drawer" }: { unitId: string; onClose: () => void; variant?: "drawer" | "panel" }) {
  useDemo();
  const u = UNIT_BY_ID.get(unitId);
  const [mode, setMode] = useState<"main" | "issue" | "lead">("main");
  const [cat, setCat] = useState<WOCategory>("Doors");
  const [prio, setPrio] = useState<WOPriority>("normal");
  const [note, setNote] = useState("");
  useEffect(() => {
    setMode("main");
    setNote("");
  }, [unitId]);
  if (!u) return null;
  const t = tenantForUnit(u);
  const info = SIZE_INFO[u.size];
  const log = unitGateLog(u.id);
  const wos = WORK_ORDERS.filter(w => w.unitId === u.id);
  const gap = t ? t.rent / u.rate - 1 : 0;
  const locked = u.status === "overlocked";
  const sub = `${sizeLabel(u.size)} · ${KIND_LABEL[u.kind]} · ${buildingName(u.building)}${u.kind === "climate" ? " · Floor " + u.floor : ""}`;

  const body =
    mode === "issue" ? (
      <div className="pa-ud-b">
        <button className="pa-back" onClick={() => setMode("main")}>
          <ChevronLeft size={14} /> {u.id}
        </button>
        <h3 className="pa-ud-h3">Report an issue</h3>
        <Field label="What's wrong">
          <div className="ok-chips">
            {ISSUES.map(c => (
              <button key={c} type="button" aria-pressed={cat === c} onClick={() => setCat(c)}>
                {c}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Priority">
          <Seg value={prio} onChange={setPrio} options={[{ value: "low", label: "Low" }, { value: "normal", label: "Normal" }, { value: "high", label: "High" }, { value: "urgent", label: "Urgent" }]} />
        </Field>
        <Field label="Notes" hint={u.status === "vacant" ? "The unit comes off the storefront until the work order is done." : t ? `${t.first} gets a text when it's scheduled.` : undefined}>
          <textarea className="z-input" rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder={cat === "Doors" ? "Door sticks halfway, spring looks loose" : "What did you see?"} />
        </Field>
        <Field label="Vendor">
          <div className="pa-ud-vendor">
            {ISSUE_VENDOR[cat] ? (
              <>
                <b>{VENDORS.find(v => v.id === ISSUE_VENDOR[cat])!.name}</b>
                <span className="faint">suggested · {VENDORS.find(v => v.id === ISSUE_VENDOR[cat])!.response} response</span>
              </>
            ) : (
              <>
                <b>Marco Ruiz</b>
                <span className="faint">in-house</span>
              </>
            )}
          </div>
        </Field>
      </div>
    ) : mode === "lead" ? (
      <div className="pa-ud-b">
        <button className="pa-back" onClick={() => setMode("main")}>
          <ChevronLeft size={14} /> {u.id}
        </button>
        <h3 className="pa-ud-h3">Hold {u.id} for a reservation</h3>
        <p className="pa-ud-p">Open reservations{leadsForUnit(u).some(l => l.size === u.size) ? ` looking for a ${sizeLabel(u.size)}` : ""}. They get a link to finish move-in online.</p>
        <ul className="pa-ud-leads">
          {leadsForUnit(u).map(l => (
            <li key={l.name}>
              <Avatar name={l.name} size="sm" />
              <div>
                <b>{l.name}</b>
                <span>
                  {sizeLabel(l.size as never)} · moving {l.moving} · {l.source}
                </span>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  holdForLead(u, l);
                  setMode("main");
                }}
              >
                Hold
              </Button>
            </li>
          ))}
        </ul>
      </div>
    ) : (
      <div className="pa-ud-b">
        <div className="pa-ud-facts">
          <div>
            <span>Street rate</span>
            <b className="tnum">{fmt.money(u.rate)}</b>
          </div>
          <div>
            <span>In-place</span>
            <b className="tnum">{t ? fmt.money(t.rent) : "—"}</b>
            {t && gap < -0.005 && <em className="mono">{(gap * 100).toFixed(0)}%</em>}
          </div>
          <div>
            <span>Area</span>
            <b className="tnum">
              {info.sqft} <small>sq ft</small>
            </b>
          </div>
        </div>

        {t ? (
          <div className="pa-ud-sec">
            <div className="pa-ud-sec-h">Tenant</div>
            <button className="pa-ud-tenant" onClick={() => go("ops/tenants/" + t.id)}>
              <Avatar name={t.name} />
              <div>
                <b>{t.name}</b>
                <span>
                  {t.phone} · since {fmt.short(t.moveIn)} {t.moveIn.slice(0, 4)}
                </span>
              </div>
              <ArrowUpRight size={15} />
            </button>
            <dl className="pa-ud-kv">
              <dt>Balance</dt>
              <dd className={t.balance > 0 ? "bad" : ""}>
                {t.balance > 0 ? (
                  <>
                    <b className="tnum">{fmt.money(t.balance)}</b> · {t.daysLate} days past due
                  </>
                ) : (
                  "Paid up"
                )}
              </dd>
              <dt>Billing</dt>
              <dd>{t.autopay ? `Autopay · ${t.card}` : "Pays manually"}</dd>
              <dt>Protection</dt>
              <dd>{t.protection ? fmt.money(t.protection) + " plan" : "None"}</dd>
              <dt>Gate code</dt>
              <dd>
                <span className={`mono pa-code ${locked ? "pa-code--off" : ""}`}>{t.gateCode}</span>
                {locked && <Pill tone="bad">Suspended</Pill>}
              </dd>
              {t.notes && (
                <>
                  <dt>Note</dt>
                  <dd className="muted">{t.notes}</dd>
                </>
              )}
            </dl>
          </div>
        ) : (
          <div className="pa-ud-sec">
            <div className="pa-ud-sec-h">{u.status === "reserved" ? "Reservation" : u.status === "maintenance" ? "Offline" : "Availability"}</div>
            <p className="pa-ud-p">
              {u.status === "vacant" && <>Listed on the storefront at {fmt.money(u.rate)}/mo. {info.like}, fits {info.fits.toLowerCase()}.</>}
              {u.status === "reserved" && <>Reserved online. The tenant finishes move-in from the link Zonera sent; the hold expires in 48 hours.</>}
              {u.status === "maintenance" && <>Not rentable until the open work order is closed. It goes back on the storefront automatically.</>}
            </p>
          </div>
        )}

        {wos.length > 0 && (
          <div className="pa-ud-sec">
            <div className="pa-ud-sec-h">Work orders</div>
            <ul className="pa-ud-list">
              {wos.map(w => (
                <li key={w.id}>
                  <button onClick={() => go("ops/maintenance/" + w.id)}>
                    <span className="mono faint">{w.id}</span>
                    <b>{w.title}</b>
                    <Pill tone={w.status === "done" ? "ok" : w.status === "new" ? "warn" : "info"}>{w.status === "progress" ? "In progress" : w.status[0].toUpperCase() + w.status.slice(1)}</Pill>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="pa-ud-sec">
          <div className="pa-ud-sec-h">Gate activity</div>
          {log.length ? (
            <ul className="pa-ud-log">
              {log.map((l, i) => (
                <li key={i}>
                  <KeyRound size={13} />
                  <span className={l.text.startsWith("Denied") ? "bad" : ""}>{l.text}</span>
                  <span className="faint">{l.gate}</span>
                  <span className="mono faint">{l.at}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="pa-ud-p faint">No gate activity. No tenant code is linked to this unit.</p>
          )}
        </div>
      </div>
    );

  const foot =
    mode === "issue" ? (
      <>
        <Button variant="ghost" onClick={() => setMode("main")}>
          Cancel
        </Button>
        <Button
          variant="primary"
          icon={<Wrench />}
          onClick={() => {
            const v = ISSUE_VENDOR[cat];
            createWorkOrder({
              title: cat === "Doors" ? "Door issue" : cat === "Lighting" ? "Light out" : cat === "Pest" ? "Pest report" : cat === "Cleaning" ? "Needs cleaning" : "Unit issue",
              location: `${u.id} · ${buildingName(u.building)}`,
              unitId: u.id,
              category: cat,
              priority: prio,
              vendorId: v,
              assignee: v ? undefined : "Marco Ruiz",
              due: prio === "urgent" || prio === "high" ? "Today" : "Oct 5",
              notes: note || "Reported from the unit panel.",
            });
            setMode("main");
          }}
        >
          Create work order
        </Button>
      </>
    ) : mode === "lead" ? null : (
      <>
        {u.status === "vacant" && (
          <Button variant="primary" icon={<UserPlus />} onClick={() => setMode("lead")}>
            Rent to a lead
          </Button>
        )}
        {u.status === "reserved" && (
          <Button icon={<CircleSlash />} onClick={() => releaseHold(u)}>
            Release hold
          </Button>
        )}
        {(u.status === "delinquent" || u.status === "overlocked") && t && (
          <Button variant="primary" icon={<CreditCard />} onClick={() => askAgent(t.last === "Okafor" ? "Matthew came in and paid $240 cash" : `${t.name} wants to pay ${fmt.money(t.balance)} for ${u.id}`)}>
            Take payment
          </Button>
        )}
        {(u.status === "occupied" || u.status === "delinquent") && t && (
          <Button icon={<Lock />} onClick={() => setOverlock(u, true)}>
            Overlock
          </Button>
        )}
        {u.status === "overlocked" && (
          <Button icon={<LockOpen />} onClick={() => setOverlock(u, false)}>
            Remove overlock
          </Button>
        )}
        {u.status === "occupied" && t && (
          <Button icon={<MessageSquare />} onClick={() => askAgent(`Text ${t.name} about ${u.id}`)}>
            Message
          </Button>
        )}
        {u.status === "maintenance" && wos.find(w => w.status !== "done") && (
          <Button variant="primary" icon={<Wrench />} onClick={() => go("ops/maintenance/" + wos.find(w => w.status !== "done")!.id)}>
            Open work order
          </Button>
        )}
        {u.status !== "maintenance" && (
          <Button icon={<Wrench />} onClick={() => setMode("issue")}>
            Report issue
          </Button>
        )}
        <Button variant="ghost" className="pa-ud-ask" icon={<Sparkles />} onClick={() => askAgent(`What's going on with ${u.id}?`)}>
          Ask agent
        </Button>
      </>
    );

  return (
    <div className={`pa-ud pa-ud--${variant}`}>
      <DrawerHead
        title={
          <span className="pa-ud-title">
            {u.id}
            <UnitStatusPill status={u.status} />
          </span>
        }
        sub={sub}
        onClose={onClose}
      />
      <div className="pa-ud-scroll">{body}</div>
      {foot && <div className="pa-ud-f">{foot}</div>}
    </div>
  );
}

export function UnitDrawer({ unitId, onClose }: { unitId: string | null; onClose: () => void }) {
  return (
    <Drawer open={!!unitId} onClose={onClose} width={460}>
      {unitId && <UnitDetail unitId={unitId} onClose={onClose} />}
    </Drawer>
  );
}
