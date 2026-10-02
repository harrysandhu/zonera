import { defineSkill } from "../../engine";
import { kw } from "../../parse";
import { CALENDAR, RESERVATIONS, TODAY_ISO, lead, money, sizeLabel, U } from "../../data";
import { TENANTS, type Tenant } from "../../../data/tenants";
import type { Row } from "../../widgets/core/types";

// Today's move-ins: the three reservations due in today, the walk-in on the
// calendar, and anyone moved in during the session (batch move-ins, walk-ins).
// Read live at call time, so it changes after "Move these three reservations in today".
//
//   "Show today's move-ins" · "Who's moving in today?"

const DUE_TODAY: { name: string; at: string }[] = [
  { name: "Owen Murphy", at: "10:30 am" },
  { name: "Hana Sato", at: "12:00 pm" },
  { name: "Imani Mensah", at: "2:30 pm" },
];
const WALK_IN = { name: "Jordan Lee", size: "10x10" };

interface Line {
  id: string;
  name: string;
  unit: string;
  size: string;
  at: string;
  status: "Moved in" | "Reserved" | "Walk-in tour";
  rent: number;
  how: string;
  route?: string;
}

export default defineSkill<{ day: string }>({
  id: "frontdesk.today",
  category: "frontdesk",
  title: "Today's move-ins",
  featured: true,
  examples: ["Show today's move-ins", "Who's moving in today?"],
  slots: { day: { label: "day", fill: q => (q.dates.includes(TODAY_ISO) ? "today" : undefined), default: "today", show: () => "today · Fri Oct 2" } },
  match: q =>
    kw(q, [
      [/\bmove-?ins?\b|\bmoving in\b|\barrivals?\b|\bcoming in today\b/, 3],
      [/\btoday'?s?\b|\bthis (morning|afternoon)\b/, 2],
      [/\b(show|who'?s|who is|who are|list|what are|any)\b/, 2],
      [/\b(these|batch|everyone reserved|all of them|move (them|everyone) in)\b/, -5],
      [/\b(text|email|e-mail|sms|call|new customer|walk-?in)\b/, -5],
    ]) - (q.people.some(p => p.kind === "lead") ? 4 : 0),

  async run(ctx) {
    ctx.title("Move-ins · today");
    await ctx.think("Check today's reservations, the calendar and anyone already moved in this morning. Read it live so it reflects what's happened since.", 900);

    const movedToday = () => TENANTS.filter(t => t.moveIn === TODAY_ISO);
    const lines = (): Line[] => {
      const moved = movedToday();
      const byName = (n: string) => moved.find(t => t.name === n);
      const out: Line[] = [];
      const done = (t: Tenant, at: string, how: string): Line => {
        const u = U(t.unitIds[0]);
        return { id: t.id, name: t.name, unit: t.unitIds[0], size: sizeLabel(u.size), at, status: "Moved in", rent: t.rent, how, route: "ops/tenants/" + t.id };
      };
      for (const r of DUE_TODAY) {
        const t = byName(r.name);
        if (t) out.push(done(t, r.at, "Reservation"));
        else if (lead(r.name)) {
          const res = RESERVATIONS[r.name];
          const u = res ? U(res.unit) : undefined;
          out.push({ id: r.name, name: r.name, unit: res?.unit ?? "—", size: sizeLabel(lead(r.name)!.size), at: r.at, status: "Reserved", rent: u?.rate ?? 0, how: res ? `${res.id} · ${res.card ?? "card at signing"}` : "Reservation", route: "ops/leads" });
        }
      }
      const tour = CALENDAR.find(e => e.kind === "tour" && e.title.includes(WALK_IN.name));
      const jordan = byName(WALK_IN.name);
      if (jordan) out.push(done(jordan, tour?.t ?? "Today", "Walk-in"));
      else if (tour) out.push({ id: "walkin", name: WALK_IN.name, unit: "—", size: sizeLabel(WALK_IN.size), at: tour.t, status: "Walk-in tour", rent: 0, how: "Walk-in", route: "ops/leads" });
      for (const t of moved) if (!out.some(l => l.id === t.id)) out.push(done(t, "Today", "Walk-in"));
      return out.sort((a, b) => toMin(a.at) - toMin(b.at));
    };

    const now = lines();
    const reserved = now.filter(l => l.status === "Reserved");
    await ctx.tools([
      { name: "reservations.query", args: { move_in: TODAY_ISO }, result: () => ({ count: DUE_TODAY.length, open: reserved.length, held_units: reserved.map(l => l.unit) }), ms: 600 },
      { name: "calendar.get", args: { date: TODAY_ISO, kind: "tour" }, result: () => CALENDAR.filter(e => e.kind === "tour" || e.kind === "movein").map(e => ({ at: e.t, title: e.title, done: !!e.done })), ms: 520 },
      { name: "tenants.query", args: { move_in: TODAY_ISO }, result: () => movedToday().map(t => ({ id: t.id, name: t.name, unit: t.unitIds[0] })), ms: 480 },
    ]);
    const units = now.map(l => l.unit).filter(u => u !== "—");
    ctx.focus({ units, selected: units[0] ?? null, tenants: now.filter(l => l.status === "Moved in").map(l => l.id).slice(0, 3) });

    const rows: Row[] = now.map(l => ({
      id: l.id,
      cells: { name: l.name, unit: l.unit, size: l.size, at: l.at, status: l.status, how: l.how },
      sort: { at: toMin(l.at) },
      tone: l.status === "Moved in" ? "ok" : undefined,
      route: l.route,
    }));
    ctx.show("table", {
      title: `${now.length} move-ins today`,
      meta: "Fri Oct 2",
      columns: [
        { key: "name", label: "Customer" },
        { key: "unit", label: "Unit", mono: true },
        { key: "size", label: "Size" },
        { key: "at", label: "Time", mono: true },
        { key: "status", label: "Status" },
        { key: "how", label: "Booking" },
      ],
      rows,
    });

    const moved = now.filter(l => l.status === "Moved in");
    const toGo = now.filter(l => l.status !== "Moved in");
    const newRent = now.reduce((s, l) => s + l.rent, 0);
    ctx.show("answer", {
      tiles: [
        { label: "Expected today", value: String(now.length), context: `${DUE_TODAY.length} reservations · 1 walk-in` },
        { label: "Moved in", value: String(moved.length), delta: moved.length ? { text: "leases signed", tone: "ok" } : undefined, context: moved.length ? undefined : "none yet" },
        { label: "Still to come", value: String(toGo.length), context: toGo[0] ? `next ${toGo[0].name.split(" ")[0]} · ${toGo[0].at}` : "all done" },
        { label: "New rent", value: money(newRent).replace(/\.00$/, ""), context: newRent ? "per month from today's move-ins" : "—" },
      ],
      links: [
        { label: "Open leads", route: "ops/leads" },
        { label: "Open tenants", route: "ops/tenants" },
      ],
    });

    const heldOk = reserved.every(l => l.unit !== "—" && ["vacant", "reserved"].includes(U(l.unit).status));
    await ctx.say(
      toGo.length === 0
        ? `All ${now.length} move-ins are done. Leases are signed and gate codes are out.`
        : `**${now.length} move-ins today**: ${moved.length} done, ${toGo.length} to go. ` +
            (reserved.length ? `${reserved.map(l => l.name.split(" ")[0]).join(", ").replace(/, ([^,]*)$/, " and $1")} ${reserved.length === 1 ? "has a reservation" : "have reservations"}${heldOk ? ", and every held unit is still free" : ""}. ` : "") +
            (toGo.some(l => l.status === "Walk-in tour") ? `Jordan Lee is coming in for a 10×10 tour at ${toGo.find(l => l.status === "Walk-in tour")!.at}.` : ""),
    );
    ctx.suggest(
      reserved.length
        ? ["Move these three reservations in today: Owen Murphy, Hana Sato, Imani Mensah", "Email Owen, Hana, Imani and Rafael about move-in times", "Call Owen Murphy about his move-in"]
        : toGo.length
          ? ["New customer wants a 10×10 today, Jordan Lee", "What needs my attention today?", "Pull up Matthew Okafor"]
          : ["What needs my attention today?", "Break revenue down by unit size", "Pull up Matthew Okafor"],
    );
  },
});

function toMin(at: string) {
  const m = /(\d+):(\d+)\s*(am|pm)/.exec(at);
  if (!m) return 24 * 60;
  return ((+m[1] % 12) + (m[3] === "pm" ? 12 : 0)) * 60 + +m[2];
}
