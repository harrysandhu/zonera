import { CATEGORIES, defineSkill } from "../engine";
import { SKILLS } from "./index";

// Out-of-scope answer: say so plainly and show what the agent can do here.
export default defineSkill({
  id: "fallback",
  category: "day",
  title: "Question",
  examples: [],
  match: () => 0,
  async run(ctx, { q }) {
    await ctx.think("This isn't something I can act on at the facility. Point to what I can do instead.", 800);
    const hello = /^(hi|hello|hey|help|what can you do)/.test(q.lower.trim());
    await ctx.say(
      hello
        ? "I run the facility with you: payments, move-ins, access, collections, messages, pricing, maintenance and reports. Tell me what you want done and I'll ask only for what I need."
        : "I can't help with that one. Here's what I can do at Alder Lake right now:",
    );
    const items = CATEGORIES.map(c => {
      const ex = SKILLS.filter(s => s.category === c.id && s.examples.length);
      return ex.length ? { label: `${c.label}: ${ex.map(s => s.title.toLowerCase()).slice(0, 4).join(", ")}`, meta: `${ex.length}`, action: { label: "Try", ask: ex[0].examples[0] } } : null;
    }).filter(Boolean) as { label: string; meta: string; action: { label: string; ask: string } }[];
    ctx.show("answer", { itemsTitle: "Things to ask", items });
    ctx.suggest(SKILLS.filter(s => s.featured).slice(0, 3).map(s => s.examples[0]));
  },
});
