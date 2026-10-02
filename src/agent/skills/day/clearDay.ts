import { defineSkill } from "../../engine";
import { kw } from "../../parse";
import { CALENDAR, STAFF, type CalEvent } from "../../data";
import { availableUnits } from "../../../data/facility";

// #69 Clear my day: read today's calendar and chores, propose who takes each
// one (the agent, Marco on the afternoon shift, or a later day), run it with
// live progress, then show what's left. The calendar is shared live data, so
// the morning briefing reflects the new owners afterwards. Undo restores it.
//
//   "I don't want to do the walkthroughs or the auction prep today"
//   "Clear my afternoon" · "Take the lien prep off my plate"

type Who = "Agent" | "Marco" | "Monday";
interface Task {
  ev: CalEvent;
  isNew?: boolean; // a chore that isn't on the calendar yet
  group: string;
  who: Who;
  label: string;
  sub: string;
  tier: "Auto" | "Ask first";
  on: boolean;
  done: string; // progress label once handled
  result: string;
  note: string;
}

const SCOPES = ["walkthroughs + auction prep", "this afternoon", "whole day"] as const;
type Scope = (typeof SCOPES)[number] | string;

const toMin = (at: string) => {
  const m = /(\d+):(\d+)\s*(am|pm)/.exec(at);
  return m ? ((+m[1] % 12) + (m[3] === "pm" ? 12 : 0)) * 60 + +m[2] : 0;
};

function scopeOf(lower: string): Scope | undefined {
  if (/\bafternoon\b/.test(lower)) return "this afternoon";
  if (/\b(whole|entire|my) day\b|\bclear (my|the) (day|calendar|schedule)\b/.test(lower)) return "whole day";
  const bits: string[] = [];
  if (/\bwalk-?throughs?\b|\binspections?\b/.test(lower)) bits.push("walkthroughs");
  if (/\bauction|lien\b/.test(lower)) bits.push("auction prep");
  if (/\bhvac|vendor\b/.test(lower)) bits.push("HVAC visit");
  if (/\btours?\b/.test(lower)) bits.push("tour");
  return bits.length ? bits.join(" + ") : undefined;
}

