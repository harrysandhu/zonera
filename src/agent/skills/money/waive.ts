import { defineSkill } from "../../engine";
import { kw } from "../../parse";
import { money, round2, snapshot, U } from "../../data";
import { clock, fmt } from "../../../state/store";
import { OPERATOR, type Tenant } from "../../../data/tenants";
import { ledgerFor as fullLedger, openCharges, ordinal, LATE_FEE, TODAY, addDays } from "../../../data/ledger";
import { post, plural, resolveTenant } from "./util";

// #16 Waive a late fee. Finds the open (or held) late fee, checks the waiver
// policy (managers can waive one per tenant per 12 months), credits it.
//
//   "Waive Matthew Okafor's late fee"   → $45 Sep 20 fee → diff → credit → new balance $195
//   "Waive the late fee for Grace"      → 2 Graces; Lindqvist's fee was held, so the waiver closes it

const YEAR_AGO = addDays(TODAY, -365);
const short = (iso: string) => fmt.short(iso);
const monthYear = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" });

interface FeeInfo {
  kind: "open" | "held";
  date: string;
  amount: number;
}

/** The late fee to waive: an unpaid posted fee, else one the agent held. */
function feeFor(t: Tenant): FeeInfo | undefined {
  const open = openCharges(t).filter(c => c.text === "Late fee");
  if (open.length && t.balance > 0) return { kind: "open", date: open[open.length - 1].date, amount: Math.min(open[open.length - 1].amount, t.balance) };
  const led = fullLedger(t);
  const held = led.find(e => e.kind === "info" && /late fee held/i.test(e.text));
  if (held) return { kind: "held", date: held.date, amount: LATE_FEE };
  return undefined;
}
const waivedToday = (t: Tenant) => fullLedger(t).find(e => e.live && e.date === TODAY && e.text === "Late fee waived");

