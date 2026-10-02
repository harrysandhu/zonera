import { UNIT_BY_ID, UNITS, occupancy, type UnitSize, type UnitStatus } from "../data/facility";
import { LEADS, TENANTS, TENANT_BY_ID, type Tenant } from "../data/tenants";
import { PROTECTION } from "../data/catalog";
import { fmt } from "../state/store";

// Agent-side records and helpers. Everything here is derived from, or writes back
// to, the shared demo data in src/data so the rest of the product stays in sync.

export const TODAY_ISO = "2026-10-02";
export const money = (n: number) => fmt.money(n, true);
export const sizeLabel = (s: string) => s.replace("x", "×");
export const round2 = (n: number) => Math.round(n * 100) / 100;

export function isoDaysAgo(days: number) {
  const d = new Date(2026, 9, 2, 12);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
export function isoAdd(iso: string, days: number, months = 0) {
  const d = new Date(iso + "T12:00:00");
  d.setMonth(d.getMonth() + months);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
const short = (iso: string) => fmt.short(iso);

export function protectionPrice(cover: number) {
  return PROTECTION.find(p => p.id === cover)?.price ?? 0;
}
export function protectionLabel(cover: number) {
  const p = PROTECTION.find(p => p.id === cover);
  return p ? `${p.label} · ${p.cover}` : "Declined";
}

// ---------------------------------------------------------------------- ledger

export interface LedgerRow {
  date: string; // ISO
  desc: string;
  charge?: number;
  payment?: number;
  balance: number;
  flag?: "late" | "dup" | "new";
}

/** A ledger that reconciles exactly to the tenant's current balance. */
export function ledgerFor(t: Tenant): LedgerRow[] {
  const rows: Omit<LedgerRow, "balance">[] = [];
  if (t.daysLate > 0) {
    const due1 = isoDaysAgo(t.daysLate);
    const prev = isoAdd(due1, 0, -1);
    rows.push({ date: prev, desc: `Rent · ${short(prev)} – ${short(isoAdd(due1, -1))}`, charge: t.rent });
    rows.push({ date: isoAdd(prev, 2), desc: t.notes?.includes("cash") ? "Cash payment · office" : t.card ? `Card payment · ${t.card}` : "Payment", payment: t.rent });
    rows.push({ date: due1, desc: `Rent · ${short(due1)} – ${short(isoAdd(due1, -1, 1))}`, charge: t.rent });
    let sum = t.rent;
    if (t.daysLate > 5 && t.balance - sum >= 45) {
      rows.push({ date: isoAdd(due1, 6), desc: "Late fee", charge: 45, flag: "late" });
      sum += 45;
    }
    if (t.daysLate > 30) {
      const due2 = isoAdd(due1, 0, 1);
      if (t.balance - sum >= t.rent) {
        rows.push({ date: due2, desc: `Rent · ${short(due2)} – ${short(isoAdd(due2, -1, 1))}`, charge: t.rent });
        sum += t.rent;
      }
      if (t.balance - sum >= 45) {
        rows.push({ date: isoAdd(due2, 6), desc: "Late fee", charge: 45, flag: "late" });
        sum += 45;
      }
    }
    if (sum < t.balance) rows.push({ date: isoDaysAgo(Math.max(1, t.daysLate - 15)), desc: "Overlock fee", charge: round2(t.balance - sum) });
    if (sum > t.balance) rows.push({ date: isoDaysAgo(2), desc: "Partial payment", payment: round2(sum - t.balance) });
  } else {
    const day = Math.min(28, +t.moveIn.slice(8, 10));
    const last = new Date(2026, day <= 2 ? 9 : 8, day, 12).toISOString().slice(0, 10);
    rows.push({ date: isoAdd(last, 0, -1), desc: `Rent · ${short(isoAdd(last, 0, -1))} – ${short(isoAdd(last, -1))}`, charge: t.rent });
    rows.push({ date: isoAdd(last, 0, -1), desc: t.card ? `Autopay · ${t.card}` : "Payment", payment: t.rent });
    rows.push({ date: last, desc: `Rent · ${short(last)} – ${short(isoAdd(last, -1, 1))}`, charge: t.rent });
    rows.push({ date: last, desc: t.card ? `Autopay · ${t.card}` : "Payment", payment: t.rent });
  }
  let bal = 0;
  return rows.map(r => {
    bal = round2(bal + (r.charge ?? 0) - (r.payment ?? 0));
    return { ...r, balance: bal };
  });
}

/** Matthew Alvarez was charged twice this morning; the 9:17 am retry is the duplicate. */
export function alvarezLedger(refunded: boolean): LedgerRow[] {
  const rows: Omit<LedgerRow, "balance">[] = [
    { date: "2026-09-02", desc: "Rent · Sep 2 – Oct 1", charge: 249 },
    { date: "2026-09-02", desc: "Autopay · Visa •• 4242 · 6:01 am", payment: 249 },
    { date: "2026-10-02", desc: "Rent · Oct 2 – Nov 1", charge: 249 },
    { date: "2026-10-02", desc: "Autopay · Visa •• 4242 · 6:02 am", payment: 249 },
    { date: "2026-10-02", desc: "Autopay retry · Visa •• 4242 · 9:17 am", payment: 249, flag: "dup" },
  ];
  if (refunded) rows.push({ date: "2026-10-02", desc: "Refund · duplicate charge", charge: 249, flag: "new" });
  let bal = 0;
  return rows.map(r => {
    bal = round2(bal + (r.charge ?? 0) - (r.payment ?? 0));
    return { ...r, balance: bal };
  });
}

// ---------------------------------------------------------------------- calendar

export interface CalEvent {
  id: string;
  t: string;
  title: string;
  meta: string;
  kind: "tour" | "vendor" | "inspection" | "lien" | "movein";
  owner: "Priya" | "Agent" | "Marco";
  done?: boolean;
  note?: string;
}

export const CALENDAR: CalEvent[] = [
  { id: "ev-maya", t: "9:42 am", title: "Maya Chen moved in online", meta: "A-126 · 10×10 · lease signed", kind: "movein", owner: "Agent", done: true },
  { id: "ev-tour", t: "11:00 am", title: "Walk-in tour, Jordan Lee", meta: "Looking for a 10×10 today", kind: "tour", owner: "Priya" },
  { id: "ev-hvac", t: "1:00 pm", title: "HVAC service, Building D", meta: "Lakeside Mechanical · temporary gate code", kind: "vendor", owner: "Priya" },
  { id: "ev-ben", t: "3:30 pm", title: "Move-out inspection, Ben Carter", meta: "B-141 · prepaid through Oct 31", kind: "inspection", owner: "Priya" },
  { id: "ev-lien", t: "5:00 pm", title: "Lien sale prep", meta: "A-131 · Dana Whitfield · 47 days past due", kind: "lien", owner: "Priya" },
];

export const STAFF = {
  marco: { name: "Marco Diaz", role: "Relief manager", shift: "on site 1:00 – 6:00 pm", phone: "(530) 555-0109" },
};

// ---------------------------------------------------------------------- reservations

export interface ResInfo {
  id: string;
  unit: string;
  card?: string;
  protection: 0 | 2000 | 5000 | 10000;
  email: string;
}

export const RESERVATIONS: Record<string, ResInfo> = {
  "Owen Murphy": { id: "R-2041", unit: "A-112", card: "Visa •• 6110", protection: 5000, email: "owen.murphy@gmail.com" },
  "Hana Sato": { id: "R-2036", unit: "A-132", card: "Mastercard •• 2290", protection: 2000, email: "hana.sato@icloud.com" },
  "Rafael Costa": { id: "R-2038", unit: "B-114", protection: 10000, email: "rafael@pineandpour.com" },
  "Leila Haddad": { id: "R-2034", unit: "D-205", protection: 0, email: "leila.haddad@gmail.com" },
  "Wes Abbott": { id: "R-2032", unit: "P-5", protection: 0, email: "wes.abbott@outlook.com" },
  "Imani Mensah": { id: "R-2039", unit: "B-128", card: "Visa •• 7745", protection: 5000, email: "imani.mensah@gmail.com" },
};

export const lead = (name: string) => LEADS.find(l => l.name === name);

// ---------------------------------------------------------------------- tenants

export function tenantByName(name: string) {
  return TENANTS.find(t => t.name.toLowerCase() === name.toLowerCase());
}
export const T = (id: string) => TENANT_BY_ID.get(id)!;
export const U = (id: string) => UNIT_BY_ID.get(id)!;

let nextId = 0;
function newTenantId() {
  const used = new Set(TENANTS.map(t => t.id));
  let n = 1000 + TENANTS.length + nextId;
  while (used.has(`T-${n}`)) n++;
  nextId++;
  return `T-${n}`;
}

/** Create a tenant in a unit. Returns an undo. */
export function moveIn(p: { first: string; last: string; phone: string; email: string; unitId: string; rent: number; protection: 0 | 2000 | 5000 | 10000; card?: string; gateCode: string; notes?: string }) {
  const u = U(p.unitId);
  const prev = { status: u.status, tenantId: u.tenantId };
  const t: Tenant = {
    id: newTenantId(),
    first: p.first,
    last: p.last,
    name: `${p.first} ${p.last}`,
    email: p.email,
    phone: p.phone,
    unitIds: [p.unitId],
    rent: p.rent,
    balance: 0,
    daysLate: 0,
    autopay: !!p.card,
    card: p.card,
    moveIn: TODAY_ISO,
    protection: p.protection,
    gateCode: p.gateCode,
    notes: p.notes,
    lastContact: "Oct 2 · Welcome text",
  };
  TENANTS.push(t);
  TENANT_BY_ID.set(t.id, t);
  u.status = "occupied";
  u.tenantId = t.id;
  return {
    tenant: t,
    undo() {
      const i = TENANTS.indexOf(t);
      if (i >= 0) TENANTS.splice(i, 1);
      TENANT_BY_ID.delete(t.id);
      u.status = prev.status;
      u.tenantId = prev.tenantId;
    },
  };
}

/** Snapshot a tenant + their units so an effect can be undone. */
export function snapshot(t: Tenant) {
  const s = { ...t, unitIds: [...t.unitIds] };
  const units = t.unitIds.map(id => ({ id, status: U(id).status, tenantId: U(id).tenantId }));
  return () => {
    Object.assign(t, s);
    for (const u of units) {
      U(u.id).status = u.status;
      U(u.id).tenantId = u.tenantId;
    }
  };
}

export function setUnitStatus(id: string, st: UnitStatus) {
  const u = U(id);
  const prev = u.status;
  u.status = st;
  return () => {
    u.status = prev;
  };
}

export function removeLead(name: string) {
  const i = LEADS.findIndex(l => l.name === name);
  if (i < 0) return () => {};
  const [l] = LEADS.splice(i, 1);
  return () => {
    if (!LEADS.includes(l)) LEADS.splice(Math.min(i, LEADS.length), 0, l);
  };
}

export function occPct() {
  return occupancy().byUnit;
}

export function sizeOcc(size: UnitSize) {
  const all = UNITS.filter(u => u.size === size && u.status !== "maintenance");
  const taken = all.filter(u => u.status !== "vacant" && u.status !== "reserved").length;
  return { total: all.length, taken, vacant: all.filter(u => u.status === "vacant"), rate: taken / Math.max(1, all.length) };
}

export const pastDue = () => TENANTS.filter(t => t.daysLate > 0).sort((a, b) => b.daysLate - a.daysLate);
export const autopayFailures = () => TENANTS.filter(t => t.autopay && t.daysLate > 0 && t.balance > 0);

export const DECLINE: Record<string, { code: string; label: string; soft: boolean }> = {
  "Nora Banerjee": { code: "insufficient_funds", label: "Insufficient funds", soft: true },
  "Grace Lindqvist": { code: "expired_card", label: "Card expired", soft: false },
  "Nora Larsen": { code: "do_not_honor", label: "Bank declined", soft: false },
  "Olivia Hughes": { code: "expired_card", label: "Card expired", soft: false },
};

// ---------------------------------------------------------------------- records the agent creates

export interface GateCodeRec { id: string; code: string; label: string; zones: string[]; window: string; kind: "one-time" | "recurring" | "tenant"; revoked?: boolean }
export interface WorkOrder { id: string; unit?: string; title: string; vendor: string; window: string; status: "scheduled" | "open" | "done" }
export interface Promo { id: string; title: string; size: UnitSize; until: string; live: boolean }

export const RECORDS = {
  gateCodes: [] as GateCodeRec[],
  workOrders: [{ id: "WO-2291", title: "Gate 2 exit sensor offline", vendor: "Tahoe Access Systems", window: "Today 2:00 – 4:00 pm", status: "scheduled" }] as WorkOrder[],
  promos: [] as Promo[],
  liens: [] as { tenantId: string; step: string }[],
};

let codeSeq = 0;
const CODES = ["4826", "7316", "5094", "2681", "9043", "3157", "6402", "8529"];
export function nextCode() {
  return CODES[codeSeq++ % CODES.length];
}
