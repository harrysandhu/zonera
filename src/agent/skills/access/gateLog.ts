import { defineSkill } from "../../engine";
import { kw, type Parsed } from "../../parse";
import { UNIT_BY_ID } from "../../../data/facility";
import { tenantForUnit, type Tenant } from "../../../data/tenants";
import { fmtTime, lastNightEvents, tenantEvents, todayEvents } from "./ops";
import type { LogEvent } from "../../widgets/access/types";
import type { Row, Tone } from "../../widgets/core/types";

// #36 Investigate gate events: who came and went, from the live gate log
// (GATE_EVENTS via ops.todayEvents), last night's history (ops.lastNightEvents,
// which matches the overnight line in the feed) or one unit's recent history.
//
//   "Who came in after 10pm last night?"   → nobody; two after-hours exits, one camera alert
//   "Show the gate log for A-131"          → Dana's history, denied at 7:12 am
//   "Who opened the gate this morning?"    → first in, entries since 6 am, the denied attempt

const RESULT: Record<LogEvent["kind"], { label: string; tone?: Tone }> = {
  entry: { label: "Granted", tone: "ok" },
  exit: { label: "Exit" },
  denied: { label: "Denied", tone: "bad" },
  system: { label: "System" },
  camera: { label: "Camera" },
};

function result(e: LogEvent): { text: string; tone?: Tone } {
  if (e.kind === "system") return { text: e.note ?? "System" };
  if (e.kind === "camera") return { text: e.note?.replace(/ · WO-\d+ opened/, "") ?? "Motion" };
  if (e.kind === "denied") return { text: `Denied${e.note ? " · " + e.note.replace(/^Code /, "code ") : ""}`, tone: "bad" };
  if (e.kind === "exit" && /after hours/i.test(e.note ?? "")) return { text: "Exit · after hours", tone: "warn" };
  if (e.kind === "exit") return { text: e.note === "Exit by keypad" ? "Exit · keypad" : "Exit" };
  return { text: RESULT[e.kind].label, tone: RESULT[e.kind].tone };
}

function row(e: LogEvent, withDay = false): Row {
  const r = result(e);
  return {
    id: e.id,
    cells: { at: withDay ? `${e.day} · ${e.at}` : e.at, who: e.who, unit: e.unit ?? "—", door: e.door, res: r.text },
    sort: { at: e.min },
    tone: r.tone,
    route: e.tenantId ? "ops/tenants/" + e.tenantId : undefined,
  };
}

const COLS = [
  { key: "at", label: "Time", mono: true },
  { key: "who", label: "Who" },
  { key: "unit", label: "Unit", mono: true },
  { key: "door", label: "Door" },
  { key: "res", label: "Result" },
];

/** "after 10pm", "after 9:30 pm" → minutes after midnight. */
function cutoffFrom(q: Parsed) {
  const m = /\bafter\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/.exec(q.lower);
  if (!m) return 22 * 60;
  let h = +m[1] % 12;
  if (m[3] !== "am") h += 12; // "after 10" at night means pm
  return h * 60 + +(m[2] ?? 0);
}

const hhmmOf = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

function scopeOf(q: Parsed): string | undefined {
  if (q.units[0]) return q.units[0];
  const p = q.people.find(x => x.kind === "tenant");
  return p?.unit;
}

type Win = string; // "night@22:00" | "morning" | "recent"

