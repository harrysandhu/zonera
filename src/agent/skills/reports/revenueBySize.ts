import { defineSkill } from "../../engine";
import { kw } from "../../parse";
import { money, sizeLabel, sizeOcc } from "../../data";
import { SIZE_INFO, UNITS, type UnitSize } from "../../../data/facility";
import { TENANT_BY_ID } from "../../../data/tenants";
import type { Row } from "../../widgets/core/types";

// Revenue by unit size, computed from the live rent roll: monthly rent per size,
// occupancy, revenue per rentable sq ft, street rate, and what's left on the
// table (vacant units at street rate). Read-only.
//
//   "Break revenue down by unit size" · "Which unit sizes make the most money?"

const SIZES: UnitSize[] = ["5x5", "5x10", "10x10", "10x15", "10x20", "10x30", "12x40"];
const OCCUPIED = new Set(["occupied", "delinquent", "overlocked"]);
const usd = (n: number) => money(n).replace(/\.00$/, "");
const perFt = (n: number) => "$" + n.toFixed(2);

function bySize() {
  return SIZES.map(size => {
    const all = UNITS.filter(u => u.size === size);
    const occ = all.filter(u => OCCUPIED.has(u.status));
    const vacant = all.filter(u => u.status === "vacant");
    const revenue = occ.reduce((s, u) => s + (u.tenantId ? TENANT_BY_ID.get(u.tenantId)?.rent ?? 0 : 0), 0);
    const sqft = SIZE_INFO[size].sqft * all.filter(u => u.status !== "maintenance").length;
    const rates = [...new Set(all.map(u => u.rate))].sort((a, b) => a - b);
    const so = sizeOcc(size);
    return {
      size,
      units: all.length,
      occupied: occ.length,
      occ: so.rate,
      revenue,
      sqft,
      perSqft: sqft ? revenue / sqft : 0,
      rates,
      empty: vacant.reduce((s, u) => s + u.rate, 0),
      parking: all[0]?.kind === "parking",
    };
  });
}

