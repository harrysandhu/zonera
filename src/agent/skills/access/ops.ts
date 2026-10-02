import { UNIT_BY_ID } from "../../../data/facility";
import { TENANTS, tenantForUnit, type Tenant } from "../../../data/tenants";
import { ACCESS_CODES, GATE_EVENTS, HOLIDAYS, addAccessCode, pushGateEvent, unitGateLog, type AccessCode, type GateEvent, type ZoneId } from "../../../data/gate";
import { VENDORS, type Vendor } from "../../../data/maintenance";
import { addComm } from "../../../data/comms";
import { pushLedger, clockMin, TODAY } from "../../../data/ledger";
import { clock } from "../../../state/store";
import { TODAY_ISO, isoAdd } from "../../data";
import type { DoorId, LogEvent } from "../../widgets/access/types";

// Access-side data helpers shared by the access and facility skills: doors and
// zones, time windows, code issuing, lock-outs and the gate history the
// investigation skill reads. Everything writes to src/data (gate.ts,
// tenants.ts, comms.ts, ledger.ts) so the Gate access page and profiles follow.

// ---------------------------------------------------------------- doors and zones

export const DOORS: Record<DoorId, { label: string; short: string; zone: ZoneId; hint: string }> = {
  G1: { label: "Gate 1", short: "Gate 1", zone: "lot", hint: "Main entry" },
  G2: { label: "Gate 2", short: "Gate 2", zone: "lot", hint: "Exit lane" },
  PED: { label: "Pedestrian gate", short: "Pedestrian", zone: "lot", hint: "Walk-through" },
  D1: { label: "Building D doors", short: "Bldg D doors", zone: "climate", hint: "Keypad and card" },
  ELV: { label: "Elevator", short: "Elevator", zone: "climate", hint: "Building D, floor 2" },
  RV: { label: "RV & Boat gate", short: "RV gate", zone: "rv", hint: "North lot" },
};
export const DOOR_ORDER: DoorId[] = ["G1", "G2", "PED", "D1", "ELV", "RV"];

export function zonesOf(doors: DoorId[]): ZoneId[] {
  return [...new Set(doors.map(d => DOORS[d].zone))];
}

export function doorsText(doors: DoorId[]) {
  const names = DOOR_ORDER.filter(d => doors.includes(d)).map(d => DOORS[d].label);
  if (names.length <= 1) return names.join("");
  return names.slice(0, -1).join(", ") + " and " + names[names.length - 1].replace(/^Elevator$/, "the elevator");
}

/** Doors a tenant needs for their units. */
export function doorsForUnits(unitIds: string[]): DoorId[] {
  const d = new Set<DoorId>(["G1", "G2"]);
  for (const id of unitIds) {
    const u = UNIT_BY_ID.get(id);
    if (u?.kind === "climate") {
      d.add("D1");
      if (u.floor === 2) d.add("ELV");
    }
    if (u?.kind === "parking") d.add("RV");
  }
  return DOOR_ORDER.filter(x => d.has(x));
}

// ---------------------------------------------------------------- time windows

export function fmtTime(hhmm: string) {
  let [h, m] = hhmm.split(":").map(Number);
  if (h === 24) h = 0;
  const ap = h >= 12 ? "pm" : "am";
  const hh = h % 12 || 12;
  return `${hh}:${String(m).padStart(2, "0")} ${ap}`;
}

/** "1:00–5:00 pm", "9:00 am–12:00 pm". */
export function fmtRange(from: string, to: string) {
  const a = fmtTime(from);
  const b = fmtTime(to);
  if (a.slice(-2) === b.slice(-2)) return `${a.slice(0, -3)}–${b}`;
  return `${a}–${b}`;
}

export const hourOf = (hhmm: string) => Number(hhmm.split(":")[0]) + Number(hhmm.split(":")[1] ?? 0) / 60;
export const hhmm = (h: number) => `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.round((h % 1) * 60)).padStart(2, "0")}`;

const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WD3 = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function weekday(iso: string) {
  return new Date(iso + "T12:00:00").getDay();
}

/** "Today", "Tomorrow", "Sat, Oct 3". */
export function dayLabel(iso: string) {
  if (iso === TODAY_ISO) return "Today";
  if (iso === isoAdd(TODAY_ISO, 1)) return "Tomorrow";
  const d = new Date(iso + "T12:00:00");
  return `${WD3[d.getDay()]}, ${MON[d.getMonth()]} ${d.getDate()}`;
}

