import { defineSkill } from "../../engine";
import { kw } from "../../parse";
import { money } from "../../data";
import { MONTHLY, SEPT_LAST_YEAR, TENANTS } from "../../../data/tenants";

// #60 Owner report: computed from the live data, previewed, then sent or scheduled.
export default defineSkill<{ period: string }>({
  id: "reports.owner",
  n: 60,
  category: "reports",
  title: "Owner report",
  featured: true,
  examples: ["Generate the September owner report vs last year", "Make the monthly report for the owners"],
  slots: { period: { label: "period", fill: () => undefined, default: "Sep 2026 vs Sep 2025" } },
  match: q => kw(q, [[/\breport\b/, 2], [/\bowners?\b|\bmonthly\b|\bseptember\b/, 2]]),
  async run(ctx) {
    ctx.title("Owner report · September");
    await ctx.think("Pull September revenue, occupancy, move-ins and delinquency, compare to last year, write the summary.", 1200);
    const sept = MONTHLY[MONTHLY.length - 1];
    const yoy = sept.revenue / SEPT_LAST_YEAR.revenue - 1;
    const late = TENANTS.filter(t => t.daysLate > 0);
    await ctx.tools([
      { name: "reports.revenue", args: { month: "2026-09" }, result: { collected: sept.revenue }, ms: 700 },
      { name: "reports.occupancy", args: { month: "2026-09" }, result: { unit: sept.occupancy }, ms: 600 },
      { name: "reports.delinquency", args: { as_of: "2026-10-02" }, result: { tenants: late.length }, ms: 500 },
    ]);
    const ans = await ctx.ask(
      "reportPreview",
      {
        title: "September 2026 owner report",
        subtitle: "Zonera Alder Lake · vs September 2025",
        kpis: [
          { label: "Revenue", value: money(sept.revenue), delta: `+${(yoy * 100).toFixed(1)}% YoY`, tone: "ok" },
          { label: "Occupancy", value: (sept.occupancy * 100).toFixed(1) + "%", delta: `+${((sept.occupancy - SEPT_LAST_YEAR.occupancy) * 100).toFixed(1)} pts`, tone: "ok" },
          { label: "Move-ins / outs", value: `${sept.moveIns} / ${sept.moveOuts}`, delta: `+${sept.moveIns - sept.moveOuts} net`, tone: "ok" },
          { label: "Past due", value: `${late.length} tenants`, delta: `${((late.length / TENANTS.length) * 100).toFixed(1)}%`, tone: "warn" },
        ],
        charts: [
          { kind: "bar", title: "Revenue by month", data: MONTHLY.map(m => ({ label: m.m, value: m.revenue })), format: "money" },
          { kind: "line", title: "Occupancy", data: MONTHLY.map(m => ({ label: m.m, value: m.occupancy })), format: "pct", domain: [0.82, 0.9] },
        ],
        narrative: [
          `September revenue was ${money(sept.revenue)}, up ${(yoy * 100).toFixed(1)}% on last September, driven by occupancy rising to ${(sept.occupancy * 100).toFixed(1)}% and the spring rate review.`,
          `Move-ins outpaced move-outs ${sept.moveIns} to ${sept.moveOuts}. 10×20 units remain the soft spot; a $1 first-month promotion is recommended until they reach 90%.`,
          `${late.length} tenants are past due. Two units are overlocked and one account (A-131) is entering the California pre-lien process.`,
        ],
        pages: 4,
        file: "alder-lake-owner-report-2026-09.pdf",
        actions: ["send", "download", "schedule"],
        recipients: "Brennan Storage Co. · 2 recipients",
      },
      ["wait:1200", "send"],
    );
    ctx.effect({ kind: "agent", text: `September owner report ${ans === "send" ? "emailed to owners" : ans === "schedule" ? "scheduled monthly" : "downloaded"}`, link: { label: "Open reports", route: "ops/reports" } });
    await ctx.say(ans === "send" ? "Sent to Gail Brennan and the Brennan Storage Co. inbox with the PDF attached." : ans === "schedule" ? "Scheduled for the 3rd of every month at 8:00 am." : "Downloaded `alder-lake-owner-report-2026-09.pdf`.");
    ctx.suggest(["Schedule it monthly", "Break revenue down by unit size", "How many 10×20s are free?"]);
  },
});
