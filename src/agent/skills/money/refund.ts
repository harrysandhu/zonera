import { defineSkill } from "../../engine";
import { kw } from "../../parse";
import { money, round2 } from "../../data";
import { clock, fmt } from "../../../state/store";
import type { Tenant } from "../../../data/tenants";
import { ledgerFor as fullLedger, addDays } from "../../../data/ledger";
import type { LedgerRow } from "../../widgets/core/types";
import { hm, post, resolveTenant } from "./util";

// #15 Refund a duplicate charge. The processor captured an autopay twice (a
// retry after a gateway timeout); only one capture posted to the ledger. Refund
// the extra capture to the card, post the pair so the ledger nets to zero.
//
//   "Refund Grace's duplicate charge"      → 2 Graces, only Lindqvist has a duplicate → ledger → diff → receipt
//   "Refund the double charge on B-122"    → Matthew Alvarez, charged at 6:02 am and again at 9:17 am today

interface Dup {
  date: string; // ISO day of both captures
  first: number; // minutes after midnight, the capture that posted
  second: number; // the duplicate
  amount: number;
  card: string;
  charge: string; // processor id of the duplicate
  cause: string;
}

/** Duplicate captures the processor reports for a tenant (story tenants only). */
function duplicateFor(t: Tenant): Dup | undefined {
  if (t.name === "Grace Lindqvist") return { date: "2026-08-23", first: 8 * 60 + 28, second: 8 * 60 + 29, amount: 219, card: "Visa •• 0077", charge: "ch_3PxK2vLq8d0077b", cause: "the processor retried after a timeout" };
  if (t.name === "Matthew Alvarez") return { date: "2026-10-02", first: 6 * 60 + 2, second: 9 * 60 + 17, amount: t.rent, card: t.card ?? "Visa •• 4242", charge: "ch_3QA9mRw4242c917", cause: "the 6:02 am charge timed out at the gateway and the 9:17 am retry charged again" };
  return undefined;
}
const refunded = new Map<string, { at: string; actionId: string }>();
const short = (iso: string) => fmt.short(iso);

/** The billing cycle with the duplicate and what followed, reconciled to the tenant's balance. */
function rowsFor(t: Tenant, d: Dup): LedgerRow[] {
  const led = fullLedger(t).filter(e => e.date >= addDays(d.date, -1) && e.kind !== "info" && e.kind !== "admin");
  const rows: LedgerRow[] = [];
  let bal = round2(fullLedger(t).filter(e => e.date < addDays(d.date, -1)).reduce((a, e) => a + e.amount, 0));
  for (const e of led) {
    if (e.kind === "protection") continue; // folded into rent
    bal = round2(bal + e.amount);
    if (e.kind === "rent") {
      const prem = led.find(x => x.kind === "protection" && x.date === e.date)?.amount ?? 0;
      bal = round2(bal + prem);
      rows.push({ date: e.date, desc: e.text, charge: round2(e.amount + prem), balance: bal });
    } else if (e.kind === "failed") {
      rows.push({ date: e.date, desc: `${e.text} · ${e.detail ?? "declined"}`, balance: bal });
    } else if (e.kind === "payment" && !e.live && e.date === d.date) {
      rows.push({ date: e.date, desc: `Autopay · ${d.card} · ${hm(d.first)}`, payment: -e.amount, balance: bal });
      rows.push({ date: d.date, desc: `Autopay retry · ${d.card} · ${hm(d.second)} · not applied`, payment: d.amount, balance: bal, flag: "dup" });
    } else {
      const desc = `${e.text}${e.method && e.kind === "payment" ? " · " + e.method : ""}`;
      rows.push(e.amount < 0 ? { date: e.date, desc, payment: -e.amount, balance: bal } : { date: e.date, desc, charge: e.amount, balance: bal, flag: e.kind === "fee" ? "late" : undefined });
    }
  }
  return rows;
}