export function shortDay(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return `${MON[d.getMonth()]} ${d.getDate()}`;
}

export function daysText(days: number[]) {
  const s = [...days].sort((a, b) => a - b);
  if (s.length === 7) return "Every day";
  if (s.join() === "1,2,3,4,5") return "Weekdays";
  if (s.join() === "0,6") return "Weekends";
  if (s.length === 1) return WEEKDAY[s[0]] + "s";
  return s.map(d => WD3[d]).join(", ");
}

export interface WindowSpec {
  mode: "once" | "recurring";
  date?: string;
  days?: number[];
  from: string;
  to: string;
}

/** The AccessCode.window string the Gate access page shows. */
export function windowText(w: WindowSpec) {
  const range = fmtRange(w.from, w.to);
  if (w.mode === "recurring") return `${daysText(w.days ?? [])} · ${range}`;
  const d = w.date ?? TODAY_ISO;
  return `${d === TODAY_ISO ? "Today" : d === isoAdd(TODAY_ISO, 1) ? "Tomorrow" : shortDay(d)} · ${range}`;
}

/** Current demo time as hours (9.75 = 9:45 am). */
export function nowHours() {
  const m = /(\d+):(\d+)\s*(am|pm)/.exec(clock());
  if (!m) return 9.75;
  return ((+m[1] % 12) + (m[3] === "pm" ? 12 : 0)) + +m[2] / 60;
}

export function statusFor(w: WindowSpec): AccessCode["status"] {
  if (w.mode === "recurring") return w.days?.includes(weekday(TODAY_ISO)) && nowHours() >= hourOf(w.from) && nowHours() < hourOf(w.to) ? "active" : "scheduled";
  if ((w.date ?? TODAY_ISO) > TODAY_ISO) return "scheduled";
  return nowHours() >= hourOf(w.from) && nowHours() < hourOf(w.to) ? "active" : nowHours() >= hourOf(w.to) ? "expired" : "scheduled";
}

// ---------------------------------------------------------------- codes

const VENDOR_CODES = ["604 913", "237 580", "851 462", "319 746", "742 085", "590 231", "468 317", "125 964", "903 418", "276 059"];
const TENANT_CODES = ["4826", "7316", "5094", "2681", "9043", "3157", "6402", "8529", "1739", "6058"];
let vSeq = 0;
let tSeq = 0;

function usedCodes() {
  return new Set([...ACCESS_CODES.map(c => c.code.replace(/\s/g, "")), ...TENANTS.map(t => t.gateCode)]);
}

/** A deterministic 6-digit vendor / guest code that isn't in use. */
export function freshCode(): string {
  const used = usedCodes();
  for (let i = 0; i < VENDOR_CODES.length; i++) {
    const c = VENDOR_CODES[(vSeq + i) % VENDOR_CODES.length];
    if (!used.has(c.replace(/\s/g, ""))) {
      vSeq += i + 1;
      return c;
    }
  }
  return String(100000 + ((vSeq++ * 7919) % 899999)).replace(/^(\d{3})/, "$1 ");
}

/** A deterministic 4-digit tenant code that isn't in use. */
export function freshTenantCode(): string {
  const used = usedCodes();
  for (let i = 0; i < TENANT_CODES.length; i++) {
    const c = TENANT_CODES[(tSeq + i) % TENANT_CODES.length];
    if (!used.has(c)) {
      tSeq += i + 1;
      return c;
    }
  }
  return String(1000 + ((tSeq++ * 7919) % 8999));
}

export interface IssueSpec extends WindowSpec {
  holder: string;
  company?: string;
  phone?: string;
  type: AccessCode["type"];
  code: string;
  doors: DoorId[];
  note?: string;
  unitIds?: string[];
  tenantId?: string;
}

/** Add a stored code (vendor, staff, guest). Returns the code and an undo. */
export function issueCode(s: IssueSpec) {
  const ac = addAccessCode({
    holder: s.holder,
    company: s.company,
    phone: s.phone,
    type: s.type,
    code: s.code,
    zones: zonesOf(s.doors),
    window: windowText(s),
    status: statusFor(s),
    unitIds: s.unitIds,
    tenantId: s.tenantId,
    note: s.note ?? doorsText(s.doors),
    createdBy: "Zonera agent",
  });
  return {
    ac,
    undo: () => {
      const i = ACCESS_CODES.indexOf(ac);
      if (i >= 0) ACCESS_CODES.splice(i, 1);
    },
  };
}

