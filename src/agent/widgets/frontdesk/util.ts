import { SIZE_INFO, routeTo, UNIT_BY_ID, type UnitSize } from "../../../data/facility";
import type { UnitOption } from "./types";

// Small formatting helpers shared by the front-desk widgets.

export const usd = (n: number) => (n < 0 ? "−" : "") + "$" + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const usd0 = (n: number) => (n < 0 ? "−" : "") + "$" + Math.abs(Math.round(n)).toLocaleString("en-US");
export const sizeText = (s: string) => s.replace("x", "×");

/** "14:30" → "2:30 pm" */
export function t12(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "pm" : "am";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ap}`;
}

const WK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dt = (iso: string) => new Date(iso + "T12:00:00");
export const wk = (iso: string) => WK[dt(iso).getDay()];
export const dayNum = (iso: string) => dt(iso).getDate();
export const mon = (iso: string) => MON[dt(iso).getMonth()];
/** "Sat, Oct 3" */
export const dayLabel = (iso: string) => `${wk(iso)}, ${mon(iso)} ${dayNum(iso)}`;
/** "Oct 3, 2026" */
export const longLabel = (iso: string) => `${mon(iso)} ${dayNum(iso)}, ${iso.slice(0, 4)}`;

export const kindLabel = (k: string) => (k === "climate" ? "Climate" : k === "parking" ? "Parking" : "Drive-up");
export const sqftOf = (size: UnitSize) => SIZE_INFO[size].sqft;

export function unitLine(o: UnitOption) {
  return `${sizeText(o.size)} ${kindLabel(o.kind).toLowerCase()} · ${o.kind === "climate" ? `floor ${o.floor}` : o.building === "P" ? "RV & boat" : `Building ${o.building}`}`;
}

/** Route polyline in site-plan feet, for 2D mini maps. */
export function routePoints(unitId: string) {
  if (!UNIT_BY_ID.has(unitId)) return null;
  return routeTo(unitId);
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .map(s => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
