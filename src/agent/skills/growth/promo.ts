import { defineSkill } from "../../engine";
import { kw, type Parsed } from "../../parse";
import { money, sizeLabel, sizeOcc, occPct, RECORDS } from "../../data";
import { UNITS, type UnitSize } from "../../../data/facility";
import { LEADS } from "../../../data/tenants";

// #48 Promo: check the size's occupancy, street rate and what competitors run,
// propose the offer with an end rule, publish it. The live promo goes into
// RECORDS.promos (src/agent/data.ts); undo takes it down.
//
//   "Run a $1 first month on 10×20s until we hit 90%"   → 81% → 90% is 2 more move-ins
//   "Put 10×15s at 50% off the first month"             → same flow, percent offer

type Offer = string; // "$1" | "50%"

function offerOf(q: Parsed): Offer | undefined {
  const d = /\$\s?(\d+)\s*(?:for the |for |the )?first month/.exec(q.lower) ?? /first month (?:for|at) \$\s?(\d+)/.exec(q.lower);
  if (d) return `$${d[1]}`;
  const p = /(\d+)\s*%\s*off/.exec(q.lower);
  if (p) return `${p[1]}%`;
  if (/\bfree (first )?month\b/.test(q.lower)) return "$0";
  return undefined;
}

function targetOf(q: Parsed): number | undefined {
  const m = /\b(?:hit|reach|reaches|get to|until|at)\s+(\d{2})\s*%/.exec(q.lower) ?? /(\d{2})\s*%\s*(?:occupied|occupancy|full)/.exec(q.lower);
  return m ? +m[1] : undefined;
}

/** 90%, or the next 5% step when the size is already there. */
function defaultTarget(size: UnitSize) {
  const p = Math.round(sizeOcc(size).rate * 100);
  return p < 90 ? 90 : Math.min(100, (Math.floor(p / 5) + 1) * 5);
}

const offerLabel = (o: Offer) => (o.startsWith("$") ? (o === "$0" ? "Free first month" : `${o} first month`) : `${o} off the first month`);
/** What the first month costs the tenant under the offer. */
const firstMonth = (o: Offer, rate: number) => (o.startsWith("$") ? +o.slice(1) : Math.round(rate * (1 - +o.slice(0, -1) / 100) * 100) / 100);

const COMPETITORS = [
  { name: "Lakeside Self Storage", miles: 1.8, base: 1.04, promo: "50% off first month" },
  { name: "Route 50 Storage", miles: 3.1, base: 0.91, promo: "None" },
  { name: "Tahoe Valley Storage", miles: 4.6, base: 1.03, promo: "$1 first month" },
];