export default defineSkill<{ who: string }>({
  id: "money.refund",
  n: 15,
  category: "money",
  title: "Refund a charge",
  featured: true,
  examples: ["Refund Grace's duplicate charge", "Refund the double charge on B-122", "Matthew Alvarez was charged twice, refund him"],
  slots: {
    who: { label: "tenant", fill: q => q.people.find(p => p.kind === "tenant")?.name ?? q.ambiguous[0]?.said ?? q.units[0] },
  },
  match: q => kw(q, [[/\brefund\w*/, 4], [/\b(duplicate|double|twice)\b/, 2], [/\bcharged (him |her |them )?twice\b|\bdouble[- ]charged?\b/, 2]]),

  async run(ctx, { q }) {
    await ctx.think("Match the processor's captures against the ledger, find the extra one, refund it to the same card and post the pair so the ledger nets to zero.", 1200);
    const t = await resolveTenant(ctx, q, { fits: x => !!duplicateFor(x), why: "duplicate capture on file", title: (said, n) => (said ? `${n} tenants named ${said}. Whose charge?` : "Whose charge should I refund?") });
    const unitId = t.unitIds[0];
    ctx.title(`Refund · ${t.name}`);
    ctx.focus({ tenants: [t.id], selected: unitId, units: [] });

    const d = duplicateFor(t);
    await ctx.tools([
      { name: "ledger.get", args: { tenant_id: t.id, since: d ? addDays(d.date, -1) : "2026-07-01" }, result: () => ({ balance: t.balance, autopay: t.autopay, card: t.card ?? null }), ms: 560 },
      {
        name: "payments.charges.list",
        args: { tenant_id: t.id, card: t.card ?? null, days: 90 },
        result: () =>
          d
            ? { captures: [{ id: d.charge.replace(/.{4}$/, "a01f"), at: `${d.date} ${hm(d.first)}`, amount: d.amount, posted: true }, { id: d.charge, at: `${d.date} ${hm(d.second)}`, amount: d.amount, posted: false, note: "retry after gateway timeout" }], duplicates: 1 }
            : { captures: t.autopay ? 3 : 0, duplicates: 0 },
        ms: 720,
      },
    ]);

    if (!d) {
      await ctx.say(`No duplicate charges on **${t.name}**'s ${t.card ?? "account"} in the last 90 days. Every capture matches a ledger line.`);
      ctx.suggest(["Fix last night's autopay failures", "Show delinquency aging", "What needs my attention today?"]);
      return;
    }
    const prior = refunded.get(t.id);
    if (prior) {
      await ctx.say(`Already refunded at ${prior.at}: ${money(d.amount)} to ${d.card}. It arrives in 5–10 business days.`);
      ctx.suggest(["Fix last night's autopay failures", "Show delinquency aging", "What needs my attention today?"]);
      return;
    }

    ctx.show("ledger", { title: `Ledger · ${t.name}`, meta: `${unitId} · ${d.card}`, rows: rowsFor(t, d) });
    // Grace's 0077 card expired; she may have updated it on today's call.
    const expired = t.card !== d.card || /expired/i.test(t.notes ?? "");
    await ctx.say(
      `${t.first} was charged **${money(d.amount)} twice** on ${short(d.date)}, at ${hm(d.first)} and ${hm(d.second)}; ${d.cause}. ` +
        `Only the first charge reached the ledger, so the second is money we're holding with nothing to apply it to.` +
        (t.balance > 0 ? ` Separately, ${money(t.balance)} is still open for the current period.` : ""),
    );

    const ans = await ctx.ask(
      "diff",
      {
        title: `Refund · ${t.name}`,
        meta: `${unitId} · ${d.charge.slice(0, 12)}…`,
        rows: [
          { field: "Refund", before: "—", after: `${money(d.amount)} to ${d.card}` },
          { field: "Reason", before: "—", after: `Duplicate charge · ${short(d.date)}, ${hm(d.second)}` },
          { field: "Ledger", before: "Capture not posted", after: "Capture + refund · nets $0.00" },
          { field: "Balance", before: money(t.balance), after: `${money(t.balance)} · unchanged` },
          { field: "Receipt", before: "—", after: `Texted to ${t.phone}` },
        ],
        note: expired
          ? `The card ending ${d.card.slice(-4)} expired in September. Visa routes refunds to the reissued card, so it still reaches ${t.first} in 5–10 business days.`
          : "Arrives in 5–10 business days. Within your $500 refund limit.",
        cta: `Refund ${money(d.amount)}`,
      },
      ["wait:900", "submit"],
    );
    if (ans !== "approve") {
      await ctx.say("Cancelled. Nothing was refunded.");
      ctx.suggest(["Fix last night's autopay failures", "Show delinquency aging"]);
      return;
    }

    const refundId = "re_3QB" + t.id.slice(-3) + "x7Lm";
    await ctx.tool("payments.refund", { charge: d.charge, amount: d.amount, reason: "duplicate" }, { refund: refundId, status: "pending", arrives: "Oct 9 – Oct 16" }, 820);
    let lines: ReturnType<typeof post>[] = [];
    const actionId = ctx.effect({
      kind: "payment",
      text: `Refunded ${money(d.amount)} duplicate charge to ${t.name} · ${d.card}`,
      link: { label: "Open profile", route: "ops/tenants/" + t.id },
      run: () => {
        lines = [
          post(t.id, { date: d.date, min: d.second, kind: "payment", text: "Autopay · duplicate capture", detail: "Processor retry, not applied to rent", ref: d.charge.slice(0, 14), amount: -d.amount, method: `Autopay · ${d.card}` }),
          post(t.id, { kind: "refund", text: "Refund · duplicate charge", detail: `To ${d.card} · arrives Oct 9 – Oct 16`, ref: `RFND-${refundId.slice(-6)}`, amount: d.amount, method: d.card, by: "Zonera agent" }),
        ];
        t.lastContact = "Oct 2 · Refund receipt, SMS";
      },
      undo: () => {
        lines[0]?.void("Duplicate capture · refund cancelled", "Refund cancelled before it settled");
        lines[1]?.void("Refund cancelled", "Cancelled before it settled");
        refunded.delete(t.id);
      },
    });
    refunded.set(t.id, { at: clock(), actionId });
    await ctx.tool("sms.send", { to: t.phone, template: "refund_receipt", amount: d.amount }, { status: "delivered" }, 560);

    ctx.show("receipt", {
      title: "Refund",
      no: `RF-20261002-${refundId.slice(-4).toUpperCase()}`,
      payer: t.name,
      unit: unitId,
      lines: [{ label: `Duplicate charge · ${short(d.date)}, ${hm(d.second)}`, amount: d.amount }],
      method: `Refund to ${d.card}`,
      balance: t.balance,
      sentTo: t.phone,
      triggered: ["Ledger: capture and refund posted, net $0.00", `Arrives Oct 9 – Oct 16 · ${refundId}`],
      actionId,
      links: [{ label: "Open profile", route: "ops/tenants/" + t.id }],
    });
    await ctx.say(
      t.balance > 0
        ? `Refunded. ${t.first} still owes **${money(t.balance)}** for the current period${expired && t.card === d.card ? " because the card expired; once it's updated, autopay picks it up" : ""}.`
        : `Refunded. ${t.first}'s balance stays at ${money(t.balance)} and autopay runs as usual next month.`,
    );
    ctx.suggest(t.balance > 0 ? [t.name === "Grace Lindqvist" ? "Charge Grace's card for her balance" : `Charge ${t.name}'s card for the balance`, "Fix last night's autopay failures", "Show delinquency aging"] : ["Fix last night's autopay failures", "Show delinquency aging", "What needs my attention today?"]);
  },
});
