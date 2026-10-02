import { UNIT_BY_ID } from "./facility";
import { TENANTS, TENANT_BY_ID, OPERATOR, type Tenant } from "./tenants";
import { clock, commit } from "../state/store";

// Tenant ledgers: a deterministic billing history for every tenant, from move-in
// to today (Fri Oct 2 2026), that ends exactly on the balance in TENANTS.
//
// Billing model (what the lease says):
// - tenant.rent is the total monthly charge: base rent + the tenant protection premium.
// - Rent is billed on the tenant's billing day (anniversary of move-in unless moved).
// - A $45 late fee posts when rent is more than 5 days late.
// - Base rent goes up once a year on the move-in anniversary (30 days' notice).
//
// Live changes (payments taken on the profile, the agent, refunds) append to LIVE.
// If anything else changes a tenant's balance, ledgerFor() adds a reconciling line,
// so the running balance always matches the header.

export const TODAY = "2026-10-02";
export const LATE_FEE = 45;
export const PREMIUM: Record<Tenant["protection"], number> = { 0: 0, 2000: 12, 5000: 19, 10000: 29 };
export const PLAN_NAME: Record<Tenant["protection"], string> = { 0: "Declined", 2000: "Essential", 5000: "Plus", 10000: "Complete" };

export type EntryKind = "rent" | "protection" | "fee" | "admin" | "payment" | "failed" | "refund" | "credit" | "adjustment" | "info";

export interface LedgerEntry {
  id: string;
  date: string; // ISO
  min: number; // minutes after midnight
  kind: EntryKind;
  text: string;
  detail?: string;
  ref?: string;
  amount: number; // + charge, − payment / credit, 0 informational
  method?: string;
  by?: string;
  live?: boolean;
}

// ---- dates --------------------------------------------------------------------

