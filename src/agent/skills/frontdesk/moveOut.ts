import { defineSkill } from "../../engine";
import { kw } from "../../parse";
import { needTenant } from "../../need";
import { money, round2, sizeLabel, U } from "../../data";

// #6 Schedule a move-out: final bill with prepaid refund, inspection, access end, re-list.
export default defineSkill<{ who: string }>({
  id: "frontdesk.moveOut",
  n: 6,
  category: "frontdesk",
  title: "Schedule move-out",
  featured: true,
  examples: ["Ben Carter is moving out Friday", "Close out Ben Carter's unit today"],
  slots: { who: { label: "tenant", fill: q => q.people[0]?.name ?? q.ambiguous[0]?.said, default: "Ben Carter" } },
  match: q => kw(q, [[/\bmov(e|ing) ?-?out\b|\bvacat|\bclose out\b|\bleaving\b/, 4]]),
  async run(ctx, { q }) {
    await ctx.think("Prorate the final month, refund prepaid days to the card, book the inspection, end gate access, re-list the unit.", 1100);
    const t = await needTenant(ctx, q, { title: (said, n) => `${n} tenants match "${said}". Who is moving out?` });
    const unitId = t.unitIds[0];
    const u = U(unitId);
    ctx.title(`Move-out · ${t.name}`);
    ctx.focus({ tenants: [t.id], selected: unitId });
    const unusedDays = 29; // Oct 3–31, prepaid through Oct 31
    const refund = round2((t.rent * unusedDays) / 31);
    await ctx.tools([
      { name: "ledger.get", args: { tenant_id: t.id }, result: { paid_through: "2026-10-31", balance: 0 }, ms: 600 },
      { name: "calendar.slots", args: { type: "inspection", date: "2026-10-02" }, result: ["3:30 pm", "4:30 pm"], ms: 500 },
    ]);
    await ctx.say(`${t.name} is prepaid through Oct 31 for **${unitId}** (${sizeLabel(u.size)}, ${money(t.rent)}/mo). Moving out today leaves 29 unused days, so the refund is **${money(refund)}** to ${t.card ?? "the card on file"}.`);
    const ok = await ctx.ask(
      "plan",
      {
        title: `Move-out · ${t.name}`,
        meta: unitId,
        items: [
          { id: "refund", label: `Refund ${money(refund)} to ${t.card ?? "card on file"}`, sub: "29 of 31 days · prorated", tier: "Ask first" },
          { id: "inspect", label: "Book move-out inspection · today 3:30 pm", sub: "Marco Diaz on site", tier: "Auto" },
          { id: "gate", label: "End gate access · today 10:00 pm", sub: `Code for ${unitId} deactivates at close`, tier: "Auto" },
          { id: "relist", label: `Re-list ${unitId} after cleaning`, sub: `${sizeLabel(u.size)} at ${money(u.rate)} street rate`, tier: "Auto" },
          { id: "sms", label: "Text confirmation with the inspection time", tier: "Auto" },
        ],
        impact: `Unit returns to inventory · −${money(t.rent)}/mo recurring`,
        cta: "Approve move-out",
      },
      ["wait:900", "submit"],
    );
    if (ok.secondary) return;
    const items = [
      { id: "1", label: `Refund ${money(refund)} · re_3Q8x…`, state: "todo" as const },
      { id: "2", label: "Inspection booked · 3:30 pm", state: "todo" as const },
      { id: "3", label: "Gate access ends 10:00 pm", state: "todo" as const },
      { id: "4", label: `${unitId} set to available after cleaning`, state: "todo" as const },
      { id: "5", label: `SMS sent to ${t.phone}`, state: "todo" as const },
    ];
    const h = ctx.show("progress", { title: "Closing out", items });
    for (let i = 0; i < items.length; i++) {
      h.update({ items: items.map((x, j) => ({ ...x, state: j < i ? "done" : j === i ? "run" : "todo" })) });
      await ctx.wait(500);
    }
    h.update({ items: items.map(x => ({ ...x, state: "done" })), summary: "5 of 5 done" });
    const prev = { status: u.status, tenantId: u.tenantId, units: [...t.unitIds] };
    const id = ctx.effect({
      kind: "moveout",
      text: `${t.name} moved out of ${unitId} · ${money(refund)} refunded`,
      run: () => {
        u.status = "vacant";
        u.tenantId = undefined;
        t.unitIds = t.unitIds.filter(x => x !== unitId);
      },
      undo: () => {
        u.status = prev.status;
        u.tenantId = prev.tenantId;
        t.unitIds = prev.units;
      },
      link: { label: "View unit", route: "ops/units" },
    });
    ctx.show("receipt", { title: "Move-out", no: "MO-20261002-031", payer: t.name, unit: unitId, lines: [{ label: "Prepaid rent refund (29 days)", amount: -refund }], method: t.card ?? "Card on file", balance: 0, sentTo: t.phone, triggered: ["Inspection booked for 3:30 pm", "Gate code ends 10:00 pm", `${unitId} back on the storefront after cleaning`], actionId: id, links: [{ label: "Open profile", route: "ops/tenants/" + t.id }] });
    ctx.suggest(["Ask Ben for a Google review", "Show available 10×15s", "What needs my attention today?"]);
  },
});
