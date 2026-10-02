import { defineSkill } from "../../engine";
import { kw } from "../../parse";
import { REPORTS, type ReportSchedule } from "./state";

// #67 Scheduled report: the owner report on a monthly cadence. One question
// (which day of the month) when the prompt doesn't say, a before/after of the
// schedule, then it's saved. Undo removes it.
//
//   "Schedule the owner report monthly"               → asks which day
//   "Send the owner report on the 1st of every month" → no question
//   "Schedule it monthly"                              → follow-up chip after the owner report

type Day = "1st" | "3bd" | "last";
const DAYS: Record<Day, { label: string; cadence: string; first: string; firstShort: string; covers: string; hint: string; next: string[] }> = {
  "1st": { label: "1st of the month", cadence: "Monthly · 1st, 6:00 am", first: "Sun Nov 1, 2026 · 6:00 am", firstShort: "Nov 1", covers: "October 2026 vs October 2025", hint: "First send Nov 1", next: ["Sun Nov 1 · October report", "Tue Dec 1 · November report", "Fri Jan 1 · December report"] },
  "3bd": { label: "3rd business day", cadence: "Monthly · 3rd business day, 6:00 am", first: "Wed Nov 4, 2026 · 6:00 am", firstShort: "Nov 4", covers: "October 2026 vs October 2025, after month-end close", hint: "Books closed · first send Nov 4", next: ["Wed Nov 4 · October report", "Thu Dec 3 · November report", "Wed Jan 6 · December report"] },
  last: { label: "Last day of the month", cadence: "Monthly · last day, 6:00 pm", first: "Sat Oct 31, 2026 · 6:00 pm", firstShort: "Oct 31", covers: "Month to date vs last year", hint: "Month to date · first send Oct 31", next: ["Sat Oct 31 · October to date", "Mon Nov 30 · November to date", "Thu Dec 31 · December to date"] },
};
const RECIPIENTS = "Alder Lake Holdings · 2 recipients";

function dayFrom(lower: string): Day | undefined {
  if (/\b(3rd|third) business day\b/.test(lower)) return "3bd";
  if (/\blast day\b|\bend of (the|each|every) month\b|\bmonth-?end\b/.test(lower)) return "last";
  if (/\b(1st|first)( day)? of (the|each|every) month\b|\bon the (1st|first)\b/.test(lower)) return "1st";
  return undefined;
}

