import { defineSkill } from "../../engine";
import { kw } from "../../parse";
import { needTenant } from "../../need";
import { ledgerFor, money, sizeLabel, U } from "../../data";
import { tenantForUnit, tenureMonths, type Tenant } from "../../../data/tenants";
import { addDays, nextBillDate, shortDate, TODAY } from "../../../data/ledger";
import { unitGateLog } from "../../../data/gate";
import { CHANNEL_LABEL, commsFor } from "../../../data/comms";

// Tenant lookup: profile, ledger, gate log and last contact in one view.
// Read-only, so there is nothing to undo. The next-step chips depend on state:
// a balance offers the matching payment or collections step.
//
//   "Pull up Matthew Okafor"      → unique name
//   "Show Matthew's ledger"        → three Matthews, the one with a balance is badged
//   "Look up unit A-131"           → resolved from the unit

const STORY_IDS = new Set(["T-1000", "T-1001", "T-1002", "T-1003", "T-1004", "T-1005", "T-1006"]);

function tenure(t: Tenant) {
  const m = Math.max(0, tenureMonths(t));
  const y = Math.floor(m / 12);
  const r = m % 12;
  if (!y) return `${r} mo`;
  return r ? `${y} yr ${r} mo` : `${y} yr`;
}

/** Last day covered by rent already paid. */
function paidThrough(t: Tenant) {
  if (t.daysLate > 0) return addDays(TODAY, -t.daysLate - 1);
  return addDays(nextBillDate(t), -1);
}

function nextSteps(t: Tenant): string[] {
  if (t.balance > 0) {
    if (t.name === "Matthew Okafor")
      return [Math.abs(t.balance - 240) < 0.01 ? "Matthew came in and paid $240 cash" : "Okafor dropped off a check for 195", "Waive Matthew Okafor's late fee", "Who's more than 15 days late?"];
    if (t.name === "Grace Lindqvist") return ["Charge Grace's card for her balance", "Fix last night's autopay failures", "Who's more than 15 days late?"];
    if (t.name === "Dana Whitfield") return ["Start the lien process for Dana Whitfield", "Show delinquency aging", "Who's more than 15 days late?"];
    return ["Text everyone past due a reminder", "Who's more than 15 days late?", "Show delinquency aging"];
  }
  if (t.name === "Sofia Reyes" && t.unitIds[0] === "C-108") return ["Move Sofia Reyes from her 5×10 to a 10×10", "How many 10×10s are free?", "What needs my attention today?"];
  if (t.name === "Ben Carter") return ["Ben Carter is moving out Friday", "Show today's move-ins", "What needs my attention today?"];
  return ["Move Sofia Reyes from her 5×10 to a 10×10", "Show today's move-ins", "What needs my attention today?"];
}

