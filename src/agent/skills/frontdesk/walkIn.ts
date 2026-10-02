import { defineSkill } from "../../engine";
import { kw } from "../../parse";
import { money, moveIn, nextCode, round2, sizeLabel } from "../../data";
import { availableUnits, FACILITY, type UnitSize } from "../../../data/facility";
import { PROTECTION, ADMIN_FEE } from "../../../data/catalog";

// #1 Walk-in move-in: pick the unit on the twin, protection, prorated charge,
// lease e-signed at the counter, gate code. Everything in one conversation.
const sizeFrom = (text: string): UnitSize | undefined => {
  const m = text.match(/(\d+)\s*(?:x|×|by)\s*(\d+)/i);
  return m ? (`${m[1]}x${m[2]}` as UnitSize) : undefined;
};

export default defineSkill<{ who: string; size: UnitSize }>({
  id: "frontdesk.walkIn",
  n: 1,
  category: "frontdesk",
  title: "Walk-in move-in",
  featured: true,
  examples: ["New customer wants a 10×10 today, Jordan Lee", "Rent a 5x10 to the person at the counter, Priya Shah"],
  slots: {
    who: { label: "customer", fill: q => q.newNames[0] ?? q.people.find(p => p.kind === "lead")?.name, default: "Jordan Lee" },
    size: { label: "size", fill: q => (q.sizes[0] as UnitSize) ?? sizeFrom(q.text), default: "10x10", show: v => sizeLabel(v) },
  },
  match: q => kw(q, [[/\bnew (customer|tenant)\b|\bwalk-?in\b|\bat the counter\b/, 4], [/\b(rent|wants|needs) (a|an)\b/, 2], [/\breservations?\b/, -2]]),
  async run(ctx, { slots }) {
    const name = slots.who ?? "Jordan Lee";
    const size = (slots.size ?? "10x10") as UnitSize;
    const [first, ...rest] = name.split(" ");
    ctx.title(`Move-in · ${name}`);
    await ctx.think(`Walk-in for a ${sizeLabel(size)} today. Show what's open, closest to the gate first, then protection, payment and lease in one pass.`, 1100);
    const open = availableUnits(size).slice(0, 4);
    await ctx.tool("units.available", { size, date: "2026-10-02" }, { count: open.length, units: open.map(u => u.id) }, 600);
    if (!open.length) {
      await ctx.say(`No ${sizeLabel(size)} units are open today. I can put ${first} on the waitlist or offer the next size up.`);
      return;
    }
    ctx.focus({ units: open.map(u => u.id), selected: open[0].id, tenants: [] });
    const unitId = await ctx.ask(
      "disambiguate",
      {
        title: `${open.length} ${sizeLabel(size)} units open. Which one for ${first}?`,
        meta: "lit on the twin",
        options: open.map((u, i) => ({
          id: u.id,
          title: `${u.id} · ${u.kind === "climate" ? `climate, floor ${u.floor}` : "drive-up"}`,
          sub: `${sizeLabel(u.size)} · ${u.kind === "climate" ? "Building D, elevator" : `Building ${u.building}, faces ${u.facing}`}`,
          meta: `${money(u.rate)}/mo`,
          badge: i === 0 ? "Closest to the gate" : undefined,
        })),
      },
      ["wait:900", "opt:" + open[0].id],
    );
    const unit = open.find(u => u.id === unitId) ?? open[0];
    ctx.focus({ units: [], selected: unit.id, tenants: [] });
    const prot = await ctx.ask(
      "quickReplies",
      {
        question: `Protection for ${first}'s things?`,
        options: [
          ...PROTECTION.map(p => ({ value: String(p.id), label: `${p.cover} · ${money(p.price)}/mo`, hint: p.note })),
          { value: "0", label: "Own policy", hint: "Upload renter's or homeowner's declaration" },
        ],
      },
      ["wait:900", "opt:5000"],
    );
    const cover = Number(prot) as 0 | 2000 | 5000 | 10000;
    const protPrice = PROTECTION.find(p => p.id === cover)?.price ?? 0;
    const rent = round2((unit.rate * 30) / 31);
    const lines = [
      { label: `Rent · Oct 2 – Oct 31 (30 of 31 days)`, amount: rent },
      { label: "Admin fee", amount: ADMIN_FEE },
      ...(protPrice ? [{ label: `Protection · ${PROTECTION.find(p => p.id === cover)!.cover}`, amount: protPrice }] : []),
    ];
    const pay = await ctx.ask(
      "payment",
      { payer: name, title: "Collect first payment", method: "reader", methods: ["reader", "new-card", "cash", "check"], lines, receiptTo: "(530) 555-0144", card: "Visa •• 3311", after: `Then ${money(unit.rate + protPrice)}/mo on the 2nd, autopay on`, cta: "Charge" },
      ["wait:900", "submit"],
    );
    const items = [
      { label: "Lease sent", state: "todo" as const },
      { label: "Signed on the counter iPad", state: "todo" as const },
      { label: "Payment", state: "todo" as const, value: money(pay.amount) },
      { label: "Gate code", state: "todo" as const },
    ];
    const code = nextCode();
    const card = { id: "c", title: name, sub: `${unit.id} · ${sizeLabel(unit.size)}`, avatar: name, steps: items.map(x => ({ ...x })) };
    const h = ctx.show("batch", { title: "Moving in", cards: [card] });
    for (let i = 0; i < items.length; i++) {
      card.steps[i].state = "run" as any;
      h.update({ cards: [{ ...card, steps: [...card.steps] }] });
      await ctx.wait(550);
      card.steps[i].state = "done" as any;
      if (i === 1) card.steps[i].value = "9:52 am";
      if (i === 3) card.steps[i].value = code + "#";
    }
    h.update({ cards: [{ ...card, steps: [...card.steps], total: `${money(pay.amount)} paid · ${money(unit.rate + protPrice)}/mo` }], summary: `${first} is moved in` });
    let undo = () => {};
    const id = ctx.effect({
      kind: "movein",
      text: `${name} moved into ${unit.id} · ${money(pay.amount)} ${pay.method === "cash" ? "cash" : "card"}`,
      run: () => {
        const r = moveIn({ first, last: rest.join(" ") || "Lee", phone: "(530) 555-0144", email: `${first.toLowerCase()}@example.com`, unitId: unit.id, rent: unit.rate, protection: cover, card: pay.card ?? "Visa •• 3311", gateCode: code });
        undo = r.undo;
      },
      undo: () => undo(),
      link: { label: "Open tenants", route: "ops/tenants" },
    });
    ctx.show("receipt", {
      title: "Move-in",
      no: "R-20261002-0421",
      payer: name,
      unit: unit.id,
      lines,
      method: pay.method === "cash" ? "Cash" : pay.method === "check" ? "Check" : "Visa •• 3311",
      balance: 0,
      paidThrough: "Oct 31",
      sentTo: "(530) 555-0144",
      triggered: [`Lease signed for ${unit.id}`, `Gate code ${code}# texted · ${FACILITY.gateHours}`, `${unit.id} marked occupied on the twin`],
      actionId: id,
      links: [{ label: "Open tenants", route: "ops/tenants" }],
    });
    ctx.suggest([`Text ${first} directions to ${unit.id}`, "Show today's move-ins", "What needs my attention today?"]);
  },
});