export default defineSkill<{ offer: Offer; size: UnitSize; target: number }>({
  id: "growth.promo",
  n: 48,
  category: "growth",
  title: "Run a promo",
  featured: true,
  examples: ["Run a $1 first month on 10×20s until we hit 90%", "Put 10×15s at 50% off the first month"],
  slots: {
    offer: { label: "offer", fill: q => offerOf(q), default: "$1", show: v => offerLabel(v) },
    size: { label: "size", fill: q => q.sizes[0], default: "10x20", show: v => sizeLabel(v) + "s" },
    target: { label: "until", fill: q => targetOf(q), default: q => defaultTarget((q.sizes[0] ?? "10x20") as UnitSize), show: v => `${v}% occupied` },
  },
  match: q =>
    kw(q, [
      [/\bpromo(tion)?s?\b|\bfirst month\b|\b\d+\s*% off\b|\bmove-?in special\b|\bdiscount\b/, 5],
      [/\b(run|put|start|launch|offer)\b/, 1],
      [/\b(email|text|sms|message|send)\b/, -4],
    ]),

  async run(ctx, { slots }) {
    const offer = slots.offer ?? "$1";
    const size = (slots.size ?? "10x20") as UnitSize;
    const target = slots.target ?? defaultTarget(size);
    const units = UNITS.filter(u => u.size === size);
    const occ = sizeOcc(size);
    const rate = units[0]?.rate ?? 0;
    const kinds = [...new Set(units.map(u => u.kind))];
    const kindLabel = kinds.length === 1 ? (kinds[0] === "climate" ? "climate" : kinds[0]) : "all";
    const need = Math.max(0, Math.ceil((target / 100) * occ.total) - occ.taken);
    const pct = Math.round(occ.rate * 100);
    const first = firstMonth(offer, rate);
    const cost = Math.round((rate - first) * 100) / 100;
    const projected = Math.max(need, Math.min(occ.vacant.length, need + 1));
    const leads = LEADS.filter(l => l.size === size).length;
    ctx.title(`Promo · ${sizeLabel(size)}s`);
    await ctx.think(`${sizeLabel(size)}s first: occupancy, what's vacant, the street rate and what the three nearest competitors run. Then size the offer and an end rule so it stops on its own.`, 1100);
    ctx.focus({ units: occ.vacant.map(u => u.id), selected: occ.vacant[0]?.id ?? null, tenants: [] });
    await ctx.tools([
      { name: "units.available", args: { size }, result: () => ({ total: occ.total, occupied: occ.taken, vacant: occ.vacant.map(u => u.id) }), ms: 600 },
      { name: "rates.get", args: { size }, result: { street: rate, web: rate, last_change: "2026-06-01" }, ms: 480 },
      { name: "competitors.scan", args: { size, radius_mi: 5 }, result: COMPETITORS.map(c => ({ name: c.name, price: Math.round(rate * c.base), promo: c.promo })), ms: 900 },
    ]);
    ctx.show("answer", {
      label: `${sizeLabel(size)} right now`,
      tiles: [
        { label: "Occupancy", value: `${pct}%`, context: `${occ.taken} of ${occ.total}`, delta: { text: `facility ${Math.round(occPct() * 100)}%`, tone: pct < Math.round(occPct() * 100) ? "warn" : "ok" } },
        { label: "Vacant", value: String(occ.vacant.length), context: occ.vacant.slice(0, 3).map(u => u.id).join(", ") + (occ.vacant.length > 3 ? " …" : "") },
        { label: "Street rate", value: money(rate), context: "per month" },
        { label: "Competitors", value: `${COMPETITORS.filter(c => c.promo !== "None").length} of ${COMPETITORS.length}`, context: "run a first-month promo" },
      ],
      itemsTitle: "Within 5 miles",
      items: COMPETITORS.map(c => ({ label: `${c.name} · ${c.miles} mi`, meta: `${money(Math.round(rate * c.base))} · ${c.promo === "None" ? "no promo" : c.promo}` })),
    });
    await ctx.say(
      pct >= target
        ? `${sizeLabel(size)}s are already at **${pct}%**, at or above ${target}%. A promo would give away margin. I can still set it up to switch on if occupancy drops below ${target}%.`
        : `${sizeLabel(size)}s are at **${pct}%** with ${occ.vacant.length} vacant. Getting to ${target}% takes **${need} more move-in${need === 1 ? "" : "s"}**. ${offerLabel(offer)} costs ${money(cost)} per move-in against ${money(rate)}/mo of recurring rent.`,
    );
    const ends = `When ${sizeLabel(size)}s reach ${target}% (${occ.taken + need} of ${occ.total}) or Nov 30`;
    const ans = await ctx.ask(
      "diff",
      {
        title: "New promotion",
        meta: "Storefront · Google · SpareFoot",
        rows: [
          { field: "Offer", before: "—", after: `${offerLabel(offer)} · ${money(first)} instead of ${money(rate)}` },
          { field: "Applies to", before: "—", after: `${sizeLabel(size)} ${kindLabel === "all" ? "units" : kindLabel} · ${occ.vacant.length} vacant` },
          { field: "Ends", before: "—", after: ends },
          { field: "Storefront", before: "Street rate only", after: `Banner and "${offerLabel(offer)}" badge on ${sizeLabel(size)}s` },
          { field: "Est. cost", before: "—", after: `${money(cost)} per move-in` },
          { field: "Projected", before: "—", after: `+${projected} move-ins in 30 days · ${money(projected * rate)}/mo recurring` },
        ],
        note: "Existing tenants keep their rate. New move-ins pay street rate from month two.",
        cta: "Publish promo",
      },
      ["wait:900", "submit"],
    );
    if (ans !== "approve") {
      await ctx.say("Not published. Nothing changed on the storefront.");
      return;
    }
    const id = `PR-${size.replace("x", "")}-${offer.replace(/\D/g, "") || "0"}`;
    ctx.effect({
      kind: "rate",
      text: `Promo live: ${offerLabel(offer)} on ${sizeLabel(size)}s until ${target}%`,
      run: () => {
        RECORDS.promos.unshift({ id, title: offerLabel(offer), size, until: ends, live: true });
      },
      undo: () => {
        const i = RECORDS.promos.findIndex(p => p.id === id);
        if (i >= 0) RECORDS.promos.splice(i, 1);
      },
      link: { label: "Open rates", route: "ops/rates" },
    });
    const items = [
      { id: "store", label: "Storefront banner live", sub: `${sizeLabel(size)} cards show "${offerLabel(offer)}"`, state: "todo" as const },
      { id: "google", label: "Google Business listing updated", sub: "Offer post, 30 days", state: "todo" as const },
      { id: "sparefoot", label: "SpareFoot price synced", sub: `${money(first)} first month · ${money(rate)} after`, state: "todo" as const },
      { id: "email", label: `Email to ${leads + 11} recent ${sizeLabel(size)} inquiries queued`, sub: "Sends at 10:00 am", state: "todo" as const },
    ];
    const h = ctx.show("progress", { title: "Publishing", items });
    for (let i = 0; i < items.length; i++) {
      h.update({ items: items.map((x, j) => ({ ...x, state: j < i ? "done" : j === i ? "run" : "todo" })) });
      await ctx.wait(480);
    }
    h.update({ items: items.map(x => ({ ...x, state: "done" as const })), summary: "4 of 4 channels updated" });
    ctx.show("answer", {
      label: "Promo live",
      value: offerLabel(offer),
      context: `${sizeLabel(size)}s · ${occ.vacant.length} vacant · ends at ${target}% or Nov 30`,
      delta: { text: `${need} to go`, tone: "neutral" },
      links: [
        { label: "Open rates", route: "ops/rates" },
        { label: "View storefront", route: "store" },
      ],
    });
    await ctx.say(`Live everywhere. I'll end it the day ${sizeLabel(size)}s reach ${target}% and tell you here.`);
    ctx.suggest(["Send a promo email to 10×20 tenants tomorrow", "Break revenue down by unit size", `How many ${sizeLabel(size)}s are free?`]);
  },
});
