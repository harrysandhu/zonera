import { defineSkill } from "../../engine";
import { kw } from "../../parse";
import { money, pastDue, TODAY_ISO, DECLINE } from "../../data";
import { fmt } from "../../../state/store";
import { TENANTS, SEPT_LAST_YEAR, type Tenant } from "../../../data/tenants";
import { UNITS } from "../../../data/facility";
import { STAGES, stageOf } from "../../../ops/pages/b/lien";
import { plural, sum } from "../money/util";

// #62 Delinquency aging: open balances bucketed by days past due, live from the
// rent roll, with the biggest balances one click from collecting.
//
//   "Show delinquency aging"   → tiles + aging chart + biggest balances + every past-due tenant
//   "How much is past due?"    → same answer, the total leads

const BUCKETS = [
  { label: "1–15", lo: 1, hi: 15 },
  { label: "16–30", lo: 16, hi: 30 },
  { label: "31–60", lo: 31, hi: 60 },
  { label: "60+", lo: 61, hi: 99999 },
];
// Past due at the end of August: the Delinquency page reports $4,186 recovered in September, 78% of it.
const AUG_PAST_DUE = Math.round(4186 / 0.78);

const whole = (n: number) => fmt.money(n);

/** A prompt that routes to the skill that collects from this tenant. */
function collectAsk(t: Tenant): string {
  if (t.daysLate >= 30) return `Start the lien process for ${t.name}`;
  if (t.card && !DECLINE[t.name] && !/expired/i.test(t.notes ?? "")) return `Charge ${t.name}'s card for the balance`;
  return `Text ${t.name} a payment reminder`;
}

