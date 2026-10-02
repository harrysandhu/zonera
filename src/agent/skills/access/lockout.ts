import { defineSkill } from "../../engine";
import { kw } from "../../parse";
import { needTenant } from "../../need";
import { money, sizeLabel } from "../../data";
import { UNIT_BY_ID } from "../../../data/facility";
import { tenantForUnit, type Tenant } from "../../../data/tenants";
import { GATE_EVENTS } from "../../../data/gate";
import { addComm, commsFor } from "../../../data/comms";
import { ledgerFor as fullLedger, pushLedger, clockMin, TODAY } from "../../../data/ledger";
import { fmt } from "../../../state/store";
import { lockOut, restoreAccess } from "./ops";
import { createWorkOrder } from "../facility/util";

// #33 Lock out / restore: overlock a unit (suspends the gate code everywhere),
// or take the overlock off. Reads the live unit status first, so it never
// locks a unit twice:
//
//   "Overlock Dana Whitfield's unit"   → A-131 has been overlocked since Aug 31 but she was
//                                        never told; send the notice, book a lock check
//                                        (a delinquent unit gets the full overlock instead)
//   "Remove the overlock on A-122"     → release the smart overlock, code works again

const OVERLOCK_FEE = 25;
const MARCO = "Marco Ruiz";

/** Date the overlock went on, from the ledger ("Unit overlocked"). */
function lockedSince(t: Tenant) {
  const e = [...fullLedger(t)].reverse().find(x => x.kind === "info" && /^(Unit overlocked|Locked out)/.test(x.text));
  return e ? fmt.short(e.date) : undefined;
}

/** Remove the gate event the ops helpers just pushed. */
function dropEvent(ev: (typeof GATE_EVENTS)[number] | undefined) {
  if (!ev) return;
  const i = GATE_EVENTS.indexOf(ev);
  if (i >= 0) GATE_EVENTS.splice(i, 1);
}

