import { UNITS, UNIT_BY_ID } from "./facility";
import { TENANTS, TENANT_BY_ID, type Tenant } from "./tenants";

// Gate access for Alder Lake: devices, zones, access codes and the event log.
// Tenant codes are derived live from TENANTS + UNITS (an overlocked unit suspends
// its tenant's code everywhere). Vendor and staff codes are stored here and can be
// added from the Gate access page or the agent.

export type GateId = "G1" | "G2" | "PED" | "D1" | "RV" | "OFF";
export type ZoneId = "lot" | "climate" | "rv" | "office";
export type DeviceStatus = "online" | "degraded" | "offline";

export interface GateDevice {
  id: GateId;
  name: string;
  short: string;
  kind: string;
  hardware: string;
  zone: ZoneId;
  status: DeviceStatus;
  note: string;
  workOrder?: string;
  today: number[]; // events per hour, 6 am → now
  lastSeen: string;
}

export const GATES: GateDevice[] = [
  { id: "G1", name: "Gate 1 · Main entry", short: "Gate 1", kind: "Vehicle gate · entry and exit", hardware: "PTI Falcon XL · slide gate", zone: "lot", status: "online", note: "Keypad and loop detectors healthy", today: [2, 4, 7, 9], lastSeen: "9:43 am" },
  { id: "G2", name: "Gate 2 · Exit lane", short: "Gate 2", kind: "Vehicle gate · exit only", hardware: "PTI loop detector · swing arm", zone: "lot", status: "degraded", note: "Exit sensor offline since 8:52 am. Exits fall back to the keypad.", workOrder: "WO-2050", today: [1, 3, 5, 2], lastSeen: "9:40 am" },
  { id: "PED", name: "Pedestrian gate", short: "Pedestrian", kind: "Walk-through gate", hardware: "PTI keypad · mag lock", zone: "lot", status: "online", note: "Battery 82%", today: [0, 1, 1, 2], lastSeen: "9:21 am" },
  { id: "D1", name: "Building D door", short: "Door D1", kind: "Building door · keypad and card", hardware: "PTI StorLogix · card reader", zone: "climate", status: "online", note: "Hallways 63°F · humidity 41%", today: [1, 2, 4, 5], lastSeen: "9:38 am" },
  { id: "RV", name: "RV & Boat gate", short: "RV gate", kind: "Vehicle gate · north lot", hardware: "PTI keypad · slide gate", zone: "rv", status: "online", note: "Keypad and loop detectors healthy", today: [0, 1, 0, 1], lastSeen: "8:14 am" },
  { id: "OFF", name: "Office door", short: "Office", kind: "Staff door", hardware: "Schlage smart lock", zone: "office", status: "online", note: "Unlocked at 9:00 am for office hours", today: [1, 0, 2, 3], lastSeen: "9:02 am" },
];
export const GATE_BY_ID = new Map(GATES.map(g => [g.id, g]));

export interface Zone {
  id: ZoneId;
  name: string;
  covers: string;
  gates: GateId[];
  hours: string;
  rule: string;
}

export const ZONES: Zone[] = [
  { id: "lot", name: "Drive-up lot", covers: "Buildings A, B, C", gates: ["G1", "G2", "PED"], hours: "6:00 am – 10:00 pm", rule: "Every active tenant" },
  { id: "climate", name: "Building D · Climate", covers: "Floors 1 and 2, elevator", gates: ["D1"], hours: "6:00 am – 10:00 pm", rule: "Tenants with a D unit" },
  { id: "rv", name: "RV & Boat lot", covers: "Spaces P-1 to P-7", gates: ["RV"], hours: "5:00 am – 11:00 pm", rule: "Parking tenants only" },
  { id: "office", name: "Office", covers: "Front office, records room", gates: ["OFF"], hours: "9:00 am – 6:00 pm, Mon–Sat", rule: "Staff only" },
];
export const ZONE_BY_ID = new Map(ZONES.map(z => [z.id, z]));