export default defineSkill<{ asOf: string }>({
  id: "collections.aging",
  n: 62,
  category: "collections",
  title: "Delinquency aging",
  featured: true,
  examples: ["Show delinquency aging", "How much is past due?", "What's our delinquency rate?"],
  slots: {
    asOf: { label: "as of", fill: () => undefined, default: TODAY_ISO, show: v => (v === TODAY_ISO ? "today" : fmt.short(v)) },
  },
  match: q =>
    kw(q, [
      [/\baging\b|\baged (balances|receivables)\b/, 5],
      [/\bhow much\b.*\b(past due|overdue|outstanding|owed|delinquen)/, 5],
      [/\bdelinquency (rate|report|total)\b|\btotal past due\b|\breceivables?\b/, 5],
      [/\b(text|email|remind|lien)\b/, -3],
    ]),

  async run(ctx) {
    ctx.title("Delinquency aging");
    await ctx.think("Bucket every open balance by days past due, compare with the end of August, then rank the balances worth chasing first.", 1100);

    const late = pastDue();
    const total = sum(late.map(t => t.balance));
    const rentRoll = sum(TENANTS.map(t => t.rent));
    const occupied = UNITS.filter(u => u.tenantId && ["occupied", "delinquent", "overlocked"].includes(u.status)).length;
    const buckets = BUCKETS.map(b => {
      const ts = late.filter(t => t.daysLate >= b.lo && t.daysLate <= b.hi);
      return { ...b, n: ts.length, amt: sum(ts.map(t => t.balance)) };
    });

    await ctx.tools([
      {
        name: "ar.aging",
        args: { as_of: TODAY_ISO, buckets: BUCKETS.map(b => b.label.replace("–", "-")) },
        result: () => ({ total, tenants: late.length, buckets: buckets.map(b => ({ days: b.label.replace("–", "-"), tenants: b.n, amount: b.amt })) }),
        ms: 720,
      },
      { name: "reports.delinquency", args: { month: "2026-09" }, result: { past_due_aug_31: AUG_PAST_DUE, recovered_sep: 4186, rent_roll: rentRoll }, ms: 540 },
    ]);

    if (!late.length) {
      ctx.show("answer", { label: "Past due", value: "$0", context: `Nobody is past due as of ${fmt.short(TODAY_ISO)}. ${plural(occupied, "occupied unit")}, all current.`, links: [{ label: "Open delinquency", route: "ops/delinquency" }] });
      await ctx.say("Every tenant is current. Nothing to chase today.");
      ctx.suggest(["What needs my attention today?", "Fix last night's autopay failures", "Generate the September owner report vs last year"]);
      return;
    }

    const byBalance = [...late].sort((a, b) => b.balance - a.balance);
    ctx.focus({ tenants: byBalance.slice(0, 3).map(t => t.id), units: late.flatMap(t => t.unitIds), selected: late[0].unitIds[0], caption: `${late.length} past-due units` });

    const rate = total / rentRoll;
    const over30 = late.filter(t => t.daysLate > 30);
    const over30Amt = sum(over30.map(t => t.balance));
    const change = total - AUG_PAST_DUE;
    const changePct = change / AUG_PAST_DUE;
    const ptsVsLy = (rate - SEPT_LAST_YEAR.delinquency) * 100;

    ctx.show("answer", {
      tiles: [
        { label: "Past due", value: whole(total), context: plural(late.length, "tenant") },
        { label: "Delinquency rate", value: fmt.pct(rate), context: `of rent roll · ${late.length} of ${occupied} units`, delta: { text: `${ptsVsLy >= 0 ? "+" : "−"}${Math.abs(ptsVsLy).toFixed(1)} pts vs last Oct`, tone: ptsVsLy > 0 ? "bad" : "ok" } },
        { label: "vs Aug 31", value: (change < 0 ? "−" : "+") + whole(Math.abs(change)).replace("−", ""), context: `from ${whole(AUG_PAST_DUE)}`, delta: { text: `${changePct < 0 ? "−" : "+"}${Math.abs(changePct * 100).toFixed(0)}%`, tone: change <= 0 ? "ok" : "bad" } },
        { label: "Over 30 days", value: whole(over30Amt), context: over30.length ? `${plural(over30.length, "tenant")} · lien track` : "none" },
      ],
      chart: { kind: "bar", title: "Past due by days late", data: buckets.map(b => ({ label: `${b.label} days`, value: b.amt, note: plural(b.n, "tenant") })), format: "money", height: 150 },
      itemsTitle: "Biggest balances",
      items: byBalance.slice(0, 4).map(t => ({
        label: `${t.name} · ${t.unitIds[0]}`,
        meta: `${money(t.balance)} · ${t.daysLate}d`,
        action: { label: "Collect", ask: collectAsk(t) },
      })),
      links: [{ label: "Open delinquency", route: "ops/delinquency" }],
    });

    const stageLabel = (t: Tenant) => STAGES.find(s => s.id === stageOf(t))?.label ?? "Past due";
    ctx.show("table", {
      title: `${plural(late.length, "past-due tenant")}`,
      meta: money(total),
      columns: [
        { key: "name", label: "Tenant" },
        { key: "unit", label: "Unit", mono: true },
        { key: "days", label: "Days", align: "right", mono: true },
        { key: "bal", label: "Balance", align: "right", mono: true },
        { key: "stage", label: "Stage" },
        { key: "last", label: "Last contact" },
      ],
      rows: late.map(t => ({
        id: t.id,
        cells: { name: t.name, unit: t.unitIds.join(", "), days: String(t.daysLate), bal: money(t.balance), stage: stageLabel(t), last: t.lastContact ?? "—" },
        sort: { days: t.daysLate, bal: t.balance },
        tone: (t.daysLate > 30 ? "bad" : t.daysLate > 15 ? "warn" : undefined) as "bad" | "warn" | undefined,
        route: "ops/tenants/" + t.id,
      })),
      maxRows: 6,
    });

    const b1 = buckets[0];
    const top = byBalance[0];
    await ctx.say(
      `**${money(total)}** is past due across **${plural(late.length, "tenant")}**, ${fmt.pct(rate)} of the monthly rent roll. ` +
        `${change <= 0 ? `That's ${whole(Math.abs(change))} less than at the end of August.` : `That's ${whole(change)} more than at the end of August.`} ` +
        `${b1.n ? `Most of it is fresh: ${plural(b1.n, "tenant")} under 16 days owe ${money(b1.amt)}.` : ""}` +
        (over30.length ? ` ${over30.map(t => t.name).join(", ")} ${over30.length === 1 ? "is" : "are"} past 30 days and on the lien track.` : "") +
        (top && !over30.includes(top) ? ` Biggest single balance: ${top.name}, ${money(top.balance)}.` : ""),
    );

    const dana = late.find(t => t.name === "Dana Whitfield");
    ctx.suggest(["Who's more than 15 days late?", "Text everyone past due a reminder", dana ? "Start the lien process for Dana Whitfield" : "Fix last night's autopay failures"]);
  },
});