/** Retire a stored code (replaced or revoked). Returns an undo. */
export function retireCode(ac: AccessCode, note: string) {
  const prev = { status: ac.status, note: ac.note };
  ac.status = "expired";
  ac.note = note;
  return () => {
    ac.status = prev.status;
    ac.note = prev.note;
  };
}

/** A stored code that overlaps a holder + day (e.g. this morning's draft for the HVAC tech). */
export function existingCodeFor(holder: string | undefined, company: string | undefined, date: string) {
  const day = date === TODAY_ISO ? "Today" : shortDay(date);
  return ACCESS_CODES.find(c => c.status !== "expired" && (c.holder === holder || (!!company && c.company === company)) && c.window.startsWith(day));
}

/** Change a tenant's gate code. Returns the previous code and an undo. */
export function resetTenantCode(t: Tenant, code: string) {
  const prev = t.gateCode;
  t.gateCode = code;
  pushLedger(t.id, { date: TODAY, min: clockMin(), kind: "info", text: "Gate code reset", detail: `New code issued · old code ••${prev.slice(-2)} stopped working`, amount: 0, by: "Zonera agent" });
  addComm(t.id, { channel: "system", who: "Zonera agent", body: `Gate code reset · old code ••${prev.slice(-2)} disabled at every keypad` });
  return {
    prev,
    undo: () => {
      t.gateCode = prev;
    },
  };
}

// ---------------------------------------------------------------- lock-outs

export const isLockedOut = (t: Tenant) => t.unitIds.some(id => UNIT_BY_ID.get(id)?.status === "overlocked");

/** Suspend a tenant's code on these units (status "overlocked" suspends it everywhere). */
export function lockOut(t: Tenant | undefined, unitIds: string[], reason: string, sms?: string) {
  const prev = unitIds.map(id => ({ id, status: UNIT_BY_ID.get(id)!.status }));
  for (const id of unitIds) UNIT_BY_ID.get(id)!.status = "overlocked";
  if (t) {
    pushLedger(t.id, { date: TODAY, min: clockMin(), kind: "info", text: "Locked out", detail: `${reason} · gate code suspended`, amount: 0, by: "Zonera agent" });
    addComm(t.id, { channel: "system", who: "Zonera agent", body: `${unitIds.join(", ")} locked out · ${reason.toLowerCase()} · gate code suspended` });
    if (sms) addComm(t.id, { channel: "sms", dir: "out", who: "Zonera agent", body: sms, status: "Delivered" });
  }
  pushGateEvent({ at: clock(), gate: "G1", kind: "system", who: "Zonera agent", unitId: unitIds[0], tenantId: t?.id, note: `Code suspended · ${unitIds.join(", ")}`, fresh: true });
  return () => {
    for (const p of prev) UNIT_BY_ID.get(p.id)!.status = p.status;
  };
}

/** Lift a lock-out. The unit goes back to past due or occupied. */
export function restoreAccess(t: Tenant | undefined, unitIds: string[], sms?: string) {
  const prev = unitIds.map(id => ({ id, status: UNIT_BY_ID.get(id)!.status }));
  for (const id of unitIds) UNIT_BY_ID.get(id)!.status = t && t.balance > 0 ? "delinquent" : "occupied";
  if (t) {
    pushLedger(t.id, { date: TODAY, min: clockMin(), kind: "info", text: "Access restored", detail: "Gate code active again", amount: 0, by: "Zonera agent" });
    addComm(t.id, { channel: "system", who: "Zonera agent", body: `${unitIds.join(", ")} access restored · gate code ${t.gateCode} active` });
    if (sms) addComm(t.id, { channel: "sms", dir: "out", who: "Zonera agent", body: sms, status: "Delivered" });
  }
  pushGateEvent({ at: clock(), gate: "G1", kind: "system", who: "Zonera agent", unitId: unitIds[0], tenantId: t?.id, note: `Code restored · ${unitIds.join(", ")}`, fresh: true });
  return () => {
    for (const p of prev) UNIT_BY_ID.get(p.id)!.status = p.status;
  };
}

