import { defineSkill } from "../../engine";
import { kw } from "../../parse";
import { needTenant } from "../../need";
import { money } from "../../data";
import { leaseFor } from "../../../data/leases";
import { LATE_FEE, PLAN_NAME, longDate } from "../../../data/ledger";

// A tenant's rental agreement in plain language, read from the signed lease.
//
//   "Explain Matthew Okafor's lease for A-122 in plain language"
//   "What does Sofia's lease say?"

const COVER: Record<number, string> = { 0: "no protection plan (own insurance on file)", 2000: "the Essential plan, $2,000 of cover", 5000: "the Plus plan, $5,000 of cover", 10000: "the Complete plan, $10,000 of cover" };
const nth = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;

export default defineSkill<{ who: string }>({
  id: "frontdesk.leaseExplain",
  category: "frontdesk",
  title: "Explain a lease",
  featured: true,
  examples: ["Explain Matthew Okafor's lease for A-122 in plain language", "What does Sofia's lease say?"],
  slots: { who: { label: "tenant", fill: q => q.people.find(p => p.kind === "tenant")?.name ?? q.ambiguous[0]?.said } },
  match: q => kw(q, [[/\bexplain\b.*\b(lease|agreement|contract)\b|\b(lease|agreement) say\b|\blease terms\b|\bplain language\b/, 6]]),
  async run(ctx, { q }) {
    const t = await needTenant(ctx, q, { prefer: x => x.daysLate });
    const l = leaseFor(t);
    ctx.title(`Lease · ${t.name}`);
    ctx.focus({ tenants: [t.id], selected: l.unitId });
    await ctx.think("Read the signed agreement and the addenda, then say what it means for the tenant in plain words.", 1000);
    await ctx.tools([
      { name: "leases.get", args: { tenant_id: t.id }, result: { number: l.number, status: l.status, addenda: l.addenda.length }, ms: 600 },
      { name: "documents.read", args: { file: `${l.number}.pdf` }, result: { pages: 6, sections: 14 }, ms: 800 },
    ]);
    const late = t.daysLate > 0;
    ctx.show("answer", {
      label: `Lease ${l.number} · ${l.unitId}`,
      value: `${money(l.rent)}/mo`,
      context: `Month to month since ${longDate(l.start)} · billed on the ${nth(l.billingDay)} · autopay ${l.autopay ? `on (${l.card})` : "off"}`,
      itemsTitle: "In plain language",
      items: [
        { label: `Rent is ${money(l.base)} a month plus ${money(l.premium)} for protection, due on the ${nth(l.billingDay)}. After 5 days a ${money(LATE_FEE)} late fee applies.` },
        { label: `It's month to month. ${t.first} can leave with 10 days' written notice; rent increases need 30 days' notice.` },
        { label: `${t.first} has ${COVER[l.protection] ?? PLAN_NAME[l.protection]}. It covers fire, theft and water damage, not mold or pests.` },
        { label: `Gate hours are 6 am to 10 pm with code ${l.gateCode ?? t.gateCode}. Only ${t.first}${l.addenda.some(a => /access/i.test(a.title)) ? " and the people on the access addendum" : ""} may enter.` },
        { label: "No hazardous materials, no living or working in the unit, no subletting." },
        { label: `If rent is 14 days late the unit can be overlocked, and the California lien process can start after a written notice.${late ? ` ${t.first} is ${t.daysLate} days late today.` : ""}` },
        ...l.addenda.slice(0, 3).map(a => ({ label: `Addendum: ${a.title}${a.note ? ` · ${a.note}` : ""}`, meta: a.status })),
      ],
      links: [{ label: "Open lease", route: `ops/leases/${t.id}` }, { label: "Open profile", route: `ops/tenants/${t.id}` }],
    });
    await ctx.say(late ? `The part that matters today: ${t.first} owes ${money(t.balance)} and is past the overlock date. Nothing in the lease stops you from offering a plan first.` : `Nothing unusual in ${t.first}'s agreement. It's the standard Alder Lake lease with ${l.addenda.length} addend${l.addenda.length === 1 ? "um" : "a"}.`);
    ctx.suggest(late ? [t.last === "Okafor" ? "Matthew came in and paid $240 cash" : `Offer ${t.name} a payment plan`, `Pull up ${t.name}`] : [`Add an addendum to ${t.name}'s lease`, `Pull up ${t.name}`]);
  },
});
