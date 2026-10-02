import { defineSkill } from "../../engine";
import { kw } from "../../parse";
import { needTenant } from "../../need";
import { ledgerFor, money, round2, snapshot, DECLINE, isoAdd } from "../../data";
import { methodLabel } from "../../widgets/core/PaymentForm";
import type { PayMethod } from "../../widgets/core/types";
import { fmt } from "../../../state/store";
import { UNIT_BY_ID } from "../../../data/facility";

// #13 Take a payment. Reference skill: shows slots + chips, disambiguation,
// a ledger, a payment form, effects with undo, chained effects (unlock), a
// receipt, a conflicting-slot question, and next-step chips.
//
//   "Matthew came in and paid $240 cash"         → which Matthew? (Okafor owes exactly $240)
//   "Okafor dropped off a check for 195"          → partial payment, stays overlocked
//   "Charge Grace's card for her balance"         → card on file expired → asks what to do

type Method = PayMethod;

export default defineSkill<{ who: string; amount: number | "balance"; method: Method }>({
  id: "money.payment",
  n: 13,
  category: "money",
  title: "Take a payment",
  featured: true,
  examples: ["Matthew came in and paid $240 cash", "Okafor dropped off a check for 195", "Charge Grace's card for her balance"],
  slots: {
    who: {
      label: "tenant",
      fill: q => q.people.find(p => p.kind === "tenant")?.name ?? q.ambiguous[0]?.said,
    },
    amount: {
      label: "amount",
      fill: q => q.amounts[0],
      default: "balance",
      show: v => (v === "balance" ? "full balance" : money(v as number)),
    },
    method: {
      label: "method",
      fill: q => (q.method === "card" ? "card" : q.method),
      default: "cash",
      show: v => methodLabel(v).toLowerCase(),
      options: () => (["cash", "card", "check", "reader"] as Method[]).map(m => ({ value: m, label: methodLabel(m) })),
    },
  },
  match: q =>
    kw(q, [
      [/\b(paid|pays|paying|payment|dropped off|cash|check for|charge|run (his|her|their) card)\b/, 3],
      [/\$\d/, 1],
      [/\b(refund|duplicate|waive|plan)\b/, -4],
      [/\b(email|text|sms|remind)\b/, -2],
    ]) + (q.people.length || q.ambiguous.length ? 1 : 0),

  async run(ctx, { q, slots }) {
    const amountAsked = slots.amount === "balance" ? undefined : slots.amount;
    await ctx.think(
      q.ambiguous.length
        ? `"${q.ambiguous[0].said}" matches ${q.ambiguous[0].candidates.length} people. ${amountAsked ? `${money(amountAsked)} should match one balance exactly; ` : ""}confirm before recording money.`
        : "Find the tenant, check the ledger, record the payment, then apply what it unlocks.",
      1300,
    );

    // 1 · Who. Prefer the tenant whose balance equals the amount, then anyone with a balance.
    const t = await needTenant(ctx, q, {
      prefer: x => (amountAsked !== undefined && Math.abs(x.balance - amountAsked) < 0.01 ? 10 : 0) + (x.balance > 0 ? 2 : 0),
      title: (said, n) => (said ? `${n} tenants named ${said}. Which one came in?` : "Who is paying?"),
    });
    const unit = UNIT_BY_ID.get(t.unitIds[0])!;
    ctx.title(`Payment · ${t.name}`);
    ctx.focus({ tenants: [t.id], selected: unit.id, units: [] });

    if (t.balance <= 0) {
      await ctx.tool("ledger.get", { tenant_id: t.id }, () => ({ balance: 0, autopay: t.autopay, card: t.card ?? null }), 520);
      await ctx.say(`**${t.name}** doesn't owe anything right now. ${t.autopay ? `Autopay on ${t.card} covers the next bill.` : "Want me to record this as a credit toward next month?"}`);
      ctx.suggest([`Pull up ${t.name}`, "Show delinquency aging"]);
      return;
    }

    // 2 · Ledger.
    const rows = ledgerFor(t);
    await ctx.tool("ledger.get", { tenant_id: t.id }, () => ({ balance: t.balance, open_items: rows.filter(r => r.charge && r.date >= rows[2]?.date).length, days_late: t.daysLate }), 560);
    ctx.show("ledger", { title: `Ledger · ${t.name}`, meta: unit.id, rows: rows.map(r => (r.charge && r.balance > 0 && r.date >= rows[2].date ? { ...r, flag: r.flag ?? ("paying" as const) } : r)) });

    // Allocation: fees first, then rent, oldest first.
    const amount = round2(amountAsked ?? t.balance);
    const fees = rows.filter(r => r.flag === "late" || r.desc.startsWith("Overlock")).reduce((s, r) => s + (r.charge ?? 0), 0);
    const feePart = Math.min(fees, amount);
    const rentPart = round2(Math.min(t.balance - fees, amount - feePart));
    const credit = round2(Math.max(0, amount - t.balance));
    const remaining = round2(Math.max(0, t.balance - amount));
    const openRent = rows.slice(2).filter(r => r.desc.startsWith("Rent"));
    const lastRent = openRent[openRent.length - 1] ?? rows[2];
    const lines = [
      ...(feePart > 0 ? [{ label: fees > 45 ? "Late fees" : "Late fee", amount: feePart }] : []),
      ...(rentPart > 0 ? [{ label: openRent.length > 1 ? `Rent · ${openRent.length} periods` : `Rent · ${openRent[0]?.desc.replace("Rent · ", "") ?? "current period"}`, amount: rentPart }] : []),
      ...(credit > 0 ? [{ label: "Credit toward next month", amount: credit }] : []),
    ];
    const locked = unit.status === "overlocked";
    const paidThrough = fmt.short(isoAdd(lastRent.date, -1, 1));

    let method = slots.method ?? "cash";
    // Conflicting slot: card on file that is known to be declining.
    if (method === "card" && (DECLINE[t.name] || !t.card || /expired/i.test(t.notes ?? ""))) {
      const reason = DECLINE[t.name]?.label ?? (t.card ? "The card on file expired" : "There's no card on file");
      await ctx.say(`${reason}${t.card ? ` (${t.card})` : ""}, so charging it will fail. How do you want to take the ${money(amount)}?`);
      const pick = await ctx.ask(
        "quickReplies",
        {
          question: `How should ${t.first} pay ${money(amount)}?`,
          options: [
            { value: "link", label: "Text a card-update link" },
            { value: "reader", label: "Card reader at the counter" },
            { value: "cash", label: "Cash" },
          ],
        },
        ["opt:link"],
      );
      if (pick === "link") {
        await ctx.tool("sms.send", { to: t.phone, template: "card_update", amount }, () => ({ status: "delivered", link: `zonera.co/u/${t.id.toLowerCase()}` }), 700);
        ctx.effect({ kind: "payment", text: `Sent ${t.name} a card-update link for ${money(amount)}` });
        await ctx.say(`Sent. When ${t.first} updates the card I'll charge ${money(amount)} automatically${locked ? ` and release ${unit.id}` : ""}.`);
        ctx.suggest(["Fix last night's autopay failures", `Pull up ${t.name}`, "Show delinquency aging"]);
        return;
      }
      method = pick as Method;
    }

    await ctx.say(
      `${t.first}'s balance is **${money(t.balance)}**${fees ? `: ${money(t.balance - fees)} rent plus a ${money(fees)} late fee` : ""}. ` +
        (amount === t.balance
          ? `${money(amount)} clears it exactly.${locked ? ` ${unit.id} is overlocked and the gate code is suspended, so this also releases both.` : ""}`
          : amount < t.balance
            ? `${money(amount)} leaves **${money(remaining)}** open${locked ? `, so ${unit.id} stays overlocked until it's paid in full` : ""}.`
            : `${money(amount)} is ${money(credit)} more than the balance; the rest goes on account.`),
    );

    // 3 · Payment form.
    const pay = await ctx.ask(
      "payment",
      {
        payer: `${t.name} · ${unit.id}`,
        method,
        methods: ["cash", "card", "check", "reader"],
        lines,
        card: method === "reader" ? "Visa •• 3318" : t.card,
        receiptTo: t.phone,
        after: remaining === 0 ? `Clears the balance · paid through ${paidThrough}` : `${money(remaining)} stays open`,
      },
      ["submit"],
    );

    // 4 · Record it.
    const receipt = `R-20261002-${String(400 + Math.floor(Math.random() * 90)).padStart(4, "0")}`;
    await ctx.tool("payments.record", { tenant_id: t.id, amount: pay.amount, method: pay.method, apply_to: lines.map(l => l.label) }, () => ({ receipt, balance: remaining, status: "posted" }), 820);
    const restore = snapshot(t);
    const actionId = ctx.effect({
      kind: "payment",
      text: `Recorded ${money(pay.amount)} ${methodLabel(pay.method).toLowerCase()} from ${t.name} · ${unit.id}`,
      link: { label: "Open profile", route: "ops/tenants/" + t.id },
      run: () => {
        t.balance = remaining;
        if (remaining === 0) {
          t.daysLate = 0;
          if (unit.status === "delinquent") unit.status = "occupied";
        }
        t.lastContact = "Oct 2 · Paid at the office";
      },
      undo: restore,
    });

    const triggered: string[] = [];
    if (locked && remaining === 0) {
      await ctx.tools([
        { name: "locks.overlock.release", args: { unit: unit.id }, result: { lock: "smart overlock", state: "released" }, ms: 900 },
        { name: "gate.access.restore", args: { tenant_id: t.id }, result: { code: "••" + t.gateCode.slice(-2), status: "active" }, ms: 650 },
      ]);
      ctx.effect({
        kind: "gate",
        text: `Overlock removed from ${unit.id} and gate code restored for ${t.name}`,
        run: () => {
          unit.status = "occupied";
        },
        undo: () => {
          unit.status = "overlocked";
        },
      });
      triggered.push(`Overlock removed from ${unit.id}`, "Gate code restored");
    }
    if (pay.sms) {
      await ctx.tool("sms.send", { to: t.phone, template: "receipt", receipt }, { status: "delivered" }, 600);
      triggered.push("Receipt texted");
    }

    ctx.show("receipt", {
      no: receipt,
      payer: t.name,
      unit: unit.id,
      lines,
      method: methodLabel(pay.method) + (pay.card ? ` · ${pay.card}` : ""),
      balance: remaining,
      paidThrough: remaining === 0 ? paidThrough : undefined,
      sentTo: pay.sms ? t.phone : undefined,
      triggered,
      actionId,
      links: [{ label: "Open profile", route: "ops/tenants/" + t.id }],
    });

    await ctx.say(
      remaining === 0
        ? `Done. ${t.first} is paid through ${paidThrough}${locked ? `, ${unit.id} is unlocked and the gate code works again` : ""}. Next rent of ${money(t.rent)} is due the day after.${t.autopay ? "" : " Autopay is off."}`
        : `Recorded. ${money(remaining)} is still open on ${unit.id}${locked ? "; the overlock stays on until it's cleared" : ""}.`,
    );
    ctx.suggest(t.autopay ? ["Fix last night's autopay failures", "Who's more than 15 days late?", `Pull up ${t.name}`] : ["Who's more than 15 days late?", `Pull up ${t.name}`, "Show delinquency aging"]);
  },
});
