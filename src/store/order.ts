import { useSyncExternalStore } from "react";
import { UNIT_BY_ID, availableUnits, routeTo, type Unit, type UnitSize } from "../data/facility";

// The renter's order, shared by the storefront, checkout and access screens.
// Kept in memory (no persistence) so a reload resets the demo.

export type ProtectionChoice = 2000 | 5000 | 10000 | "own";
export type Plan = "monthly" | "prepay";

export interface Order {
  unitId: string;
  moveIn: string; // ISO date in October 2026
  duration: string;
  first: string;
  last: string;
  email: string;
  phone: string;
  protection: ProtectionChoice;
  ownInsurer: string;
  ownFile: string | null;
  plan: Plan;
  autopay: boolean;
  idVerified: boolean;
  pay: "card" | "apple";
  card: string;
  exp: string;
  cvc: string;
  zip: string;
  signature: string;
  agreed: boolean;
  tenantId: string | null;
  signedAt: string | null;
}

export const GATE_CODE = "4827";
export const TODAY_ISO = "2026-10-02";

export const DEFAULTS = {
  first: "Maya",
  last: "Chen",
  email: "maya.chen@icloud.com",
  phone: "(530) 555-0198",
  card: "4242 4242 4242 4242",
  exp: "08/29",
  cvc: "314",
  zip: "96150",
};

function fresh(unitId = "A-126"): Order {
  return {
    unitId,
    moveIn: TODAY_ISO,
    duration: "",
    first: DEFAULTS.first,
    last: DEFAULTS.last,
    email: DEFAULTS.email,
    phone: DEFAULTS.phone,
    protection: 5000,
    ownInsurer: "",
    ownFile: null,
    plan: "monthly",
    autopay: true,
    idVerified: false,
    pay: "card",
    card: "",
    exp: "",
    cvc: "",
    zip: "",
    signature: "",
    agreed: false,
    tenantId: null,
    signedAt: null,
  };
}

let order: Order = fresh();
let version = 0;
const subs = new Set<() => void>();
const emit = () => {
  version++;
  subs.forEach(f => f());
};

export function getOrder() {
  return order;
}

export function setOrder(patch: Partial<Order>) {
  order = { ...order, ...patch };
  emit();
}

/** Start a new checkout for a unit (keeps nothing from a previous rental). */
export function startOrder(unitId: string) {
  order = fresh(unitId);
  emit();
}

export function useOrder() {
  useSyncExternalStore(
    f => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => version,
    () => version,
  );
  return order;
}

// ---- Unit helpers -----------------------------------------------------------

export const SIZE_ORDER: UnitSize[] = ["5x5", "5x10", "10x10", "10x15", "10x20", "10x30", "12x40"];

export const sizeLabel = (s: UnitSize) => s.replace("x", "×");

const KIND_LABEL: Record<Unit["kind"], string> = { "drive-up": "Drive-up", climate: "Climate controlled", parking: "RV & boat parking" };
export const kindLabel = (u: Unit) => KIND_LABEL[u.kind];
export const kindShort = (u: Unit) => (u.kind === "climate" ? "Climate" : u.kind === "parking" ? "Parking" : "Drive-up");

/** Available units of a size, best first: the story pick, then drive-up, then nearest the gate. */
export function availableOf(size: UnitSize) {
  return availableUnits(size).sort((a, b) => {
    if (a.id === "A-126") return -1;
    if (b.id === "A-126") return 1;
    const k = (u: Unit) => (u.kind === "climate" ? 1 : 0);
    if (k(a) !== k(b)) return k(a) - k(b);
    return routeTo(a.id).feet - routeTo(b.id).feet;
  });
}

export function unitFacts(u: Unit): string[] {
  if (u.kind === "climate") return [`Building D, floor ${u.floor}`, u.floor === 2 ? "Elevator access" : "Ground floor, near the entrance", "Kept at 55–80°F"];
  if (u.kind === "parking") return ["North lot, by the lake", "Uncovered, paved", "Up to 38 ft"];
  const side = u.facing === "south" ? "front" : "north side";
  return [`Building ${u.building}, ${side}`, "Roll-up door, drive right up", `${routeTo(u.id).feet} ft from the gate`];
}

export function unitOrDefault(id: string | null | undefined) {
  return (id && UNIT_BY_ID.get(id)) || UNIT_BY_ID.get("A-126")!;
}
