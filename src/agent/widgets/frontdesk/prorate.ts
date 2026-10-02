// Proration math for move-ins, move-outs, transfers and second units.
//
// Pure functions, shared by the Proration widget (which recomputes live when
// the date or billing mode changes) and by the skills (which need the same
// numbers for the receipt and the ledger). Day counts are real calendar days:
// a cycle that starts Oct 1 has 31 days, one that starts Sep 8 has 30.

export interface ProLine {
  id: string;
  label: string;
  /** Recurring monthly amount, prorated over the period. */
  monthly?: number;
  /** One-time amount, never prorated. */
  amount?: number;
  /** Credit back (unused days on the old unit, prepaid rent). */
  credit?: boolean;
  note?: string;
  /** Show the line but charge nothing ("Administrative fee · waived"). */
  waived?: boolean;
}

export interface ProSpec {
  /** start: a new charge from `date` · end: credit unused days after `date` · change: swap one charge for another from `date`. */
  mode: "start" | "end" | "change";
  date: string;
  /** Day of the month rent is billed. For a fresh move-in it follows `billing`. */
  billingDay: number;
  billing?: "anniversary" | "first";
  lines: ProLine[];
  /** end: rent is prepaid through this date (inclusive). Defaults to the end of the current cycle. */
  paidThrough?: string;
  /** Recurring amount that keeps billing alongside the new lines (the tenant's existing rent). */
  nextBase?: number;
}

export interface ProRow {
  id: string;
  label: string;
  formula: string;
  span?: string;
  amount: number;
  kind: "charge" | "credit" | "fee" | "waived";
}

export interface ProResult {
  rows: ProRow[];
  total: number; // > 0 due today · < 0 refund
  period: { from: string; to: string; days: number; cycleDays: number };
  next?: { date: string; amount: number };
}

// ---- dates (UTC so time zones never shift a day)

const D = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const ISO = (d: Date) => d.toISOString().slice(0, 10);
export const addDaysISO = (iso: string, n: number) => {
  const d = D(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return ISO(d);
};
export const daysBetweenISO = (a: string, b: string) => Math.round((D(b).getTime() - D(a).getTime()) / 86400000);
export const daysInMonth = (y: number, m0: number) => new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const shortISO = (iso: string) => `${MON[+iso.slice(5, 7) - 1]} ${+iso.slice(8, 10)}`;
export const weekdayISO = (iso: string) => WK[D(iso).getUTCDay()];
export const ordinal = (n: number) => n + (n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th");

function billDateIn(y: number, m0: number, day: number) {
  const yy = y + Math.floor(m0 / 12);
  const mm = ((m0 % 12) + 12) % 12;
  return ISO(new Date(Date.UTC(yy, mm, Math.min(day, daysInMonth(yy, mm)))));
}

/** The billing cycle that contains `iso` for a given billing day. */
export function cycleFor(iso: string, billingDay: number) {
  const d = D(iso);
  const y = d.getUTCFullYear();
  const m0 = d.getUTCMonth();
  let start = billDateIn(y, m0, billingDay);
  let k = 0;
  if (start > iso) {
    start = billDateIn(y, m0 - 1, billingDay);
    k = -1;
  }
  const next = billDateIn(y, m0 + k + 1, billingDay);
  return { start, end: addDaysISO(next, -1), next, days: daysBetweenISO(start, next) };
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const usd = (n: number) => "$" + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function effectiveBillingDay(spec: ProSpec) {
  if (spec.mode === "start" && spec.billing) return spec.billing === "first" ? 1 : +spec.date.slice(8, 10);
  return spec.billingDay;
}

export function prorate(spec: ProSpec): ProResult {
  const bd = effectiveBillingDay(spec);
  const cyc = cycleFor(spec.date, bd);
  const rows: ProRow[] = [];
  const recurring = spec.lines.filter(l => l.monthly !== undefined);

  for (const l of spec.lines.filter(l => l.amount !== undefined)) {
    rows.push({ id: l.id, label: l.label, formula: l.waived ? l.note ?? "Waived" : l.note ?? "One-time", amount: l.waived ? 0 : r2(l.amount! * (l.credit ? -1 : 1)), kind: l.waived ? "waived" : l.credit ? "credit" : "fee" });
  }

  if (spec.mode === "end") {
    const from = addDaysISO(spec.date, 1);
    const through = spec.paidThrough ?? cyc.end;
    const inCycleTo = through < cyc.end ? through : cyc.end;
    const unused = Math.max(0, daysBetweenISO(from, addDaysISO(inCycleTo, 1)));
    // Whole months prepaid beyond the current cycle.
    let extra = 0;
    let c = cyc;
    while (through > c.end) {
      c = cycleFor(c.next, bd);
      if (through >= c.end) extra++;
      else break;
    }
    for (const l of recurring) {
      const part = r2((l.monthly! * unused) / cyc.days);
      const amt = r2(part + l.monthly! * extra);
      rows.push({
        id: l.id,
        label: l.label,
        formula: `${unused} of ${cyc.days} days × ${usd(l.monthly!)}${extra ? ` + ${extra} prepaid month${extra > 1 ? "s" : ""}` : ""}`,
        span: unused ? `${shortISO(from)} – ${shortISO(through)}` : "No unused days",
        amount: -amt,
        kind: "credit",
      });
    }
    const total = r2(rows.reduce((s, r) => s + r.amount, 0));
    return { rows, total, period: { from, to: through, days: unused, cycleDays: cyc.days } };
  }

  // start / change: from the effective date to the end of the cycle, inclusive.
  const days = daysBetweenISO(spec.date, cyc.next);
  const full = days === cyc.days;
  for (const l of recurring) {
    const amt = full ? l.monthly! : r2((l.monthly! * days) / cyc.days);
    rows.push({
      id: l.id,
      label: l.label,
      formula: full ? `Full month × ${usd(l.monthly!)}` : `${days} of ${cyc.days} days × ${usd(l.monthly!)}`,
      span: `${shortISO(spec.date)} – ${shortISO(cyc.end)}`,
      amount: l.credit ? -amt : amt,
      kind: l.credit ? "credit" : "charge",
    });
  }
  const total = r2(rows.reduce((s, r) => s + r.amount, 0));
  const nextAmt = r2(recurring.filter(l => !l.credit).reduce((s, l) => s + l.monthly!, 0) + (spec.nextBase ?? 0));
  return { rows, total, period: { from: spec.date, to: cyc.end, days, cycleDays: cyc.days }, next: { date: cyc.next, amount: nextAmt } };
}