export default defineSkill<{ scope: Scope }>({
  id: "day.clearDay",
  n: 69,
  category: "day",
  title: "Clear my day",
  featured: true,
  examples: ["I don't want to do the walkthroughs or the auction prep today", "Clear my afternoon", "Take the lien prep off my plate"],
  slots: {
    scope: {
      label: "clear",
      fill: q => scopeOf(q.lower),
      default: "walkthroughs + auction prep",
      options: () => SCOPES.map(s => ({ value: s, label: s })),
    },
  },
  match: q =>
    kw(q, [
      [/\bdon'?t want to (do|deal)|\bclear my\b|\boff my plate\b|\bcan'?t (do|get to|make)\b|\bnot doing\b|\bhand off my\b|\bcover for me\b/, 5],
      [/\bclear\b.*\b(day|afternoon|morning|schedule|calendar|plate)\b/, 2],
      [/\b(walk-?throughs?|auction prep|lien (sale )?prep|inspections?|tours?|my tasks|my calendar|meetings?)\b/, 2],
      [/\b(today|afternoon|morning)\b/, 1],
    ]),

  async run(ctx, { q, slots }) {
    const scope = slots.scope ?? "walkthroughs + auction prep";
    ctx.title("Clear my day");
    await ctx.think("Read today's calendar and chores. Marco is on site this afternoon, so hand him anything physical; take the paperwork myself; anything that needs your signature moves to Monday.", 1200);

    const marco = STAFF.marco;
    const vacant = availableUnits();
    await ctx.tools([
      { name: "calendar.get", args: { date: "2026-10-02", owner: "Priya Raman" }, result: () => CALENDAR.filter(e => !e.done && e.owner === "Priya").map(e => ({ id: e.id, at: e.t, title: e.title })), ms: 620 },
      { name: "tasks.list", args: { due: "2026-10-02", assignee: "Priya Raman" }, result: () => [{ id: "chore-vacant", title: "Vacant unit walkthrough", units: vacant.length, recurring: "weekly" }], ms: 540 },
      { name: "staff.availability", args: { date: "2026-10-02" }, result: { "Marco Diaz": { role: marco.role, shift: "13:00-18:00", open_slots: ["13:15", "14:00", "15:30"] } }, ms: 500 },
    ]);

    // Today's chores: everything on the calendar that's still Priya's, plus the weekly walkthrough.
    const chore: CalEvent = { id: "ev-walk", t: "2:00 pm", title: `Vacant unit walkthrough, ${vacant.length} units`, meta: "Weekly · lock, light and cleanliness check", kind: "inspection", owner: "Priya" };
    const evs = [...CALENDAR.filter(e => !e.done && e.owner === "Priya")];
    if (!CALENDAR.some(e => e.id === chore.id)) evs.push(chore);
    evs.sort((a, b) => toMin(a.t) - toMin(b.t));

    const want = (e: CalEvent) => {
      if (scope === "this afternoon") return toMin(e.t) >= 12 * 60;
      if (scope === "whole day") return true;
      const s = scope.toLowerCase();
      if (e.kind === "inspection") return s.includes("walkthrough");
      if (e.kind === "lien") return s.includes("auction");
      if (e.kind === "vendor") return s.includes("hvac");
      if (e.kind === "tour") return s.includes("tour");
      return false;
    };

    const plan = (e: CalEvent): Task => {
      const isNew = e.id === chore.id;
      if (e.kind === "lien")
        return {
          ev: e,
          group: "Auction prep · I'll take it",
          who: "Agent",
          label: `${e.title} · ${e.t}`,
          sub: "I check the §21703 timeline, verify the alternate contact and stage the preliminary notice. Your signature moves to Mon 9:00 am.",
          tier: "Ask first",
          on: true,
          done: "Lien packet for A-131 prepared",
          result: "Sign-off Mon 9:00 am",
          note: "Packet prepared by the agent · your sign-off Mon 9:00 am",
        };
      if (e.kind === "inspection")
        return {
          ev: e,
          isNew,
          group: `Walkthroughs · ${marco.name}, ${marco.shift}`,
          who: "Marco",
          label: `${e.title} · ${e.t}`,
          sub: isNew ? "Route and checklist sent to Marco's phone. Photos attach to each unit." : "Delegate to Marco. Move-in photos and the inspection checklist go to his phone.",
          tier: "Auto",
          on: true,
          done: isNew ? `Vacant walkthrough → ${marco.name}` : `${e.title.replace("Move-out inspection, ", "")}'s inspection → ${marco.name}`,
          result: "Checklist sent",
          note: "Delegated to Marco Diaz · checklist sent",
        };
      if (e.kind === "vendor")
        return {
          ev: e,
          group: scope === "this afternoon" || scope === "whole day" ? `Walkthroughs · ${marco.name}, ${marco.shift}` : "Also today",
          who: "Marco",
          label: `${e.title} · ${e.t}`,
          sub: "Hand to Marco. Lakeside Mechanical is told to ask for him at the office.",
          tier: "Auto",
          on: want(e),
          done: `HVAC visit → ${marco.name}`,
          result: "Vendor notified",
          note: "Delegated to Marco Diaz",
        };
      return {
        ev: e,
        group: "Also today",
        who: "Agent",
        label: `${e.title} · ${e.t}`,
        sub: "Self-guided: I text a one-time gate code and unlock two open 10×10s for 45 minutes, then answer questions by text.",
        tier: "Ask first",
        on: want(e),
        done: "Self-guided tour set up for Jordan Lee",
        result: "Code texted",
        note: "Self-guided tour · run by the agent",
      };
    };

    const tasks = evs.filter(e => want(e) || (e.kind === "vendor" && scope.includes("walkthrough"))).map(plan);
    if (!tasks.length) {
      await ctx.say("Nothing matching is still on your calendar today. Marco and I already have it.");
      ctx.suggest(["What needs my attention today?", "Start the lien process for Dana Whitfield", "Generate the September owner report vs last year"]);
      return;
    }
    const keep = evs.filter(e => !tasks.some(t => t.ev.id === e.id));
    await ctx.say(
      `You have **${evs.length} things** left today. Marco is on site ${marco.shift.replace("on site ", "")}, so he can take the walkthroughs. ` +
        (tasks.some(t => t.ev.kind === "lien") ? "I'll do the lien paperwork; the law needs your signature on the notice, so that moves to Monday." : ""),
    );

    const ok = await ctx.ask(
      "plan",
      {
        title: "Hand off today's work",
        meta: scope,
        items: tasks.map(t => ({ id: t.ev.id, group: t.group, label: t.label, sub: t.sub, tier: t.tier, on: t.on })),
        impact: keep.length ? `You keep: ${keep.map(e => `${e.title.replace(/,.*$/, "")} ${e.t}`).join(", ")}` : "Your calendar is clear",
        cta: "Approve and hand off {n}",
      },
      ["wait:1000", "submit"],
    );
    if (ok.secondary) return;
    const chosen = tasks.filter(t => ok.ids.includes(t.ev.id));

    // Run it: assign, notify, prepare.
    const toMarco = chosen.filter(t => t.who === "Marco");
    const mine = chosen.filter(t => t.who === "Agent");
    await ctx.tools([
      ...(toMarco.length ? [{ name: "tasks.assign", args: { to: marco.name, tasks: toMarco.map(t => t.ev.id) }, result: { assigned: toMarco.length, notified: marco.phone }, ms: 700 }] : []),
      ...(mine.some(t => t.ev.kind === "lien") ? [{ name: "liens.packet.prepare", args: { unit: "A-131", statute: "CA B&P §21703" }, result: { notices_verified: 3, alt_contact: "Marcus Whitfield · verified", status: "awaiting_signature" }, ms: 900 }] : []),
      ...(mine.some(t => t.ev.kind === "tour") ? [{ name: "gate.codes.create", args: { holder: "Jordan Lee", window: "10:55-11:40" }, result: { code: "7316#", status: "scheduled" }, ms: 600 }] : []),
      { name: "calendar.update", args: { date: "2026-10-02", changes: chosen.length }, result: { ok: true }, ms: 450 },
    ]);

    const items = [
      ...chosen.map(t => ({ id: t.ev.id, label: t.done, sub: `${t.ev.t} · ${t.ev.meta}`, result: t.result, state: "todo" as const })),
      { id: "cal", label: "Calendar updated", result: "", state: "todo" as const },
    ];
    const h = ctx.show("progress", { title: "Handing off", items: items.map(i => ({ ...i, result: undefined })) });
    for (let i = 0; i < items.length; i++) {
      h.update({ items: items.map((x, j) => ({ ...x, state: j < i ? "done" : j === i ? "run" : "todo", result: j < i ? x.result || undefined : undefined })) });
      await ctx.wait(520);
    }

    const prev = CALENDAR.map(e => ({ e, owner: e.owner, note: e.note }));
    let added: CalEvent | undefined;
    ctx.effect({
      kind: "agent",
      text: `Cleared Priya's ${scope === "whole day" ? "day" : scope === "this afternoon" ? "afternoon" : scope}: ${toMarco.length} to Marco Diaz, ${mine.length} to the agent`,
      run: () => {
        for (const t of chosen) {
          const owner = t.who === "Marco" ? "Marco" : "Agent";
          if (t.isNew) {
            added = { ...t.ev, owner, note: t.note };
            const at = CALENDAR.findIndex(e => toMin(e.t) > toMin(added!.t));
            CALENDAR.splice(at < 0 ? CALENDAR.length : at, 0, added);
          } else {
            t.ev.owner = owner;
            t.ev.note = t.note;
          }
        }
      },
      undo: () => {
        for (const p of prev) {
          p.e.owner = p.owner;
          p.e.note = p.note;
        }
        if (added) {
          const i = CALENDAR.indexOf(added);
          if (i >= 0) CALENDAR.splice(i, 1);
        }
      },
      link: { label: "Open overview", route: "ops/overview" },
    });

    const left = [...CALENDAR.filter(e => !e.done && e.owner === "Priya")];
    items[items.length - 1].result = left.length ? `${left.length} left for you` : "Clear";
    h.update({ items: items.map(x => ({ ...x, state: "done", result: x.result || undefined })), summary: `${chosen.length} handed off · ${toMarco.length} to Marco, ${mine.length} to me` });

    const agenda = [...CALENDAR.filter(e => !e.done)].sort((a, b) => toMin(a.t) - toMin(b.t));
    const ownerLabel = (e: CalEvent) => (e.owner === "Priya" ? "You" : e.owner === "Marco" ? "Marco" : "Zonera agent");
    ctx.show("answer", {
      label: "Your day",
      value: left.length ? `${left.length} thing${left.length === 1 ? "" : "s"} left` : "Clear",
      context: left.length ? left.map(e => `${e.title.replace(/,.*$/, "")} at ${e.t}`).join(" · ") : "Marco and I have everything else.",
      itemsTitle: "Today",
      items: agenda.map(e => ({ label: e.title, meta: `${e.t} · ${ownerLabel(e)}` })),
      links: [{ label: "Open overview", route: "ops/overview" }],
    });
    await ctx.say(
      `Done. Marco has ${toMarco.length} ${toMarco.length === 1 ? "task" : "tasks"} with checklists on his phone${mine.length ? `, and I have ${mine.length === 1 ? "the " + (mine[0].ev.kind === "lien" ? "lien prep" : "tour") : mine.length + " more"}` : ""}. ` +
        (mine.some(t => t.ev.kind === "lien") ? "Dana's preliminary lien notice is staged for your signature Monday at 9:00 am. " : "") +
        (left.length ? `You have ${left.length} thing${left.length === 1 ? "" : "s"} left today.` : "Your calendar is clear."),
    );
    ctx.suggest(["What needs my attention today?", "Start the lien process for Dana Whitfield", "Generate the September owner report vs last year"]);
  },
});
