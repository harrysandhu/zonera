import { defineSkill } from "../../engine";
import { kw } from "../../parse";
import { nextCode } from "../../data";
import { addAccessCode, type ZoneId } from "../../../data/gate";

// #31 New gate code for a vendor or helper, limited by zone and time window.
const fmt12 = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}${m ? ":" + String(m).padStart(2, "0") : ""}${h >= 12 ? "pm" : "am"}`;
};

export default defineSkill<{ who: string; zone: string; window: { from: string; to: string } }>({
  id: "access.gateCode",
  n: 31,
  category: "access",
  title: "New gate code",
  featured: true,
  examples: ["Make a gate code for the HVAC tech, 1–5pm today, Building D only", "Give the cleaners gate access 6–8am tomorrow"],
  slots: {
    who: { label: "for", fill: q => (q.text.match(/for (the )?([a-z ]+?)(,| from| \d|$)/i)?.[2] ?? undefined), default: "HVAC tech", show: v => v },
    zone: { label: "zones", fill: q => (q.buildings.includes("D") ? "Building D" : undefined), default: "Gate 1 + Building D", show: v => v },
    window: { label: "window", fill: q => q.window, default: { from: "13:00", to: "17:00" }, show: v => `${fmt12(v.from)}–${fmt12(v.to)} today` },
  },
  match: q => kw(q, [[/\bgate\b|\baccess code\b|\bcode for\b/, 3], [/\b(make|create|give|new|generate)\b/, 1], [/\breset\b|\block ?out\b/, -3]]),
  async run(ctx, { slots }) {
    const who = (slots.who ?? "HVAC tech").replace(/\b\w/g, c => c.toUpperCase());
    const win = slots.window ?? { from: "13:00", to: "17:00" };
    const climate = (slots.zone ?? "").includes("D");
    const code = nextCode();
    const doors = climate ? "Gate 1 · Building D doors · Elevator" : "Gate 1";
    ctx.title(`Gate code · ${who}`);
    await ctx.think("One-time vendor code: only the doors they need, only for the visit, expires on its own.", 1000);
    await ctx.tools([
      { name: "vendors.find", args: { query: who }, result: { vendor: "Lakeside Mechanical", contact: "Luis Ortega", phone: "(530) 555-0131" }, ms: 600 },
      { name: "gate.codes.preview", args: { zones: climate ? ["lot", "climate"] : ["lot"], window: `${win.from}-${win.to}` }, result: { code, collisions: 0 }, ms: 500 },
    ]);
    const ans = await ctx.ask(
      "diff",
      {
        title: "New access code",
        rows: [
          { field: "Holder", before: "—", after: `${who} · Lakeside Mechanical` },
          { field: "Doors", before: "—", after: doors },
          { field: "Window", before: "—", after: `Today ${fmt12(win.from)} – ${fmt12(win.to)}` },
          { field: "Code", before: "—", after: `${code}#` },
          { field: "Send to", before: "—", after: "Luis Ortega · (530) 555-0131 · SMS" },
        ],
        note: "Expires automatically. Every use shows up in Gate access.",
        cta: "Create and text code",
      },
      ["wait:900", "approve"],
    );
    if (ans !== "approve") return;
    let rec: { id: string } | undefined;
    ctx.effect({
      kind: "gate",
      text: `Gate code ${code}# for ${who} · ${fmt12(win.from)}–${fmt12(win.to)}`,
      run: () => {
        rec = addAccessCode({ holder: who, company: "Lakeside Mechanical", phone: "(530) 555-0131", type: "vendor", code, zones: (climate ? ["lot", "climate"] : ["lot"]) as ZoneId[], window: `Today ${fmt12(win.from)}–${fmt12(win.to)}`, status: "scheduled", createdBy: "Zonera agent" });
      },
      link: { label: "Open Gate access", route: "ops/gate" },
    });
    await ctx.tool("sms.send", { to: "(530) 555-0131", template: "vendor_code" }, { status: "delivered" }, 600);
    ctx.show("answer", { label: "Gate code", value: `${code}#`, context: `${doors} · today ${fmt12(win.from)}–${fmt12(win.to)} · texted to Luis Ortega`, links: [{ label: "Open Gate access", route: "ops/gate" }] });
    ctx.suggest(["Who came in after 10pm last night?", "Make it recurring every Tuesday", "Revoke it at 5pm sharp"]);
  },
});
