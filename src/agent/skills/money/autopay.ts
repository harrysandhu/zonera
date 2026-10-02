import { defineSkill } from "../../engine";
import { kw } from "../../parse";
import { DECLINE, isoDaysAgo, money, round2, snapshot, U } from "../../data";
import { clock, fmt } from "../../../state/store";
import type { Tenant } from "../../../data/tenants";
import { failedAutopay, UPDATE_LINKS, TODAY } from "../../../data/ledger";
import { addComm, commsFor } from "../../../data/comms";
import type { DeliveryState } from "../../widgets/core/types";
import { andList, post, plural, sum } from "./util";

// #19 Fix autopay failures: last night's retry run declined again for a few
// tenants. Retry the soft declines, text card-update links for expired cards,
// hold late fees for 48 hours while they fix it.
//
//   "Fix last night's autopay failures"   → table → plan → progress (one retry clears) → delivery → answer
//   "Who has a failed autopay?"           → same flow

type Reason = { code: string; label: string; retry: boolean; hint: string };

/** Why the charge failed. Insufficient funds and do-not-honor are worth one retry; expired cards are not. */
function reasonFor(t: Tenant): Reason {
  const d = DECLINE[t.name];
  const code = d?.code ?? (/expired/i.test(t.notes ?? "") ? "expired_card" : ["insufficient_funds", "do_not_honor", "expired_card"][t.id.charCodeAt(t.id.length - 1) % 3]);
  if (code === "insufficient_funds") return { code, label: "Insufficient funds", retry: true, hint: "Payroll deposits landed Oct 1" };
  if (code === "do_not_honor") return { code, label: "Do not honor", retry: true, hint: "Issuer declines like this often clear on a second try" };
  return { code: "expired_card", label: "Card expired", retry: false, hint: "Needs a new card" };
}
const attempts = (t: Tenant) => 1 + Math.min(3, Math.floor(t.daysLate / 3));
/** Only insufficient-funds retries clear in this run; do-not-honor declines again. */
const retryClears = (r: Reason) => r.code === "insufficient_funds";
const link = (t: Tenant) => `zonera.co/u/${t.unitIds[0].toLowerCase().replace("-", "")}`;
/** Already got a card link by text today (Grace was reminded at 9:38 am). */
function textedToday(t: Tenant) {
  const c = commsFor(t).find(x => x.date === TODAY && x.channel === "sms" && x.dir === "out" && /zonera\.co\/u\//.test(x.body));
  return c ? (UPDATE_LINKS.get(t.id) ?? `${Math.floor(c.min / 60) % 12 || 12}:${String(c.min % 60).padStart(2, "0")} am`) : undefined;
}

export default defineSkill<{ run: string }>({
  id: "money.autopay",
  n: 19,
  category: "money",
  title: "Fix autopay failures",
  featured: true,
  examples: ["Fix last night's autopay failures", "Who has a failed autopay?", "Retry the declined autopays"],
  slots: {
    run: { label: "run", fill: q => q.dates[0], default: isoDaysAgo(1), show: v => (v === isoDaysAgo(1) ? "last night · Oct 1" : fmt.short(v)) },
  },
  match: q => kw(q, [[/\bauto-?pay(s|ments?)?\b/, 3], [/\b(fail|failed|failures?|declin|bounced|retry)\w*/, 2], [/\brefund|duplicate|waive\b/, -3]]),

  async run(ctx) {
    ctx.title("Autopay failures");
    await ctx.think("Pull last night's declines, split soft declines worth retrying from cards that need updating, and hold late fees while tenants fix them.", 1200);

    const list = failedAutopay().filter(t => t.balance > 0);
    const total = sum(list.map(t => t.balance));
    await ctx.tool(
      "payments.failures.list",
      { run: "2026-10-01 nightly", status: "declined" },
      () => ({ count: list.length, total, declines: list.map(t => ({ tenant: t.name, unit: t.unitIds[0], amount: t.balance, card: t.card, code: reasonFor(t).code, attempts: attempts(t) })) }),
      760,
    );

    if (!list.length) {
      await ctx.say("No open autopay failures. Every card in last night's run went through.");
      ctx.suggest(["Show delinquency aging", "Who's more than 15 days late?", "What needs my attention today?"]);
      return;
    }

    ctx.focus({ tenants: list.slice(0, 3).map(t => t.id), units: list.flatMap(t => t.unitIds), selected: list[0].unitIds[0] });
    const soft = list.filter(t => reasonFor(t).retry);
    const hard = list.filter(t => !reasonFor(t).retry);
    await ctx.say(
      `**${plural(list.length, "autopay charge")}** declined again in last night's retry run, **${money(total)}** in total. ` +
        `${soft.length ? `${soft.length === 1 ? "1 is a soft decline" : `${soft.length} are soft declines`} worth retrying now` : "None are worth retrying"}; ` +
        `${hard.length ? (hard.length === 1 ? "1 card has expired, so that tenant needs to update it." : `${hard.length} cards have expired, so those tenants need to update them.`) : "no cards have expired."}`,
    );

    const pick = await ctx.ask(
      "table",
      {
        title: `${plural(list.length, "decline")} · Oct 1 run`,
        meta: money(total),
        columns: [
          { key: "name", label: "Tenant" },
          { key: "unit", label: "Unit", mono: true },
          { key: "amt", label: "Amount", align: "right", mono: true },
          { key: "card", label: "Card", mono: true },
          { key: "why", label: "Reason" },
          { key: "n", label: "Attempts", align: "right", mono: true },
        ],
        rows: list.map(t => {
          const r = reasonFor(t);
          return { id: t.id, cells: { name: t.name, unit: t.unitIds[0], amt: money(t.balance), card: t.card ?? "—", why: r.label, n: String(attempts(t)) }, sort: { amt: t.balance, n: attempts(t) }, tone: (r.retry ? "warn" : "bad") as "warn" | "bad" };
        }),
        selectable: true,
        cta: "Plan fixes for {n}",
      },
      ["wait:800", "submit"],
    );
    const chosen = list.filter(t => pick.ids.includes(t.id));
    if (!chosen.length) return;

    const retry = chosen.filter(t => reasonFor(t).retry);
    const expired = chosen.filter(t => !reasonFor(t).retry);
    const until = "Sun Oct 4, 9:45 am";
    const plan = await ctx.ask(
      "plan",
      {
        title: "Fix autopay failures",
        meta: `${plural(chosen.length, "tenant")} · ${money(sum(chosen.map(t => t.balance)))}`,
        items: [
          ...retry.map(t => ({ id: "retry:" + t.id, group: "Retry now · soft declines", label: `Retry ${money(t.balance)} · ${t.name}`, sub: `${t.card} · ${reasonFor(t).label.toLowerCase()} · ${reasonFor(t).hint}`, tier: "Auto" as const })),
          ...expired.map(t => {
            const at = textedToday(t);
            return { id: "link:" + t.id, group: "Text a card-update link", label: `${t.name} · ${t.phone}`, sub: at ? `Already texted a link at ${at}, so skip a second text` : `${t.card} expired · retries as soon as the card is updated`, on: !at, tier: "Auto" as const };
          }),
          ...retry.filter(t => !retryClears(reasonFor(t))).map(t => ({ id: "link:" + t.id, group: "Text a card-update link", label: `${t.name} · ${t.phone}`, sub: "Only if the retry declines again · asks for another card", tier: "Auto" as const })),
          { id: "pause", group: "Late fees", label: `Hold late fees for 48 hours · ${plural(chosen.length, "tenant")}`, sub: `Until ${until} · resumes on its own`, tier: "Ask first" as const },
        ],
        impact: "Retries use the card on file. Nothing new is charged without a card.",
        cta: "Approve and run {n} actions",
      },
      ["wait:900", "submit"],
    );
    if (plan.secondary) return;
    const on = new Set(plan.ids);

    // Run it.
    type Item = { id: string; label: string; sub?: string; state: "todo" | "run" | "done" | "fail" | "skip"; result?: string };
    const items: Item[] = [
      ...retry.filter(t => on.has("retry:" + t.id)).map(t => ({ id: "retry:" + t.id, label: `Retry ${money(t.balance)} · ${t.name}`, sub: `${t.card} · attempt ${attempts(t) + 1}`, state: "todo" as const })),
      ...chosen.filter(t => on.has("link:" + t.id)).map(t => ({ id: "link:" + t.id, label: `Card-update link · ${t.name}`, sub: `${t.phone} · ${link(t)}`, state: "todo" as const })),
      ...(on.has("pause") ? [{ id: "pause", label: `Late fees held until ${until}`, sub: plural(chosen.length, "tenant"), state: "todo" as const }] : []),
    ];
    // Retries first, in parallel, on the card on file.
    const retryOn = retry.filter(t => on.has("retry:" + t.id));
    if (retryOn.length)
      await ctx.tools(
        retryOn.map(t => ({
          name: "payments.charge",
          args: { tenant_id: t.id, amount: t.balance, card: t.card, reason: "autopay_retry" },
          result: retryClears(reasonFor(t)) ? { status: "succeeded", charge: "ch_3QAz" + t.id.slice(-3) + "Kp", amount: t.balance } : { status: "declined", code: reasonFor(t).code },
          ms: 820,
        })),
      );
    const h = ctx.show("progress", { title: "Fixing autopay", items });
    const paid: Tenant[] = [];
    const linked: Tenant[] = [];
    for (const it of items) {
      const t = chosen.find(x => it.id.endsWith(":" + x.id));
      if (it.id.startsWith("link:") && t && paid.includes(t)) {
        it.state = "skip";
        it.result = "Retry cleared";
        h.update({ items: [...items] });
        continue;
      }
      it.state = "run";
      h.update({ items: [...items] });
      await ctx.wait(it.id.startsWith("retry:") ? 480 : 380);
      if (it.id.startsWith("retry:") && t) {
        const r = reasonFor(t);
        const ok = retryClears(r);
        it.state = ok ? "done" : "fail";
        it.result = ok ? "Approved" : `Declined · ${r.label.toLowerCase()}`;
        if (ok) paid.push(t);
      } else if (it.id.startsWith("link:") && t) {
        it.state = "done";
        it.result = "Link sent";
        linked.push(t);
      } else {
        it.state = "done";
        it.result = "Held";
        it.sub = plural(chosen.filter(x => !paid.includes(x) && x.balance > 0).length, "tenant");
      }
      h.update({ items: [...items] });
    }
    const recovered = sum(paid.map(t => t.balance));
    h.update({ items: [...items], summary: `${money(recovered)} recovered · ${plural(linked.length, "link")} sent` });

    // Effects: each recovered charge on its own so it can be undone.
    for (const t of paid) {
      const amt = t.balance;
      const restore = snapshot(t);
      let line: ReturnType<typeof post> | undefined;
      ctx.effect({
        kind: "payment",
        text: `Autopay retry collected ${money(amt)} · ${t.unitIds[0]} ${t.name}`,
        link: { label: "Open profile", route: "ops/tenants/" + t.id },
        run: () => {
          line = post(t.id, { kind: "payment", text: "Autopay retry", detail: "Approved on retry after a soft decline", ref: `RCPT-${9300 + +t.id.slice(2) % 100}`, amount: -amt, method: `Autopay · ${t.card}`, by: "Zonera agent" });
          t.balance = 0;
          t.daysLate = 0;
          t.lastContact = "Oct 2 · Autopay retry, paid";
          for (const id of t.unitIds) if (U(id).status === "delinquent") U(id).status = "occupied";
        },
        undo: () => {
          restore();
          line?.void("Autopay retry reversed", "Undone by Priya Raman");
        },
      });
    }
    if (linked.length) {
      const prev = linked.map(t => [t.id, UPDATE_LINKS.get(t.id)] as const);
      ctx.effect({
        kind: "payment",
        text: `Card-update links texted to ${plural(linked.length, "tenant")}`,
        link: { label: "Open payments", route: "ops/payments" },
        run: () => {
          for (const t of linked) {
            UPDATE_LINKS.set(t.id, clock());
            const again = reasonFor(t).retry;
            addComm(t.id, { channel: "sms", dir: "out", who: "Zonera agent", body: again ? `Hi ${t.first}, your bank declined the ${money(t.balance)} autopay for ${t.unitIds[0]} again. Add another card at ${link(t)} and we'll charge it right away. Late fees are on hold until Sunday.` : `Hi ${t.first}, the card on file for ${t.unitIds[0]} has expired, so ${money(t.balance)} didn't go through. Update it at ${link(t)} and we'll retry right away. Late fees are on hold until Sunday.`, status: "Delivered" });
          }
        },
        undo: () => {
          for (const [id, v] of prev) v ? UPDATE_LINKS.set(id, v) : UPDATE_LINKS.delete(id);
        },
      });
    }
    if (on.has("pause")) {
      const held = chosen.filter(t => !paid.includes(t) && t.balance > 0);
      let lines: ReturnType<typeof post>[] = [];
      ctx.effect({
        kind: "payment",
        text: `Late fees held 48 hours for ${plural(held.length, "tenant")} with failed autopay`,
        run: () => {
          lines = held.map(t => post(t.id, { kind: "info", text: "Late fees on hold", detail: `Until ${until} · autopay decline`, amount: 0, by: "Zonera agent" }));
        },
        undo: () => lines.forEach(l => l.void("Late fee hold cancelled")),
      });
    }

    // Texts going out.
    if (linked.length) {
      const rows = linked.map(t => ({ id: t.id, name: t.name, to: t.phone, state: "queued" as DeliveryState, at: undefined as string | undefined }));
      const d = ctx.show("delivery", { channel: "sms", title: "Card-update links", rows });
      await ctx.wait(500);
      d.update({ rows: rows.map(r => ({ ...r, state: "sent" as DeliveryState, at: clock() })) });
      await ctx.wait(900);
      d.update({ rows: rows.map((r, i) => ({ ...r, state: (i === 0 && rows.length > 1 ? "read" : "delivered") as DeliveryState, at: clock() })) });
    }

    const stillOpen = list.filter(t => t.balance > 0);
    const paidElsewhere = list.filter(t => t.balance <= 0 && !paid.includes(t));
    ctx.show("answer", {
      tiles: [
        { label: "Recovered", value: money(recovered), context: `${paid.length} of ${list.length} charges`, delta: paid.length ? { text: "Retry approved", tone: "ok" } : undefined },
        { label: "Links sent", value: String(linked.length), context: "Retries when the card is updated" },
        { label: "Still open", value: money(round2(sum(stillOpen.map(t => t.balance)))), context: `${plural(stillOpen.length, "tenant")}${on.has("pause") ? " · fees held to Sun" : ""}` },
      ],
      items: stillOpen.map(t => ({ label: `${t.name} · ${t.unitIds[0]}`, meta: `${money(t.balance)} · ${reasonFor(t).label.toLowerCase()}`, route: "ops/tenants/" + t.id })),
      itemsTitle: stillOpen.length ? "Waiting on the tenant" : undefined,
      links: [{ label: "Open payments", route: "ops/payments" }],
    });
    await ctx.say(
      `${paid.length ? `${andList(paid.map(t => t.name))}'s retry went through, so ${money(recovered)} is collected and the balance is clear. ` : ""}` +
        `${linked.length ? `${andList(linked.map(t => t.first))} ${linked.length === 1 ? "has" : "have"} a link to update the card; each one retries on its own once it's updated.` : ""}` +
        `${stillOpen.some(t => textedToday(t) && !linked.includes(t)) ? ` ${andList(stillOpen.filter(t => textedToday(t) && !linked.includes(t)).map(t => t.first))} already had a link from this morning.` : ""}` +
        `${paidElsewhere.length ? ` ${andList(paidElsewhere.map(t => t.name))} paid while this ran, so ${paidElsewhere.length === 1 ? "that one is" : "those are"} closed too.` : ""}`,
    );
    ctx.suggest(["Charge Grace's card for her balance", "Show delinquency aging", "Text everyone past due a reminder"]);
  },
});
