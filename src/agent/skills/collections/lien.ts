import { defineSkill } from "../../engine";
import { kw } from "../../parse";
import { isoAdd, isoDaysAgo, money, pastDue, setUnitStatus, snapshot, RECORDS, TODAY_ISO, U } from "../../data";
import { fmt } from "../../../state/store";
import { OPERATOR, tenantForUnit } from "../../../data/tenants";
import { openCharges } from "../../../data/ledger";
import { addComm, commsFor, type Comm } from "../../../data/comms";
import { logLease } from "../../../data/leases";
import { LIEN, type LienState } from "../../../ops/pages/b/lien";
import { post, recall, resolveTenant, plural } from "../money/util";

// #28 Start the lien process (California Self-Service Storage Facility Act,
// Bus. & Prof. Code §21700–21716). Today's step is the preliminary lien notice
// (§21703); the rest of the statutory timeline is laid out from today.
//
//   "Start the lien process for Dana Whitfield"   → timeline → plan → notice out → progress
//   "Begin the lien on A-131"                     → same, resolved from the unit

const short = (iso: string) => fmt.short(iso);
const dow = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" });

/** Mailing details the rental agreement holds. Dana's come from her thread; others are generic. */
function addresses(name: string) {
  if (name === "Dana Whitfield") return { home: "418 Pine St, Apt 3, South Lake Tahoe, CA 96150", alt: "Marcus Whitfield, 77 Kiva Rd, Meyers, CA 96150", altName: "Marcus Whitfield", returned: "Sep 14" };
  return { home: "Address on the rental agreement", alt: "Alternate contact on the rental agreement", altName: "the alternate contact", returned: undefined as string | undefined };
}