export default defineSkill<{ unit: string; window: Win }>({
  id: "access.gateLog",
  n: 36,
  category: "access",
  title: "Gate log",
  featured: true,
  examples: ["Who came in after 10pm last night?", "Show the gate log for A-131", "Who opened the gate this morning?"],
  slots: {
    unit: { label: "unit", fill: q => scopeOf(q) },
    window: {
      label: "window",
      fill: q =>
        /\b(last night|overnight|after hours|after-hours|after \d)/.test(q.lower)
          ? `night@${hhmmOf(cutoffFrom(q))}`
          : /\bthis morning|since (6|open)|today\b/.test(q.lower)
            ? "morning"
            : undefined,
      default: q => (scopeOf(q) ? "recent" : "night@22:00"),
      show: v => (v.startsWith("night") ? `after ${fmtTime(v.split("@")[1])} last night` : v === "morning" ? "this morning" : "last 2 weeks"),
      options: () => [
        { value: "night@22:00", label: "After 10:00 pm last night" },
        { value: "morning", label: "This morning" },
        { value: "recent", label: "Last 2 weeks" },
      ],
    },
  },
  match: q =>
    kw(q, [
      [/\b(gate|door|access) (log|history|events?|activity)\b|\bwho (came|come|went|got|was) (in|on site|through)\b|\bwho (opened|entered|used|left)\b/, 5],
      [/\b(last night|overnight|after hours|after \d{1,2}\s*(pm)?)\b/, 1],
      [/\b(make|create|give|new|generate|revoke)\b/, -3],
    ]),

  async run(ctx, { q, slots }) {
    const win = slots.window ?? "night@22:00";
    const unitId = slots.unit;

    // ---------------------------------------------------------------- one unit
    if (unitId && win === "recent") {
      const u = UNIT_BY_ID.get(unitId);
      const t: Tenant | undefined = tenantForUnit(unitId);
      ctx.title(`Gate log · ${unitId}`);
      ctx.focus({ selected: unitId, units: [], tenants: t ? [t.id] : [] });
      await ctx.think(`Pull every keypad and door event for ${unitId}${t ? ` (${t.name})` : ""}, newest first, and check the code status.`, 900);
      const events = t ? tenantEvents(t) : todayEvents().filter(e => e.unit === unitId);
      const locked = u?.status === "overlocked";
      await ctx.tools([
        { name: "gate.events.query", args: { unit: unitId, days: 14 }, result: () => ({ events: events.length, denied: events.filter(e => e.kind === "denied").length }), ms: 650 },
        { name: "gate.codes.get", args: { unit: unitId }, result: () => ({ holder: t?.name ?? null, code: t ? "••" + t.gateCode.slice(-2) : null, status: locked ? "suspended" : t ? "active" : "none" }), ms: 480 },
      ]);
      if (!events.length) {
        await ctx.say(`No gate activity for **${unitId}** in the last 2 weeks${t ? "" : ". It has no tenant right now"}.`);
        ctx.suggest(["Who came in after 10pm last night?", "Who opened the gate this morning?"]);
        return;
      }
      ctx.show("table", { title: `Gate log · ${unitId}${t ? " · " + t.name : ""}`, meta: `${events.length} events · 14 days`, columns: COLS, rows: events.map(e => row(e, true)), maxRows: 8 });
      const denied = events.filter(e => e.kind === "denied");
      const last = events[0];
      ctx.show("answer", {
        label: "Last activity",
        value: `${last.day === "Today" ? "Today" : last.day} · ${last.at}`,
        context: `${result(last).text} at ${last.door}${t ? ` · code ••${t.gateCode.slice(-2)} ${locked ? "suspended" : "active"}` : ""}`,
        delta: denied.length ? { text: `${denied.length} denied`, tone: "bad" } : undefined,
        itemsTitle: "Worth knowing",
        items: [
          ...(locked ? [{ label: `${unitId} is overlocked, so the code is suspended at every keypad`, meta: "Policy" }] : []),
          ...denied.slice(0, 2).map(e => ({ label: `${e.day} ${e.at} · denied at ${e.door}`, meta: e.note ?? "" })),
          ...(t ? [{ label: `${t.name} · ${t.daysLate ? `${t.daysLate} days late` : "paid up"}`, meta: "Profile", route: "ops/tenants/" + t.id }] : []),
        ],
        links: [{ label: "Open Gate access", route: "ops/gate" }],
      });
      await ctx.say(
        locked && denied.length
          ? `${t?.first ?? "The tenant"} tried ${denied[0].door} ${denied[0].day === "Today" ? "today" : "on " + denied[0].day} at ${denied[0].at} and was turned away: the code stays suspended while ${unitId} is overlocked.`
          : `${events.length} events in 2 weeks, nothing outside gate hours.`,
      );
      ctx.suggest(
        locked
          ? t?.name === "Dana Whitfield"
            ? ["Start the lien process for Dana Whitfield", `Remove the overlock on ${unitId}`, "Who came in after 10pm last night?"]
            : [`Remove the overlock on ${unitId}`, "Who came in after 10pm last night?"]
          : ["Who came in after 10pm last night?", "Who opened the gate this morning?"],
      );
      return;
    }

    // ---------------------------------------------------------------- this morning
    if (win === "morning") {
      ctx.title("Gate log · this morning");
      await ctx.think("Gate hours start at 6:00 am. Pull every entry since then, find who was first in, and flag anything denied.", 900);
      const all = todayEvents()
        .filter(e => e.min >= 1440 + 6 * 60 && (e.kind === "entry" || e.kind === "denied" || e.kind === "exit"))
        .sort((a, b) => a.min - b.min);
      const entries = all.filter(e => e.kind === "entry");
      const denied = all.filter(e => e.kind === "denied");
      await ctx.tool("gate.events.query", { from: "2026-10-02T06:00", to: "now", doors: "all" }, () => ({ entries: entries.length, exits: all.filter(e => e.kind === "exit").length, denied: denied.length }), 700);
      const first = entries[0];
      const units = [...new Set(entries.slice(0, 6).map(e => e.unit).filter(Boolean) as string[])];
      ctx.focus({ units, selected: first?.unit ?? null, tenants: first?.tenantId ? [first.tenantId] : [] });
      ctx.show("table", { title: "Gate 1, Door D1 and pedestrian gate since 6:00 am", meta: `${all.length} events`, columns: COLS, rows: all.map(e => row(e)), maxRows: 8 });
      ctx.show("answer", {
        label: "Entries since 6:00 am",
        value: String(entries.length),
        context: first ? `First in: ${first.who} · ${first.unit} · ${first.at} at ${first.door}` : "No entries yet",
        delta: denied.length ? { text: `${denied.length} denied`, tone: "bad" } : { text: "0 denied", tone: "ok" },
        itemsTitle: "Worth knowing",
        items: [
          ...denied.map(e => ({ label: `${e.at} · ${e.who} · ${e.unit} denied at ${e.door}`, meta: e.note ?? "", route: e.tenantId ? "ops/tenants/" + e.tenantId : undefined })),
          { label: "9:02 am · Priya Raman unlocked the office", meta: "Staff" },
          { label: "Gate 2 exits fall back to the keypad since 8:52 am", meta: "WO-2050" },
        ],
        links: [{ label: "Open Gate access", route: "ops/gate" }],
      });
      await ctx.say(`${first ? `**${first.who}** opened Gate 1 first, at ${first.at}. ` : ""}${entries.length} entries since. ${denied.length ? `One was turned away: ${denied[0].who} at ${denied[0].at}, code suspended because ${denied[0].unit} is overlocked.` : "Nobody was turned away."}`);
      ctx.suggest(["Overlock Dana Whitfield's unit", "Who came in after 10pm last night?", "Revoke the HVAC tech's code at 5pm"]);
      return;
    }

    // ---------------------------------------------------------------- last night
    const cut = Number(win.split("@")[1]?.split(":")[0] ?? 22) * 60 + Number(win.split("@")[1]?.split(":")[1] ?? 0);
    const cutLabel = fmtTime(hhmmOf(cut));
    ctx.title(`Gate log · after ${cutLabel.replace(":00", "")}`);
    await ctx.think(`Last night from ${cutLabel} until the gates opened at 6:00 am. Pull every gate, door and camera event, match codes to tenants, flag anything outside the rules.`, 1100);
    const events = lastNightEvents()
      .filter(e => e.min >= cut && e.min <= 1440 + 6 * 60)
      .sort((a, b) => a.min - b.min);
    const entries = events.filter(e => e.kind === "entry");
    const exits = events.filter(e => e.kind === "exit");
    const denied = events.filter(e => e.kind === "denied");
    const cams = events.filter(e => e.kind === "camera");
    await ctx.tools([
      { name: "gate.events.query", args: { from: `2026-10-01T${hhmmOf(cut)}`, to: "2026-10-02T06:00", doors: "all" }, result: { entries: entries.length, exits: exits.length, denied: denied.length, system: events.filter(e => e.kind === "system").length }, ms: 750 },
      { name: "cameras.events.query", args: { from: `2026-10-01T${hhmmOf(cut)}`, to: "2026-10-02T06:00" }, result: { motion: cams.length, people: 0, clips: cams.map(c => c.cam) }, ms: 600 },
    ]);
    const people = [...entries, ...exits, ...denied];
    const units = [...new Set(people.map(e => e.unit).filter(Boolean) as string[])];
    const latest = [...people].sort((a, b) => b.min - a.min)[0];
    ctx.focus({ units, selected: latest?.unit ?? null, tenants: [...new Set(people.map(e => e.tenantId).filter(Boolean) as string[])] });
    ctx.show("table", { title: `Gate and camera events · Oct 1 ${cutLabel} – Oct 2 6:00 am`, meta: `${events.length} events`, columns: COLS, rows: events.map(e => row(e)), maxRows: 8 });

    // How long the latest one stayed: their entry earlier in the evening.
    const earlier = latest ? lastNightEvents().find(e => e.unit === latest.unit && e.kind === "entry" && e.min < latest.min) : undefined;
    const stayed = latest && earlier ? latest.min - earlier.min : undefined;
    ctx.show("answer", {
      label: `Entries after ${cutLabel}`,
      value: String(entries.length),
      context: `${exits.length} exit${exits.length === 1 ? "" : "s"} after close · ${denied.length} denied · ${cams.length} camera alert${cams.length === 1 ? "" : "s"}`,
      delta: entries.length || denied.length ? { text: "Review", tone: "warn" } : { text: "Nothing unusual", tone: "ok" },
      itemsTitle: "Worth knowing",
      items: [
        ...exits.map(e => ({ label: `${e.at} · ${e.who} · ${e.unit} left by ${e.door}`, meta: e === latest && stayed ? `on site ${stayed} min` : "exit only", route: e.tenantId ? "ops/tenants/" + e.tenantId : undefined })),
        ...entries.map(e => ({ label: `${e.at} · ${e.who} · ${e.unit} came in at ${e.door}`, meta: "entry", route: e.tenantId ? "ops/tenants/" + e.tenantId : undefined })),
        ...denied.map(e => ({ label: `${e.at} · ${e.who} denied at ${e.door}`, meta: e.note ?? "denied" })),
        ...cams.map(e => ({ label: `${e.at} · ${e.door} · ${e.note}`, meta: "no person" })),
      ],
      links: [{ label: "Open Gate access", route: "ops/gate" }],
    });
    await ctx.say(
      entries.length
        ? `${entries.length} ${entries.length === 1 ? "person" : "people"} came in after ${cutLabel}: ${entries.map(e => `**${e.who}** (${e.unit}) at ${e.at}`).join(", ")}.`
        : `Nobody came in after ${cutLabel}. ${exits.length ? `${exits.length === 1 ? "One tenant was" : `${exits.length} tenants were`} still inside at close and left by keypad, which the exit-only rule allows${latest && stayed ? `; **${latest.unit}** left last, at ${latest.at}` : ""}.` : ""} ${cams.length ? `Camera ${cams[0].door.replace(/\D/g, "")} picked up motion at ${cams[0].at}: an animal, no person.` : ""}`.replace(/\s+/g, " ").trim(),
    );
    ctx.suggest(["Overlock Dana Whitfield's unit", "Revoke the HVAC tech's code at 5pm", "Make a gate code for the HVAC tech, 1–5pm today, Building D only"]);
  },
});