export default defineSkill<{ who: string; action: "lock" | "release" }>({
  id: "access.lockout",
  n: 33,
  category: "access",
  title: "Overlock or release",
  featured: true,
  examples: ["Overlock Dana Whitfield's unit", "Remove the overlock on A-122"],
  slots: {
    who: { label: "unit", fill: q => q.units[0] ?? q.people.find(p => p.kind === "tenant")?.name ?? q.ambiguous[0]?.said },
    action: {
      label: "action",
      fill: q => (/\b(remove|take (off|the lock off)|release|unlock|lift|restore)\b/.test(q.lower) ? "release" : /\b(overlock|lock ?out|lock (up|down))\b/.test(q.lower) ? "lock" : undefined),
      default: "lock",
      show: v => (v === "lock" ? "overlock" : "remove overlock"),
      options: () => [
        { value: "lock", label: "Overlock" },
        { value: "release", label: "Remove overlock" },
      ],
    },
  },
  match: q =>
    kw(q, [
      [/\bover-?lock|\block ?out\b|\blocked out\b|\btake the lock off\b|\brestore\b.{0,24}\baccess\b/, 5],
      [/\b(everyone|all|bulk)\b/, -2],
    ]),

  async run(ctx, { q, slots }) {
    const action = slots.action ?? "lock";
    await ctx.think(action === "lock" ? "Check the unit and gate state first, then lock, suspend the code and notify, per the overlock policy." : "Check what's owed, release the smart overlock, turn the gate code back on and tell the tenant.", 1000);

    // Who and which unit.
    let unitId = q.units[0];
    let t: Tenant | undefined = unitId ? tenantForUnit(unitId) : undefined;
    if (!unitId) {
      t = await needTenant(ctx, q, {
        prefer: x => x.daysLate + (UNIT_BY_ID.get(x.unitIds[0])?.status === "overlocked" ? (action === "release" ? 100 : 0) : 0),
        filter: x => x.daysLate > 0,
        title: (said, n) => (said ? `${n} tenants named ${said}. Which unit?` : "Whose unit?"),
      });
      unitId = t.unitIds[0];
    }
    const u = UNIT_BY_ID.get(unitId)!;
    ctx.focus({ selected: unitId, units: [unitId], tenants: t ? [t.id] : [] });
    const name = t?.name ?? "No tenant";
    const first = t?.first ?? "the tenant";
    const code = t ? "••" + t.gateCode.slice(-2) : "—";
    const deniedToday = t ? GATE_EVENTS.find(e => e.tenantId === t!.id && e.kind === "denied") : undefined;
    const since = t ? lockedSince(t) : undefined;

    await ctx.tools([
      { name: "ledger.get", args: { tenant_id: t?.id ?? null }, result: () => ({ balance: t?.balance ?? 0, days_late: t?.daysLate ?? 0, autopay: t?.autopay ?? false }), ms: 560 },
      { name: "locks.status", args: { unit: unitId }, result: () => ({ unit: unitId, state: u.status === "overlocked" ? "overlocked" : "open", since: u.status === "overlocked" ? since ?? null : null, lock: "smart overlock" }), ms: 520 },
      { name: "gate.codes.get", args: { unit: unitId }, result: () => ({ code, status: u.status === "overlocked" ? "suspended" : "active", last_attempt: deniedToday ? `${deniedToday.at} · denied` : null }), ms: 480 },
    ]);

    // ---------------------------------------------------------------- release
    if (action === "release") {
      ctx.title(`Release · ${unitId}`);
      if (u.status !== "overlocked") {
        await ctx.say(`**${unitId}** isn't overlocked${t ? ` and ${first}'s gate code ${code} works` : ""}. Nothing to remove.`);
        ctx.suggest(["Who's more than 15 days late?", "Who came in after 10pm last night?"]);
        return;
      }
      const note = t ? commsFor(t).find(c => c.channel === "note") : undefined;
      await ctx.say(
        t && t.balance > 0
          ? `${first} owes **${money(t.balance)}**, ${t.daysLate} days late. Overlocks normally come off once the balance is paid.${note ? ` Latest note: "${note.body}"` : ""}`
          : `${unitId} is overlocked${since ? ` since ${since}` : ""} with nothing owed. Releasing it.`,
      );
      const ans = await ctx.ask(
        "diff",
        {
          title: `Remove the overlock on ${unitId}`,
          meta: name,
          rows: [
            { field: "Overlock", before: `On${since ? " since " + since : ""}`, after: "Released · smart lock" },
            { field: "Unit status", before: "overlocked", after: t && t.balance > 0 ? "past due" : "occupied" },
            { field: "Gate code", before: `${code} suspended`, after: `${code} active` },
            { field: "Tenant", before: "—", after: t ? `SMS to ${t.phone}` : "—" },
          ],
          note: t && t.balance > 0 ? `The ${money(t.balance)} balance stays open. Reminders and late fees continue.` : undefined,
          cta: "Remove overlock",
        },
        ["wait:900", "submit"],
      );
      if (ans !== "approve") {
        await ctx.say(`Left ${unitId} overlocked.`);
        return;
      }
      await ctx.tools([
        { name: "locks.overlock.release", args: { unit: unitId }, result: { lock: "smart overlock", state: "released" }, ms: 800 },
        { name: "gate.access.restore", args: { tenant_id: t?.id ?? null }, result: { code, status: "active" }, ms: 600 },
      ]);
      let undoRelease = () => {};
      let ev: (typeof GATE_EVENTS)[number] | undefined;
      ctx.effect({
        kind: "gate",
        text: `Overlock removed from ${unitId}${t ? ` · gate code restored for ${t.name}` : ""}`,
        run: () => {
          undoRelease = restoreAccess(t, [unitId], t ? `Hi ${t.first}, the overlock on ${unitId} is off and your gate code works again.${t.balance > 0 ? ` Your balance is ${money(t.balance)}: zonera.co/p/${unitId.toLowerCase().replace("-", "")}` : ""}` : undefined);
          ev = GATE_EVENTS[0];
        },
        undo: () => {
          undoRelease();
          dropEvent(ev);
        },
        link: t ? { label: "Open profile", route: "ops/tenants/" + t.id } : { label: "Open Gate access", route: "ops/gate" },
      });
      const items = [
        { id: "1", label: `Smart overlock on ${unitId} released`, state: "todo" as const },
        { id: "2", label: `Gate code ${code} active at every keypad`, state: "todo" as const },
        ...(t ? [{ id: "3", label: `SMS to ${first} · ${t.phone}`, state: "todo" as const }] : []),
      ];
      const h = ctx.show("progress", { title: `Releasing ${unitId}`, items });
      for (let i = 0; i < items.length; i++) {
        h.update({ items: items.map((x, j) => ({ ...x, state: j < i ? "done" : j === i ? "run" : "todo" })) });
        await ctx.wait(420);
      }
      h.update({ items: items.map(x => ({ ...x, state: "done" as const })), summary: `${items.length} of ${items.length} done` });
      ctx.show("answer", {
        label: "Overlock removed",
        value: unitId,
        context: `${name} · gate code ${code} works again${t && t.balance > 0 ? ` · ${money(t.balance)} still open` : ""}`,
        links: [...(t ? [{ label: "Open profile", route: "ops/tenants/" + t.id }] : []), { label: "Open delinquency", route: "ops/delinquency" }],
      });
      ctx.suggest(t?.name === "Matthew Okafor" ? ["Matthew came in and paid $240 cash", "Waive Matthew Okafor's late fee", "Who's more than 15 days late?"] : ["Who's more than 15 days late?", "Who came in after 10pm last night?"]);
      return;
    }

    // ---------------------------------------------------------------- already overlocked
    ctx.title(`Overlock · ${unitId}`);
    if (u.status === "overlocked" && t) {
      const told = commsFor(t).some(c => (c.channel === "sms" || c.channel === "email") && c.dir === "out" && /overlock/i.test(c.body));
      const returned = commsFor(t).find(c => c.channel === "letter" && /returned/i.test(c.status ?? ""));
      await ctx.tool("comms.list", { tenant_id: t.id, since: since ?? "2026-08-01" }, () => ({ overlock_notice: told ? "sent" : "none", letters: returned ? [{ status: returned.status }] : [] }), 520);
      if (told) {
        await ctx.say(`**${unitId}** is already overlocked${since ? ` (since ${since})` : ""}, ${first}'s code ${code} is suspended and the notice went out by text. Nothing to change.`);
        ctx.show("answer", { label: "Overlocked", value: unitId, context: `${name} · ${t.daysLate} days late · ${money(t.balance)} open`, links: [{ label: "Open profile", route: "ops/tenants/" + t.id }] });
        ctx.suggest(["Who's more than 15 days late?", "Text everyone past due a reminder"]);
        return;
      }
      const returnedOn = returned?.status?.match(/Returned (\w+ \d+)/)?.[1];
      await ctx.say(
        `**${unitId}** has been overlocked${since ? ` since ${since}` : ""} and ${first}'s gate code is suspended.${deniedToday ? ` She tried Gate 1 at ${deniedToday.at} today and was turned away.` : ""} The gap: she was never told. No text went out when the lock went on${returnedOn ? `, and the mailed notice came back on ${returnedOn}` : ""}.`,
      );
      const ans = await ctx.ask(
        "diff",
        {
          title: `Finish the overlock on ${unitId}`,
          meta: `${name} · ${t.daysLate} days · ${money(t.balance)}`,
          rows: [
            { field: "Overlock", before: `On${since ? " since " + since : ""}`, after: "Stays on" },
            { field: "Gate code", before: deniedToday ? `Suspended · denied ${deniedToday.at}` : "Suspended", after: "Suspended until paid" },
            { field: "Overlock notice", before: returnedOn ? `Not delivered · letter returned ${returnedOn}` : "Not sent", after: "SMS + email now, with pay link" },
            { field: "Lock check", before: "—", after: `${MARCO} · today 1:30 pm · photo for the file` },
          ],
          note: "No new fee. A lien notice is a separate step and needs your sign-off.",
          cta: "Send notice and book check",
        },
        ["wait:900", "submit"],
      );
      if (ans !== "approve") {
        await ctx.say("Left as is.");
        return;
      }
      const link = `zonera.co/p/${unitId.toLowerCase().replace("-", "")}`;
      await ctx.tools([
        { name: "sms.send", args: { to: t.phone, template: "overlock_notice" }, result: { status: "delivered" }, ms: 650 },
        { name: "email.send", args: { to: t.email, template: "overlock_notice" }, result: { status: "delivered" }, ms: 700 },
        { name: "workorders.create", args: { type: "lock_check", unit: unitId, assignee: MARCO, at: "13:30" }, result: { status: "scheduled" }, ms: 560 },
      ]);
      ctx.effect({
        kind: "agent",
        text: `Overlock notice sent to ${t.name} by SMS and email · ${unitId}`,
        run: () => {
          addComm(t!.id, { channel: "sms", dir: "out", who: "Zonera agent", body: `${t!.first}, ${unitId} is overlocked and your gate code is paused until the ${money(t!.balance)} balance is paid. Pay at ${link} or call (530) 555-0142 to set up a plan.`, status: "Delivered" });
          addComm(t!.id, { channel: "email", dir: "out", who: "Zonera agent", subject: `${unitId} is overlocked`, body: `Your unit ${unitId} has been overlocked${since ? ` since ${since}` : ""} and your gate code is paused. Balance: ${money(t!.balance)}. Pay at ${link}, or reply to set up a payment plan.`, status: "Delivered" });
          pushLedger(t!.id, { date: TODAY, min: clockMin(), kind: "info", text: "Overlock notice sent", detail: "SMS and email · pay link included", amount: 0, by: "Zonera agent" });
        },
        link: { label: "Open profile", route: "ops/tenants/" + t.id },
      });
      let undoWo = () => {};
      let woId = "";
      ctx.effect({
        kind: "maintenance",
        text: `Lock check on ${unitId} booked with ${MARCO} · today 1:30 pm`,
        run: () => {
          const r = createWorkOrder({ title: "Overlock check and photo", location: `${unitId} · Building ${u.building}`, unitId, status: "scheduled", priority: "normal", category: "Other", assignee: MARCO, due: "Today 1:30 pm", notes: `Confirm the overlock is on ${unitId} and photograph it for the lien file. ${t!.daysLate} days past due.` });
          undoWo = r.undo;
          woId = r.wo.id;
        },
        undo: () => undoWo(),
        link: { label: "Open maintenance", route: "ops/maintenance" },
      });
      const items = [
        { id: "1", label: `Overlock notice texted to ${t.phone}`, state: "done" as const, result: "Delivered" },
        { id: "2", label: `Emailed to ${t.email}`, state: "done" as const, result: "Delivered" },
        { id: "3", label: `Lock check ${woId} · ${MARCO} · 1:30 pm`, state: "done" as const, result: "Scheduled" },
        { id: "4", label: `Gate code ${code} stays suspended`, state: "done" as const },
      ];
      ctx.show("progress", { title: `Overlock · ${unitId}`, items, summary: "4 of 4 done" });
      ctx.show("answer", {
        label: "Overlocked",
        value: unitId,
        context: `${name}${since ? ` · since ${since}` : ""} · notice delivered today · lock check 1:30 pm`,
        delta: { text: `${money(t.balance)} open`, tone: "bad" },
        links: [
          { label: "Open profile", route: "ops/tenants/" + t.id },
          { label: "Open delinquency", route: "ops/delinquency" },
        ],
      });
      await ctx.say(`${first} has the notice and a pay link now. If she pays, the overlock comes off and the code turns back on by itself.`);
      ctx.suggest([t.name === "Dana Whitfield" ? "Start the lien process for Dana Whitfield" : "Who's more than 15 days late?", "Text everyone past due a reminder", "Who came in after 10pm last night?"]);
      return;
    }

    // ---------------------------------------------------------------- full overlock
    if (!t) {
      await ctx.say(`**${unitId}** has no tenant, so there's nothing to overlock. It's ${u.status}.`);
      ctx.suggest(["Who's more than 15 days late?"]);
      return;
    }
    const early = t.daysLate < 30;
    await ctx.say(
      early
        ? `${first} owes **${money(t.balance)}** and is ${t.daysLate} days late. Policy overlocks at 30 days, so this is early; approve only if you want it now.`
        : `${first} owes **${money(t.balance)}**, ${t.daysLate} days late, past the 30-day overlock line.`,
    );
    const ans = await ctx.ask(
      "diff",
      {
        title: `Overlock ${unitId}`,
        meta: `${name} · ${sizeLabel(u.size)}`,
        rows: [
          { field: "Unit status", before: u.status === "delinquent" ? "past due" : u.status, after: "overlocked" },
          { field: "Gate access", before: `${code} active`, after: "suspended at every keypad" },
          { field: "Notice", before: "—", after: "SMS + email now, with pay link" },
          { field: "Fee", before: "—", after: `${money(OVERLOCK_FEE)} overlock fee` },
          { field: "Lock", before: "—", after: `${MARCO} installs by 1:30 pm` },
        ],
        note: early ? `${t.daysLate} days late. The usual threshold is 30.` : "The overlock comes off automatically when the balance is paid.",
        cta: "Overlock and notify",
      },
      ["wait:900", "submit"],
    );
    if (ans !== "approve") {
      await ctx.say(`Left ${unitId} as is.`);
      return;
    }
    await ctx.tools([
      { name: "gate.access.suspend", args: { tenant_id: t.id, units: [unitId] }, result: { code, status: "suspended" }, ms: 600 },
      { name: "workorders.create", args: { type: "overlock", unit: unitId, assignee: MARCO, by: "13:30" }, result: { status: "scheduled" }, ms: 560 },
    ]);
    const prevBalance = t.balance;
    const link = `zonera.co/p/${unitId.toLowerCase().replace("-", "")}`;
    let undoLock = () => {};
    let undoWo = () => {};
    let ev: (typeof GATE_EVENTS)[number] | undefined;
    let fee: ReturnType<typeof pushLedger> | undefined;
    let woId = "";
    ctx.effect({
      kind: "gate",
      text: `Overlocked ${unitId} · ${t.name} · gate code suspended`,
      run: () => {
        undoLock = lockOut(t!, [unitId], `${t!.daysLate} days past due`, `${t!.first}, ${unitId} is overlocked and your gate code is paused. Pay ${money(t!.balance + OVERLOCK_FEE)} at ${link} to restore access right away.`);
        ev = GATE_EVENTS[0];
        fee = pushLedger(t!.id, { date: TODAY, min: clockMin(), kind: "fee", text: "Overlock fee", detail: "Per the rental agreement", amount: OVERLOCK_FEE, by: "Zonera agent" });
        t!.balance = prevBalance + OVERLOCK_FEE;
        addComm(t!.id, { channel: "email", dir: "out", who: "Zonera agent", subject: `${unitId} is overlocked`, body: `Your unit ${unitId} is overlocked and your gate code is paused. Balance: ${money(t!.balance)}. Pay at ${link} to restore access right away.`, status: "Delivered" });
        const r = createWorkOrder({ title: "Install overlock", location: `${unitId} · Building ${u.building}`, unitId, status: "scheduled", priority: "high", category: "Other", assignee: MARCO, due: "Today 1:30 pm", notes: `Overlock ${unitId} (${t!.name}, ${t!.daysLate} days past due). Photo for the file.` });
        undoWo = r.undo;
        woId = r.wo.id;
      },
      undo: () => {
        undoLock();
        dropEvent(ev);
        undoWo();
        t!.balance = prevBalance;
        if (fee) Object.assign(fee, { amount: 0, text: "Overlock fee reversed", detail: "Overlock undone" });
      },
      link: { label: "Open profile", route: "ops/tenants/" + t.id },
    });
    const items = [
      { id: "1", label: `Overlock work order ${woId} to ${MARCO}`, sub: "Install by 1:30 pm, photo for the file", state: "todo" as const },
      { id: "2", label: `Gate code ${code} suspended`, sub: "Every keypad, Gate 1 to Building D", state: "todo" as const },
      { id: "3", label: "Notice sent by SMS and email", sub: `${t.phone} · ${t.email}`, state: "todo" as const },
      { id: "4", label: `${money(OVERLOCK_FEE)} overlock fee posted`, state: "todo" as const },
    ];
    const h = ctx.show("progress", { title: `Overlocking ${unitId}`, items });
    for (let i = 0; i < items.length; i++) {
      h.update({ items: items.map((x, j) => ({ ...x, state: j < i ? "done" : j === i ? "run" : "todo" })) });
      await ctx.wait(450);
    }
    h.update({ items: items.map(x => ({ ...x, state: "done" as const })), summary: "4 of 4 done" });
    ctx.show("answer", {
      label: "Overlocked",
      value: unitId,
      context: `${name} · gate code suspended · notice sent · lock by 1:30 pm`,
      delta: { text: `${money(t.balance)} open`, tone: "bad" },
      links: [
        { label: "Open profile", route: "ops/tenants/" + t.id },
        { label: "Open delinquency", route: "ops/delinquency" },
      ],
    });
    ctx.suggest([t.name === "Dana Whitfield" ? "Start the lien process for Dana Whitfield" : "Who's more than 15 days late?", "Text everyone past due a reminder", "Who came in after 10pm last night?"]);
  },
});
