import { ADMIN_FEE, PROTECTION } from "../data/catalog";
import { UNIT_BY_ID } from "../data/facility";
import type { Order } from "./order";

// Move-in pricing. Every move-in date is in October 2026 (31 days): rent and
// protection for the first month are prorated by the days left in October,
// counting the move-in day. Prepay covers the next six full months at 10% off rent.

export const OCT_DAYS = 31;
export const PREPAY_MONTHS = 6;
export const PREPAY_OFF = 0.1;

export const r2 = (n: number) => Math.round(n * 100) / 100;
export const money = (n: number) => (n < 0 ? "−" : "") + "$" + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const money0 = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

export interface Line {
  label: string;
  note?: string;
  amount: number;
  tone?: "discount";
}

export interface Quote {
  rate: number;
  days: number;
  protection: number; // monthly protection price
  protectionLabel: string;
  lines: Line[];
  dueToday: number;
  monthly: number; // recurring after the paid-through date
  nextCharge: string; // "Nov 1"
  paidThrough: string;
}

export function protectionPrice(o: Pick<Order, "protection">) {
  if (o.protection === "own") return { price: 0, label: "Your own policy" };
  const p = PROTECTION.find(p => p.id === o.protection)!;
  return { price: p.price, label: `${p.label} protection, ${p.cover}` };
}

export function quote(o: Pick<Order, "unitId" | "moveIn" | "protection" | "plan">): Quote {
  const u = UNIT_BY_ID.get(o.unitId);
  const rate = u?.rate ?? 189;
  const day = Number(o.moveIn.slice(8, 10)) || 2;
  const days = OCT_DAYS - day + 1;
  const frac = days / OCT_DAYS;
  const prot = protectionPrice(o);
  const range = day === OCT_DAYS ? "Oct 31" : `Oct ${day}–31`;
  const lines: Line[] = [];

  const rentPro = r2(rate * frac);
  lines.push({ label: `Rent, ${range}`, note: `${days} of ${OCT_DAYS} days`, amount: rentPro });
  if (o.plan === "prepay") {
    const months = r2(rate * PREPAY_MONTHS);
    lines.push({ label: "Rent, Nov–Apr", note: `${PREPAY_MONTHS} months`, amount: months });
    lines.push({ label: "Prepay discount", note: "10% off rent", amount: -r2((rentPro + months) * PREPAY_OFF), tone: "discount" });
  }
  if (prot.price) {
    const pp = r2(prot.price * frac);
    lines.push({
      label: prot.label.replace(" protection", ""),
      note: o.plan === "prepay" ? `Oct prorated + ${PREPAY_MONTHS} months` : `${days} of ${OCT_DAYS} days`,
      amount: o.plan === "prepay" ? r2(pp + prot.price * PREPAY_MONTHS) : pp,
    });
  } else {
    lines.push({ label: "Protection", note: "Your own policy", amount: 0 });
  }
  lines.push({ label: "Admin fee", note: "One time", amount: ADMIN_FEE });
  lines.push({ label: "Tax", amount: 0 });
  const dueToday = r2(lines.reduce((s, l) => s + l.amount, 0));
  return {
    rate,
    days,
    protection: prot.price,
    protectionLabel: prot.label,
    lines,
    dueToday,
    monthly: rate + prot.price,
    nextCharge: o.plan === "prepay" ? "May 1" : "Nov 1",
    paidThrough: o.plan === "prepay" ? "Apr 30, 2027" : "Oct 31",
  };
}
