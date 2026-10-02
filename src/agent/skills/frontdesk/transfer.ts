import { defineSkill } from "../../engine";
import { kw } from "../../parse";
import { needTenant } from "../../need";
import { isoAdd, money, round2, sizeLabel, snapshot, U } from "../../data";
import { availableUnits, type Unit, type UnitSize } from "../../../data/facility";
import { PLAN_NAME, clockMin, daysBetween, nextBillDate, pushLedger, shortDate, TODAY, type LedgerEntry } from "../../../data/ledger";

// #8 Transfer / upsize / downsize: pick the new unit on the twin, prorate the
// rent difference to the next billing date, addendum by e-sign, gate profile
// carried over, old unit back on the storefront. One approval, full undo.
//
//   "Move Sofia Reyes from her 5×10 to a 10×10"   → C-117 is on hold for her
//   "Upsize Sofia to a 10x10"
//   "Move Sofia Reyes from C-108 to C-117, the 10×10"  → named unit, no question

const ORDER: UnitSize[] = ["5x5", "5x10", "10x10", "10x15", "10x20", "10x30"];
const step = (s: UnitSize, d: 1 | -1) => ORDER[Math.max(0, Math.min(ORDER.length - 1, ORDER.indexOf(s) + d))] ?? "10x10";
const kindLabel = (u: Unit) => (u.kind === "climate" ? `climate, floor ${u.floor}` : u.kind === "parking" ? "parking" : "drive-up");
const doors = (u: Unit) => (u.kind === "climate" ? (u.floor === 2 ? "Gate 1 · Building D doors · elevator" : "Gate 1 · Building D doors") : u.kind === "parking" ? "Gate 1 · RV gate" : "Gate 1");
const HELD: Record<string, string> = { "Sofia Reyes": "C-117" };

