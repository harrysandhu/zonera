import type { Ctx } from "../../engine";
import type { Parsed } from "../../parse";
import { needTenant } from "../../need";
import { tenantForUnit, type Tenant } from "../../../data/tenants";
import { pushLedger, clockMin, TODAY, type LedgerEntry } from "../../../data/ledger";
import type { Comm } from "../../../data/comms";

// Helpers shared by the money and collections skills.

/**
 * Resolve one tenant from the prompt.
 * - A unit id ("the double charge on B-122") names that unit's tenant.
 * - An ambiguous first name ("Grace") resolves without a question when exactly
 *   one candidate `fits` the ask (only one Grace has a duplicate charge).
 * - Otherwise falls through to needTenant (one Disambiguate question).
 */
export async function resolveTenant(
  ctx: Ctx,
  q: Parsed,
  opts: { fits?: (t: Tenant) => boolean; why?: string; fallback?: Tenant; title?: (said: string, n: number) => string } = {},
): Promise<Tenant> {
  const named = q.people.filter(p => p.kind === "tenant");
  const amb = q.ambiguous.find(a => a.candidates.some(c => c.kind === "tenant"));
  if (!named.length && !amb && q.units.length) {
    const t = tenantForUnit(q.units[0]);
    if (t) {
      await ctx.tool("tenants.search", { unit: q.units[0] }, () => ({ matches: 1, results: [{ id: t.id, name: t.name, unit: q.units[0] }] }), 420);
      return t;
    }
  }
  if (!named.length && amb && opts.fits) {
    const cands = amb.candidates.filter(c => c.kind === "tenant").map(c => c.tenant!);
    const fit = cands.filter(opts.fits);
    if (fit.length === 1) {
      await ctx.tool(
        "tenants.search",
        { query: amb.said },
        () => ({ matches: cands.length, results: cands.map(t => ({ id: t.id, name: t.name, unit: t.unitIds[0], ...(t === fit[0] ? { match: opts.why ?? "best match" } : {}) })) }),
        520,
      );
      return fit[0];
    }
  }
  if (!named.length && !amb && opts.fallback) {
    const t = opts.fallback;
    await ctx.tool("tenants.search", { query: opts.why ?? "most urgent" }, () => ({ matches: 1, results: [{ id: t.id, name: t.name, unit: t.unitIds[0] }] }), 420);
    return t;
  }
  return needTenant(ctx, q, { prefer: t => (opts.fits?.(t) ? 10 : 0) + (t.balance > 0 ? 1 : 0), title: opts.title });
}

/** Post a ledger line that an undo can neutralise in place (ledgers are append-only). */
export function post(tenantId: string, e: Omit<LedgerEntry, "id" | "live" | "date" | "min"> & { date?: string; min?: number }) {
  const entry = pushLedger(tenantId, { date: TODAY, min: clockMin(), ...e });
  return {
    entry,
    void(text: string, detail?: string) {
      Object.assign(entry, { amount: 0, kind: "info", text, detail, ref: undefined, method: undefined });
    },
  };
}

/** Mark sent messages as recalled when their action is undone. */
export function recall(comms: Comm[], status: string) {
  for (const c of comms) c.status = status;
}

export const sum = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) * 100) / 100;
export const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

/** "8:28 am" from minutes after midnight. */
export function hm(min: number) {
  const h = Math.floor(min / 60);
  return `${h % 12 || 12}:${String(min % 60).padStart(2, "0")} ${h >= 12 ? "pm" : "am"}`;
}

/** "Olivia", "Olivia and Nora", "Olivia, Nora and Grace". */
export function andList(xs: string[]) {
  return xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
}
