import { defineSkill } from "../../engine";
import { kw } from "../../parse";
import { money, sizeLabel, snapshot } from "../../data";
import { UNIT_BY_ID, type UnitSize } from "../../../data/facility";
import { TENANTS, tenureMonths, type Tenant } from "../../../data/tenants";
import { MOVE_OUTS } from "../../../data/leases";
import { addComm } from "../../../data/comms";
import { pushLedger, clockMin, TODAY } from "../../../data/ledger";
import { PENDING_INCREASES } from "./util";
import type { DeliveryProps } from "../../widgets/core/types";

// #46 Rate review (ECRI): tenants here 12+ months who pay below street rate,
// current on rent, no increase in the last 6 months. Never above street.
// Approving sends the notices and records the pending increase on each
// tenant (ledger line, email, profile note); undo withdraws them.
//
//   "Raise rates 6% for tenants here over a year"   → 39 tenants, +$410/mo
//   "Run a rate review on 10×10s"                    → same rules, 10×10s only

const EFFECTIVE = "2026-12-01";
const EFFECTIVE_LABEL = "Dec 1";

const tenure = (m: number) => (m < 24 ? `${m} mo` : `${Math.floor(m / 12)} yr ${m % 12 ? (m % 12) + " mo" : ""}`.trim());

interface Pick {
  t: Tenant;
  unit: string;
  months: number;
  cur: number;
  street: number;
  next: number;
  delta: number;
}

function review(pct: number, size?: UnitSize) {
  const pool = TENANTS.filter(t => {
    const u = UNIT_BY_ID.get(t.unitIds[0] ?? "");
    return u && tenureMonths(t) >= 12 && (!size || u.size === size);
  });
  const skipped = { late: 0, recent: 0, street: 0, leaving: 0 };
  const picks: Pick[] = [];
  for (const t of pool) {
    const u = UNIT_BY_ID.get(t.unitIds[0])!;
    const months = tenureMonths(t);
    if (t.daysLate > 0 || t.balance > 0) {
      skipped.late++;
      continue;
    }
    if (MOVE_OUTS.has(t.id) || /prepaid|moving out/i.test(t.notes ?? "")) {
      skipped.leaving++;
      continue;
    }
    if (t.rent >= u.rate * 0.97) {
      skipped.street++;
      continue;
    }
    if (months % 12 < 6 || PENDING_INCREASES.has(t.id)) {
      skipped.recent++;
      continue;
    }
    const next = Math.min(Math.round(t.rent * (1 + pct / 100)), u.rate);
    picks.push({ t, unit: u.id, months, cur: t.rent, street: u.rate, next, delta: next - t.rent });
  }
  picks.sort((a, b) => (a.unit < b.unit ? -1 : 1));
  return { pool, picks, skipped };
}

