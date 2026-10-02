import { commit, toast, clock } from "../../../state/store";
import { UNITS, UNIT_BY_ID, BUILDINGS, SIZE_INFO, type Unit, type UnitSize, type UnitStatus } from "../../../data/facility";
import { LEADS, OPERATOR, tenantForUnit } from "../../../data/tenants";
import { GATE_EVENTS } from "../../../data/gate";
import { WORK_ORDERS, nextWorkOrderId, type WorkOrder, type WOCategory, type WOPriority } from "../../../data/maintenance";

export const SIZES: UnitSize[] = ["5x5", "5x10", "10x10", "10x15", "10x20", "10x30", "12x40"];
export const STATUS_ORDER: UnitStatus[] = ["vacant", "reserved", "delinquent", "overlocked", "maintenance", "occupied"];
export const KIND_LABEL: Record<Unit["kind"], string> = { "drive-up": "Drive-up", climate: "Climate", parking: "Parking" };

export const sizeLabel = (s: UnitSize) => s.replace("x", "×");
export const sqft = (u: Unit) => SIZE_INFO[u.size].sqft;
export const buildingName = (id: string) => BUILDINGS.find(b => b.id === id)?.name.replace(" · Climate", "") ?? id;

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

/** The most recent thing that happened to a unit, with minutes-ago for sorting. */
export function lastActivity(u: Unit): { text: string; when: string; ago: number } {
  const ev = GATE_EVENTS.find(e => e.unitId === u.id);
  if (ev) {
    const verb = ev.kind === "denied" ? "Gate denied" : ev.kind === "entry" ? "Gate entry" : "Gate exit";
    return { text: verb, when: ev.at, ago: minutesAgo(ev.at) };
  }
  const h = hash(u.id);
  const d = 1 + (h % 21);
  const day = (n: number) => {
    const dt = new Date(2026, 9, 2 - n);
    return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };
  const wo = WORK_ORDERS.find(w => w.unitId === u.id && w.status !== "done");
  switch (u.status) {
    case "vacant":
      return { text: "Listed", when: day(d + 3), ago: (d + 3) * 1440 };
    case "reserved":
      return { text: "Reserved online", when: day(1 + (h % 5)), ago: (1 + (h % 5)) * 1440 };
    case "maintenance":
      return { text: wo ? `${wo.id} opened` : "Work order", when: "7:58 am", ago: 106 };
    case "overlocked":
      return { text: "Overlocked", when: day(8 + (h % 20)), ago: (8 + (h % 20)) * 1440 };
    case "delinquent":
      return { text: "Reminder sent", when: day(2 + (h % 6)), ago: (2 + (h % 6)) * 1440 };
    default:
      return h % 3 === 0 ? { text: "Autopay", when: "Oct 1", ago: 1 * 1440 + (h % 300) } : { text: "Gate entry", when: day(d), ago: d * 1440 + (h % 600) };
  }
}

function minutesAgo(at: string) {
  const m = /(\d+):(\d+)\s*(am|pm)/.exec(at);
  const n = /(\d+):(\d+)\s*(am|pm)/.exec(clock());
  if (!m || !n) return 0;
  const toMin = (x: RegExpExecArray) => ((+x[1] % 12) + (x[3] === "pm" ? 12 : 0)) * 60 + +x[2];
  return Math.max(0, toMin(n) - toMin(m));
}

export function setOverlock(u: Unit, on: boolean) {
  const t = tenantForUnit(u);
  if (on) u.status = "overlocked";
  else u.status = t && t.balance > 0 ? "delinquent" : "occupied";
  commit({
    kind: "gate",
    text: on ? `Overlocked ${u.id}${t ? " · " + t.name : ""} · gate code suspended` : `Removed overlock on ${u.id}${t ? " · " + t.name : ""} · gate code restored`,
    who: OPERATOR.name,
  });
  toast({
    title: on ? `${u.id} overlocked` : `Overlock removed from ${u.id}`,
    body: on ? `${t?.first ?? "The tenant"}'s gate code is suspended. A notice was texted.` : `${t?.first ?? "The tenant"}'s gate code works again.`,
    tone: on ? "warn" : "ok",
  });
}

export function leadsForUnit(u: Unit) {
  const exact = LEADS.filter(l => l.size === u.size);
  return exact.length ? exact : LEADS;
}

export function holdForLead(u: Unit, lead: (typeof LEADS)[number]) {
  u.status = "reserved";
  commit({ kind: "lead", text: `Held ${u.id} for ${lead.name} · move-in link texted`, who: OPERATOR.name });
  toast({ title: `${u.id} held for ${lead.name}`, body: `Move-in link texted to ${lead.phone}. The hold expires in 48 hours.`, tone: "ok" });
}

export function releaseHold(u: Unit) {
  u.status = "vacant";
  commit({ kind: "lead", text: `Released hold on ${u.id} · back on the storefront`, who: OPERATOR.name });
  toast({ title: `${u.id} is available again`, body: "Listed on the storefront at " + "$" + u.rate + "/mo.", tone: "info" });
}

export function createWorkOrder(w: { title: string; location: string; unitId?: string; gateId?: string; category: WOCategory; priority: WOPriority; vendorId?: string; assignee?: string; due: string; notes: string; source?: WorkOrder["source"] }) {
  const wo: WorkOrder = {
    id: nextWorkOrderId(),
    status: "new",
    opened: "Today " + clock(),
    source: w.source ?? "Manager",
    log: [{ at: clock(), text: `Opened by ${OPERATOR.name}` }],
    ...w,
  };
  WORK_ORDERS.unshift(wo);
  let offline = false;
  if (w.unitId) {
    const u = UNIT_BY_ID.get(w.unitId);
    if (u && u.status === "vacant") {
      u.status = "maintenance";
      offline = true;
      wo.log.push({ at: clock(), text: `${u.id} set to maintenance, removed from the storefront`, agent: true });
    }
  }
  commit({ kind: "maintenance", text: `${wo.id} opened · ${wo.title} · ${wo.location}`, who: OPERATOR.name });
  toast({ title: `${wo.id} created`, body: `${wo.title} · ${wo.location}${offline ? ". Unit taken off the storefront." : ""}`, tone: "ok", action: { label: "Open board", route: "ops/maintenance/" + wo.id } });
  return wo;
}

export function unitCounts() {
  return STATUS_ORDER.map(s => ({ s, n: UNITS.filter(u => u.status === s).length }));
}
