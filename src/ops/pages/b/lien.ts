import { TENANTS, type Tenant } from "../../../data/tenants";
import { UNIT_BY_ID } from "../../../data/facility";
import { TODAY, addDays, shortDate } from "../../../data/ledger";

// Lien pipeline state for the delinquency board. Stages follow the California
// Self-Service Storage Facility Act: overlock → preliminary lien notice (§21703)
// → notice of lien sale (§21705) → public sale (§21707).

export type Stage = "pastdue" | "overlocked" | "prelien" | "notice" | "auction";
export const STAGES: { id: Stage; label: string; hint: string }[] = [
  { id: "pastdue", label: "Past due", hint: "Reminders, late fee on day 6" },
  { id: "overlocked", label: "Overlocked", hint: "Gate code suspended" },
  { id: "prelien", label: "Pre-lien notice", hint: "§21703 · 14 days to pay" },
  { id: "notice", label: "Lien notice sent", hint: "§21705 · notice of sale" },
  { id: "auction", label: "Auction scheduled", hint: "§21707 · online sale" },
];

export interface LienState { stage: Stage; sent?: string; draft?: boolean; sale?: string }
export const LIEN = new Map<string, LienState>();

const locked = (t: Tenant) => t.unitIds.some(id => UNIT_BY_ID.get(id)?.status === "overlocked");

(function seed() {
  const late = TENANTS.filter(t => t.daysLate > 0);
  const overl = late.filter(t => locked(t) && t.name !== "Dana Whitfield" && t.name !== "Matthew Okafor").sort((a, b) => b.daysLate - a.daysLate);
  const dana = late.find(t => t.name === "Dana Whitfield");
  if (dana) LIEN.set(dana.id, { stage: "prelien", draft: true });
  if (overl[0]) LIEN.set(overl[0].id, { stage: "auction", sent: addDays(TODAY, -22), sale: "2026-10-22" });
  if (overl[1]) LIEN.set(overl[1].id, { stage: "notice", sent: addDays(TODAY, -8) });
  if (overl[2] && overl[2].daysLate > 40) LIEN.set(overl[2].id, { stage: "prelien", sent: addDays(TODAY, -5) });
})();

export function stageOf(t: Tenant): Stage {
  const s = LIEN.get(t.id);
  if (s) return s.stage;
  return locked(t) ? "overlocked" : "pastdue";
}

export function nextLine(t: Tenant): { text: string; tone?: "warn" | "bad" | "accent" | "ok" } {
  const s = LIEN.get(t.id);
  const st = stageOf(t);
  const due = addDays(TODAY, -t.daysLate);
  if (t.name === "Matthew Okafor" && st === "overlocked") return { text: "Promised to pay today", tone: "ok" };
  if (st === "pastdue") return t.daysLate >= 15 ? { text: "Overlock eligible now", tone: "warn" } : { text: `Overlock eligible ${shortDate(addDays(due, 15))}` };
  if (st === "overlocked") return t.daysLate >= 14 ? { text: "Eligible for pre-lien notice", tone: "warn" } : { text: `Pre-lien eligible ${shortDate(addDays(due, 14))}` };
  if (st === "prelien") return s?.draft ? { text: "Draft ready · needs approval", tone: "accent" } : { text: `Sent ${shortDate(s!.sent!)} · cure by ${shortDate(addDays(s!.sent!, 14))}` };
  if (st === "notice") return { text: `Sale can be set after ${shortDate(addDays(s!.sent!, 14))}` };
  return { text: `Online sale ${shortDate(s!.sale!)} · 10:00 am`, tone: "bad" };
}

export const ADVANCE_LABEL: Record<Stage, string> = {
  pastdue: "Overlock",
  overlocked: "Send pre-lien",
  prelien: "Send notice of sale",
  notice: "Schedule sale",
  auction: "View sale",
};
