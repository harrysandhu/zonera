import { defineSkill } from "../../engine";
import { kw, type Parsed } from "../../parse";
import { money, setUnitStatus, sizeLabel, TODAY_ISO } from "../../data";
import { UNITS, UNIT_BY_ID, type Unit } from "../../../data/facility";
import { TENANTS, tenantForUnit } from "../../../data/tenants";
import { VENDORS, WORK_ORDERS, type Vendor, type WOCategory, type WOPriority, type WorkOrder } from "../../../data/maintenance";
import { addComm } from "../../../data/comms";
import { doorsForUnits, freshCode, issueCode } from "../access/ops";
import { createWorkOrder, updateWorkOrder } from "./util";
import type { Candidate } from "../../widgets/core/types";

// #38 Work order: log a repair, pick who fixes it, give the vendor a gate code,
// tell whoever is affected. Writes WORK_ORDERS (Maintenance page, unit drawer),
// ACCESS_CODES (Gate access) and the unit status when a vacant unit has to come
// off the storefront.
//
//   "The door on C-120 is jammed"                  → occupied unit: Basin Door today 2–4 pm, tenant texted
//   "Log a work order for the Building D elevator" → asks what's wrong, Marco takes a first look
//   "Door on C-112 is jammed"                      → already logged at 7:58 am (WO-2051): dispatch it
//   "The door on C-210 is jammed"                  → no such unit: asks which one, closest first

interface Issue {
  key: string;
  label: string;
  category: WOCategory;
  vendor?: string; // VENDORS id
}

const ISSUES: [RegExp, Issue][] = [
  [/\belevator\b/, { key: "elevator", label: "Elevator", category: "Other" }],
  [/\b(door|roll-?up|latch|spring|hinge)\b|\b(jam|jammed)\b/, { key: "door", label: "Roll-up door jammed", category: "Doors", vendor: "basin-door" }],
  [/\b(light|lights|bulb|dark|pole)\b/, { key: "light", label: "Light out", category: "Lighting", vendor: "alder-electric" }],
  [/\b(hvac|heat|heating|a\/?c|air|temperature|humid)\b/, { key: "hvac", label: "HVAC issue", category: "HVAC", vendor: "lakeside-mech" }],
  [/\b(pest|mice|mouse|rodent|rats?|bugs?|ants?)\b/, { key: "pest", label: "Pest sighting", category: "Pest", vendor: "sierra-pest" }],
  [/\b(gate|keypad)\b/, { key: "gate", label: "Gate fault", category: "Gates & access", vendor: "tahoe-gate" }],
  [/\b(leak|leaking|water|roof)\b/, { key: "leak", label: "Water leak", category: "Other" }],
];

function issueOf(q: Parsed): Issue | undefined {
  for (const [re, i] of ISSUES) if (re.test(q.lower)) return i;
  return undefined;
}

/** A unit-looking token that isn't a real unit ("C-210"). */
function ghostUnit(q: Parsed) {
  const m = /\b([a-dp])-?(\d{2,3})\b/.exec(q.lower);
  if (!m) return undefined;
  const id = `${m[1].toUpperCase()}-${m[2]}`;
  return UNIT_BY_ID.has(id) ? undefined : id;
}

/** Real units closest to a typo: same digits first, then same ending, then nearest number. */
function nearestUnits(id: string, n = 3): Unit[] {
  const [b, num] = id.split("-");
  const digits = num.split("").sort().join("");
  const pool = UNITS.filter(u => u.building === b);
  const score = (u: Unit) => {
    const d = u.id.split("-")[1];
    let s = 0;
    if (d.split("").sort().join("") === digits) s += 100;
    if (d.slice(-2) === num.slice(-2)) s += 50;
    if (WORK_ORDERS.some(w => w.unitId === u.id && w.status !== "done" && w.category === "Doors")) s += 60;
    return s - Math.abs(+d - +num) / 10;
  };
  return [...pool].sort((x, y) => score(y) - score(x)).slice(0, n);
}

const MARCO = { id: "marco", name: "Marco Ruiz", role: "Maintenance tech" };

function unitSub(u: Unit) {
  const t = tenantForUnit(u);
  return `${sizeLabel(u.size)} ${u.kind === "climate" ? `climate, floor ${u.floor}` : "drive-up"} · ${t ? t.name : u.status}`;
}