export default defineSkill<{ report: string; day: Day }>({
  id: "reports.schedule",
  n: 67,
  category: "reports",
  title: "Schedule a report",
  featured: true,
  examples: ["Schedule the owner report monthly", "Send the owner report on the 1st of every month", "Schedule it monthly"],
  slots: {
    report: { label: "report", fill: q => (/\bowner\b/.test(q.lower) ? "Owner report" : undefined), default: "Owner report" },
    day: {
      label: "day",
      fill: q => dayFrom(q.lower),
      show: v => DAYS[v].label,
      options: () => (Object.keys(DAYS) as Day[]).map(d => ({ value: d, label: DAYS[d].label })),
    },
  },
  match: q =>
    kw(q, [
      [/\bschedul\w*\b|\brecurring\b|\bautomatically\b/, 2],
      [/\breports?\b/, 2],
      [/\bevery (month|week)\b|\beach month\b|\bmonthly\b/, 2],
      [/\bon the (1st|first|\d{1,2}(st|nd|rd|th)|last)\b|\b(3rd|third) business day\b|\blast day of\b/, 2],
      [/\bschedule it\b/, 2],
      [/\bowners?\b/, 1],
      [/\b(generate|make|build|pull|break)\b/, -3],
      [/\b(september|vs last year|gate|vendor|pest|tour|inspection|move-?out|move-?in|text|sms|call)\b/, -3],
    ]),

  async run(ctx, { slots }) {
    ctx.title("Schedule · owner report");
    await ctx.think("Set the owner report on a monthly cadence: pick the send day, keep the recipients and format from the last send, and preview what the first run covers.", 1000);
    await ctx.tool("reports.get", { report: "owner", last_sent: true }, { last_sent: "2026-09-03", recipients: 2, to: "Alder Lake Holdings", format: ["pdf", "csv"], schedule: null }, 560);

    let day = slots.day;
    if (!day) {
      await ctx.say("The last owner report went to Alder Lake Holdings by hand on Sep 3. Which day should it go out each month?");
      day = (await ctx.ask(
        "quickReplies",
        {
          question: "Send the owner report on…",
          options: (Object.keys(DAYS) as Day[]).map(d => ({ value: d, label: DAYS[d].label, hint: DAYS[d].hint })),
        },
        ["wait:800", "opt:1st"],
      )) as Day;
      if (!DAYS[day]) day = "1st";
    }
    const d = DAYS[day];

    const ans = await ctx.ask(
      "diff",
      {
        title: "New report schedule",
        meta: slots.report ?? "Owner report",
        rows: [
          { field: "Report", before: "—", after: "Owner report · revenue, occupancy, collections" },
          { field: "Recipients", before: "—", after: RECIPIENTS },
          { field: "Cadence", before: "Sent by hand", after: d.cadence },
          { field: "Covers", before: "—", after: d.covers },
          { field: "First send", before: "—", after: d.first },
          { field: "Format", before: "—", after: "PDF + CSV" },
        ],
        note: "You get a preview the evening before each send. Reply hold to skip a month.",
        cta: "Save schedule",
      },
      ["wait:900", "submit"],
    );
    if (ans !== "approve") {
      await ctx.say("Not scheduled. The owner report stays manual.");
      ctx.suggest(["Generate the September owner report vs last year", "Break revenue down by unit size"]);
      return;
    }

    await ctx.tool("reports.schedule.create", { report: "owner", cadence: day, at: day === "last" ? "18:00" : "06:00", to: "Alder Lake Holdings", format: ["pdf", "csv"] }, { id: "sch_owner_m", status: "active", next_run: d.first }, 640);
    const rec: ReportSchedule = { id: "sch-owner-agent", report: "Owner report", cadence: d.cadence.replace("Monthly · ", ""), to: ["Alder Lake Holdings", "Priya Raman"], format: "PDF and CSV", next: d.firstShort, by: "Zonera agent", fresh: true };
    let replaced: { i: number; old: ReportSchedule } | undefined;
    ctx.effect({
      kind: "agent",
      text: `Owner report scheduled · ${d.cadence.toLowerCase()} · first send ${d.firstShort}`,
      link: { label: "Open reports", route: "ops/reports/owner" },
      run: () => {
        const i = REPORTS.schedules.findIndex(s => s.report === "Owner report");
        if (i >= 0) {
          replaced = { i, old: REPORTS.schedules[i] };
          REPORTS.schedules.splice(i, 1, rec);
        } else REPORTS.schedules.push(rec);
      },
      undo: () => {
        const i = REPORTS.schedules.indexOf(rec);
        if (i >= 0) REPORTS.schedules.splice(i, 1);
        if (replaced) REPORTS.schedules.splice(Math.min(replaced.i, REPORTS.schedules.length), 0, replaced.old);
      },
    });

    ctx.show("answer", {
      label: "Owner report schedule",
      value: d.label,
      context: `${d.cadence} · ${RECIPIENTS} · PDF + CSV`,
      itemsTitle: "Next sends",
      items: d.next.map(n => ({ label: n.split(" · ")[1], meta: n.split(" · ")[0] })),
      links: [{ label: "Open reports", route: "ops/reports/owner" }],
    });
    await ctx.say(`Scheduled. The first one goes out **${d.first}** and covers ${d.covers}. I'll send you a preview the evening before.`);
    ctx.suggest(["Break revenue down by unit size", "Generate the September owner report vs last year", "What needs my attention today?"]);
  },
});
