import { LEADS, TENANTS, type Tenant } from "../data/tenants";
import { UNIT_BY_ID } from "../data/facility";
import type { Ctx } from "./engine";
import { SEGMENTS, personFromLead, personFromTenant, type Parsed, type PersonRef, type Segment } from "./parse";
import { isoAdd, money, sizeLabel, TODAY_ISO } from "./data";
import { fmt } from "../state/store";
import type { Candidate, Recipient } from "./widgets/core/types";

// Slot resolution helpers. A skill calls these at the point in its script where
// it needs a value. If the parser already filled it unambiguously they return
// immediately; otherwise they ask exactly one question with the right widget
// (Disambiguate for ambiguous names, QuickReplies for a missing choice,
// RecipientSet for a missing audience). In movie mode they pick the top option.

// ---------------------------------------------------------------- people

export function tenantSub(t: Tenant) {
  const u = UNIT_BY_ID.get(t.unitIds[0]);
  const bits = [t.unitIds.join(", "), u ? sizeLabel(u.size) : "", t.daysLate ? `${t.daysLate} days late` : t.autopay ? "Autopay" : "Paid up"];
  return bits.filter(Boolean).join(" · ");
}

export function tenantCandidate(t: Tenant, badge?: string): Candidate {
  return { id: t.id, title: t.name, sub: tenantSub(t), meta: t.balance > 0 ? `owes ${money(t.balance)}` : "Paid up", metaTone: t.balance > 0 ? "warn" : undefined, avatar: t.name, badge };
}

/**
 * Resolve one tenant from the prompt. `prefer` scores candidates (higher is a
 * better match) so the likely one is badged and listed first; `why` explains it.
 */
export async function needTenant(
  ctx: Ctx,
  q: Parsed,
  opts: { prefer?: (t: Tenant) => number; title?: (said: string, n: number) => string; filter?: (t: Tenant) => boolean; search?: boolean } = {},
): Promise<Tenant> {
  const named = q.people.filter(p => p.kind === "tenant").map(p => p.tenant!);
  const amb = q.ambiguous.find(a => a.candidates.some(c => c.kind === "tenant"));
  if (named.length === 1 && !amb) {
    if (opts.search !== false) await ctx.tool("tenants.search", { query: named[0].name }, () => ({ matches: 1, results: [{ id: named[0].id, name: named[0].name, unit: named[0].unitIds[0] }] }), 420);
    return named[0];
  }
  const said = amb?.said ?? named[0]?.first ?? "";
  let list: Tenant[] = amb ? amb.candidates.filter(c => c.kind === "tenant").map(c => c.tenant!) : named;
  if (!list.length) list = TENANTS.filter(opts.filter ?? (t => t.balance > 0)).slice(0, 5);
  const score = (t: Tenant) => opts.prefer?.(t) ?? 0;
  list = [...list].sort((a, b) => score(b) - score(a));
  if (opts.search !== false)
    await ctx.tool("tenants.search", { query: said || "balance > 0" }, () => ({ matches: list.length, results: list.map(t => ({ id: t.id, name: t.name, unit: t.unitIds[0], balance: t.balance })) }), 520);
  const top = list[0];
  const clear = list.length > 1 && score(top) > score(list[1]);
  const id = await ctx.ask(
    "disambiguate",
    {
      title: opts.title?.(said, list.length) ?? (said ? `Which ${said}?` : "Which tenant?"),
      meta: `${list.length} match${list.length === 1 ? "" : "es"}`,
      options: list.map((t, i) => tenantCandidate(t, i === 0 && clear ? "Likely match" : undefined)),
    },
    ["opt:" + top.id],
  );
  return TENANTS.find(t => t.id === id)!;
}

// ---------------------------------------------------------------- recipients

export function dueDate(t: Tenant) {
  if (t.daysLate > 0) return fmt.short(isoAdd(TODAY_ISO, -t.daysLate));
  const day = Math.min(28, +t.moveIn.slice(8, 10));
  return fmt.short(new Date(2026, day <= 2 ? 10 : 9, day, 12).toISOString().slice(0, 10));
}

export function toRecipient(p: PersonRef): Recipient {
  const t = p.tenant;
  const lead = p.kind === "lead" ? LEADS.find(l => l.name === p.id) : undefined;
  return {
    id: p.id,
    name: p.name,
    sub: t ? t.unitIds.join(", ") : lead ? `Reservation · ${sizeLabel(lead.size)}` : p.unit,
    phone: p.phone,
    email: p.email,
    data: {
      first: p.first,
      unit: t ? t.unitIds.join(", ") : p.unit ?? "",
      size: lead ? sizeLabel(lead.size) : t ? sizeLabel(UNIT_BY_ID.get(t.unitIds[0])?.size ?? "") : "",
      balance: t ? money(t.balance) : "$0.00",
      due_date: t ? dueDate(t) : "",
      code: t ? t.gateCode : "",
      moving: lead?.moving ?? "",
      link: `zonera.co/p/${(t?.id ?? p.id).replace(/\s+/g, "").toLowerCase().slice(-6)}`,
    },
  };
}

export const tenantRecipient = (t: Tenant) => toRecipient(personFromTenant(t));

export function segmentRecipients(s: Segment) {
  return s.resolve().map(toRecipient);
}

/** Common audiences offered as one-click rows in RecipientSet. */
export function commonSegments() {
  return [SEGMENTS.pastDue(), SEGMENTS.autopayFailed(), SEGMENTS.leads(), SEGMENTS.size("10x20"), SEGMENTS.all()].map(s => ({ id: s.id, label: s.label, people: segmentRecipients(s) }));
}

export function pool(): Recipient[] {
  return [...TENANTS.map(personFromTenant), ...LEADS.map(personFromLead)].map(toRecipient);
}

/**
 * Resolve the audience for a message. Named people and segments come from the
 * prompt. If nobody is named, or the count doesn't match ("these 4 people" with
 * 3 names), or the audience is a segment worth reviewing, ask with RecipientSet.
 */
export async function needRecipients(ctx: Ctx, q: Parsed, channel: "sms" | "email", opts: { review?: boolean } = {}): Promise<Recipient[]> {
  // Ambiguous first names: take the best guess (a lead if it's a reservation ask, else a tenant with a balance).
  const extra: PersonRef[] = q.ambiguous.map(a => a.candidates.find(c => c.kind === "lead") ?? a.candidates.sort((x, y) => (y.tenant?.balance ?? 0) - (x.tenant?.balance ?? 0))[0]);
  const named = [...q.people, ...extra].map(toRecipient);
  const fromSeg = q.segment ? segmentRecipients(q.segment) : [];
  const all = [...named, ...fromSeg.filter(r => !named.some(n => n.id === r.id))];
  const countOff = q.count !== undefined && q.count !== all.length && !q.segment;
  if (all.length && !countOff && !opts.review && !q.segment) return all;
  return ctx.ask(
    "recipients",
    { channel, selected: all, segments: commonSegments(), pool: pool() },
    all.length ? ["submit"] : ["seg:past-due", "submit"],
  );
}
