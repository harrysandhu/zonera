import { defineSkill } from "../../engine";
import { kw } from "../../parse";
import { money, sizeLabel, sizeOcc } from "../../data";
import { UNITS, availableUnits, type UnitSize } from "../../../data/facility";

// #65 Ad-hoc Q&A: "How many 10×10s are free?" — computed from live inventory.
export default defineSkill<{ size?: string }>({
  id: "reports.available",
  n: 65,
  category: "reports",
  title: "Ask about availability",
  featured: true,
  examples: ["How many 10×10s are free?", "What do we have available in 10x20?", "Any climate units open?"],
  slots: { size: { label: "size", fill: q => q.sizes[0] ?? (q.text.match(/(\d+)\s*(?:x|×|by)\s*(\d+)/i) ? q.text.match(/(\d+)\s*(?:x|×|by)\s*(\d+)/i)!.slice(1, 3).join("x") : undefined), default: undefined, show: v => (v ? sizeLabel(v) : "all sizes") } },
  match: q => kw(q, [[/\b(free|available|open|vacant|in stock)\b/, 3], [/\bhow many|any|what do we have\b/, 1]]),
  async run(ctx, { q, slots }) {
    const size = slots.size as UnitSize | undefined;
    const climate = /\bclimate\b/i.test(q.text);
    const list = availableUnits(size).filter(u => !climate || u.kind === "climate");
    await ctx.tool("units.available", { size: size ?? "any", climate }, { count: list.length }, 500);
    ctx.focus({ units: list.map(u => u.id), selected: list[0]?.id ?? null, tenants: [] });
    const total = UNITS.filter(u => (!size || u.size === size) && (!climate || u.kind === "climate")).length;
    ctx.show("answer", {
      label: size ? `Available ${sizeLabel(size)} units` : climate ? "Available climate units" : "Available units",
      value: String(list.length),
      context: size ? `of ${total} · ${Math.round(sizeOcc(size).rate * 100)}% occupied` : `of ${total} units`,
      itemsTitle: "Units",
      items: list.slice(0, 8).map(u => ({ label: `${u.id} · ${sizeLabel(u.size)} · ${u.kind === "climate" ? "climate, floor " + u.floor : "drive-up"}`, meta: money(u.rate) + "/mo", action: { label: "Hold", ask: `Hold ${u.id} for a caller until Monday` } })),
      links: [{ label: "Open digital twin", route: "ops/facility" }],
    });
    await ctx.say(list.length ? `They're lit on the twin. Cheapest is **${list.slice().sort((a, b) => a.rate - b.rate)[0].id}** at ${money(Math.min(...list.map(u => u.rate)))}/mo.` : "Nothing open in that size right now. I can put people on a waitlist.");
    ctx.suggest(["Run a $1 first month on 10×20s", "Move Owen Murphy in", "Who's more than 15 days late?"]);
  },
});
