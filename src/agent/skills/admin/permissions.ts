import { defineSkill } from "../../engine";
import { kw } from "../../parse";
import { PERMS, type Tier } from "../../../data/permissions";

// What the agent may do on its own, what it asks first, and what it never does.
// Reads the same table as Settings → Agent permissions.
const TIER_LABEL: Record<Tier, string> = { auto: "On its own", ask: "Asks you first", never: "Never" };

export default defineSkill<{ tier: Tier | "all" }>({
  id: "admin.permissions",
  category: "admin",
  title: "Agent permissions",
  featured: true,
  examples: ["What can the agent do without asking me?", "What needs my approval?", "What will Zonera never do on its own?"],
  slots: {
    tier: {
      label: "show",
      fill: q => (/\bwithout asking|on its own\b/.test(q.lower) ? "auto" : /\bapproval|ask (me )?first\b/.test(q.lower) ? "ask" : /\bnever\b/.test(q.lower) ? "never" : undefined),
      default: "all",
      show: v => (v === "all" ? "all permissions" : TIER_LABEL[v as Tier].toLowerCase()),
    },
  },
  match: q =>
    kw(q, [
      [/\b(without asking|on its own|needs? my approval|ask(s)? (me )?first|permissions?|allowed to)\b/, 5],
      [/\bagent|zonera\b/, 1],
    ]),
  async run(ctx, { slots }) {
    const tier = slots.tier ?? "all";
    ctx.title("Agent permissions");
    await ctx.think("Read the permission table from Settings and group it by tier.", 700);
    await ctx.tool("settings.permissions.get", { facility: "alder-lake" }, { auto: PERMS.filter(p => p.tier === "auto").length, ask: PERMS.filter(p => p.tier === "ask").length, never: PERMS.filter(p => p.tier === "never").length }, 500);
    const count = (t: Tier) => PERMS.filter(p => p.tier === t).length;
    ctx.show("answer", {
      tiles: (["auto", "ask", "never"] as Tier[]).map(t => ({ label: TIER_LABEL[t], value: String(count(t)), context: t === "auto" ? "logged with Undo" : t === "ask" ? "waits in your inbox" : "prepares, never sends" })),
    });
    for (const t of (tier === "all" ? ["auto", "ask", "never"] : [tier]) as Tier[]) {
      ctx.show("answer", {
        itemsTitle: TIER_LABEL[t],
        items: PERMS.filter(p => p.tier === t).map(p => ({ label: p.name, meta: p.notes[t].split(".")[0] })),
      });
    }
    await ctx.say("Every action is in the audit log on Settings, and anything done on its own can be undone. Change a tier there and I follow it from the next request.");
    ctx.suggest(["Refund Grace's duplicate charge", "Start the lien process for Dana Whitfield", "What needs my attention today?"]);
  },
});