// ---------------------------------------------------------------- vendors and contacts

/** People the operator has texted before who aren't vendors yet. */
export const CONTACTS = [{ id: "shoreline-clean", name: "Shoreline Cleaning", contact: "Rosa Delgado", phone: "(530) 555-0138", trade: "Cleaning", match: /\b(clean(ers|ing)?|janitor|cleaning crew)\b/ }];

const VENDOR_WORDS: [RegExp, string][] = [
  [/\b(hvac|heat|heating|air ?con|a\/?c|furnace|filter|air handler)\b/, "lakeside-mech"],
  [/\b(pest|bug|rodent|mice|mouse|rat|ant|termite|exterminator)\b/, "sierra-pest"],
  [/\b(gate|keypad|loop|sensor|controller|pti)\b/, "tahoe-gate"],
  [/\b(door|roll-?up|jam|jammed|stuck|spring|latch|panel|hinge)\b/, "basin-door"],
  [/\b(light|lights|bulb|electric|electrician|pole|outlet|power)\b/, "alder-electric"],
];

export function vendorFromText(lower: string): Vendor | undefined {
  for (const [re, id] of VENDOR_WORDS) if (re.test(lower)) return VENDORS.find(v => v.id === id);
  return undefined;
}

/** Add a contact to the vendor list (first time they get a code). Returns an undo. */
export function addVendor(c: (typeof CONTACTS)[number]) {
  if (VENDORS.some(v => v.id === c.id)) return () => {};
  const v: Vendor = { id: c.id, name: c.name, trade: c.trade, contact: c.contact, phone: c.phone, rating: 0, response: "New", coi: "Not on file", coiWarn: true, ytd: 0 };
  VENDORS.push(v);
  return () => {
    const i = VENDORS.indexOf(v);
    if (i >= 0) VENDORS.splice(i, 1);
  };
}

// ---------------------------------------------------------------- holidays

export const HOLIDAY_WORDS: [RegExp, string][] = [
  [/thanksgiving/, "Thanksgiving"],
  [/christmas eve/, "Christmas Eve"],
  [/christmas( day)?|xmas/, "Christmas Day"],
  [/new year/, "New Year's Day"],
];

export function holidayFrom(lower: string) {
  for (const [re, name] of HOLIDAY_WORDS) if (re.test(lower)) return HOLIDAYS.find(h => h.name === name);
  return undefined;
}

/** Set a holiday's gate hours (or add a one-off day). Returns an undo. */
export function setHolidayHours(h: { date: string; name: string }, gate: string, office?: string) {
  let row = HOLIDAYS.find(x => x.date === h.date);
  if (!row) {
    row = { date: h.date, name: h.name, gate, office: office ?? "Closed", on: true };
    HOLIDAYS.push(row);
    const added = row;
    return () => {
      const i = HOLIDAYS.indexOf(added);
      if (i >= 0) HOLIDAYS.splice(i, 1);
    };
  }
  const prev = { ...row };
  row.gate = gate;
  if (office) row.office = office;
  row.on = true;
  const r = row;
  return () => Object.assign(r, prev);
}

/** Announcements already sent, by holiday date. */
export const ANNOUNCED = new Set<string>();

// ---------------------------------------------------------------- gate history

const KIND: Record<GateEvent["kind"], LogEvent["kind"]> = { entry: "entry", exit: "exit", fallback: "exit", denied: "denied", system: "system", open: "system" };
const GATE_SHORT: Record<string, string> = { G1: "Gate 1", G2: "Gate 2", PED: "Pedestrian", D1: "Door D1", RV: "RV gate", OFF: "Office" };

function toMin(at: string) {
  const m = /(\d+):(\d+)\s*(am|pm)/.exec(at);
  if (!m) return 0;
  return ((+m[1] % 12) + (m[3] === "pm" ? 12 : 0)) * 60 + +m[2];
}

function codeOf(t?: Tenant) {
  return t ? "••" + t.gateCode.slice(-2) : undefined;
}

