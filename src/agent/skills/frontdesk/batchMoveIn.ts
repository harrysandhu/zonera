import { defineSkill } from "../../engine";
import { kw } from "../../parse";
import { RESERVATIONS, lead, moveIn, money, nextCode, U, removeLead, sizeLabel } from "../../data";
import { availableUnits, type UnitSize } from "../../../data/facility";
import type { BatchCard } from "../../widgets/core/types";

// #3 Batch move-ins: several reservations moved in at once, one approval, parallel progress.
const DEFAULT = ["Owen Murphy", "Hana Sato", "Imani Mensah"];

export default defineSkill<{ who: string[] }>({
  id: "frontdesk.batchMoveIn",
  n: 3,
  category: "frontdesk",
  title: "Batch move-ins",
  featured: true,
  examples: ["Move these three reservations in today: Owen Murphy, Hana Sato, Imani Mensah", "Move in everyone reserved for this week"],
  slots: {
    who: {
      label: "reservations",
      fill: q => {
        const names = q.people.filter(p => p.kind === "lead").map(p => p.name);
        return names.length ? names : undefined;
      },
      default: DEFAULT,
      show: v => `${v.length} people`,
    },
  },
  match: q => kw(q, [[/\bmove\b.*\bin\b|\bmove-?ins?\b/, 2], [/\b(reservations?|reserved|these (two|three|four|\d))\b/, 2], [/\bbatch|all of them|everyone reserved\b/, 2], [/\bfinish\b.*\bmove-?in\b/, 3]]),
  async run(ctx, { slots }) {
    const names = (slots.who ?? DEFAULT).filter(n => RESERVATIONS[n] || lead(n));
    ctx.title(names.length === 1 ? `Move-in · ${names[0]}` : `Move-ins · ${names.length} reservations`);
    await ctx.think("Match each reservation to its held unit, prepare leases, charge the card on file, issue gate codes.", 1200);
    const picks = names.map(n => {
      const r = RESERVATIONS[n];
      const l = lead(n);
      const size = (l?.size ?? "10x10") as UnitSize;
      let unitId = r?.unit;
      if (!unitId || !["vacant", "reserved"].includes(U(unitId).status)) unitId = availableUnits(size)[0]?.id ?? unitId;
      const u = U(unitId!);
      return { name: n, unitId: unitId!, size: u.size, rent: u.rate, card: r?.card ?? "card at signing", protection: r?.protection ?? 2000, phone: l?.phone ?? "(530) 555-0100", email: r?.email ?? `${n.split(" ")[0].toLowerCase()}@example.com` };
    });
    await ctx.tools([
      { name: "reservations.get", args: { names }, result: { found: picks.length }, ms: 600 },
      { name: "units.hold.check", args: { units: picks.map(p => p.unitId) }, result: picks.map(p => ({ unit: p.unitId, status: "held" })), ms: 700 },
    ]);
    ctx.focus({ units: picks.map(p => p.unitId), selected: picks[0]?.unitId ?? null, tenants: [], leads: names });
    await ctx.say(`${picks.length === 1 ? "The reservation is" : `${picks.length} reservations are`} ready. ${picks.length === 1 ? "The unit is" : "All units are"} still held. First month is prorated from today (Oct 2, 30 of 31 days).`);
    const ok = await ctx.ask(
      "plan",
      {
        title: `Move in ${picks.length} customers`,
        meta: "Today",
        items: picks.flatMap(p => [
          { id: p.name + ":lease", group: p.name, label: `Lease for ${p.unitId} · ${sizeLabel(p.size)} · ${money(p.rent)}/mo`, sub: "Sent by SMS for e-signature", tier: "Auto" as const },
          { id: p.name + ":pay", group: p.name, label: `Charge ${money(Math.round((p.rent * 30) / 31 * 100) / 100 + 25)} to ${p.card}`, sub: "Prorated rent + $25 admin fee", tier: "Ask first" as const },
        ]),
        impact: `+${picks.length} occupied units · +${money(picks.reduce((s, p) => s + p.rent, 0))}/mo recurring`,
        cta: "Approve and move in",
      },
      ["wait:900", "submit"],
    );
    if (ok.secondary) return;
    const cards: BatchCard[] = picks.map(p => ({
      id: p.name,
      title: p.name,
      sub: `${p.unitId} · ${sizeLabel(p.size)}`,
      avatar: p.name,
      steps: [
        { label: "Lease sent", state: "todo" },
        { label: "Signed", state: "todo" },
        { label: "Payment", state: "todo" },
        { label: "Gate code", state: "todo" },
      ],
    }));
    const h = ctx.show("batch", { title: "Moving in", cards });
    for (let step = 0; step < 4; step++) {
      for (let i = 0; i < cards.length; i++) {
        cards[i].steps[step].state = "run";
        h.update({ cards: cards.map(c => ({ ...c, steps: [...c.steps] })) });
        await ctx.wait(450);
        const p = picks[i];
        cards[i].steps[step].state = "done";
        cards[i].steps[step].value = step === 1 ? "9:4" + (6 + i) + " am" : step === 2 ? money(Math.round((p.rent * 30) / 31 * 100) / 100 + 25) : step === 3 ? nextCode() + "#" : undefined;
      }
      h.update({ cards: cards.map(c => ({ ...c, steps: [...c.steps] })) });
    }
    let undos: (() => void)[] = [];
    ctx.effect({
      kind: "movein",
      text: `Moved in ${picks.map(p => p.name).join(", ")}`,
      run: () => {
        undos = picks.map(p => {
          const [first, ...rest] = p.name.split(" ");
          const r = moveIn({ first, last: rest.join(" "), phone: p.phone, email: p.email, unitId: p.unitId, rent: p.rent, protection: p.protection as 0 | 2000 | 5000 | 10000, card: p.card, gateCode: nextCode() });
          const u2 = removeLead(p.name);
          return () => {
            u2();
            r.undo();
          };
        });
      },
      undo: () => undos.forEach(u => u()),
      link: { label: "Open tenants", route: "ops/tenants" },
    });
    h.update({ summary: `${picks.length} of ${picks.length} moved in · leases signed · codes sent` });
    await ctx.say(`Done. ${picks.length} customers moved in, leases signed, cards charged and gate codes texted. Units are marked occupied on the twin.`);
    ctx.suggest(["Email Owen, Hana, Imani and Rafael about move-in times", "Show today's move-ins", "Call Leila Haddad and finish her reservation"]);
  },
});