export default defineSkill<{ who: string; fee: string }>({
  id: "money.waive",
  n: 16,
  category: "money",
  title: "Waive a late fee",
  featured: true,
  examples: ["Waive Matthew Okafor's late fee", "Waive the late fee for Grace", "Remove the late fee on A-122"],
  slots: {
    who: { label: "tenant", fill: q => q.people.find(p => p.kind === "tenant")?.name ?? q.ambiguous[0]?.said ?? q.units[0] },
    fee: { label: "fee", fill: () => undefined, default: "late fee · $45", show: v => v },
  },
  match: q => kw(q, [[/\b(waive|waiving|waived|forgive)\b/, 5], [/\b(remove|drop|reverse|cancel|take off) (the |his |her |their |a )?late fees?\b/, 5]]),

  async run(ctx, { q }) {
    await ctx.think("Find the late fee, check the waiver policy for this tenant, credit it and show the new balance.", 1000);
    const t = await resolveTenant(ctx, q, { fits: x => !!feeFor(x), why: "has a late fee", title: (said, n) => (said ? `${n} tenants named ${said}. Whose fee?` : "Whose late fee should I waive?") });
    const unitId = t.unitIds[0];
    ctx.title(`Waive fee · ${t.name}`);
    ctx.focus({ tenants: [t.id], selected: unitId, units: [] });

    const led = fullLedger(t);
    const fees12 = led.filter(e => e.kind === "fee" && e.date >= YEAR_AGO);
    const waivers12 = led.filter(e => /waived/i.test(e.text) && e.date >= YEAR_AGO && e.amount !== 0);
    const fee = feeFor(t);
    await ctx.tool(
      "ledger.get",
      { tenant_id: t.id, include: ["fees", "waivers"] },
      () => ({ balance: t.balance, open_fee: fee ? { date: fee.date, amount: fee.amount, status: fee.kind } : null, late_fees_12mo: fees12.length, waivers_12mo: waivers12.length }),
      600,
    );

    const already = waivedToday(t);
    if (already || !fee) {
      await ctx.say(
        already
          ? `Already waived today: ${money(LATE_FEE)} credited to ${t.name}. ${t.balance > 0 ? `${money(t.balance)} is still open.` : "The balance is clear."}`
          : t.balance > 0
            ? `**${t.name}** has no late fee on the account. The ${money(t.balance)} open is rent.`
            : `**${t.name}** doesn't owe anything, so there's no fee to waive.`,
      );
      ctx.suggest(["Show delinquency aging", "Who's more than 15 days late?", "What needs my attention today?"]);
      return;
    }

    const within = waivers12.length === 0;
    const months = Math.round((new Date(TODAY).getTime() - new Date(t.moveIn).getTime()) / (30.44 * 86400000));
    const longTerm = months >= 12;
    const reason = fee.kind === "held"
      ? "Card expired · first decline in 23 months"
      : `${longTerm ? `Long-term tenant since ${monthYear(t.moveIn)}` : `Tenant since ${monthYear(t.moveIn)}`} · ${fees12.length <= 1 ? "first late fee in 12 months" : "first waiver in 12 months"}`;
    const after = fee.kind === "open" ? round2(t.balance - fee.amount) : t.balance;

    await ctx.say(
      fee.kind === "held"
        ? `${t.first}'s ${money(LATE_FEE)} late fee from ${short(fee.date)} was put on hold, not charged. Waiving it closes it for good; the balance stays **${money(t.balance)}**.`
        : `${t.first} has a **${money(fee.amount)}** late fee from ${short(fee.date)} in the **${money(t.balance)}** balance. ` +
            `${fees12.length > 1 ? `It's the ${ordinal(fees12.length)} late fee in 12 months, ` : "It's the first late fee in 12 months, "}` +
            `${within ? "and none have been waived, so this is within policy." : `but ${plural(waivers12.length, "waiver")} already went through this year, so it needs owner approval.`}`,
    );

    const ans = await ctx.ask(
      "diff",
      {
        title: `Waive late fee · ${t.name}`,
        meta: unitId,
        rows: [
          { field: `Late fee · ${short(fee.date)}`, before: fee.kind === "held" ? `${money(fee.amount)} · on hold` : money(fee.amount), after: "$0.00" },
          { field: "Balance", before: money(t.balance), after: fee.kind === "held" ? `${money(after)} · unchanged` : money(after) },
          { field: "Reason", before: "—", after: reason },
          { field: "Policy", before: "1 waiver per 12 months", after: within ? "Within limit · auto-approved" : "Over limit · owner approval" },
        ],
        note: "Posts a credit to the ledger. Late fees still apply to future months.",
        cta: `Waive ${money(fee.amount)}`,
      },
      ["wait:900", "submit"],
    );
    if (ans !== "approve") {
      await ctx.say("Cancelled. The fee stays on the account.");
      ctx.suggest(["Show delinquency aging", "Who's more than 15 days late?"]);
      return;
    }

    await ctx.tool("ledger.credit", { tenant_id: t.id, amount: fee.kind === "open" ? fee.amount : 0, reason: "late_fee_waiver", note: reason }, { status: "posted", balance: after, approved_by: within ? "policy" : "pending owner" }, 680);
    const restore = snapshot(t);
    let line: ReturnType<typeof post> | undefined;
    const before = t.balance;
    ctx.effect({
      kind: "payment",
      text: `Waived ${money(fee.amount)} late fee · ${unitId} ${t.name}`,
      link: { label: "Open profile", route: "ops/tenants/" + t.id },
      run: () => {
        line =
          fee.kind === "open"
            ? post(t.id, { kind: "credit", text: "Late fee waived", detail: reason, amount: -fee.amount, by: OPERATOR.name })
            : post(t.id, { kind: "info", text: "Late fee waived", detail: `Held fee from ${short(fee.date)} closed · ${reason}`, amount: 0, by: OPERATOR.name });
        t.balance = after;
      },
      undo: () => {
        restore();
        line?.void("Late fee waiver reversed", `Undone at ${clock()}`);
      },
    });

    const locked = t.unitIds.some(id => U(id).status === "overlocked");
    ctx.show("answer", {
      label: "New balance",
      value: money(t.balance),
      delta: fee.kind === "open" ? { text: `−${money(fee.amount)}`, tone: "ok" } : undefined,
      context: `${t.name} · ${unitId} · late fee from ${short(fee.date)} waived${fee.kind === "open" ? `, was ${money(before)}` : ""}.`,
      links: [{ label: "Open profile", route: "ops/tenants/" + t.id }],
    });
    await ctx.say(
      t.balance > 0
        ? `Done. ${t.first} now owes **${money(t.balance)}**${locked ? `; ${unitId} stays overlocked until that's paid` : ""}.`
        : `Done. ${t.first}'s balance is clear.`,
    );
    ctx.suggest(
      t.name === "Matthew Okafor"
        ? ["Okafor dropped off a check for 195", "Show delinquency aging", "Text everyone past due a reminder"]
        : t.name === "Grace Lindqvist"
          ? ["Charge Grace's card for her balance", "Fix last night's autopay failures", "Show delinquency aging"]
          : ["Show delinquency aging", "Text everyone past due a reminder", "Who's more than 15 days late?"],
    );
  },
});