const D = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const ISO = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (iso: string, n: number) => {
  const d = D(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return ISO(d);
};
export const daysBetween = (a: string, b: string) => Math.round((D(b).getTime() - D(a).getTime()) / 86400000);
const dim = (y: number, m0: number) => new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();
/** The billing date in the month that is `k` months after (y, m0). */
function billDate(y: number, m0: number, k: number, day: number) {
  const mm = m0 + k;
  const yy = y + Math.floor(mm / 12);
  const m = ((mm % 12) + 12) % 12;
  return ISO(new Date(Date.UTC(yy, m, Math.min(day, dim(yy, m)))));
}
export function fmtMin(m: number) {
  let h = Math.floor(m / 60);
  const mm = m % 60;
  const ap = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;
  return `${h}:${String(mm).padStart(2, "0")} ${ap}`;
}
export function clockMin() {
  const m = /(\d+):(\d+)\s*(am|pm)/.exec(clock());
  if (!m) return 9 * 60 + 44;
  let h = +m[1] % 12;
  if (m[3] === "pm") h += 12;
  return h * 60 + +m[2];
}
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const shortDate = (iso: string) => `${MON[+iso.slice(5, 7) - 1]} ${+iso.slice(8, 10)}`;
export const longDate = (iso: string) => `${MON[+iso.slice(5, 7) - 1]} ${+iso.slice(8, 10)}, ${iso.slice(0, 4)}`;
const ordinal = (n: number) => n + (n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th");
export { ordinal };

// ---- seeded randomness ----------------------------------------------------------

export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const seedOf = (s: string) => {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h;
};

// ---- the rent roll as it stood when the demo loaded ------------------------------

interface Snap { balance: number; daysLate: number; rent: number; autopay: boolean; card?: string; overlocked: boolean }
const INITIAL = new Map<string, Snap>();
for (const t of TENANTS) {
  INITIAL.set(t.id, {
    balance: t.balance,
    daysLate: t.daysLate,
    rent: t.rent,
    autopay: t.autopay,
    card: t.card,
    overlocked: t.unitIds.some(id => UNIT_BY_ID.get(id)?.status === "overlocked"),
  });
}
const snap = (t: Tenant) => INITIAL.get(t.id) ?? { balance: t.balance, daysLate: t.daysLate, rent: t.rent, autopay: t.autopay, card: t.card, overlocked: false };

export const premium = (t: Tenant) => PREMIUM[t.protection];
export const baseRent = (t: Tenant) => t.rent - premium(t);

const BILL_DAY_OVERRIDE: Record<string, number> = { "Ben Carter": 1 };
const EXPIRED_CARD: Record<string, string> = { "Matthew Okafor": "Visa •• 3310" };

/** Day of the month rent is due. */
export function billingDay(t: Tenant): number {
  if (BILL_DAY_OVERRIDE[t.name]) return BILL_DAY_OVERRIDE[t.name];
  const s = snap(t);
  if (s.daysLate > 0) return +addDays(TODAY, -s.daysLate).slice(8, 10);
  return +t.moveIn.slice(8, 10);
}

/** Next date rent will be charged (after today). */
export function nextBillDate(t: Tenant) {
  const day = billingDay(t);
  for (let k = 0; k < 3; k++) {
    const d = billDate(2026, 9, k, day);
    if (d > TODAY) return d;
  }
  return billDate(2026, 10, 0, day);
}

export function methodFor(t: Tenant) {
  if (t.autopay && t.card) return `Autopay · ${t.card}`;
  if (EXPIRED_CARD[t.name]) return "Cash at the office";
  return t.card ? `Card · ${t.card}` : "Cash";
}

// ---- base ledger -------------------------------------------------------------------

const BASE = new Map<string, LedgerEntry[]>();

function buildBase(t: Tenant): LedgerEntry[] {
  const s = snap(t);
  const r = rng(seedOf(t.id + t.name));
  const prem = PREMIUM[t.protection];
  const base = s.rent - prem;
  const plan = PLAN_NAME[t.protection];
  const out: LedgerEntry[] = [];
  let n = 0;
  const push = (e: Omit<LedgerEntry, "id">) => out.push({ id: `${t.id}-${++n}`, ...e });
  const story = ["Matthew Okafor", "Dana Whitfield", "Grace Lindqvist", "Matthew Alvarez", "Matthew Cho", "Sofia Reyes", "Ben Carter"].includes(t.name);

  // How many cycles at the end are still unpaid, and the late fees on them.
  const unpaid = s.daysLate > 30 ? 2 : s.daysLate > 0 ? 1 : 0;
  const feesDue = Math.max(0, s.balance - unpaid * s.rent);
  const feeCount = Math.round(feesDue / LATE_FEE);
  const feeRemainder = +(feesDue - feeCount * LATE_FEE).toFixed(2);

  // Cycle dates.
  const day = billingDay(t);
  const [my, mm, md] = t.moveIn.split("-").map(Number);
  const cycles: string[] = [];
  let firstProrate = 0;
  if (day === md) {
    for (let k = 0; ; k++) {
      const d = billDate(my, mm - 1, k, day);
      if (d > TODAY) break;
      cycles.push(d);
    }
  } else {
    let k = 0;
    let next = billDate(my, mm - 1, 0, day);
    while (next <= t.moveIn) next = billDate(my, mm - 1, ++k, day);
    firstProrate = daysBetween(t.moveIn, next);
    for (;;) {
      if (next > TODAY) break;
      cycles.push(next);
      next = billDate(my, mm - 1, ++k, day);
    }
  }

  // Base rent by year of tenancy: one increase per anniversary.
  const yearsNow = Math.floor(daysBetween(t.moveIn, TODAY) / 365.25);
  const step = 1.05 + (seedOf(t.id) % 3) * 0.01; // 5–7%
  const baseAt = (iso: string) => {
    const y = Math.floor(daysBetween(t.moveIn, iso) / 365.25);
    return Math.round(base / Math.pow(step, yearsNow - Math.min(y, yearsNow)));
  };

  const card = s.card ?? "Visa •• 4242";
  const manualMethod = () => {
    if (t.name === "Matthew Okafor") return r() < 0.72 ? "Cash at the office" : `Card · ${EXPIRED_CARD[t.name]}`;
    if (t.name === "Dana Whitfield") return r() < 0.5 ? "Cash at the office" : "Check · mailed";
    const x = r();
    return x < 0.55 ? `Card · ${card}` : x < 0.75 ? "Cash at the office" : "ACH · bank transfer";
  };
  const autoMin = (iso: string) => (iso === TODAY && t.name === "Matthew Alvarez" ? 9 * 60 + 17 : 6 * 60 + 2 + (seedOf(t.id + iso) % 200));
  const payMin = () => 9 * 60 + 5 + Math.floor(r() * 520);
  let receipt = 4100 + (seedOf(t.id) % 5000);

  // Move-in.
  push({ date: t.moveIn, min: 9 * 60 + 30 + Math.floor(r() * 300), kind: "info", text: "Moved in", detail: `${t.unitIds.join(", ")} · lease signed`, amount: 0 });
  push({ date: t.moveIn, min: out[0].min + 1, kind: "admin", text: "Administrative fee", detail: "One-time, at move-in", amount: 25 });

  cycles.forEach((due, i) => {
    const isFirst = i === 0 && day === md;
    const open = cycles.length - i <= unpaid;
    const rent = open ? base : baseAt(due);
    const prevBase = i > 0 ? baseAt(cycles[i - 1]) : rent;
    if (i > 0 && rent !== prevBase) {
      push({ date: addDays(due, -30), min: 10 * 60, kind: "info", text: "Rent change notice sent", detail: `${fmtMoney(prevBase)} → ${fmtMoney(rent)} from ${shortDate(due)} · 30 days' notice`, amount: 0, by: "Zonera agent" });
    }
    const cycleEnd = addDays(i + 1 < cycles.length ? cycles[i + 1] : billDate(+due.slice(0, 4), +due.slice(5, 7) - 1, 1, day), -1);
    const per = `${shortDate(due)} – ${shortDate(cycleEnd)}`;
    const dueMin = isFirst ? out[0].min + 2 : 0;
    push({ date: due, min: dueMin, kind: "rent", text: `Rent · ${per}`, ref: `INV-${due.replace(/-/g, "").slice(2)}`, amount: rent });
    if (prem) push({ date: due, min: dueMin, kind: "protection", text: `Tenant protection · ${plan}`, detail: `${fmtMoney(t.protection)} coverage`, amount: prem });
    const charged = rent + prem;

    const remaining = cycles.length - i;
    if (remaining <= unpaid) {
      // Still open.
      if (s.autopay) {
        const failCard = t.name === "Grace Lindqvist" ? "Visa •• 0077" : card;
        push({ date: due, min: autoMin(due), kind: "failed", text: `Autopay declined · ${failCard}`, detail: t.name === "Grace Lindqvist" ? "Card expired 09/26" : "Card declined by issuer", amount: 0, method: `Autopay · ${failCard}` });
      }
      const j = unpaid - remaining; // 0 = oldest open cycle
      const fees = unpaid === 1 ? feeCount : j === 0 ? Math.ceil(feeCount / 2) : Math.floor(feeCount / 2);
      if (isFirst) push({ date: due, min: out[0].min + 3, kind: "payment", text: "Payment at move-in", detail: "Administrative fee", ref: `RCPT-${receipt++}`, amount: -25, method: `Card · ${card}` });
      for (let f = 0; f < fees; f++) push({ date: addDays(due, 6), min: 1, kind: "fee", text: "Late fee", detail: "Rent more than 5 days late", amount: LATE_FEE });
      if (remaining === unpaid && feeRemainder) push({ date: addDays(due, 6), min: 2, kind: "fee", text: "Other charges", amount: feeRemainder });
      if (s.overlocked && remaining === unpaid) {
        const lockDay = t.name === "Matthew Okafor" ? addDays(due, 16) : addDays(due, 15);
        if (lockDay <= TODAY) push({ date: lockDay, min: 10 * 60 + 12, kind: "info", text: "Unit overlocked", detail: "Gate code suspended until paid", amount: 0, by: t.name === "Matthew Okafor" ? OPERATOR.name : "Zonera agent" });
      }
      if (t.name === "Grace Lindqvist") push({ date: addDays(due, 6), min: 8 * 60 + 40, kind: "info", text: "Late fee held", detail: "First decline in 23 months · card update link sent", amount: 0, by: "Zonera agent" });
      return;
    }

    // Paid.
    if (s.autopay && (story || i > 0)) {
      push({ date: due, min: autoMin(due), kind: "payment", text: "Autopay", ref: `RCPT-${receipt++}`, amount: -charged, method: `Autopay · ${card}` });
      return;
    }
    if (isFirst) {
      push({ date: due, min: out[0].min + 3, kind: "payment", text: "Payment at move-in", ref: `RCPT-${receipt++}`, amount: -(charged + 25), method: t.name === "Matthew Okafor" ? `Card · ${EXPIRED_CARD[t.name]}` : `Card · ${card}` });
      return;
    }
    // Manual payer: usually a few days in, sometimes late with a fee.
    const lateBias = t.name === "Matthew Okafor" ? 0.35 : t.name === "Dana Whitfield" ? 0.55 : 0.12;
    const x = r();
    const delay = x < lateBias ? 6 + Math.floor(r() * 7) : Math.floor(r() * 5);
    const payDate = addDays(due, Math.min(delay, daysBetween(due, TODAY)));
    let amt = charged;
    if (delay > 5 && payDate > addDays(due, 5)) {
      push({ date: addDays(due, 6), min: 1, kind: "fee", text: "Late fee", detail: "Rent more than 5 days late", amount: LATE_FEE });
      amt += LATE_FEE;
    }
    push({ date: payDate, min: payDate === TODAY ? 9 * 60 + 2 + Math.floor(r() * 30) : payMin(), kind: "payment", text: "Payment", ref: `RCPT-${receipt++}`, amount: -amt, method: manualMethod() });
  });

  // Prorated first month when the billing day differs from move-in.
  if (firstProrate) {
    const rent0 = baseAt(t.moveIn);
    const pr = +(((rent0 + prem) * firstProrate) / 30).toFixed(2);
    const m0 = out[0].min;
    out.splice(2, 0,
      { id: `${t.id}-p1`, date: t.moveIn, min: m0 + 2, kind: "rent", text: `Rent · prorated ${firstProrate} days`, ref: `INV-${t.moveIn.replace(/-/g, "").slice(2)}`, amount: pr },
      { id: `${t.id}-p2`, date: t.moveIn, min: m0 + 3, kind: "payment", text: "Payment at move-in", ref: `RCPT-${receipt++}`, amount: -(pr + 25), method: `Card · ${card}` },
    );
  } else if (s.autopay && story && cycles.length) {
    // Story autopay tenants: admin fee taken with the first autopay.
    const first = out.findIndex(e => e.kind === "payment");
    if (first >= 0 && out[first].date === t.moveIn) out[first] = { ...out[first], min: out[0].min + 3, text: "Payment at move-in", amount: out[first].amount - 25, method: `Card · ${card}` };
  }

  out.sort((a, b) => (a.date === b.date ? a.min - b.min : a.date < b.date ? -1 : 1));

  // Close any rounding gap so the history lands exactly on the starting balance.
  const sum = +out.reduce((a, e) => a + e.amount, 0).toFixed(2);
  const gap = +(s.balance - sum).toFixed(2);
  if (Math.abs(gap) >= 0.01) out.push({ id: `${t.id}-bal`, date: TODAY, min: 0, kind: gap > 0 ? "adjustment" : "credit", text: gap > 0 ? "Balance carried forward" : "Account credit", amount: gap });
  return out;
}

function baseLedger(t: Tenant) {
  let b = BASE.get(t.id);
  if (!b) {
    b = buildBase(t);
    BASE.set(t.id, b);
  }
  return b;
}

const LIVE = new Map<string, LedgerEntry[]>();
let liveSeq = 1;
let rcpt = 9100;

export function pushLedger(tenantId: string, e: Omit<LedgerEntry, "id" | "live">) {
  const list = LIVE.get(tenantId) ?? [];
  const entry = { ...e, id: `L${liveSeq++}`, live: true };
  list.push(entry);
  LIVE.set(tenantId, list);
  return entry;
}

/** Full ledger, oldest first, with the running balance after each line. */
export function ledgerFor(t: Tenant): (LedgerEntry & { balance: number })[] {
  const all = [...baseLedger(t), ...(LIVE.get(t.id) ?? [])];
  const sum = +all.reduce((a, e) => a + e.amount, 0).toFixed(2);
  const gap = +(t.balance - sum).toFixed(2);
  if (Math.abs(gap) >= 0.01) {
    all.push({
      id: `${t.id}-sync`,
      date: TODAY,
      min: clockMin(),
      kind: gap < 0 ? "payment" : "adjustment",
      text: gap < 0 ? "Payment" : "Adjustment",
      ref: gap < 0 ? "RCPT-AGENT" : undefined,
      amount: gap,
      method: gap < 0 ? "Recorded by Zonera agent" : undefined,
      by: "Zonera agent",
      live: true,
    });
  }
  let bal = 0;
  return all.map(e => {
    bal = +(bal + e.amount).toFixed(2);
    return { ...e, balance: bal };
  });
}

/** Unpaid charges, oldest first: what a payment would apply to. */
export function openCharges(t: Tenant) {
  const led = ledgerFor(t);
  let credit = -led.filter(e => e.amount < 0).reduce((a, e) => a + e.amount, 0);
  const open: { date: string; text: string; amount: number }[] = [];
  for (const e of led) {
    if (e.amount <= 0) continue;
    const covered = Math.min(credit, e.amount);
    credit -= covered;
    const left = +(e.amount - covered).toFixed(2);
    if (left > 0) open.push({ date: e.date, text: e.text, amount: left });
  }
  return open;
}

export function lifetime(t: Tenant) {
  const led = ledgerFor(t);
  return {
    paid: -led.filter(e => e.kind === "payment" || e.kind === "credit").reduce((a, e) => a + e.amount, 0),
    fees: led.filter(e => e.kind === "fee").reduce((a, e) => a + e.amount, 0),
    lateCount: led.filter(e => e.kind === "fee").length,
    payments: led.filter(e => e.kind === "payment").length,
  };
}

/** Month-by-month payment record for the last n billing cycles: days late when paid (null = open). */
export function paymentRecord(t: Tenant, n = 12) {
  const led = ledgerFor(t);
  const rents = led.filter(e => e.kind === "rent");
  const pays = led.filter(e => e.kind === "payment");
  return rents.slice(-n).map(r => {
    // The first payment after (or on) the due date that brings the balance to <= the pre-charge level.
    const idx = led.indexOf(r);
    const before = idx > 0 ? led[idx - 1].balance : 0;
    const settle = led.slice(idx + 1).find(e => e.kind === "payment" && e.balance <= Math.max(0, before) + 0.005) ?? (led.slice(idx + 1).some(e => e.kind === "payment" && e.date === r.date) ? pays.find(p => p.date === r.date) : undefined);
    return { due: r.date, late: settle ? Math.max(0, daysBetween(r.date, settle.date)) : null as number | null, method: settle?.method };
  });
}

// ---- recording money -----------------------------------------------------------------

export interface Txn {
  id: string;
  tenantId: string;
  name: string;
  unitId: string;
  date: string;
  min: number;
  kind: "payment" | "failed" | "refund" | "autopay";
  method: string;
  amount: number;
  ref?: string;
  live?: boolean;
}

/** Payments, declines and refunds across all tenants since `since` (ISO), newest first. */
export function transactions(since = addDays(TODAY, -30)): Txn[] {
  const out: Txn[] = [];
  for (const t of TENANTS) {
    for (const e of ledgerFor(t)) {
      if (e.date < since) continue;
      if (e.kind !== "payment" && e.kind !== "failed" && e.kind !== "refund") continue;
      const auto = e.method?.startsWith("Autopay") && e.kind === "payment";
      out.push({
        id: e.id,
        tenantId: t.id,
        name: t.name,
        unitId: t.unitIds[0] ?? "",
        date: e.date,
        min: e.min,
        kind: e.kind === "failed" ? "failed" : e.kind === "refund" ? "refund" : auto ? "autopay" : "payment",
        method: e.method ?? "",
        amount: e.kind === "refund" ? -e.amount : -e.amount,
        ref: e.ref,
        live: e.live,
      });
    }
  }
  return out.sort((a, b) => (a.date === b.date ? b.min - a.min : a.date < b.date ? 1 : -1));
}

export interface PaymentResult { receipt: string; unlocked: string[]; balance: number }

/**
 * Record a payment against a tenant: ledger line, balance, days late, overlock, activity feed.
 * Shared with agent mode ("Matthew came in and paid $240 cash").
 */
export function recordPayment(t: Tenant, amount: number, method: string, opts: { unlock?: boolean; by?: string; note?: string; silent?: boolean } = {}): PaymentResult {
  const receipt = `RCPT-${rcpt++}`;
  pushLedger(t.id, { date: TODAY, min: clockMin(), kind: "payment", text: "Payment", ref: receipt, amount: -amount, method, by: opts.by ?? OPERATOR.name, detail: opts.note });
  t.balance = +(t.balance - amount).toFixed(2);
  const unlocked: string[] = [];
  if (t.balance <= 0.005) {
    t.daysLate = 0;
    for (const id of t.unitIds) {
      const u = UNIT_BY_ID.get(id);
      if (!u) continue;
      if (u.status === "delinquent" || (u.status === "overlocked" && opts.unlock !== false)) {
        if (u.status === "overlocked") unlocked.push(id);
        u.status = "occupied";
      }
    }
    if (unlocked.length) pushLedger(t.id, { date: TODAY, min: clockMin(), kind: "info", text: "Overlock removed", detail: "Gate code restored", amount: 0, by: opts.by ?? OPERATOR.name });
  }
  t.lastContact = `Oct 2 · Payment, ${method.split(" ·")[0].toLowerCase()}`;
  if (!opts.silent) {
    commit({
      kind: "payment",
      text: `${fmtMoney(amount, true)} ${method.split(" ·")[0].toLowerCase()} · ${t.unitIds[0]} ${t.name}${unlocked.length ? " — overlock removed" : ""}`,
      who: opts.by ?? OPERATOR.name,
    });
  }
  return { receipt, unlocked, balance: t.balance };
}

/** Refund money to a tenant (e.g. a duplicate autopay). Net-zero pair on the ledger. */
export function recordRefund(t: Tenant, amount: number, reason: string, method: string) {
  pushLedger(t.id, { date: "2026-09-30", min: 6 * 60 + 41, kind: "payment", text: "Autopay · duplicate charge", ref: `RCPT-${rcpt++}`, amount: -amount, method });
  pushLedger(t.id, { date: TODAY, min: clockMin(), kind: "refund", text: `Refund · ${reason}`, ref: `RFND-${rcpt++}`, amount, method, by: OPERATOR.name });
  commit({ kind: "payment", text: `Refunded ${fmtMoney(amount, true)} to ${t.name} · ${reason}`, who: OPERATOR.name });
}

export function waiveFee(t: Tenant, amount = LATE_FEE) {
  pushLedger(t.id, { date: TODAY, min: clockMin(), kind: "credit", text: "Late fee waived", amount: -amount, by: OPERATOR.name });
  t.balance = +(t.balance - amount).toFixed(2);
  commit({ kind: "payment", text: `Waived a ${fmtMoney(amount)} late fee for ${t.name}`, who: OPERATOR.name });
}

function fmtMoney(n: number, cents = false) {
  return (n < 0 ? "−" : "") + "$" + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });
}

export function tenantById(id: string) {
  return TENANT_BY_ID.get(id);
}

// ---- autopay failures & update links ------------------------------------------------------

/** Tenants whose autopay failed and are still open. Same set the Overview counts. */
export function failedAutopay() {
  return TENANTS.filter(t => t.autopay && t.daysLate > 0);
}

/** Tenant ids that have been sent a card-update link (and when). */
export const UPDATE_LINKS = new Map<string, string>();