export default defineSkill<{ where: string; issue: string }>({
  id: "facility.maintenance",
  n: 38,
  category: "facility",
  title: "Work order",
  featured: true,
  examples: ["The door on C-120 is jammed", "Log a work order for the Building D elevator", "Door on C-112 is jammed"],
  slots: {
    where: {
      label: "location",
      fill: q => q.units[0] ?? ghostUnit(q) ?? (/\belevator\b/.test(q.lower) ? "Building D elevator" : q.buildings[0] ? `Building ${q.buildings[0]}` : undefined),
    },
    issue: { label: "issue", fill: q => issueOf(q)?.label },
  },
  match: q =>
    kw(q, [
      [/\b(jam|jammed|stuck|broken|busted|won'?t (open|close|lock)|leak|leaking|out of order|not working)\b/, 4],
      [/\bwork ?orders?\b|\b(repair|maintenance) (request|ticket)\b/, 5],
      [/\b(door|elevator|light|roof|keypad)\b/, 1],
      [/\b(code|revoke|overlock|gate log)\b/, -3],
    ]),

  async run(ctx, { q, slots }) {
    const issue = issueOf(q) ?? { key: "other", label: "Repair", category: "Other" as WOCategory };
    let unitId = q.units[0];
    const ghost = !unitId ? ghostUnit(q) : undefined;
    const elevator = issue.key === "elevator";

    await ctx.think(
      ghost
        ? `There's no ${ghost} here: Building ${ghost[0]} has one floor, ${UNITS.filter(u => u.building === ghost[0])[0]?.id} to ${UNITS.filter(u => u.building === ghost[0]).slice(-1)[0]?.id}. Ask which unit, closest match first.`
        : elevator
          ? "Building D's elevator serves floor 2. Find out what's wrong, get someone on it, and warn floor 2 tenants if it's out."
          : "Check the unit, who rents it and any open work order, then pick who can fix it soonest and tell the tenant.",
      1000,
    );

    // ---------------------------------------------------------------- which unit (typo)
    if (ghost) {
      const near = nearestUnits(ghost);
      await ctx.tool("units.search", { query: ghost }, () => ({ matches: 0, closest: near.map(u => u.id) }), 480);
      unitId = await ctx.ask(
        "disambiguate",
        {
          title: `There's no ${ghost}. Which door is it?`,
          meta: `Building ${ghost[0]}`,
          options: near.map((u, i): Candidate => {
            const open = WORK_ORDERS.find(w => w.unitId === u.id && w.status !== "done");
            return { id: u.id, title: u.id, sub: unitSub(u), meta: open ? `${open.id} open` : u.status, metaTone: open ? "warn" : undefined, badge: i === 0 ? "Likely match" : undefined };
          }),
        },
        ["wait:900", "opt:" + near[0].id],
      );
    }

    // ---------------------------------------------------------------- elevator / building-level
    if (!unitId) {
      const where = elevator ? "Building D · elevator" : slots.where ?? "Facility";
      ctx.title(`Work order · ${elevator ? "Building D elevator" : where}`);
      const floor2 = TENANTS.filter(t => t.unitIds.some(id => UNIT_BY_ID.get(id)?.kind === "climate" && UNIT_BY_ID.get(id)?.floor === 2));
      ctx.focus({ units: UNITS.filter(u => u.building === "D" && u.floor === 2).map(u => u.id), selected: null, tenants: [] });
      await ctx.tools([
        { name: "assets.get", args: { asset: elevator ? "elevator-d" : where }, result: elevator ? { model: "ThyssenKrupp hydraulic · 2,500 lb", last_inspection: "2026-03-11", permit: "CA DIR #E-41870" } : { building: where }, ms: 520 },
        { name: "workorders.search", args: { location: where, status: "open" }, result: { open: 0 }, ms: 460 },
      ]);
      const kind = elevator
        ? await ctx.ask(
            "quickReplies",
            {
              question: "What's wrong with the elevator?",
              options: [
                { value: "stuck", label: "Stuck or not running", hint: "Urgent · floor 2 tenants get a text" },
                { value: "doors", label: "Doors won't close", hint: "High" },
                { value: "noise", label: "Noisy or jerky", hint: "Normal" },
                { value: "inspect", label: "Inspection due", hint: "Low" },
              ],
            },
            ["wait:900", "opt:stuck"],
          )
        : "other";
      const spec: Record<string, { title: string; priority: WOPriority; out: boolean }> = {
        stuck: { title: "Elevator not running", priority: "urgent", out: true },
        doors: { title: "Elevator doors won't close", priority: "high", out: true },
        noise: { title: "Elevator noisy or jerky", priority: "normal", out: false },
        inspect: { title: "Elevator inspection", priority: "low", out: false },
        other: { title: issue.label, priority: "normal", out: false },
      };
      const s = spec[kind] ?? spec.other;
      const when = s.priority === "urgent" ? "Today 10:30 am" : s.priority === "high" ? "Today 11:30 am" : "Mon Oct 5";
      const ans = await ctx.ask(
        "diff",
        {
          title: "New work order",
          meta: where,
          rows: [
            { field: "Issue", before: "—", after: s.title },
            { field: "Location", before: "—", after: where },
            { field: "Priority", before: "—", after: s.priority[0].toUpperCase() + s.priority.slice(1) },
            { field: "Assigned", before: "—", after: `${MARCO.name} · first look ${when.replace("Today ", "today ")}` },
            ...(s.out ? [{ field: "Floor 2 tenants", before: "—", after: `${floor2.length} texted · use the stairs, cart at the door` }] : []),
          ],
          note: elevator ? "If it needs a licensed elevator mechanic, Marco calls it in and I'll add the visit here." : undefined,
          cta: "Create work order",
        },
        ["wait:900", "submit"],
      );
      if (ans !== "approve") {
        await ctx.say("Nothing logged.");
        return;
      }
      await ctx.tool("workorders.create", { title: s.title, location: where, priority: s.priority, assignee: MARCO.name }, { status: "scheduled" }, 600);
      let undo = () => {};
      let wo: WorkOrder | undefined;
      ctx.effect({
        kind: "maintenance",
        text: `Work order: ${s.title} · ${MARCO.name}`,
        run: () => {
          const r = createWorkOrder({ title: s.title, location: where, status: "scheduled", priority: s.priority, category: issue.category, assignee: MARCO.name, due: when, notes: `${s.title}. Logged by Priya from agent mode.${s.out ? " Floor 2 tenants told to use the stairs." : ""}` });
          undo = r.undo;
          wo = r.wo;
        },
        undo: () => undo(),
        link: { label: "Open maintenance", route: "ops/maintenance" },
      });
      if (s.out) {
        await ctx.tool("sms.send_batch", { to: `${floor2.length} floor 2 tenants`, template: "elevator_out" }, { queued: floor2.length, delivered: floor2.length }, 700);
        ctx.effect({
          kind: "agent",
          text: `Texted ${floor2.length} floor 2 tenants that the elevator is out`,
          run: () => {
            for (const t of floor2) addComm(t.id, { channel: "sms", dir: "out", who: "Zonera agent", body: `Heads up: the Building D elevator is out of service while we fix it. Please use the stairs; a cart is at the Building D door.`, status: "Delivered" });
          },
        });
      }
      ctx.show("answer", {
        label: "Work order",
        value: wo?.id ?? "—",
        context: `${s.title} · ${MARCO.name} · ${when.replace("Today ", "today ")}`,
        items: [
          { label: `Priority: ${s.priority}`, meta: issue.category },
          ...(s.out ? [{ label: `${floor2.length} floor 2 tenants texted`, meta: "Delivered" }] : []),
        ],
        links: [{ label: "Open maintenance", route: "ops/maintenance" + (wo ? "/" + wo.id : "") }],
      });
      ctx.suggest(["Make a gate code for the HVAC tech, 1–5pm today, Building D only", "What needs my attention today?"]);
      return;
    }

    // ---------------------------------------------------------------- one unit
    const u = UNIT_BY_ID.get(unitId)!;
    const t = tenantForUnit(u);
    const open = WORK_ORDERS.find(w => w.unitId === unitId && w.status !== "done" && (w.category === issue.category || issue.key === "other"));
    const vacant = u.status === "vacant";
    const vendor: Vendor | undefined = VENDORS.find(v => v.id === (open?.vendorId ?? issue.vendor));
    ctx.title(`Work order · ${unitId}`);
    ctx.focus({ selected: unitId, units: [unitId], tenants: t ? [t.id] : [] });
    await ctx.tools([
      { name: "units.get", args: { id: unitId }, result: () => ({ id: unitId, size: u.size, kind: u.kind, status: u.status, building: u.building }), ms: 480 },
      { name: "tenants.forUnit", args: { unit: unitId }, result: () => (t ? { id: t.id, name: t.name, phone: t.phone } : null), ms: 420 },
      { name: "workorders.search", args: { unit: unitId, status: "open" }, result: () => ({ open: open ? 1 : 0, ids: open ? [open.id] : [] }), ms: 460 },
      { name: "vendors.list", args: { trade: vendor?.trade ?? issue.category }, result: () => VENDORS.filter(v => v.id === vendor?.id).map(v => ({ id: v.id, name: v.name, response: v.response, next_slot: "Today 2:00–4:00 pm" })), ms: 560 },
    ]);

    if (open) {
      const first = open.log[0];
      await ctx.say(`Already logged. ${first ? `${first.text} at ${first.at}` : `Opened ${open.opened}`} (**${open.id}**): ${open.notes.split(".")[0].toLowerCase()}. ${open.status === "new" ? "Nobody's been dispatched yet." : `It's ${open.status}.`}${u.status === "maintenance" ? ` ${unitId} is off the storefront until it's fixed.` : ""}`);
    } else {
      await ctx.say(
        t
          ? `${unitId} is rented to **${t.name}**, so they can't get to their things until it's fixed.${vendor ? ` ${vendor.name} can come today 2:00–4:00 pm. ${MARCO.name} can look sooner, but spring work needs a door tech.` : ""}`
          : `${unitId} is ${u.status}.${vacant ? " I'll take it off the storefront until it's fixed." : ""}${vendor ? ` ${vendor.name} can come today 2:00–4:00 pm.` : ""}`,
      );
    }

    // Who fixes it. Skipped when we already asked which unit (one question per turn).
    let who = vendor?.id ?? MARCO.id;
    if (!ghost && vendor && open?.status !== "scheduled") {
      who = await ctx.ask(
        "disambiguate",
        {
          title: "Who should fix it?",
          meta: issue.label,
          options: [
            { id: vendor.id, title: vendor.name, sub: `${vendor.trade} · ${vendor.contact} · ${vendor.rating} rating · ${money(vendor.ytd)} this year`, meta: "Today 2–4 pm · est. $180", badge: "Recommended" },
            { id: MARCO.id, title: `${MARCO.name} · in-house`, sub: "On site · finishing the pole 4 light (WO-2048)", meta: "Today 11:30 am · no labor cost" },
          ],
        },
        ["wait:900", "opt:" + vendor.id],
      );
    }
    const useVendor = who !== MARCO.id && !!vendor;
    const eta = useVendor ? "Today 2:00–4:00 pm" : "Today 11:30 am";
    const code = useVendor ? freshCode() : undefined;
    const doors = doorsForUnits([unitId]);
    const priority: WOPriority = open?.priority ?? (t ? "high" : "normal");

    const rows = [
      ...(open
        ? [{ field: "Work order", before: `${open.id} · ${open.status}`, after: `${open.id} · scheduled` }]
        : [
            { field: "Issue", before: "—", after: issue.label },
            { field: "Unit", before: "—", after: `${unitId} · ${sizeLabel(u.size)} ${u.kind === "climate" ? "climate" : "drive-up"}` },
            { field: "Priority", before: "—", after: priority === "high" && t ? "High · tenant can't get in" : priority[0].toUpperCase() + priority.slice(1) },
          ]),
      { field: useVendor ? "Vendor" : "Assigned", before: open?.vendorId && !open.assignee ? `Suggested · ${vendor?.name}` : "—", after: useVendor ? `${vendor!.name} · ${vendor!.contact}` : MARCO.name },
      { field: "ETA", before: "—", after: eta },
      ...(useVendor ? [{ field: "Gate code", before: "—", after: `${code}# · ${vendor!.contact} · 1:30–4:30 pm` }] : []),
      ...(t ? [{ field: "Tenant", before: "—", after: `${t.name} texted the ETA` }] : []),
      ...(vacant ? [{ field: "Unit status", before: "vacant", after: "maintenance · off the storefront" }] : u.status === "maintenance" ? [{ field: "Storefront", before: "Off", after: "Back on once it's closed" }] : []),
    ];
    const ans = await ctx.ask(
      "diff",
      { title: open ? `Dispatch ${open.id}` : "New work order", meta: `${unitId}${t ? " · " + t.name : ""}`, rows, cta: open ? "Dispatch" : "Create and dispatch" },
      ["wait:900", "submit"],
    );
    if (ans !== "approve") {
      await ctx.say("Nothing changed.");
      return;
    }

    await ctx.tools([
      { name: open ? "workorders.update" : "workorders.create", args: { id: open?.id, unit: unitId, vendor: useVendor ? vendor!.id : null, assignee: useVendor ? null : MARCO.name, window: eta }, result: { status: "scheduled" }, ms: 620 },
      ...(useVendor ? [{ name: "gate.codes.create", args: { holder: vendor!.contact, window: "13:30-16:30", doors }, result: { code, collisions: 0 }, ms: 520 }] : []),
    ]);
    let undos: (() => void)[] = [];
    let woId = open?.id ?? "";
    ctx.effect({
      kind: "maintenance",
      text: `${open ? "Dispatched" : "Work order"} ${unitId} · ${issue.label.toLowerCase()} · ${useVendor ? vendor!.name : MARCO.name} ${eta.replace("Today ", "")}`,
      run: () => {
        undos = [];
        if (open) {
          undos.push(updateWorkOrder(open, { status: "scheduled", vendorId: useVendor ? vendor!.id : undefined, assignee: useVendor ? undefined : MARCO.name, due: eta.replace(/–.*/, "") }, [useVendor ? `Dispatched ${vendor!.name}, ${eta.toLowerCase()}` : `Assigned to ${MARCO.name}, ${eta.toLowerCase()}`]));
        } else {
          const r = createWorkOrder({ title: issue.label, location: `${unitId} · Building ${u.building}`, unitId, status: "scheduled", priority, category: issue.category, vendorId: useVendor ? vendor!.id : undefined, assignee: useVendor ? undefined : MARCO.name, due: eta.replace(/–.*/, ""), notes: `${issue.label} on ${unitId}.${t ? ` Rented to ${t.name}; texted the window.` : ""}`, cost: useVendor ? 180 : undefined });
          undos.push(r.undo);
          woId = r.wo.id;
        }
        if (useVendor) {
          const c = issueCode({ holder: vendor!.contact, company: vendor!.name, phone: vendor!.phone, type: "vendor", code: code!, doors, mode: "once", date: TODAY_ISO, from: "13:30", to: "16:30", note: `${unitId} · ${issue.label.toLowerCase()}` });
          undos.push(c.undo);
        }
        if (vacant) undos.push(setUnitStatus(unitId, "maintenance"));
      },
      undo: () => undos.reverse().forEach(f => f()),
      link: { label: "Open maintenance", route: "ops/maintenance" },
    });
    if (t) {
      await ctx.tool("sms.send", { to: t.phone, template: "repair_window" }, { status: "delivered" }, 520);
      ctx.effect({
        kind: "agent",
        text: `Texted ${t.name} the repair window for ${unitId}`,
        run: () => addComm(t.id, { channel: "sms", dir: "out", who: "Zonera agent", body: `Hi ${t.first}, sorry about the door on ${unitId}. ${useVendor ? vendor!.name : "Our maintenance tech"} is coming ${eta.replace("Today ", "today ")} to fix it. We'll text you when it's done.`, status: "Delivered" }),
      });
    }
    ctx.show("answer", {
      label: open ? "Dispatched" : "Work order",
      value: woId,
      context: `${issue.label} · ${unitId} · ${useVendor ? vendor!.name : MARCO.name} · ${eta.replace("Today ", "today ")}`,
      items: [
        ...(useVendor ? [{ label: `Gate code ${code}# for ${vendor!.contact} · 1:30–4:30 pm`, meta: "Gate access", route: "ops/gate" }] : []),
        ...(t ? [{ label: `${t.name} texted the repair window`, meta: "Delivered", route: "ops/tenants/" + t.id }] : []),
        ...(vacant ? [{ label: `${unitId} off the storefront until it's closed`, meta: "maintenance" }] : []),
      ],
      links: [{ label: "Open maintenance", route: "ops/maintenance/" + woId }],
    });
    ctx.suggest(["Make a gate code for the HVAC tech, 1–5pm today, Building D only", "What needs my attention today?"]);
  },
});