export default defineSkill<{ who: string; view: "profile" | "ledger" }>({
  id: "frontdesk.lookup",
  category: "frontdesk",
  title: "Look up a tenant",
  featured: true,
  examples: ["Pull up Matthew Okafor", "Show Grace's ledger", "Show Matthew's ledger", "Look up unit A-131"],
  slots: {
    who: {
      label: "tenant",
      fill: q => q.people.find(p => p.kind === "tenant")?.name ?? q.ambiguous[0]?.said ?? (q.units[0] ? tenantForUnit(q.units[0])?.name ?? q.units[0] : undefined),
    },
    view: {
      label: "view",
      fill: q => (/\bledger|statement|balance|payments?\b/.test(q.lower) ? "ledger" : undefined),
      default: "profile",
      show: v => (v === "ledger" ? "ledger" : "profile + ledger"),
    },
  },
  match: q => {
    const verb = kw(q, [
      [/\b(pull up|look ?up|bring up)\b/, 4],
      [/\b(show|open|find|get)\b/, 2],
      [/\b(ledger|profile|account|statement|history|file|details)\b/, 3],
    ]);
    if (verb <= 0) return 0;
    const who = q.people.some(p => p.kind === "tenant") || q.ambiguous.some(a => a.candidates.some(c => c.kind === "tenant")) || q.units.length ? 2 : 0;
    return (
      verb +
      who +
      kw(q, [
        [/\b(move|moving|transfer|upsize|pa(id|y)|charge|refund|waive|text|email|call|lien|overlock|gate code|revoke|reminder)\b/, -5],
        [/\b(aging|delinquen|call center|available|free|open units?|reports?|today'?s|move-?ins?)\b/, -4],
      ])
    );
  },

  async run(ctx, { q, slots }) {
    await ctx.think(
      q.units.length && !q.people.length
        ? `Find who rents ${q.units[0]}, then pull the profile, ledger, gate log and last contact in parallel.`
        : q.ambiguous.length
          ? `"${q.ambiguous[0].said}" matches ${q.ambiguous[0].candidates.length} people. Badge the one most likely meant, then pull everything in parallel.`
          : "Pull the profile, ledger, gate log and last contact in parallel.",
      1000,
    );

    // 1 · Who. A unit resolves to its tenant; a name goes through needTenant.
    let t: Tenant | undefined;
    if (q.units.length && !q.people.length && !q.ambiguous.length) {
      const u = U(q.units[0]);
      t = tenantForUnit(u);
      await ctx.tool("units.get", { unit: u.id }, () => ({ unit: u.id, size: u.size, status: u.status, tenant_id: t?.id ?? null }), 480);
      if (!t) {
        ctx.title(`Unit · ${u.id}`);
        ctx.focus({ units: [u.id], selected: u.id, tenants: [] });
        ctx.show("answer", {
          label: `${u.id} · ${sizeLabel(u.size)} ${u.kind === "climate" ? "climate" : u.kind}`,
          value: u.status === "vacant" ? "Vacant" : u.status === "reserved" ? "Reserved" : u.status === "maintenance" ? "In maintenance" : "No tenant",
          context: `${money(u.rate)}/mo street rate · ${u.kind === "climate" ? `Building D, floor ${u.floor}` : `Building ${u.building}, faces ${u.facing}`}`,
          links: [{ label: "Open units", route: "ops/units" }],
        });
        await ctx.say(u.status === "vacant" ? `Nobody rents **${u.id}** right now. It's on the storefront at ${money(u.rate)}/mo.` : `**${u.id}** has no active tenant. Status: ${u.status}.`);
        ctx.suggest(["New customer wants a 10×10 today, Jordan Lee", "How many 10×10s are free?", "Show today's move-ins"]);
        return;
      }
    } else {
      t = await needTenant(ctx, q, {
        prefer: x => (STORY_IDS.has(x.id) ? 3 : 0) + (x.balance > 0 ? 2 : 0),
        title: (said, n) => (said ? `${n} tenants named ${said}. Whose ${slots.view === "ledger" ? "ledger" : "profile"}?` : "Which tenant?"),
        filter: x => STORY_IDS.has(x.id),
      });
    }

    const unitId = t.unitIds[0];
    const u = U(unitId);
    ctx.title(`${slots.view === "ledger" ? "Ledger" : "Tenant"} · ${t.name}`);
    ctx.focus({ tenants: [t.id], selected: unitId, units: [] });

    // 2 · Everything about them, in parallel.
    const thru = paidThrough(t);
    const gates = unitGateLog(unitId);
    const touch = commsFor(t).find(c => c.channel === "sms" || c.channel === "email" || c.channel === "call" || c.channel === "letter");
    await ctx.tools([
      { name: "ledger.get", args: { tenant_id: t.id }, result: () => ({ balance: t!.balance, days_late: t!.daysLate, paid_through: thru, autopay: t!.autopay ? t!.card ?? true : false }), ms: 620 },
      { name: "gate.events.query", args: { unit: unitId, limit: 3 }, result: () => gates.slice(0, 3).map(g => ({ at: g.at, event: g.text, gate: g.gate })), ms: 560 },
      { name: "messages.latest", args: { tenant_id: t.id }, result: () => (touch ? { channel: touch.channel, date: touch.date, dir: touch.dir ?? "out", status: touch.status ?? null } : null), ms: 500 },
    ]);

    ctx.show("entity", { tenantId: t.id });
    const rows = ledgerFor(t);
    ctx.show("ledger", { title: `Ledger · ${t.name}`, meta: unitId, rows, foot: t.balance > 0 ? "Balance due" : "Balance" });

    const late = t.daysLate > 0;
    const locked = u.status === "overlocked";
    ctx.show("answer", {
      tiles: [
        { label: "Balance", value: money(t.balance), delta: late ? { text: `${t.daysLate} days late`, tone: t.daysLate > 30 ? "bad" : "warn" } : { text: "Paid up", tone: "ok" } },
        { label: "Paid through", value: shortDate(thru), context: late ? `Due ${shortDate(addDays(thru, 1))}` : `Next bill ${shortDate(addDays(thru, 1))}` },
        { label: "Autopay", value: t.autopay ? "On" : "Off", context: t.autopay ? t.card : t.notes?.match(/cash/i) ? "Pays cash" : "Manual" },
        { label: "Tenure", value: tenure(t), context: `Since ${shortDate(t.moveIn)} ${t.moveIn.slice(0, 4)}` },
      ],
      itemsTitle: "Recent activity",
      items: [
        ...gates.slice(0, 3).map(g => ({ label: `${g.text} · ${g.gate}`, meta: g.at })),
        ...(touch
          ? [{ label: `Last contact · ${CHANNEL_LABEL[touch.channel]}${touch.dir === "in" ? " from " + t.first : ""}: ${clip(touch.subject ?? touch.body)}`, meta: shortDate(touch.date) }]
          : t.lastContact
            ? [{ label: `Last contact · ${t.lastContact.split(" · ")[1] ?? t.lastContact}`, meta: t.lastContact.split(" · ")[0] }]
            : []),
      ],
      links: [
        { label: "Open profile", route: "ops/tenants/" + t.id },
        { label: "Open lease", route: "ops/leases/" + t.id },
      ],
    });

    const status = late
      ? `owes **${money(t.balance)}**, ${t.daysLate} days late.${locked ? ` ${unitId} is overlocked and the gate code is suspended.` : u.status === "delinquent" ? ` ${unitId} is flagged delinquent.` : ""}`
      : `is paid through **${shortDate(thru)}**${t.autopay ? ` on autopay (${t.card})` : ""}.`;
    const note = t.notes ? ` ${t.notes}` : "";
    await ctx.say(`**${t.name}** rents ${t.unitIds.join(", ")}, a ${sizeLabel(u.size)} at ${money(t.rent)}/mo, and ${status}${note}`);
    ctx.suggest(nextSteps(t));
  },
});

function clip(s: string, n = 64) {
  const one = s.replace(/\s+/g, " ").trim();
  return one.length > n ? one.slice(0, n - 1).replace(/[\s,.;:]+\S*$/, "") + "…" : one;
}