export interface AccessCode {
  id: string;
  holder: string;
  company?: string;
  phone?: string;
  type: "tenant" | "vendor" | "staff";
  code: string;
  zones: ZoneId[];
  window: string;
  status: "active" | "scheduled" | "suspended" | "expired";
  unitIds?: string[];
  tenantId?: string;
  note?: string;
  createdBy: string;
  uses: number;
}

/** Stored (non-tenant) codes. New codes are unshifted onto this list. */
export const ACCESS_CODES: AccessCode[] = [
  { id: "AC-311", holder: "Dev Patel", company: "Lakeside Mechanical", phone: "(530) 555-0144", type: "vendor", code: "418 206", zones: ["lot", "climate"], window: "Today · 1:00–5:00 pm", status: "scheduled", note: "HVAC filters, Building D", createdBy: "Zonera agent", uses: 0 },
  { id: "AC-310", holder: "Kim Tran", company: "Tahoe Gate & Access", phone: "(530) 555-0193", type: "vendor", code: "772 941", zones: ["lot"], window: "Today · 2:00–5:00 pm", status: "scheduled", note: "Gate 2 exit sensor, WO-2050", createdBy: "Zonera agent", uses: 0 },
  { id: "AC-309", holder: "Anna Kowalski", company: "Sierra Pest Control", phone: "(530) 555-0110", type: "vendor", code: "305 118", zones: ["lot", "climate", "rv"], window: "Oct 6 · 8:00–11:00 am", status: "scheduled", note: "Quarterly inspection", createdBy: "Priya Raman", uses: 0 },
  { id: "AC-304", holder: "Luis Ortega", company: "Basin Door Co.", phone: "(530) 555-0181", type: "vendor", code: "660 427", zones: ["lot"], window: "Sep 28 · 9:00 am–12:00 pm", status: "expired", note: "B-118 door panel", createdBy: "Zonera agent", uses: 2 },
  { id: "AC-201", holder: "Priya Raman", company: "Facility manager", type: "staff", code: "•••• ••", zones: ["lot", "climate", "rv", "office"], window: "24/7", status: "active", createdBy: "Owner", uses: 3 },
  { id: "AC-202", holder: "Marco Ruiz", company: "Maintenance tech", type: "staff", code: "•••• ••", zones: ["lot", "climate", "rv", "office"], window: "6:00 am – 10:00 pm", status: "active", createdBy: "Priya Raman", uses: 2 },
  { id: "AC-203", holder: "Jess Park", company: "Assistant manager", type: "staff", code: "•••• ••", zones: ["lot", "climate", "office"], window: "6:00 am – 10:00 pm", status: "active", createdBy: "Priya Raman", uses: 0 },
];

function zonesForTenant(t: Tenant): ZoneId[] {
  const z = new Set<ZoneId>(["lot"]);
  for (const id of t.unitIds) {
    const u = UNIT_BY_ID.get(id);
    if (u?.kind === "climate") z.add("climate");
    if (u?.kind === "parking") z.add("rv");
  }
  return [...z];
}

/** Tenant codes, derived from the live rent roll. Overlocked units suspend the code. */
export function tenantCodes(): AccessCode[] {
  return TENANTS.filter(t => t.unitIds.some(id => UNIT_BY_ID.get(id))).map((t, i) => {
    const locked = t.unitIds.some(id => UNIT_BY_ID.get(id)?.status === "overlocked");
    const units = t.unitIds.filter(id => UNIT_BY_ID.has(id));
    return {
      id: "TC-" + t.id.slice(2),
      holder: t.name,
      company: t.business,
      phone: t.phone,
      type: "tenant" as const,
      code: t.gateCode,
      zones: zonesForTenant(t),
      window: locked ? "Suspended" : "Gate hours",
      status: locked ? ("suspended" as const) : ("active" as const),
      unitIds: units,
      tenantId: t.id,
      note: locked ? `Overlocked · ${t.daysLate} days past due` : undefined,
      createdBy: "Move-in",
      uses: (i * 7) % 23,
    };
  });
}

export function allCodes() {
  return [...ACCESS_CODES, ...tenantCodes()];
}

export function newCode() {
  const n = String(100000 + Math.floor(Math.random() * 899999));
  return n.slice(0, 3) + " " + n.slice(3);
}