export default defineSkill<{ metric: string }>({
  id: "reports.revenueBySize",
  n: 61,
  category: "reports",
  title: "Revenue by size",
  featured: true,
  examples: ["Break revenue down by unit size", "Which unit sizes make the most money?"],
  slots: {
    metric: {
      label: "group by",
      fill: q => (/\bsq(uare)? ?f(oo)?t\b|\bper foot\b/.test(q.lower) ? "size · per sq ft" : undefined),
      default: "unit size · this month",
    },
  },
  match: q =>
    kw(q, [
      [/\b(revenue|money|income|earn\w*|rent roll|per square foot|per sq ?ft)\b/, 3],
      [/\bby (unit )?size\b|\bunit sizes?\b|\bper size\b|\beach size\b|\bwhich sizes?\b|\bsizes\b/, 3],
      [/\b(break\w* (it )?down|breakdown|split|compare|most|least)\b/, 1],
      [/\b(owner report|september|vs last year|schedul\w*|raise|promo|\$1)\b/, -4],
    ]),

  async run(ctx) {
    ctx.title("Revenue by unit size");
    await ctx.think("Group the live rent roll by unit size, add occupancy and revenue per rentable square foot, and compare against street rates to see which size is under-earning.", 1200);
    const rows = bySize();
    const total = rows.reduce((s, r) => s + r.revenue, 0);
    const occTotal = rows.reduce((s, r) => s + r.occupied, 0);
    await ctx.tools([
      { name: "reports.rent_roll", args: { group_by: "size", as_of: "2026-10-02" }, result: () => ({ monthly: total, occupied_units: occTotal, sizes: rows.length }), ms: 760 },
      { name: "units.inventory", args: { group_by: "size" }, result: () => rows.map(r => ({ size: r.size, units: r.units, occupied: r.occupied })), ms: 620 },
      { name: "rates.street", args: { facility: "alder-lake" }, result: () => Object.fromEntries(rows.map(r => [r.size, r.rates.length > 1 ? r.rates : r.rates[0]])), ms: 480 },
    ]);

    const storage = rows.filter(r => !r.parking);
    const top = [...rows].sort((a, b) => b.revenue - a.revenue)[0];
    const bestFt = [...storage].sort((a, b) => b.perSqft - a.perSqft)[0];
    const soft = [...storage].sort((a, b) => a.occ - b.occ)[0];
    const softTwin = storage.filter(r => r !== soft).sort((a, b) => Math.abs(a.perSqft - soft.perSqft) - Math.abs(b.perSqft - soft.perSqft))[0];
    ctx.focus({ units: UNITS.filter(u => u.size === soft.size && u.status === "vacant").map(u => u.id), selected: null, tenants: [] });

    ctx.show("answer", {
      label: "Monthly rent roll",
      value: usd(total),
      context: `${occTotal} occupied units · ${perFt(total / rows.reduce((s, r) => s + r.sqft, 0))} per rentable sq ft`,
      tiles: [
        { label: "Top earner", value: sizeLabel(top.size), context: `${usd(top.revenue)} · ${Math.round((top.revenue / total) * 100)}% of rent` },
        { label: "Best per sq ft", value: sizeLabel(bestFt.size), context: `${perFt(bestFt.perSqft)} / sq ft` },
        { label: "Under-earning", value: sizeLabel(soft.size), delta: { text: `${Math.round(soft.occ * 100)}% occupied`, tone: "warn" }, context: `${usd(soft.empty)}/mo empty` },
      ],
      chart: { kind: "bar", title: "Monthly rent by size", data: rows.map(r => ({ label: sizeLabel(r.size), value: r.revenue })), format: "money", height: 180 },
    });

    const table: Row[] = rows.map(r => ({
      id: r.size,
      cells: {
        size: sizeLabel(r.size) + (r.parking ? " parking" : ""),
        units: String(r.units),
        occupied: String(r.occupied),
        occ: Math.round(r.occ * 100) + "%",
        revenue: usd(r.revenue),
        ft: perFt(r.perSqft),
        street: r.rates.map(usd).join(" / "),
      },
      sort: { units: r.units, occupied: r.occupied, occ: r.occ, revenue: r.revenue, ft: r.perSqft, street: r.rates[0] },
      tone: r === soft ? "warn" : undefined,
    }));
    ctx.show("table", {
      title: "Revenue by unit size",
      meta: "per month · live",
      columns: [
        { key: "size", label: "Size" },
        { key: "units", label: "Units", align: "right", mono: true },
        { key: "occupied", label: "Occupied", align: "right", mono: true },
        { key: "occ", label: "Occ.", align: "right", mono: true },
        { key: "revenue", label: "Monthly rent", align: "right", mono: true },
        { key: "ft", label: "$/sq ft", align: "right", mono: true },
        { key: "street", label: "Street rate", align: "right", mono: true },
      ],
      rows: table,
    });

    await ctx.say(
      `**${sizeLabel(top.size)}s bring in the most**: ${usd(top.revenue)} a month, ${Math.round((top.revenue / total) * 100)}% of rent. ` +
        `Small units earn the most per foot (${sizeLabel(bestFt.size)}s at ${perFt(bestFt.perSqft)}). ` +
        `**${sizeLabel(soft.size)}s are under-earning**: ${Math.round(soft.occ * 100)}% occupied and ${perFt(soft.perSqft)} per sq ft, with ${usd(soft.empty)} a month of street rent sitting empty` +
        (softTwin ? `. ${sizeLabel(softTwin.size)}s earn about the same per foot but are ${Math.round(softTwin.occ * 100)}% full.` : "."),
    );
    ctx.suggest(["Raise rates 6% for tenants here over a year", "Run a $1 first month on 10×20s until we hit 90%", "Generate the September owner report vs last year"]);
  },
});
