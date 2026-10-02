import { defineSkill } from "../../engine";
import { kw } from "../../parse";
import { PENDING, REMINDED, SIGNED_NOW, remindSigner } from "../../../data/leases";
import { shortDate, fmtMin } from "../../../data/ledger";

// Nudge everyone with a lease out for signature.
//
//   "Remind everyone who hasn't signed their lease"
//   "Who hasn't signed their lease yet?"

export default defineSkill<{}>({
  id: "frontdesk.leaseReminders",
  category: "frontdesk",
  title: "Unsigned leases",
  featured: true,
  examples: ["Remind everyone who hasn't signed their lease", "Who hasn't signed their lease yet?"],
  match: q => kw(q, [[/\b(hasn't|haven't|has not|not yet|un)\s?signed\b|\bunsigned\b|\bsignature reminders?\b/, 6], [/\blease\b/, 1]]),
  async run(ctx) {
    const open = PENDING.filter(l => !SIGNED_NOW.has(l.key));
    ctx.title("Unsigned leases");
    await ctx.think("Find leases sent but not signed, show how long each has waited, then remind by text and email.", 800);
    await ctx.tool("leases.list", { status: "sent" }, { unsigned: open.length }, 500);
    if (!open.length) {
      await ctx.say("Every lease is signed. Nothing to chase.");
      ctx.suggest(["Show today's move-ins", "What needs my attention today?"]);
      return;
    }
    ctx.focus({ units: open.map(l => l.unitId), selected: open[0].unitId, tenants: [], leads: open.map(l => l.name) });
    const pick = await ctx.ask(
      "table",
      {
        title: `${open.length} leases waiting for a signature`,
        columns: [
          { key: "name", label: "Occupant" },
          { key: "unit", label: "Unit", mono: true },
          { key: "sent", label: "Sent" },
          { key: "viewed", label: "Opened" },
          { key: "rem", label: "Reminders", align: "right", mono: true },
        ],
        rows: open.map(l => ({
          id: l.key,
          cells: { name: l.name, unit: l.unitId, sent: l.sent ? `${shortDate(l.sent.date)} · ${fmtMin(l.sent.min)}` : "—", viewed: l.viewed ? `${shortDate(l.viewed.date)} · ${l.viewed.device}` : "Not yet", rem: String(REMINDED.get(l.key) ?? 0) },
          tone: l.viewed ? undefined : ("warn" as const),
        })),
        selectable: true,
        cta: "Send reminders",
      },
      ["wait:900", "submit"],
    );
    const chosen = open.filter(l => pick.ids.includes(l.key));
    if (!chosen.length) return;
    ctx.effect({
      kind: "lease",
      text: `Signature reminders sent to ${chosen.map(l => l.name).join(", ")}`,
      run: () => chosen.forEach(remindSigner),
      link: { label: "Open leases", route: "ops/leases" },
    });
    const track = ctx.show("delivery", { channel: "sms", title: `${chosen.length} reminders`, rows: chosen.map(l => ({ id: l.key, name: l.name, to: l.phone, state: "queued" as const })) });
    for (const stage of ["sent", "delivered", "read"] as const) {
      await ctx.wait(500);
      track.update(p => ({ rows: p.rows.map((r, i) => (stage === "read" && i > 0 ? r : { ...r, state: stage })) }));
    }
    await ctx.say(`Reminded ${chosen.length === 1 ? chosen[0].name : `all ${chosen.length}`} by text and email with a one-tap signing link. I'll tell you when they sign.`);
    ctx.suggest(["Show today's move-ins", "Email Owen, Hana, Imani and Rafael about move-in times", "What needs my attention today?"]);
  },
});