export default defineSkill<{ who: string; law: string }>({
  id: "collections.lien",
  n: 28,
  category: "collections",
  title: "Start lien process",
  featured: true,
  examples: ["Start the lien process for Dana Whitfield", "Begin the lien on A-131", "Start the lien process for Dana"],
  slots: {
    who: {
      label: "tenant",
      fill: q => q.people.find(p => p.kind === "tenant")?.name ?? (q.units[0] ? tenantForUnit(q.units[0])?.name : undefined),
      default: () => pastDue()[0]?.name,
    },
    law: { label: "law", fill: () => undefined, default: "California · B&P §21700", show: v => v },
  },
  match: q => kw(q, [[/\blien\b|\bpre-?lien\b|\blien sale\b/, 5], [/\b(start|begin|kick off|open|process)\b/, 1], [/\b(auction results?|sold for)\b/, -3]]),

  async run(ctx, { q }) {
    await ctx.think("Check eligibility under the California Self-Service Storage Facility Act, rebuild the notice history, then lay out the statutory timeline from today.", 1300);

    const fallback = pastDue().find(t => t.daysLate >= 14);
    const t = await resolveTenant(ctx, q, { fits: x => x.daysLate >= 14, why: "14+ days past due", fallback });
    const unitId = t.unitIds[0];
    const u = U(unitId);
    ctx.title(`Lien · ${t.name}`);
    ctx.focus({ tenants: [t.id], selected: unitId, units: [unitId] });

    const due = isoDaysAgo(t.daysLate);
    const eligible = isoAdd(due, 14);
    const prior: LienState | undefined = LIEN.get(t.id) ? { ...LIEN.get(t.id)! } : undefined;

    // Not eligible: California needs 14 consecutive days unpaid.
    if (t.balance <= 0 || t.daysLate < 14) {
      await ctx.tool("ledger.get", { tenant_id: t.id }, () => ({ balance: t.balance, days_late: t.daysLate }), 520);
      await ctx.say(
        t.balance <= 0
          ? `**${t.name}** doesn't owe anything, so there's no lien to start.`
          : `**${t.name}** is ${t.daysLate} days late on ${unitId}. California requires 14 days unpaid before a preliminary lien notice (§21703), so the earliest date is **${short(eligible)}**. A reminder now usually works better.`,
      );
      ctx.suggest(["Text everyone past due a reminder", "Show delinquency aging", "Who's more than 15 days late?"]);
      return;
    }

    // Paused by a manager (Priya on Dana's call): respect the plan, don't send.
    if (/lien (sale )?paused/i.test(t.notes ?? "")) {
      await ctx.tool("ledger.get", { tenant_id: t.id }, () => ({ balance: t.balance, days_late: t.daysLate, lien: "paused", plan: /Plan: ([^.]+)/.exec(t.notes ?? "")?.[1] ?? null }), 560);
      await ctx.say(`The lien on **${unitId}** is paused. ${t.notes} I won't send a notice while the plan is current; if the next installment is missed, ask me again and I'll restart the timeline from that day.`);
      ctx.suggest(["Show delinquency aging", "Text everyone past due a reminder", "Pull up Matthew Okafor"]);
      return;
    }

    const addr = addresses(t.name);
    const thread = commsFor(t);
    const reminders = thread.filter(c => c.dir === "out" && (c.channel === "sms" || c.channel === "email") && c.date >= due).length;
    const lockedSince = thread.find(c => c.channel === "system" && /overlocked/i.test(c.body))?.date;
    const open = openCharges(t);

    await ctx.tools([
      { name: "ledger.get", args: { tenant_id: t.id }, result: () => ({ balance: t.balance, days_late: t.daysLate, open_items: open.map(c => ({ date: c.date, item: c.text, amount: c.amount })) }), ms: 620 },
      {
        name: "tenants.get",
        args: { id: t.id, include: ["addresses", "consents", "protection"] },
        result: () => ({ name: t.name, unit: unitId, unit_status: u.status, protection: t.protection ? `$${t.protection.toLocaleString()} coverage` : "declined", mail: addr.returned ? `returned ${addr.returned} · not at this address` : "deliverable", alternate: addr.alt, email_notices: "consented on rental agreement" }),
        ms: 540,
      },
      {
        name: "legal.timeline",
        args: { state: "CA", statute: "Bus. & Prof. Code §21700–21716", first_unpaid: due, prelien_sent: prior?.sent ?? null },
        result: () => ({ prelien_eligible: eligible, notice_period_days: 14, delivery: ["certified mail", "email with consent"], declaration_in_opposition_days: 14, advertising: "online, 2 consecutive weeks", sale: "online auction allowed" }),
        ms: 760,
      },
    ]);

    // Already in motion: show where it stands instead of sending twice.
    if (prior && !prior.draft && prior.stage !== "overlocked" && prior.stage !== "pastdue") {
      const sent = prior.sent ?? TODAY_ISO;
      await ctx.say(
        prior.stage === "prelien"
          ? `The preliminary lien notice for **${unitId}** went out ${sent === TODAY_ISO ? "today" : short(sent)}. ${t.first} has until **${short(isoAdd(sent, 14))}** to pay; the notice of lien sale can't go out before then.`
          : prior.stage === "notice"
            ? `The notice of lien sale for **${unitId}** went out ${short(sent)}. The sale can be set after ${short(isoAdd(sent, 14))}.`
            : `**${unitId}** is already scheduled for an online sale on ${short(prior.sale ?? isoAdd(sent, 28))}.`,
      );
      ctx.suggest(["Show delinquency aging", "Text everyone past due a reminder", "Who's more than 15 days late?"]);
      return;
    }

    // Statutory timeline from today.
    const prelien = TODAY_ISO;
    const noticeSale = isoAdd(prelien, 14); // right to use ends; §21705 notice can go out
    const declDue = isoAdd(noticeSale, 14); // §21706 declaration in opposition
    const ad1 = declDue;
    const ad2 = isoAdd(ad1, 7);
    const sale = isoAdd(ad2, 7);
    const planUntil = isoAdd(sale, -5);
    const overdueBy = Math.round((new Date(TODAY_ISO).getTime() - new Date(eligible).getTime()) / 86400000);
    const locked = u.status === "overlocked";

    ctx.show("table", {
      title: `Lien timeline · ${unitId}`,
      meta: "California · B&P §21700–21716",
      columns: [
        { key: "step", label: "Step" },
        { key: "law", label: "Statute", mono: true },
        { key: "date", label: "Date", mono: true },
        { key: "status", label: "Status" },
      ],
      rows: [
        { id: "due", cells: { step: `Rent due · ${money(t.rent)}`, law: "—", date: short(due), status: "Missed" }, tone: "bad" as const },
        { id: "rem", cells: { step: `${plural(reminders, "reminder")}, late fees`, law: "Lease", date: `${short(isoAdd(due, 6))} – Sep 30`, status: "Done" } },
        { id: "elig", cells: { step: "Eligible for preliminary lien notice", law: "§21703", date: short(eligible), status: overdueBy > 0 ? `${overdueBy} days ago` : "Today" }, tone: "warn" as const },
        ...(lockedSince || locked ? [{ id: "lock", cells: { step: "Overlocked, gate code suspended", law: "Lease", date: lockedSince ? short(lockedSince) : "—", status: "On" } }] : []),
        { id: "pre", cells: { step: "Preliminary lien notice · certified + email", law: "§21703", date: "Today", status: "Ready to send" }, tone: "warn" as const },
        { id: "end", cells: { step: "Right to use ends · notice of lien sale", law: "§21705", date: `${dow(noticeSale)} ${short(noticeSale)}`, status: "If unpaid" } },
        { id: "decl", cells: { step: "Declaration in opposition due", law: "§21706", date: `${dow(declDue)} ${short(declDue)}`, status: "If unpaid" } },
        { id: "ads", cells: { step: "Online ads · StorageTreasure", law: "§21707", date: `${short(ad1)} & ${short(ad2)}`, status: "If unpaid" } },
        { id: "sale", cells: { step: "Lien sale, online · 10:00 am", law: "§21707", date: `${dow(sale)} ${short(sale)}`, status: "If unpaid" } },
      ],
      maxRows: 9,
    });

    await ctx.say(
      `${t.first} is **${t.daysLate} days** late on **${unitId}** and owes **${money(t.balance)}**${t.protection ? "" : ", with no tenant protection"}. ` +
        `Eligible for a preliminary lien notice since ${short(eligible)}${prior?.draft ? "; the draft has been waiting for your sign-off" : ""}. ` +
        (addr.returned ? `The Sep 3 letter came back ${addr.returned}, so this one goes certified to ${addr.home.split(",")[0]} and to ${addr.altName}, plus email. ` : "It goes certified to the address and alternate contact on the lease, plus email. ") +
        `If it stays unpaid, the sale lands on **${dow(sale)} ${short(sale)}**. Paying in full stops it at any point before then.`,
    );

    const ok = await ctx.ask(
      "plan",
      {
        title: `Start lien · ${t.name}`,
        meta: `${unitId} · ${money(t.balance)}`,
        items: [
          { id: "notice", group: "Today", label: "Send the preliminary lien notice (§21703)", sub: `Certified mail to ${addr.home.split(",")[0]} and ${addr.altName}, plus email · itemized ${money(t.balance)} · cure by ${short(noticeSale)}`, tier: "Ask first" },
          { id: "lock", group: "Today", label: `Keep the overlock on ${unitId}`, sub: lockedSince ? `On since ${short(lockedSince)}` : "Smart overlock, released automatically on payment", tier: "Auto" },
          { id: "gate", group: "Today", label: "Keep gate access denied", sub: `Code ••${t.gateCode.slice(-2)} stays suspended until paid`, tier: "Auto" },
          { id: "plan", group: "Today", label: `Offer a payment plan until ${short(planUntil)}`, sub: "Half now, half in 14 days · 5 days before the sale", tier: "Ask first" },
          { id: "sale", group: "If unpaid", label: `Draft the notice of lien sale for ${short(noticeSale)} (§21705)`, sub: "Needs your signature that day", tier: "Ask first" },
          { id: "list", group: "If unpaid", label: `Draft a StorageTreasure listing for ${short(sale)}`, sub: `Ads ${short(ad1)} and ${short(ad2)} (§21707) · not published`, tier: "Ask first" },
        ],
        impact: "Nothing is sold without another sign-off.",
        cta: "Approve and run {n} steps",
      },
      ["wait:1000", "submit"],
    );
    if (ok.secondary) return;
    const ids = new Set(ok.ids);

    const tracking = ["9407 1118 9876 5432 1010 23", "9407 1118 9876 5432 1010 47"];
    const items = [
      ...(ids.has("notice")
        ? [
            { id: "pdf", label: "Notice generated", sub: `prelien-${unitId.toLowerCase().replace("-", "")}-2026-10-02.pdf · itemized ${money(t.balance)} · blank declaration enclosed`, result: "2 pages" },
            { id: "usps1", label: `Certified mail queued · ${addr.home.split(",")[0]}`, sub: `USPS ${tracking[0]}`, result: "Pickup 3:00 pm" },
            { id: "usps2", label: `Copy to alternate address · ${addr.altName}`, sub: `USPS ${tracking[1]}`, result: "Pickup 3:00 pm" },
            { id: "email", label: `Email sent · ${t.email}`, sub: "PDF attached · read receipt on", result: "Delivered" },
          ]
        : []),
      ...(ids.has("lock") || ids.has("gate") ? [{ id: "lock", label: `${unitId} overlock and gate suspension confirmed`, sub: "Releases on payment in full", result: "Held" }] : []),
      ...(ids.has("plan") ? [{ id: "plan", label: "Payment plan offer added to the notice", sub: `zonera.co/p/${unitId.toLowerCase().replace("-", "")} · open until ${short(planUntil)}`, result: "Linked" }] : []),
      ...(ids.has("sale") ? [{ id: "sale", label: `Notice of lien sale drafted for ${short(noticeSale)}`, sub: "Reminder on your calendar, 9:00 am", result: "Draft" }] : []),
      ...(ids.has("list") ? [{ id: "list", label: "StorageTreasure listing drafted", sub: `${unitId} · online sale ${short(sale)}, 10:00 am`, result: "Not published" }] : []),
    ].map(x => ({ ...x, state: "todo" as const }));

    const h = ctx.show("progress", { title: `Lien process · ${unitId}`, items });
    for (let i = 0; i < items.length; i++) {
      h.update({ items: items.map((x, j) => ({ ...x, state: j < i ? "done" : j === i ? "run" : "todo", result: j < i ? x.result : undefined })) });
      await ctx.wait(i === 0 ? 700 : 420);
    }
    h.update({ items: items.map(x => ({ ...x, state: "done" as const })), summary: `${items.length} of ${items.length} done${ids.has("notice") ? ` · cure by ${short(noticeSale)}` : ""}` });

    const restore = snapshot(t);
    let undoLock = () => {};
    let sent: Comm[] = [];
    let line: ReturnType<typeof post> | undefined;
    const rec = { tenantId: t.id, step: ids.has("notice") ? "prelien" : "review" };
    ctx.effect({
      kind: "alert",
      text: ids.has("notice") ? `Preliminary lien notice sent · ${unitId} ${t.name} · cure by ${short(noticeSale)}` : `Lien review · ${unitId} ${t.name}`,
      link: { label: "Open delinquency", route: "ops/delinquency" },
      run: () => {
        if (ids.has("lock")) undoLock = setUnitStatus(unitId, "overlocked");
        if (ids.has("notice")) {
          LIEN.set(t.id, { stage: "prelien", sent: TODAY_ISO });
          sent = [
            addComm(t.id, {
              channel: "letter",
              dir: "out",
              who: "Zonera agent",
              subject: "Preliminary lien notice · §21703",
              body: `Itemized balance ${money(t.balance)}. Right to use ${unitId} ends ${short(noticeSale)} unless paid. Certified mail to ${addr.home} (USPS ${tracking[0]}) and ${addr.alt} (USPS ${tracking[1]}), with a blank Declaration in Opposition to Lien Sale.${ids.has("plan") ? ` Payment plan available until ${short(planUntil)}.` : ""}`,
              status: "Certified · awaiting pickup",
            }),
            addComm(t.id, { channel: "email", dir: "out", who: "Zonera agent", subject: `Preliminary lien notice for ${unitId}`, body: `Your balance for ${unitId} is ${money(t.balance)}. Your right to use the space ends ${short(noticeSale)} unless it's paid. The notice is attached. Pay or set up a plan at zonera.co/p/${unitId.toLowerCase().replace("-", "")}.`, status: "Delivered" }),
          ];
          line = post(t.id, { kind: "info", text: "Preliminary lien notice sent", detail: `§21703 · certified mail + email · cure by ${short(noticeSale)}`, amount: 0, by: "Zonera agent" });
          logLease(t.id, { text: "Preliminary lien notice sent", who: OPERATOR.name, meta: "Certified mail + email · §21703" });
          t.lastContact = "Oct 2 · Pre-lien notice, certified mail";
        }
        t.notes = `${t.notes ? t.notes + " " : ""}Lien process started Oct 2${ids.has("sale") ? `; notice of sale ${short(noticeSale)}, sale ${short(sale)} if unpaid` : ""}.`;
        RECORDS.liens.push(rec);
      },
      undo: () => {
        restore();
        undoLock();
        if (prior) LIEN.set(t.id, prior);
        else LIEN.delete(t.id);
        recall(sent, "Cancelled before pickup");
        line?.void("Preliminary lien notice cancelled", "Recalled before USPS pickup");
        if (sent.length) logLease(t.id, { text: "Preliminary lien notice cancelled", who: OPERATOR.name, meta: "Recalled before USPS pickup" });
        const i = RECORDS.liens.indexOf(rec);
        if (i >= 0) RECORDS.liens.splice(i, 1);
      },
    });

    ctx.show("answer", {
      label: ids.has("notice") ? "Preliminary lien notice sent" : "Lien steps updated",
      value: ids.has("notice") ? `Cure by ${short(noticeSale)}` : unitId,
      context: `${t.name} · ${unitId} · owes ${money(t.balance)}. ${ids.has("notice") ? `Sale ${dow(sale)} ${short(sale)} if unpaid.` : "No notice sent."}`,
      tiles: [
        { label: "Owes", value: money(t.balance), context: `${t.daysLate} days late` },
        { label: "Notice of sale", value: short(noticeSale), context: ids.has("sale") ? "Drafted · needs signature" : "Not drafted" },
        { label: "Sale if unpaid", value: short(sale), context: ids.has("list") ? "Listing drafted" : "No listing yet" },
      ],
      items: ids.has("notice") ? [{ label: "Certified mail", meta: `USPS ${tracking[0]}` }, { label: `Copy to ${addr.altName}`, meta: `USPS ${tracking[1]}` }] : undefined,
      itemsTitle: ids.has("notice") ? "Tracking" : undefined,
      links: [
        { label: "Open delinquency", route: "ops/delinquency" },
        { label: "Open profile", route: "ops/tenants/" + t.id },
      ],
    });
    await ctx.say(
      ids.has("notice")
        ? `Sent. ${t.first} has until **${short(noticeSale)}** to pay ${money(t.balance)}${ids.has("plan") ? ` or take the plan` : ""}. I'll bring the notice of lien sale back to you that morning if it's still open, and the overlock comes off on its own once it's paid in full.`
        : `Done. The preliminary lien notice did not go out, so the timeline hasn't started.`,
    );
    ctx.suggest(["Text everyone past due a reminder", "Show delinquency aging", "Pull up Matthew Okafor"]);
  },
});
