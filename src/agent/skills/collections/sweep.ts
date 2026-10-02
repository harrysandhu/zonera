import { defineSkill } from "../../engine";
import { kw } from "../../parse";
import { money, pastDue, setUnitStatus } from "../../data";

// #25 Delinquency sweep: list, propose a plan, run it with live progress.
export default defineSkill<{ days: number }>({
  id: "collections.sweep",
  n: 25,
  category: "collections",
  title: "Delinquency sweep",
  featured: true,
  examples: ["Who's more than 15 days late?", "Handle collections for today"],
  slots: { days: { label: "past due", fill: q => q.days, default: 15, show: v => `${v}+ days` } },
  match: q => kw(q, [[/\b(late|past due|delinquen|collections?|owe)\b/, 3], [/\bwho\b|\bhandle\b/, 1], [/\btext\b|\bemail\b/, -2]]),
  async run(ctx, { slots }) {
    const days = slots.days ?? 15;
    ctx.title(`Collections · ${days}+ days`);
    await ctx.think("Pull everyone past the threshold, group by stage, propose reminders, fees and overlocks per policy.", 1100);
    const all = pastDue();
    const list = all.filter(t => t.daysLate > days);
    await ctx.tool("tenants.query", { days_late_gt: days }, { count: list.length, total: list.reduce((s, t) => s + t.balance, 0) }, 700);
    ctx.focus({ tenants: list.slice(0, 3).map(t => t.id), units: list.flatMap(t => t.unitIds), selected: list[0]?.unitIds[0] ?? null });
    ctx.show("table", {
      title: `${list.length} tenants more than ${days} days late`,
      meta: money(list.reduce((s, t) => s + t.balance, 0)),
      columns: [
        { key: "name", label: "Tenant" },
        { key: "unit", label: "Unit", mono: true },
        { key: "days", label: "Days", align: "right", mono: true },
        { key: "bal", label: "Balance", align: "right", mono: true },
        { key: "last", label: "Last contact" },
      ],
      rows: list.map(t => ({ id: t.id, cells: { name: t.name, unit: t.unitIds.join(", "), days: String(t.daysLate), bal: money(t.balance), last: t.lastContact ?? "—" }, tone: (t.daysLate > 30 ? "bad" : "warn") as "bad" | "warn", route: "ops/tenants/" + t.id })),
    });
    const over30 = list.filter(t => t.daysLate > 30);
    const under30 = list.filter(t => t.daysLate <= 30);
    const ok = await ctx.ask(
      "plan",
      {
        title: "Proposed plan",
        items: [
          ...under30.map(t => ({ id: "sms:" + t.id, group: "Text a reminder with a pay link", label: t.name, sub: `${t.unitIds[0]} · ${money(t.balance)}`, tier: "Auto" as const })),
          ...over30.map(t => ({ id: "lock:" + t.id, group: "Overlock (30+ days, per policy)", label: t.name, sub: `${t.unitIds[0]} · ${t.daysLate} days`, tier: "Ask first" as const })),
        ],
        impact: `Policy: reminders at ${days} days, overlock after 30. Pre-lien notices need your sign-off separately.`,
      },
      ["wait:900", "submit"],
    );
    if (ok.secondary) return;
    const chosen = list.filter(t => ok.ids.some(id => id.endsWith(t.id)));
    const items = chosen.map(t => ({ id: t.id, label: t.daysLate > 30 ? `Overlock ${t.unitIds[0]} · ${t.name}` : `Reminder to ${t.name} · ${t.phone}`, state: "todo" as const }));
    const h = ctx.show("progress", { title: "Running collections", items });
    for (let i = 0; i < items.length; i++) {
      h.update({ items: items.map((x, j) => ({ ...x, state: j < i ? "done" : j === i ? "run" : "todo" })) });
      await ctx.wait(320);
    }
    h.update({ items: items.map(x => ({ ...x, state: "done" })), summary: `${items.length} of ${items.length} done` });
    const locks = chosen.filter(t => t.daysLate > 30);
    let undos: (() => void)[] = [];
    ctx.effect({
      kind: "agent",
      text: `Collections: ${chosen.length - locks.length} reminders, ${locks.length} overlocks`,
      run: () => {
        undos = locks.map(t => setUnitStatus(t.unitIds[0], "overlocked"));
      },
      undo: () => undos.forEach(u => u()),
      link: { label: "Open delinquency", route: "ops/delinquency" },
    });
    await ctx.say(`Sent ${chosen.length - locks.length} reminders and overlocked ${locks.length} unit${locks.length === 1 ? "" : "s"}. Replies and payments will show up here and on the Delinquency page.`);
    ctx.suggest(["Start the lien process for Dana", "Text everyone past due a friendly reminder", "Show delinquency aging"]);
  },
});