/** Today's events from the live gate log, newest first. */
export function todayEvents(): LogEvent[] {
  return GATE_EVENTS.map(e => {
    const t = e.tenantId ? TENANTS.find(x => x.id === e.tenantId) : undefined;
    return {
      id: "g" + e.id,
      day: "Today",
      at: e.at,
      min: 1440 + toMin(e.at),
      door: GATE_SHORT[e.gate] ?? e.gate,
      kind: KIND[e.kind],
      who: e.who,
      unit: e.unitId,
      tenantId: e.tenantId,
      code: codeOf(t),
      note: e.kind === "fallback" ? "Exit by keypad" : e.note,
    };
  });
}

/**
 * Last night, Oct 1 6:00 pm → Oct 2 6:00 am. Matches the overnight summary in the
 * feed: no entries or attempts after close, two people left after 10 pm.
 */
export function lastNightEvents(): LogEvent[] {
  const t = (unit: string) => tenantForUnit(unit);
  const rows: [string, string, LogEvent["kind"], string | null, string?, string?][] = [
    // at, door, kind, unit (null = system), note, camera
    ["6:04 pm", "Gate 1", "entry", "B-138"],
    ["6:31 pm", "Gate 2", "exit", "B-138"],
    ["6:52 pm", "Door D1", "entry", "D-216"],
    ["7:15 pm", "Gate 1", "entry", "C-121"],
    ["7:48 pm", "Gate 2", "exit", "C-121"],
    ["8:40 pm", "Camera 4", "camera", null, "Pole 4 dark, lane B–C · WO-2048 opened", "CAM 4 · LANE B–C"],
    ["9:12 pm", "Gate 1", "entry", "C-125"],
    ["9:46 pm", "Gate 1", "entry", "A-108"],
    ["9:58 pm", "Gate 2", "exit", "D-216"],
    ["10:00 pm", "All gates", "system", null, "Gate hours ended · keypads exit-only"],
    ["10:09 pm", "Pedestrian", "exit", "C-125", "After hours · exit allowed"],
    ["10:38 pm", "Gate 2", "exit", "A-108", "After hours · exit by keypad", "CAM 2 · GATE 2 EXIT"],
    ["11:52 pm", "Camera 6", "camera", null, "Motion at east fence · animal, no person", "CAM 6 · EAST FENCE"],
    ["5:30 am", "Recorder", "system", null, "Camera and recorder health check passed"],
    ["6:00 am", "All gates", "system", null, "Gate hours started"],
  ];
  return rows
    .map(([at, door, kind, unit, note, cam], i) => {
      const tt = unit ? t(unit) : undefined;
      const am = at.endsWith("am") && !at.startsWith("12");
      return {
        id: "n" + i,
        day: am ? "Today" : "Oct 1",
        at,
        min: (am ? 1440 : 0) + toMin(at),
        door,
        kind,
        who: tt?.name ?? (kind === "camera" ? "Camera" : "System"),
        unit: unit ?? undefined,
        tenantId: tt?.id,
        code: codeOf(tt),
        note,
        cam,
      } as LogEvent;
    })
    .sort((a, b) => b.min - a.min);
}

/** Every event we can show for one tenant: today's plus their recent history. */
export function tenantEvents(t: Tenant): LogEvent[] {
  const today = todayEvents().filter(e => e.tenantId === t.id);
  const hist: LogEvent[] = [];
  for (const id of t.unitIds) {
    unitGateLog(id)
      .filter(e => !e.at.startsWith("Today"))
      .forEach((e, i) => {
        const [mon, d, ...rest] = e.at.split(" ");
        hist.push({ id: `h${id}${i}`, day: `${mon} ${d}`, at: rest.join(" "), min: -i, door: e.gate, kind: /Denied/.test(e.text) ? "denied" : /Exit/.test(e.text) ? "exit" : "entry", who: t.name, unit: id, tenantId: t.id, code: codeOf(t) });
      });
  }
  return [...today, ...hist];
}

export function hourBuckets(events: LogEvent[], fromMin: number, toMinExcl: number, cutoff?: number) {
  const out: { label: string; value: number; after?: boolean }[] = [];
  for (let m = fromMin; m < toMinExcl; m += 60) {
    const h = Math.floor((m % 1440) / 60);
    const label = h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`;
    out.push({ label, value: events.filter(e => (e.kind === "entry" || e.kind === "exit" || e.kind === "denied") && e.min >= m && e.min < m + 60).length, after: cutoff !== undefined && m >= cutoff });
  }
  return out;
}
