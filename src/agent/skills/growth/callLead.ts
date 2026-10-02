import { defineSkill } from "../../engine";
import { kw } from "../../parse";
import { lead, RESERVATIONS } from "../../data";
import { startOutboundCall } from "../../../calls/api";

// #50 Call a person: hand the call to the AI voice agent and follow it live.
export default defineSkill<{ who: string }>({
  id: "growth.call",
  n: 50,
  category: "growth",
  title: "Call a customer",
  featured: true,
  examples: ["Call Leila Haddad and finish her reservation", "Call Owen Murphy about his move-in"],
  slots: { who: { label: "call", fill: q => q.people[0]?.name, default: "Leila Haddad" } },
  match: q => kw(q, [[/\bcall\b|\bphone\b|\bring\b/, 4], [/\bcall center\b/, -3]]),
  async run(ctx, { q, slots }) {
    const name = slots.who ?? "Leila Haddad";
    const l = lead(name);
    const phone = l?.phone ?? q.people[0]?.phone ?? "(530) 555-0175";
    const purpose = name === "Leila Haddad" ? "Finish her 10×10 reservation" : /move-?in/i.test(q.text) ? "Confirm move-in details" : "Follow up";
    ctx.title(`Call · ${name}`);
    await ctx.think(`${name} ${l ? `reserved a ${l.size.replace("x", "×")} (${l.note ?? "web"})` : "is a tenant"}. Let the voice agent call, answer questions and close it out.`, 900);
    await ctx.tool("crm.get", { name }, { reservation: RESERVATIONS[name]?.id ?? null, last_touch: l?.reserved ?? "—" }, 500);
    const script = name === "Leila Haddad"
      ? ["Confirm she still wants a 10×10 this week", "Offer drive-up C-107 at $189 or climate D-205 at $229", "Take payment by text link", "Send the gate code and directions"]
      : ["Confirm the move-in date and time", "Answer questions about access hours", "Text the gate code"];
    const go = await ctx.ask("callHandoff", { name, phone, purpose, script, status: "ready" }, ["wait:900", "call"]);
    if (go !== "call") return;
    const callId = startOutboundCall({ name, phone, purpose, scriptId: name === "Leila Haddad" ? "leila-reservation" : undefined });
    ctx.show("callHandoff", { name, phone, purpose, script, status: "live", callId });
    ctx.effect({ kind: "call", text: `Zonera Voice calling ${name} · ${purpose.toLowerCase()}`, link: { label: "Open call center", route: "ops/calls" } });
    await ctx.say("Zonera Voice is on the call now. The live transcript is in the call panel on the right; you can whisper to it or take over at any point.");
    ctx.suggest(["Take over the call", "Text her the payment link instead", "Show the call center"]);
  },
});
