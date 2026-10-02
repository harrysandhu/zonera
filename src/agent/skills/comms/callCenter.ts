import { defineSkill } from "../../engine";
import { kw } from "../../parse";
import { calls, liveCalls, mmss, elapsed, openCall, takeOver, ensureStarted } from "../../../calls/engine";
import { setCallsOpen } from "../../../state/store";

// Call center from the chat: list the live calls, open one in the push-in
// panel, or join one as the human (Zonera Voice becomes the copilot).
//
//   "Show the call center"        → live calls table, panel opens
//   "Take over the call"          → joins the most relevant live call
//   "Listen to Leila's call"      → opens that call

const STATUS: Record<string, string> = { ringing: "Ringing", dialing: "Dialing", live: "Live", wrap: "Wrapping up", ended: "Ended" };

export default defineSkill<{ mode: "show" | "join" | "listen"; who: string }>({
  id: "comms.calls",
  category: "comms",
  title: "Call center",
  featured: true,
  examples: ["Show the call center", "Take over the call", "Listen to Leila's call", "Show me the live calls"],
  slots: {
    mode: {
      label: "do",
      fill: q => (/\btake over|join\b/.test(q.lower) ? "join" : /\blisten|open\b/.test(q.lower) && q.people.length ? "listen" : undefined),
      default: "show",
      show: v => (v === "join" ? "take over" : v === "listen" ? "listen in" : "show live calls"),
    },
    who: { label: "call", fill: q => q.people[0]?.name ?? (/\bleila\b/i.test(q.text) ? "Leila Haddad" : undefined), hidden: true },
  },
  match: q =>
    kw(q, [
      [/\btake over\b|\bjoin (the|her|his|that) call\b|\blisten (in|to)\b/, 6],
      [/\bcall center\b|\blive calls?\b|\bwho('s| is) on the phone\b/, 6],
    ]),
  async run(ctx, { slots }) {
    ensureStarted();
    const live = liveCalls();
    const mode = slots.mode ?? "show";
    ctx.title(mode === "join" ? "Take over a call" : "Call center");
    await ctx.think(
      mode === "join" ? "Join the call that needs a person most: one waiting on a manager, else the outbound call I just placed, else the longest live one." : "List what Zonera Voice is handling right now, then open the panel.",
      900,
    );
    await ctx.tool("calls.live", {}, { live: live.length, ringing: live.filter(c => c.status === "ringing").length, waiting_on_human: live.filter(c => c.alert).length }, 500);

    ctx.show("table", {
      title: `${live.length} live ${live.length === 1 ? "call" : "calls"}`,
      columns: [
        { key: "who", label: "Caller" },
        { key: "intent", label: "About" },
        { key: "dir", label: "Direction" },
        { key: "st", label: "Status" },
        { key: "t", label: "Time", align: "right", mono: true },
      ],
      rows: live.map(c => ({
        id: c.id,
        cells: { who: c.name, intent: c.script.intent, dir: c.script.direction === "inbound" ? "Inbound" : "Outbound", st: c.alert ? "Needs you" : c.handler === "human" ? "You're on it" : STATUS[c.status] ?? c.status, t: mmss(elapsed(c)) },
        tone: c.alert ? ("warn" as const) : undefined,
        route: `ops/calls/${c.id}`,
      })),
    });

    const named = slots.who ? live.find(c => c.name.toLowerCase().includes(slots.who!.toLowerCase().split(" ")[0])) : undefined;
    const target =
      named ??
      live.find(c => c.alert) ??
      calls.find(c => c.script.direction === "outbound" && c.status !== "ended") ??
      [...live].sort((a, b) => elapsed(b) - elapsed(a))[0];

    if (!target) {
      ctx.effect({ kind: "call", text: "Opened the call center", run: () => setCallsOpen(true) });
      await ctx.say("No calls right now. Zonera Voice is answering everything that comes in; the panel is open on the right.");
      ctx.suggest(["Call Leila Haddad and finish her reservation", "What needs my attention today?"]);
      return;
    }

    if (mode === "join") {
      ctx.effect({
        kind: "call",
        text: `Priya took over the call with ${target.name}`,
        run: () => {
          openCall(target.id);
          takeOver(target);
        },
        link: { label: "Open call", route: `ops/calls/${target.id}` },
      });
      await ctx.say(`You're on the line with **${target.name}** (${target.script.intent.toLowerCase()}). Zonera Voice is your copilot now: it suggests replies on the right and keeps running the tools.`);
    } else {
      ctx.effect({ kind: "call", text: `Opened the call with ${target.name}`, run: () => openCall(target.id), link: { label: "Open call center", route: "ops/calls" } });
      await ctx.say(`Opened **${target.name}**'s call on the right. You can listen, whisper a hint that only Zonera Voice hears, or take over.`);
    }
    ctx.suggest(mode === "join" ? ["Show the call center", "What needs my attention today?"] : ["Take over the call", "Call Owen Murphy about his move-in", "What needs my attention today?"]);
  },
});