export default defineSkill<{ pct: number; size: UnitSize; tenure: number }>({
  id: "growth.rates",
  n: 46,
  category: "growth",
  title: "Rate review",
  featured: true,
  examples: ["Raise rates 6% for tenants here over a year", "Run a rate review on 10×10s"],
  slots: {
    pct: { label: "increase", fill: q => q.percent, default: 6, show: v => `+${v}%` },
    size: { label: "size", fill: q => q.sizes[0], show: v => sizeLabel(v) + "s" },
    tenure: { label: "tenure", fill: () => undefined, default: 12, show: v => `${v}+ months` },
  },
  match: q =>
    kw(q, [
      [/\b(raise|increase|bump|hike)\b.{0,20}\b(rates?|rents?|prices?)\b|\brate (review|increase|hike)\b|\becri\b|\brent increases?\b/, 5],
      [/\b(street rate|drop|lower|cut)\b/, -2],
      [/\b(email|text)\b/, -2],
    ]),

  async run(ctx, { slots }) {
    const pct = slots.pct ?? 6;
    const size = slots.size as UnitSize | undefined;
    ctx.title(`Rate review${size ? " · " + sizeLabel(size) + "s" : ""}`);
    await ctx.think(`Tenants here 12+ months${size ? ` in ${sizeLabel(size)}s` : ""}, paying below street rate. Skip anyone past due, leaving, or raised in the last 6 months. +${pct}%, capped at street.`, 1200);
    const { pool, picks, skipped } = review(pct, size);
    await ctx.tools([
      { name: "tenants.query", args: { tenure_months_gte: 12, size: size ?? "any", status: "active" }, result: { count: pool.length }, ms: 650 },
      { name: "rates.street", args: { size: size ?? "all" }, result: size ? { [size]: UNIT_BY_ID.get(picks[0]?.unit ?? "")?.rate ?? null } : { "5x10": 109, "10x10": 189, "10x15": 249, "10x20": 319, "10x30": 419, climate_10x10: 229 }, ms: 500 },
      { name: "ledger.rent_history", args: { tenants: pool.length, months: 12 }, result: { raised_last_6_months: skipped.recent, past_due: skipped.late }, ms: 700 },
    ]);
    if (!picks.length) {
      await ctx.say(`Nobody qualifies right now: ${skipped.late} past due, ${skipped.recent} raised in the last 6 months, ${skipped.street} already at street rate.`);
      ctx.suggest(["Break revenue down by unit size", "Generate the September owner report vs last year"]);
      return;
    }
    ctx.focus({ units: picks.map(p => p.unit), selected: picks[0].unit, tenants: [] });
    const total = picks.reduce((s, p) => s + p.delta, 0);
    await ctx.say(`**${picks.length} tenants** qualify. +${pct}% capped at street rate adds **${money(total)}/mo**. ${picks.filter(p => p.next === p.street).length} hit the street-rate cap. Untick anyone you want to leave alone.`);

    const sel = await ctx.ask(
      "table",
      {
        title: `Rate review · ${picks.length} tenants${size ? " · " + sizeLabel(size) : ""}`,
        meta: `+${money(total)}/mo`,
        columns: [
          { key: "name", label: "Tenant" },
          { key: "unit", label: "Unit", mono: true },
          { key: "tenure", label: "Tenure", align: "right" },
          { key: "cur", label: "Current", align: "right", mono: true },
          { key: "street", label: "Street", align: "right", mono: true },
          { key: "next", label: "New", align: "right", mono: true },
          { key: "delta", label: "+$", align: "right", mono: true },
        ],
        rows: picks.map(p => ({
          id: p.t.id,
          cells: { name: p.t.name, unit: p.unit, tenure: tenure(p.months), cur: money(p.cur), street: money(p.street), next: money(p.next), delta: "+" + money(p.delta) },
          sort: { tenure: p.months, cur: p.cur, street: p.street, next: p.next, delta: p.delta },
        })),
        selectable: true,
        cta: "Continue with {n}",
        maxRows: 8,
      },
      ["wait:1100", "submit"],
    );
    const chosen = picks.filter(p => sel.ids.includes(p.t.id));
    if (!chosen.length) return;
    const cur = chosen.reduce((s, p) => s + p.cur, 0);
    const add = chosen.reduce((s, p) => s + p.delta, 0);
    const ans = await ctx.ask(
      "diff",
      {
        title: "Rent increase notices",
        meta: `${chosen.length} tenants`,
        rows: [
          { field: "Monthly rent", before: `${money(cur)}/mo`, after: `${money(cur + add)}/mo` },
          { field: "Increase", before: "—", after: `+${money(add)}/mo · +${money(add * 12)}/yr` },
          { field: "Average", before: "—", after: `+${money(add / chosen.length)} per tenant` },
          { field: "Notice", before: "—", after: "Email today, Oct 2 · 30+ days ahead (California)" },
          { field: "Effective", before: "—", after: `${EFFECTIVE_LABEL}, 2026` },
        ],
        note: `Skipped: ${skipped.late} past due, ${skipped.recent} raised in the last 6 months, ${skipped.street} at street rate, ${skipped.leaving} prepaid or moving out. Nobody goes above street rate.`,
        cta: `Send ${chosen.length} notices`,
      },
      ["wait:900", "submit"],
    );
    if (ans !== "approve") {
      await ctx.say("No notices sent. Rents unchanged.");
      return;
    }

    await ctx.tool("notices.rent_increase.send", { tenants: chosen.length, channel: "email", effective: EFFECTIVE }, { queued: chosen.length, template: "rent_change_30d" }, 700);
    let records: { restore: () => void; led: ReturnType<typeof pushLedger>; mail: ReturnType<typeof addComm>; id: string }[] = [];
    ctx.effect({
      kind: "rate",
      text: `Rate review: ${chosen.length} notices, +${money(add)}/mo from ${EFFECTIVE_LABEL}`,
      run: () => {
        records = chosen.map(p => {
          const restore = snapshot(p.t);
          p.t.notes = `${p.t.notes ? p.t.notes + " " : ""}Rent goes to ${money(p.next)} on ${EFFECTIVE_LABEL} (notice sent Oct 2).`;
          p.t.lastContact = "Oct 2 · Rent change notice, email";
          const led = pushLedger(p.t.id, { date: TODAY, min: clockMin(), kind: "info", text: "Rent change notice sent", detail: `${money(p.cur)} → ${money(p.next)} from ${EFFECTIVE_LABEL} · 30+ days' notice`, amount: 0, by: "Zonera agent" });
          const mail = addComm(p.t.id, { channel: "email", dir: "out", who: "Zonera agent", subject: `Your rent for ${p.unit} changes on ${EFFECTIVE_LABEL}`, body: `Hi ${p.t.first}, starting ${EFFECTIVE_LABEL}, 2026 your monthly rent for ${p.unit} will be ${money(p.next)} (now ${money(p.cur)}). Our street rate for this unit is ${money(p.street)}. Questions? Reply or call (530) 555-0142.`, status: "Delivered" });
          PENDING_INCREASES.set(p.t.id, { tenantId: p.t.id, unitId: p.unit, from: p.cur, to: p.next, effective: EFFECTIVE, noticeSent: TODAY });
          return { restore, led, mail, id: p.t.id };
        });
      },
      undo: () => {
        for (const r of records) {
          r.restore();
          Object.assign(r.led, { text: "Rent change notice withdrawn", detail: "Withdrawn before it took effect" });
          r.mail.status = "Withdrawn";
          PENDING_INCREASES.delete(r.id);
        }
      },
      link: { label: "Open tenants", route: "ops/tenants" },
    });

    // Delivery: the first rows individually, the rest rolled up.
    const SHOW = 6;
    const head = chosen.slice(0, SHOW);
    const rest = chosen.length - head.length;
    const rows: DeliveryProps["rows"] = [
      ...head.map(p => ({ id: p.t.id, name: p.t.name, to: p.t.email, state: "queued" as const })),
      ...(rest > 0 ? [{ id: "rest", name: `${rest} more tenants`, to: `${rest} emails`, state: "queued" as const }] : []),
    ];
    const h = ctx.show("delivery", { channel: "email", title: `Rent change notices · ${chosen.length}`, rows });
    const set = (i: number, state: "sent" | "delivered", at?: string) => {
      rows[i] = { ...rows[i], state, at };
      h.update({ rows: [...rows] });
    };
    for (let i = 0; i < rows.length; i++) {
      set(i, "sent");
      await ctx.wait(220);
    }
    for (let i = 0; i < rows.length; i++) {
      set(i, "delivered", "9:4" + (6 + Math.min(3, Math.floor(i / 3))) + " am");
      await ctx.wait(180);
    }
    const top = [...chosen].sort((a, b) => b.delta - a.delta).slice(0, 3);
    ctx.show("answer", {
      label: "Rate review",
      value: `+${money(add)}/mo`,
      context: `${chosen.length} notices delivered · effective ${EFFECTIVE_LABEL} · +${money(add * 12)} a year`,
      delta: { text: `+${pct}%, capped at street`, tone: "ok" },
      itemsTitle: "Largest increases",
      items: top.map(p => ({ label: `${p.t.name} · ${p.unit} · ${money(p.cur)} → ${money(p.next)}`, meta: "+" + money(p.delta), route: "ops/tenants/" + p.t.id })),
      links: [
        { label: "Open tenants", route: "ops/tenants" },
        { label: "Open rates", route: "ops/rates" },
      ],
    });
    await ctx.say(`Sent. Replies come back to this thread; anyone who pushes back, I'll flag before ${EFFECTIVE_LABEL}.`);
    ctx.suggest(["Break revenue down by unit size", "Generate the September owner report vs last year"]);
  },
});