export default defineSkill<{ who: string; size: UnitSize }>({
  id: "frontdesk.transfer",
  n: 8,
  category: "frontdesk",
  title: "Transfer units",
  featured: true,
  examples: ["Move Sofia Reyes from her 5×10 to a 10×10", "Upsize Sofia to a 10x10", "Move Sofia Reyes from C-108 to C-117, the 10×10"],
  slots: {
    who: { label: "tenant", fill: q => q.people.find(p => p.kind === "tenant")?.name ?? q.ambiguous[0]?.said, default: "Sofia Reyes" },
    size: {
      label: "to",
      fill: q => {
        const t = q.people.find(p => p.kind === "tenant")?.tenant;
        const target = q.units.find(id => id !== t?.unitIds[0]);
        if (target) return U(target).size;
        return q.sizes.length > 1 ? q.sizes[q.sizes.length - 1] : q.sizes[0];
      },
      default: q => {
        const t = q.people.find(p => p.kind === "tenant")?.tenant;
        const cur = t ? U(t.unitIds[0])?.size : undefined;
        return cur ? step(cur, /\b(downsize|smaller)\b/.test(q.lower) ? -1 : 1) : "10x10";
      },
      show: v => sizeLabel(v),
      options: () => (["5x10", "10x10", "10x15", "10x20"] as UnitSize[]).map(s => ({ value: s, label: sizeLabel(s) })),
    },
  },
  match: q =>
    kw(q, [
      [/\b(transfer|upsize|downsize|bigger unit|smaller unit|larger unit|switch units?|swap units?)\b/, 5],
      [/\bmove\b.*\bfrom\b.*\bto\b/, 4],
      [/\bfrom (her|his|their|the|my)?\s*(\d+\s*[x×]\s*\d+|[a-d]-?\d{3})\b/, 2],
      [/\bmove-?ins?\b|\bmov(e|ing) ?-?out\b|\breservations?\b|\bnew customer\b|\bwalk-?in\b/, -5],
    ]) + (q.people.some(p => p.kind === "tenant") ? 1 : 0),

  async run(ctx, { q, slots }) {
    await ctx.think("Check the current unit and what's paid, find open units of the new size close by, prorate the rent difference to the next bill, and carry the gate code and autopay over.", 1200);
    const t = await needTenant(ctx, q, {
      prefer: x => (/bigger unit/i.test(x.notes ?? "") ? 5 : 0) + (x.balance === 0 ? 1 : 0),
      title: (said, n) => (said ? `${n} tenants named ${said}. Who is transferring?` : "Who is transferring?"),
      filter: x => x.balance === 0,
    });
    const fromId = t.unitIds[0];
    const from = U(fromId);
    const size = (slots.size ?? "10x10") as UnitSize;
    ctx.title(`Transfer · ${t.name}`);

    if (from.size === size) {
      ctx.focus({ tenants: [t.id], selected: fromId, units: [] });
      await ctx.say(`${t.first} is already in a ${sizeLabel(size)} (**${fromId}**). Pick another size on the chip above and I'll find options.`);
      ctx.suggest(["How many 10×10s are free?", "Pull up Matthew Okafor", "What needs my attention today?"]);
      return;
    }

    // 1 · Options of the new size, closest first. A unit on hold for this tenant leads.
    const held = HELD[t.name];
    const named = q.units.find(id => id !== fromId && U(id)?.status === "vacant" && U(id).size === size);
    const rank = (u: Unit) => (u.id === held ? -1000 : 0) + (u.building === from.building ? 0 : 400) + (u.kind === from.kind ? 0 : 200) + Math.abs(u.x - from.x);
    const open = availableUnits(size).filter(u => u.id !== fromId).sort((a, b) => rank(a) - rank(b));
    const picks = named ? [U(named)] : open.slice(0, 3);

    const next = nextBillDate(t);
    const cycleStart = isoAdd(next, 0, -1);
    const cycleDays = daysBetween(cycleStart, next);
    const daysLeft = daysBetween(TODAY, next);
    const thru = isoAdd(next, -1);

    await ctx.tools([
      { name: "units.available", args: { size, near: fromId }, result: () => ({ count: open.length, nearest: open.slice(0, 3).map(u => ({ unit: u.id, rate: u.rate, kind: u.kind })) }), ms: 640 },
      { name: "ledger.get", args: { tenant_id: t.id }, result: () => ({ balance: t.balance, paid_through: thru, next_bill: next, autopay: t.autopay ? t.card : false }), ms: 560 },
    ]);
    ctx.focus({ tenants: [t.id], selected: fromId, units: [fromId, ...picks.map(u => u.id)] });

    if (!picks.length) {
      await ctx.say(`No ${sizeLabel(size)} units are open right now. I can put ${t.first} on the transfer waitlist and text when one frees up.`);
      ctx.suggest(["How many 10×10s are free?", "Pull up Matthew Okafor", "What needs my attention today?"]);
      return;
    }

    const heldOpen = held && picks.some(u => u.id === held);
    await ctx.say(
      `${t.first} is in **${fromId}**, a ${sizeLabel(from.size)} at ${money(t.rent)}/mo${t.autopay ? `, autopay on ${t.card}` : ""}, paid through ${shortDate(thru)}. ` +
        (named ? `${named} is open.` : `I found ${open.length} open ${sizeLabel(size)} units.`) +
        (heldOpen ? ` ${held} is on hold for ${t.first} until tomorrow's 10 am visit.` : ""),
    );

    // 2 · Which unit.
    let to = picks[0];
    if (!named) {
      const id = await ctx.ask(
        "disambiguate",
        {
          title: `${picks.length} open ${sizeLabel(size)} units. Which one for ${t.first}?`,
          meta: "lit on the twin",
          options: picks.map((u, i) => ({
            id: u.id,
            title: `${u.id} · ${kindLabel(u)}`,
            sub:
              u.id === held
                ? `Building ${u.building} · two doors down · on hold until Sat 10 am`
                : `${u.kind === "climate" ? "Building D, elevator" : `Building ${u.building}, faces ${u.facing}`}${u.building === from.building ? " · same building" : ""}`,
            meta: `${money(u.rate)}/mo`,
            badge: u.id === held ? `Held for ${t.first}` : i === 0 ? "Closest" : undefined,
          })),
        },
        ["wait:900", "opt:" + picks[0].id],
      );
      to = picks.find(u => u.id === id) ?? picks[0];
    }
    ctx.focus({ selected: to.id, units: [fromId, to.id] });

    // 3 · The change, priced.
    const oldRent = t.rent;
    const newRent = to.rate;
    const delta = round2(newRent - oldRent);
    const prorated = round2((delta * daysLeft) / cycleDays);
    const sameDoors = doors(from) === doors(to);
    const plan = PLAN_NAME[t.protection];
    const ans = await ctx.ask(
      "diff",
      {
        title: `Transfer · ${t.name}`,
        meta: `${fromId} → ${to.id}`,
        rows: [
          { field: "Unit", before: `${fromId} · ${sizeLabel(from.size)} ${kindLabel(from)}`, after: `${to.id} · ${sizeLabel(to.size)} ${kindLabel(to)}` },
          { field: "Monthly rent", before: money(oldRent), after: `${money(newRent)} (${delta >= 0 ? "+" : "−"}${money(Math.abs(delta))})` },
          { field: prorated >= 0 ? "Due today" : "Credit today", before: "—", after: `${money(Math.abs(prorated))} · ${shortDate(TODAY)}–${shortDate(thru)}, ${daysLeft} of ${cycleDays} days` },
          { field: "Next bill", before: `${shortDate(next)} · ${money(oldRent)}`, after: `${shortDate(next)} · ${money(newRent)}` },
          { field: "Gate access", before: `Code ••${t.gateCode.slice(-2)} · ${doors(from)}`, after: sameDoors ? "Unchanged" : `Same code · ${doors(to)}` },
          { field: "Protection", before: t.protection ? `${plan} · ${money(t.protection).replace(/\.00$/, "")}` : "Declined", after: "Carries over" },
          { field: "Lease", before: "—", after: "Transfer addendum · e-sign by text" },
        ],
        note: `${prorated >= 0 ? `${money(prorated)} goes on ${t.card ?? "the card on file"} today` : `${money(-prorated)} is credited to the account`}. No admin fee for transfers. ${fromId} goes back on the storefront after cleaning.`,
        cta: "Approve transfer",
      },
      ["wait:1100", "submit"],
    );
    if (ans !== "approve") {
      await ctx.say(`Cancelled. Nothing changed${heldOpen ? `, and ${held} stays on hold for ${t.first} until tomorrow` : ""}.`);
      ctx.suggest(["How many 10×10s are free?", "Pull up Matthew Okafor", "What needs my attention today?"]);
      return;
    }

    // 4 · Charge, addendum, e-sign.
    const receiptNo = `RCPT-${9400 + Math.floor(Math.random() * 90)}`;
    await ctx.tools([
      { name: prorated >= 0 ? "payments.charge" : "ledger.credit", args: { tenant_id: t.id, amount: Math.abs(prorated), card: t.card ?? null }, result: { status: "succeeded", receipt: receiptNo }, ms: 820 },
      { name: "leases.addendum.create", args: { tenant_id: t.id, type: "transfer", from: fromId, to: to.id, rent: newRent, effective: TODAY }, result: { addendum: `AD-${t.id}-T2`, pages: 2 }, ms: 760 },
      { name: "esign.send", args: { to: t.phone, document: `AD-${t.id}-T2` }, result: { status: "sent", link: `zonera.co/s/${t.id.toLowerCase()}t2` }, ms: 680 },
    ]);

    const restore = snapshot(t);
    const prevTo = { status: to.status, tenantId: to.tenantId };
    let lines: LedgerEntry[] = [];
    const actionId = ctx.effect({
      kind: "lease",
      text: `Transferred ${t.name} from ${fromId} to ${to.id} · ${money(newRent)}/mo`,
      link: { label: "Open profile", route: "ops/tenants/" + t.id },
      run: () => {
        t.unitIds = t.unitIds.map(x => (x === fromId ? to.id : x));
        from.status = "vacant";
        from.tenantId = undefined;
        to.status = "occupied";
        to.tenantId = t.id;
        t.rent = newRent;
        t.notes = `Moved from ${fromId} on Oct 2. Transfer addendum out for e-signature.`;
        t.lastContact = "Oct 2 · Transfer addendum sent";
        const min = clockMin();
        lines = [
          pushLedger(t.id, { date: TODAY, min, kind: prorated >= 0 ? "rent" : "credit", text: `Transfer ${fromId} → ${to.id} · prorated ${shortDate(TODAY)} – ${shortDate(thru)}`, detail: `${daysLeft} of ${cycleDays} days at ${delta >= 0 ? "+" : "−"}${money(Math.abs(delta))}/mo`, amount: prorated, by: "Zonera agent" }),
          ...(prorated > 0 ? [pushLedger(t.id, { date: TODAY, min: min + 1, kind: "payment", text: "Card payment", ref: receiptNo, amount: -prorated, method: `Card · ${t.card ?? "on file"}`, by: "Zonera agent" })] : []),
        ];
      },
      undo: () => {
        restore();
        to.status = prevTo.status;
        to.tenantId = prevTo.tenantId;
        for (const l of lines) Object.assign(l, { kind: "info", amount: 0, text: `Voided · ${l.text}`, detail: "Transfer undone" });
      },
    });

    // 5 · What happens next, live.
    const items = [
      { id: "pay", label: prorated >= 0 ? `Charged ${money(prorated)} to ${t.card ?? "card on file"}` : `Credited ${money(-prorated)} to the account`, result: receiptNo, state: "todo" as const },
      { id: "add", label: "Transfer addendum generated", result: "2 pages", state: "todo" as const },
      { id: "sign", label: `E-sign link texted to ${t.first}`, result: t.phone, state: "todo" as const },
      { id: "gate", label: `Gate profile moved to ${to.id}`, result: sameDoors ? `Same code ••${t.gateCode.slice(-2)}` : doors(to), state: "todo" as const },
      { id: "relist", label: `${fromId} queued for cleaning, then re-listed`, result: `${money(from.rate)}/mo`, state: "todo" as const },
    ];
    const h = ctx.show("progress", { title: "Transferring", items: items.map(i => ({ ...i, result: undefined })) });
    for (let i = 0; i < items.length; i++) {
      h.update({ items: items.map((x, j) => ({ ...x, state: j < i ? "done" : j === i ? "run" : "todo", result: j < i ? x.result : undefined })) });
      await ctx.wait(480);
    }
    h.update({ items: items.map(x => ({ ...x, state: "done" })), summary: `${items.length} of ${items.length} done` });

    ctx.show("receipt", {
      title: "Unit transfer",
      no: receiptNo,
      payer: t.name,
      unit: `${fromId} → ${to.id}`,
      lines: [{ label: `Prorated difference · ${shortDate(TODAY)} – ${shortDate(thru)}`, amount: prorated }],
      method: prorated >= 0 ? t.card ?? "Card on file" : "Account credit",
      balance: t.balance,
      paidThrough: shortDate(thru),
      sentTo: t.phone,
      triggered: [`Rent ${money(oldRent)} → ${money(newRent)} from ${shortDate(next)}`, "Addendum out for e-signature", `${to.id} marked occupied on the twin`, `${fromId} back on the storefront after cleaning`],
      actionId,
      links: [
        { label: "Open profile", route: "ops/tenants/" + t.id },
        { label: "Open lease", route: "ops/leases/" + t.id },
      ],
    });
    await ctx.say(`Done. ${t.first} is in **${to.id}** from today. Next bill on ${shortDate(next)} is ${money(newRent)}${t.autopay ? " on autopay" : ""}. ${sameDoors ? `${t.first}'s gate code doesn't change.` : "Same gate code, now with Building D access."}`);
    ctx.suggest(["How many 10×10s are free?", "Pull up Matthew Okafor", "What needs my attention today?"]);
  },
});