let codeSeq = 312;
export function addAccessCode(c: Omit<AccessCode, "id" | "uses">) {
  const ac: AccessCode = { ...c, id: "AC-" + codeSeq++, uses: 0 };
  ACCESS_CODES.unshift(ac);
  return ac;
}

// ---- Event log -------------------------------------------------------------

export type GateEventKind = "entry" | "exit" | "fallback" | "denied" | "system" | "open";

export interface GateEvent {
  id: number;
  at: string; // "9:31 am"
  gate: GateId;
  kind: GateEventKind;
  who: string;
  unitId?: string;
  tenantId?: string;
  note?: string;
  fresh?: boolean;
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fmtMin(m: number) {
  let h = Math.floor(m / 60);
  const mm = m % 60;
  const ap = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;
  return `${h}:${String(mm).padStart(2, "0")} ${ap}`;
}

const goodTenants = () => TENANTS.filter(t => t.daysLate === 0 && t.unitIds.length && UNIT_BY_ID.get(t.unitIds[0])?.status === "occupied");

let evSeq = 1;
export const GATE_EVENTS: GateEvent[] = (() => {
  const r = rng(2026);
  const pool = goodTenants();
  const out: GateEvent[] = [];
  // Pinned story events from the morning feed.
  const pinned: Omit<GateEvent, "id">[] = [
    { at: "9:41 am", gate: "G2", kind: "fallback", who: pool[5].name, unitId: pool[5].unitIds[0], tenantId: pool[5].id, note: "Exit by keypad" },
    { at: "9:31 am", gate: "G1", kind: "entry", who: "Matthew Alvarez", unitId: "B-122", tenantId: TENANTS.find(t => t.last === "Alvarez")?.id },
    { at: "9:02 am", gate: "OFF", kind: "open", who: "Priya Raman", note: "Office unlocked" },
    { at: "8:52 am", gate: "G2", kind: "system", who: "Exit sensor", note: "Loop detector offline · WO-2050 opened" },
    { at: "8:30 am", gate: "G1", kind: "entry", who: "Matthew Cho", unitId: "D-207", tenantId: TENANTS.find(t => t.last === "Cho")?.id },
    { at: "7:12 am", gate: "G1", kind: "denied", who: "Dana Whitfield", unitId: "A-131", tenantId: TENANTS.find(t => t.last === "Whitfield")?.id, note: "Code suspended · overlocked" },
  ];
  const pinnedMins = pinned.map(p => toMin(p.at));
  for (let m = 6 * 60 + 4; m < 9 * 60 + 44; m += 3 + Math.floor(r() * 7)) {
    if (pinnedMins.some(p => Math.abs(p - m) < 3)) continue;
    const t = pool[Math.floor(r() * pool.length)];
    const u = UNIT_BY_ID.get(t.unitIds[0])!;
    const exit = r() < 0.42;
    const after852 = m >= 8 * 60 + 52;
    const gate: GateId = u.kind === "climate" && !exit && r() < 0.5 ? "D1" : u.kind === "parking" ? "RV" : exit ? "G2" : "G1";
    const kind: GateEventKind = exit ? (gate === "G2" && after852 ? "fallback" : "exit") : "entry";
    out.push({ id: 0, at: fmtMin(m), gate, kind, who: t.name, unitId: u.id, tenantId: t.id, note: kind === "fallback" ? "Exit by keypad" : undefined });
  }
  for (const p of pinned) out.push({ id: 0, ...p });
  out.sort((a, b) => toMin(b.at) - toMin(a.at));
  out.forEach(e => (e.id = evSeq++));
  return out;
})();

function toMin(at: string) {
  const m = /(\d+):(\d+)\s*(am|pm)/.exec(at);
  if (!m) return 0;
  let h = +m[1] % 12;
  if (m[3] === "pm") h += 12;
  return h * 60 + +m[2];
}

/** A plausible next event for the live stream. */
export function nextGateEvent(at: string): GateEvent {
  const pool = goodTenants();
  const x = Math.random();
  if (x < 0.06) {
    const late = TENANTS.filter(t => t.unitIds.some(id => UNIT_BY_ID.get(id)?.status === "overlocked"));
    const t = late[Math.floor(Math.random() * late.length)];
    if (t) return { id: evSeq++, at, gate: "G1", kind: "denied", who: t.name, unitId: t.unitIds[0], tenantId: t.id, note: "Code suspended · overlocked", fresh: true };
  }
  const t = pool[Math.floor(Math.random() * pool.length)];
  const u = UNIT_BY_ID.get(t.unitIds[0])!;
  const exit = Math.random() < 0.45;
  const g2 = GATE_BY_ID.get("G2")!;
  const gate: GateId = u.kind === "climate" && !exit ? "D1" : u.kind === "parking" ? "RV" : exit ? "G2" : Math.random() < 0.12 ? "PED" : "G1";
  const kind: GateEventKind = exit ? (gate === "G2" && g2.status !== "online" ? "fallback" : "exit") : "entry";
  return { id: evSeq++, at, gate, kind, who: t.name, unitId: u.id, tenantId: t.id, note: kind === "fallback" ? "Exit by keypad" : undefined, fresh: true };
}

export function pushGateEvent(e: Omit<GateEvent, "id">) {
  const ev = { ...e, id: evSeq++ };
  GATE_EVENTS.unshift(ev);
  if (GATE_EVENTS.length > 200) GATE_EVENTS.length = 200;
  return ev;
}

/** Gate log for one unit: real events from today plus a deterministic history. */
export function unitGateLog(unitId: string): { at: string; text: string; gate: string }[] {
  const today = GATE_EVENTS.filter(e => e.unitId === unitId).map(e => ({ at: "Today " + e.at, text: KIND_TEXT[e.kind], gate: GATE_BY_ID.get(e.gate)?.short ?? e.gate }));
  const u = UNIT_BY_ID.get(unitId);
  if (!u || !u.tenantId || !TENANT_BY_ID.has(u.tenantId)) return today;
  let h = 0;
  for (const c of unitId) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const r = rng(h);
  const locked = u.status === "overlocked";
  const hist: { at: string; text: string; gate: string }[] = [];
  const days = ["Sep 30", "Sep 27", "Sep 24", "Sep 19", "Sep 12"];
  for (let i = 0; i < 3; i++) {
    const m = 7 * 60 + Math.floor(r() * 13 * 60);
    hist.push({ at: `${days[i + (h % 2)]} ${fmtMin(m)}`, text: locked && i === 0 ? "Denied · code suspended" : r() < 0.5 ? "Entry" : "Exit", gate: u.kind === "climate" ? "Door D1" : u.kind === "parking" ? "RV gate" : "Gate 1" });
  }
  return [...today, ...hist].slice(0, 4);
}

export const KIND_TEXT: Record<GateEventKind, string> = {
  entry: "Entry",
  exit: "Exit",
  fallback: "Exit · keypad fallback",
  denied: "Denied",
  system: "Device alert",
  open: "Unlocked",
};

export const HOLIDAYS = [
  { date: "Nov 26", name: "Thanksgiving", gate: "6:00 am – 6:00 pm", office: "Closed", on: true },
  { date: "Dec 24", name: "Christmas Eve", gate: "6:00 am – 6:00 pm", office: "9:00 am – 1:00 pm", on: true },
  { date: "Dec 25", name: "Christmas Day", gate: "8:00 am – 4:00 pm", office: "Closed", on: true },
  { date: "Jan 1", name: "New Year's Day", gate: "8:00 am – 6:00 pm", office: "Closed", on: true },
];

export const WEEK_HOURS = [
  { day: "Mon – Fri", gate: "6:00 am – 10:00 pm", office: "9:00 am – 6:00 pm" },
  { day: "Saturday", gate: "6:00 am – 10:00 pm", office: "9:00 am – 6:00 pm" },
  { day: "Sunday", gate: "6:00 am – 10:00 pm", office: "Closed · agent answers" },
];

export function unitsInZone(z: ZoneId) {
  return UNITS.filter(u => (z === "lot" ? u.kind === "drive-up" : z === "climate" ? u.kind === "climate" : z === "rv" ? u.kind === "parking" : false));
}
