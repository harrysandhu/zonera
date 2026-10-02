import { defineSkill } from "../../engine";
import { kw, parse } from "../../parse";
import { needTenant } from "../../need";
import { money, round2, snapshot, isoAdd, TODAY_ISO } from "../../data";
import { addComm } from "../../../data/comms";
import { longDate } from "../../../data/ledger";

// Split a past-due balance into dated installments, pause escalation while the
// plan is kept, and text the tenant the schedule.
//
//   "Offer Dana Whitfield a payment plan for the $448.00 balance on A-131"
//   "Set up a payment plan for Dana"

export default defineSkill<{ who: string; parts: number }>({
  id: "collections.paymentPlan",
  category: "collections",
  title: "Payment plan",
  featured: true,
  examples: ["Offer Dana Whitfield a payment plan for the $448.00 balance on A-131", "Set up a payment plan for Dana"],
  slots: {
    who: { label: "tenant", fill: q => q.people.find(p => p.kind === "tenant")?.name ?? q.ambiguous[0]?.said, default: "Dana Whitfield" },
    parts: { label: "installments", fill: q => (q.text.match(/\b(two|three|four|2|3|4) (payments|installments|parts)\b/i) ? ({ two: 2, three: 3, four: 4 } as Record<string, number>)[q.text.match(/\b(two|three|four|2|3|4) (payments|installments|parts)\b/i)![1].toLowerCase()] ?? +q.text.match(/\b(2|3|4) (payments|installments|parts)\b/i)![1] : undefined), hidden: true },
  },
  match: q => kw(q, [[/\bpayment plan\b|\binstall?ments?\b|\bsplit (the|her|his|their) balance\b/, 6]]),
  async run(ctx, { q, slots }) {
    // Nobody named: the plan is for the tenant furthest behind (Dana).
    const named = q.people.length || q.ambiguous.length ? q : { ...q, people: parse(slots.who ?? "Dana Whitfield", []).people };
    const t = await needTenant(ctx, named, { filter: x => x.balance > 0, prefer: x => x.daysLate });
    const unit = t.unitIds[0];
    ctx.title(`Payment plan · ${t.name}`);
    ctx.focus({ tenants: [t.id], selected: unit });
    await ctx.think(`${t.first} owes ${money(t.balance)}, ${t.daysLate} days late. Offer a short plan that clears it before the next rent date, and hold the lien timeline while it's kept.`, 1100);
    await ctx.tools([
      { name: "ledger.get", args: { tenant_id: t.id }, result: { balance: t.balance, days_late: t.daysLate, late_fees: t.daysLate > 5 ? 1 : 0 }, ms: 600 },
      { name: "policy.get", args: { key: "payment_plans" }, result: { max_installments: 3, max_days: 30, fees: "waived while kept" }, ms: 500 },
    ]);
    if (t.balance <= 0) {
      await ctx.say(`**${t.name}** doesn't owe anything right now, so there's nothing to split.`);
      ctx.suggest(["Show delinquency aging", "Who's more than 15 days late?"]);
      return;
    }
    const parts = slots.parts ?? Number(
      await ctx.ask(
        "quickReplies",
        {
          question: `Split ${money(t.balance)} into how many payments?`,
          options: [
            { value: "2", label: `2 payments · ${money(round2(t.balance / 2))}`, hint: "Today and Oct 16" },
            { value: "3", label: `3 payments · ${money(round2(t.balance / 3))}`, hint: "Today, Oct 12 and Oct 22" },
            { value: "1", label: "Pay in full by Oct 9", hint: "No split, fees waived" },
          ],
        },
        ["wait:900", "opt:2"],
      ),
    );
    const dates = parts === 3 ? [TODAY_ISO, isoAdd(TODAY_ISO, 10), isoAdd(TODAY_ISO, 20)] : parts === 2 ? [TODAY_ISO, isoAdd(TODAY_ISO, 14)] : [isoAdd(TODAY_ISO, 7)];
    const each = round2(t.balance / dates.length);
    const schedule = dates.map((d, i) => `${longDate(d).replace(/, 2026$/, "")} · ${money(i === dates.length - 1 ? round2(t.balance - each * (dates.length - 1)) : each)}`);
    const ok = await ctx.ask(
      "diff",
      {
        title: "Payment plan",
        meta: `${t.name} · ${unit}`,
        rows: [
          { field: "Balance", before: money(t.balance), after: `${dates.length} payment${dates.length > 1 ? "s" : ""}` },
          { field: "Schedule", before: "—", after: schedule.join("  ·  ") },
          { field: "Late fees", before: "Accruing", after: "Paused while the plan is kept" },
          { field: "Lien timeline", before: t.daysLate >= 30 ? "Active" : "Not started", after: "On hold until the last payment" },
          { field: "Tenant notice", before: "—", after: `SMS + email to ${t.phone}` },
        ],
        note: "If a payment is missed by more than 3 days, the plan ends and the normal timeline resumes.",
        cta: "Offer the plan",
      },
      ["wait:900", "submit"],
    );
    if (ok !== "approve") return;
    const undo = snapshot(t);
    ctx.effect({
      kind: "agent",
      text: `Payment plan for ${t.name}: ${schedule.join(", ")}`,
      run: () => {
        t.notes = `${t.notes ? t.notes + " " : ""}Payment plan Oct 2: ${schedule.join(", ")}. Fees paused while kept.`;
        t.lastContact = "Oct 2 · SMS payment plan";
        addComm(t.id, { channel: "sms", dir: "out", who: "Zonera agent", body: `Hi ${t.first}, here's the plan we set up for ${unit}: ${schedule.join(", ")}. Late fees are paused while it's kept. Pay here: zonera.co/p/${t.id.toLowerCase()}`, status: "Delivered" });
      },
      undo,
      link: { label: "Open profile", route: `ops/tenants/${t.id}` },
    });
    await ctx.tool("sms.send", { to: t.phone, template: "payment_plan" }, { status: "delivered" }, 600);
    ctx.show("answer", {
      label: "Plan offered",
      value: money(each) + (dates.length > 1 ? ` × ${dates.length}` : ""),
      context: `${t.name} · ${unit} · first payment ${dates[0] === TODAY_ISO ? "today" : longDate(dates[0])}. Texted with a pay link.`,
      items: schedule.map((s, i) => ({ label: `Payment ${i + 1}`, meta: s })),
      links: [{ label: "Open profile", route: `ops/tenants/${t.id}` }],
    });
    ctx.suggest(["Show delinquency aging", "Text everyone past due a reminder", `Pull up ${t.name}`]);
  },
});
