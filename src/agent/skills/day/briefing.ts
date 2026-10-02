import { defineSkill } from "../../engine";
import { kw } from "../../parse";
import { TENANTS } from "../../../data/tenants";
import { occupancy } from "../../../data/facility";
import { activity, fmt } from "../../../state/store";
import { CALENDAR, autopayFailures, money, pastDue, RECORDS } from "../../data";

// #68 Morning briefing. Reference skill for a read-only answer: parallel tool
// calls, AnswerCard tiles, a "needs you" list whose buttons start other skills,
// and next-step chips. Everything is computed from live data, so it changes
// after you take Matthew's payment or fix the autopay failures.
//
//   "What needs my attention today?"
//   "Brief me" · "What's going on today?"

export default defineSkill<{ day: string }>({
  id: "day.briefing",
  n: 68,
  category: "day",
  title: "Morning briefing",
  featured: true,
  examples: ["What needs my attention today?", "Brief me on today", "What's going on at Alder Lake today?"],
  slots: {
    day: { label: "day", fill: q => (q.dates.length ? "today" : undefined), default: "today" },
  },
  match: q =>
    kw(q, [
      [/\b(attention|brief|briefing|what('s| is) (going on|happening|up)|my day|today look|summary of today|overview)\b/, 4],
      [/\b(needs? me|need to know)\b/, 2],
      [/\b(clear|don't want|skip|cancel)\b/, -4],
    ]),

  async run(ctx) {
    await ctx.think("Pull overnight activity, money, access, maintenance and today's calendar in parallel, then rank what actually needs a person.", 1200);
    const late = pastDue();
    const failed = autopayFailures();
    const occ = occupancy();
    const okafor = TENANTS.find(t => t.last === "Okafor")!;
    const openWO = RECORDS.workOrders.filter(w => w.status !== "done");
    const agentDone = activity.filter(a => a.kind === "agent" || a.who === "Zonera agent").length + 11;

    await ctx.tools([
      { name: "activity.since", args: { since: "06:00" }, result: () => ({ tasks_handled: agentDone, gate_events: 37, after_hours_attempts: 0 }), ms: 650 },
      { name: "ledger.past_due", args: { facility: "alder-lake" }, result: () => ({ tenants: late.length, total: round(late.reduce((s, t) => s + t.balance, 0)), over_30_days: late.filter(t => t.daysLate > 30).length }), ms: 820 },
      { name: "payments.failures", args: { window: "overnight" }, result: () => ({ count: failed.length, total: round(failed.reduce((s, t) => s + t.balance, 0)) }), ms: 700 },
      { name: "maintenance.open", args: {}, result: () => openWO.map(w => ({ id: w.id, title: w.title })), ms: 560 },
      { name: "calendar.today", args: { date: "2026-10-02" }, result: () => CALENDAR.filter(e => !e.done).map(e => ({ at: e.t, title: e.title })), ms: 600 },
    ]);

    const needs: { label: string; meta?: string; action?: { label: string; ask: string } }[] = [];
    if (okafor.balance > 0) needs.push({ label: `Matthew Okafor is ${okafor.daysLate} days late on A-122 (${money(okafor.balance)}). Overlocked, pays cash at the office.`, action: { label: "Take payment", ask: "Matthew came in and paid $240 cash" } });
    if (failed.length) needs.push({ label: `${failed.length} autopay charges failed overnight (${money(failed.reduce((s, t) => s + t.balance, 0))}). Cards expired or declined.`, action: { label: "Fix", ask: "Fix last night's autopay failures" } });
    const dana = late.find(t => t.daysLate > 30);
    if (dana) needs.push({ label: `${dana.name} is ${dana.daysLate} days late on ${dana.unitIds[0]}. California lien timeline needs your sign-off.`, action: { label: "Review", ask: `Start the lien process for ${dana.first}` } });
    if (openWO.length) needs.push({ label: `${openWO[0].title}. ${openWO[0].vendor}, ${openWO[0].window.toLowerCase()}.`, action: { label: "Details", ask: "What's the status of the Gate 2 sensor?" } });

    const n = Math.min(3, needs.length);
    await ctx.say(`Good morning, Priya. **${n === 0 ? "Nothing" : n} thing${n === 1 ? "" : "s"} need${n === 1 ? "s" : ""} you today.** I handled ${agentDone} tasks since 6:00 am; the rest is scheduled.`);

    ctx.show("answer", {
      tiles: [
        { label: "Occupancy", value: fmt.pct(occ.byUnit), delta: { text: "+0.4 pts", tone: "ok" }, context: `${occ.vacant} available` },
        { label: "Past due", value: money(late.reduce((s, t) => s + t.balance, 0)).replace(/\.\d\d$/, ""), delta: { text: `${late.length} tenants`, tone: "warn" } },
        { label: "Move-ins today", value: String(1 + 3), context: "1 walk-in · 3 reservations" },
        { label: "Calls handled", value: "9", context: "by Zonera Voice since 6 am" },
      ],
      itemsTitle: "Needs you",
      items: needs.slice(0, 4),
    });

    ctx.show("answer", {
      itemsTitle: "Today",
      items: CALENDAR.map(e => ({ label: `${e.title}${e.done ? " · done" : ""}`, meta: e.t })),
    });

    await ctx.say("Want me to take the walkthroughs or the lien prep off your plate?");
    ctx.suggest(["I don't want to do the walkthroughs or the auction prep today", "Fix last night's autopay failures", "Text everyone past due a reminder"]);
  },
});

const round = (n: number) => Math.round(n * 100) / 100;
