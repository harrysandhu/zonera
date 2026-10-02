// Zonera Alder Lake — the demo facility.
// The site plan is authored in feet (1 world unit = 1 ft). x runs east, z runs south.
// Everything else in the product (3D twin, storefront inventory, operator tables,
// agent tools) is derived from this one description, the way a real operator's
// site map + rent roll would be imported.

export type UnitSize = "5x5" | "5x10" | "10x10" | "10x15" | "10x20" | "10x30" | "12x40";
export type UnitKind = "drive-up" | "climate" | "parking";
export type UnitStatus = "occupied" | "vacant" | "reserved" | "delinquent" | "overlocked" | "maintenance";
export type Facing = "north" | "south" | "east" | "west";

export interface Building {
  id: string;
  name: string;
  kind: UnitKind | "office";
  x: number; // min x
  z: number; // min z
  w: number; // extent along x
  d: number; // extent along z
  h: number; // height per floor
  floors: number;
}

export interface Unit {
  id: string;
  building: string;
  size: UnitSize;
  kind: UnitKind;
  floor: number;
  // footprint in world feet
  x: number;
  z: number;
  w: number;
  d: number;
  facing: Facing;
  // where you stand to open it (drive-up: in the aisle; climate: in the hallway)
  door: { x: number; z: number };
  aisleZ?: number;
  rate: number; // street rate, monthly USD
  status: UnitStatus;
  tenantId?: string;
}

export const FACILITY = {
  id: "alder-lake",
  name: "Zonera Alder Lake",
  short: "Alder Lake",
  address: "2200 Shoreline Drive, Alder Lake, CA 96150",
  phone: "(530) 555-0142",
  gateHours: "6:00 am – 10:00 pm, every day",
  officeHours: "9:00 am – 6:00 pm, Mon–Sat",
  bounds: { x: -210, z: -170, w: 420, d: 320 },
  gate: { x: -150, z: 150 },
  office: { x: -196, z: 92, w: 36, d: 26 },
};

export const OTHER_FACILITIES = [
  { id: "dolores", name: "Zonera Dolores", short: "Dolores", address: "3550 18th Street, San Francisco, CA 94110", units: 184, occupancy: 0.937 },
  { id: "pier-7", name: "Zonera Pier 7", short: "Pier 7", address: "1 Embarcadero North, San Francisco, CA 94111", units: 96, occupancy: 0.884 },
];

export const SIZE_INFO: Record<UnitSize, { label: string; sqft: number; like: string; fits: string; cubic: number }> = {
  "5x5": { label: "5′ × 5′", sqft: 25, like: "A hall closet", fits: "Boxes, a suitcase, seasonal décor, a bike", cubic: 200 },
  "5x10": { label: "5′ × 10′", sqft: 50, like: "A walk-in closet", fits: "A studio: mattress, dresser, 15 boxes", cubic: 400 },
  "10x10": { label: "10′ × 10′", sqft: 100, like: "Half a one-car garage", fits: "A one-bedroom: sofa, bed, table, 25 boxes", cubic: 800 },
  "10x15": { label: "10′ × 15′", sqft: 150, like: "A large bedroom", fits: "A two-bedroom with appliances", cubic: 1200 },
  "10x20": { label: "10′ × 20′", sqft: 200, like: "A one-car garage", fits: "A three-bedroom house, or a car", cubic: 1600 },
  "10x30": { label: "10′ × 30′", sqft: 300, like: "A garage and a half", fits: "A four-bedroom house, or business stock", cubic: 2400 },
  "12x40": { label: "12′ × 40′", sqft: 480, like: "An RV or boat space", fits: "Boats, RVs and trailers up to 38′", cubic: 0 },
};

const RATE: Record<string, number> = {
  "drive-up:5x10": 109,
  "drive-up:10x10": 189,
  "drive-up:10x15": 249,
  "drive-up:10x20": 319,
  "drive-up:10x30": 419,
  "climate:5x5": 79,
  "climate:5x10": 129,
  "climate:10x10": 229,
  "parking:12x40": 179,
};

export const BUILDINGS: Building[] = [
  { id: "A", name: "Building A", kind: "drive-up", x: -60, z: 62, w: 220, d: 30, h: 11, floors: 1 },
  { id: "B", name: "Building B", kind: "drive-up", x: -60, z: -12, w: 220, d: 45, h: 12, floors: 1 },
  { id: "C", name: "Building C", kind: "drive-up", x: -60, z: -72, w: 160, d: 20, h: 10, floors: 1 },
  { id: "D", name: "Building D · Climate", kind: "climate", x: -196, z: -40, w: 96, d: 72, h: 12, floors: 2 },
  { id: "P", name: "RV & Boat", kind: "parking", x: 20, z: -154, w: 84, d: 40, h: 0, floors: 1 },
  { id: "O", name: "Office", kind: "office", x: -196, z: 92, w: 36, d: 26, h: 13, floors: 1 },
];

// Aisles (drive lanes) the route planner uses. Centre lines.
export const AISLES = {
  southZ: 112, // between A's south face and the fence, runs from the gate
  abZ: 47.5, // between A and B
  bcZ: -32, // between B and C
  northZ: -100, // north of C
  spineX: -78, // north–south lane between D and A/B/C
  eastX: 186, // east lane
};

// Deterministic PRNG so the demo looks the same on every load.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Strip {
  building: string;
  facing: Facing;
  depth: number;
  pattern: { w: number; size: UnitSize }[];
}

const STRIPS: Strip[] = [
  // Building A: south face (towards the entry lane) 10x20s, north face 10x10s and 5x10s
  { building: "A", facing: "south", depth: 20, pattern: [{ w: 10, size: "10x20" }] },
  { building: "A", facing: "north", depth: 10, pattern: [{ w: 10, size: "10x10" }, { w: 10, size: "10x10" }, { w: 5, size: "5x10" }, { w: 5, size: "5x10" }] },
  // Building B: south face 10x30s, north face 10x15s
  { building: "B", facing: "south", depth: 30, pattern: [{ w: 10, size: "10x30" }] },
  { building: "B", facing: "north", depth: 15, pattern: [{ w: 10, size: "10x15" }] },
  // Building C: both faces 10x10 and 5x10
  { building: "C", facing: "south", depth: 10, pattern: [{ w: 10, size: "10x10" }, { w: 5, size: "5x10" }] },
  { building: "C", facing: "north", depth: 10, pattern: [{ w: 10, size: "10x10" }] },
];

function buildDriveUps(): Unit[] {
  const out: Unit[] = [];
  for (const b of BUILDINGS.filter(b => b.kind === "drive-up")) {
    const strips = STRIPS.filter(s => s.building === b.id);
    let n = 101;
    for (const strip of strips) {
      let cursor = b.x + 4; // end walls
      let i = 0;
      const end = b.x + b.w - 4;
      while (true) {
        const p = strip.pattern[i % strip.pattern.length];
        if (cursor + p.w > end) break;
        const z = strip.facing === "south" ? b.z + b.d - strip.depth : b.z;
        const doorZ = strip.facing === "south" ? b.z + b.d : b.z;
        const aisleZ =
          b.id === "A" ? (strip.facing === "south" ? AISLES.southZ : AISLES.abZ)
          : b.id === "B" ? (strip.facing === "south" ? AISLES.abZ : AISLES.bcZ)
          : strip.facing === "south" ? AISLES.bcZ : AISLES.northZ;
        out.push({
          id: `${b.id}-${n}`,
          building: b.id,
          size: p.size,
          kind: "drive-up",
          floor: 1,
          x: cursor,
          z,
          w: p.w,
          d: strip.depth,
          facing: strip.facing,
          door: { x: cursor + p.w / 2, z: doorZ + (strip.facing === "south" ? 6 : -6) },
          aisleZ,
          rate: RATE[`drive-up:${p.size}`],
          status: "occupied",
        });
        n++;
        i++;
        cursor += p.w;
      }
    }
  }
  return out;
}

function buildClimate(): Unit[] {
  // Building D: two floors, a central east–west corridor, units on both sides.
  const b = BUILDINGS.find(b => b.id === "D")!;
  const out: Unit[] = [];
  const corridorZ = b.z + b.d / 2; // corridor centre
  for (const floor of [1, 2]) {
    let n = floor * 100 + 1;
    for (const side of ["north", "south"] as const) {
      const row: { w: number; d: number; size: UnitSize }[] =
        side === "north"
          ? [{ w: 10, d: 10, size: "10x10" }, { w: 5, d: 10, size: "5x10" }, { w: 5, d: 10, size: "5x10" }, { w: 5, d: 5, size: "5x5" }]
          : [{ w: 5, d: 10, size: "5x10" }, { w: 10, d: 10, size: "10x10" }, { w: 5, d: 5, size: "5x5" }, { w: 5, d: 5, size: "5x5" }];
      let cursor = b.x + 14; // stair + elevator core at the west end
      let i = 0;
      while (cursor + row[i % row.length].w <= b.x + b.w - 4) {
        const p = row[i % row.length];
        const z = side === "north" ? corridorZ - 4 - p.d : corridorZ + 4;
        out.push({
          id: `D-${n}`,
          building: "D",
          size: p.size,
          kind: "climate",
          floor,
          x: cursor,
          z,
          w: p.w,
          d: p.d,
          facing: side === "north" ? "south" : "north",
          door: { x: cursor + p.w / 2, z: corridorZ },
          rate: RATE[`climate:${p.size}`],
          status: "occupied",
        });
        n++;
        i++;
        cursor += p.w;
      }
    }
  }
  return out;
}

function buildParking(): Unit[] {
  const b = BUILDINGS.find(b => b.id === "P")!;
  const out: Unit[] = [];
  for (let i = 0; i < 7; i++) {
    out.push({
      id: `P-${i + 1}`,
      building: "P",
      size: "12x40",
      kind: "parking",
      floor: 1,
      x: b.x + i * 12,
      z: b.z,
      w: 12,
      d: 40,
      facing: "south",
      door: { x: b.x + i * 12 + 6, z: b.z + b.d + 6 },
      aisleZ: AISLES.northZ,
      rate: RATE["parking:12x40"],
      status: "occupied",
    });
  }
  return out;
}

export const UNITS: Unit[] = [...buildDriveUps(), ...buildClimate(), ...buildParking()];
export const UNIT_BY_ID = new Map(UNITS.map(u => [u.id, u]));

// ---- Status assignment ---------------------------------------------------
// Story units are pinned first so the scenarios line up; everything else is
// seeded to ~91% occupancy with a realistic spread of exceptions.

export const STORY_UNITS = {
  storefrontPick: "A-126", // Maya Chen books this through the storefront (10x10)
  matthewOkafor: "A-122",
  matthewAlvarez: "B-122",
  matthewCho: "D-207",
  sofiaFrom: "C-108",
  sofiaTo: "C-117",
  dana: "A-131",
  ben: "B-141",
  jammedDoor: "C-112",
  lockout: "D-118",
};

const pinned: Record<string, UnitStatus> = {
  "A-126": "vacant",
  "A-122": "overlocked",
  "D-118": "delinquent",
  "B-122": "occupied",
  "D-207": "occupied",
  "C-108": "occupied",
  "C-117": "vacant",
  "A-131": "overlocked",
  "B-141": "occupied",
  "C-112": "maintenance",
  "D-105": "vacant",
  "D-209": "vacant",
  "B-128": "vacant",
  "P-5": "vacant",
};

(function assignStatuses() {
  const r = rng(7);
  for (const u of UNITS) {
    if (pinned[u.id]) {
      u.status = pinned[u.id];
      continue;
    }
    const x = r();
    // Larger and parking units run a little emptier; 10x20 is the soft spot the promo targets.
    const vacancy = u.size === "10x20" ? 0.2 : u.size === "10x30" ? 0.08 : u.kind === "parking" ? 0.12 : 0.04;
    if (x < vacancy) u.status = "vacant";
    else if (x < vacancy + 0.035) u.status = "reserved";
    else if (x < vacancy + 0.07) u.status = "delinquent";
    else if (x < vacancy + 0.08) u.status = "overlocked";
    else u.status = "occupied";
  }
})();

export function unitsBySize(size: UnitSize, kind?: UnitKind) {
  return UNITS.filter(u => u.size === size && (!kind || u.kind === kind));
}

export function availableUnits(size?: UnitSize) {
  return UNITS.filter(u => u.status === "vacant" && (!size || u.size === size));
}

export function occupancy() {
  const rentable = UNITS.filter(u => u.status !== "maintenance");
  const occ = rentable.filter(u => u.status === "occupied" || u.status === "delinquent" || u.status === "overlocked");
  const sqft = (list: Unit[]) => list.reduce((s, u) => s + u.w * u.d, 0);
  return {
    units: UNITS.length,
    occupied: occ.length,
    vacant: UNITS.filter(u => u.status === "vacant").length,
    reserved: UNITS.filter(u => u.status === "reserved").length,
    byUnit: occ.length / rentable.length,
    bySqft: sqft(occ) / sqft(rentable),
  };
}

// Route from the gate to a unit, as a polyline on the ground (feet).
export function routeTo(unitId: string): { points: { x: number; z: number }[]; steps: string[]; feet: number } {
  const u = UNIT_BY_ID.get(unitId)!;
  const g = FACILITY.gate;
  const pts: { x: number; z: number }[] = [{ x: g.x, z: g.z + 14 }, { x: g.x, z: AISLES.southZ }];
  const steps: string[] = ["Enter your code at the gate keypad"];
  if (u.kind === "climate") {
    pts.push({ x: AISLES.spineX, z: AISLES.southZ });
    pts.push({ x: AISLES.spineX, z: -4 });
    steps.push("Turn left onto the main lane", "Park at the Building D entrance on your left");
    steps.push(u.floor === 2 ? `Take the elevator to floor 2 — ${u.id} is down the hall on your ${u.facing === "south" ? "right" : "left"}` : `${u.id} is down the hall on your ${u.facing === "south" ? "right" : "left"}`);
  } else if (u.aisleZ === AISLES.southZ) {
    pts.push({ x: u.door.x, z: AISLES.southZ });
    steps.push(`Drive straight along Building A — ${u.id} is on your left`);
  } else {
    pts.push({ x: AISLES.spineX, z: AISLES.southZ });
    pts.push({ x: AISLES.spineX, z: u.aisleZ! });
    pts.push({ x: u.door.x, z: u.aisleZ! });
    const lane = u.aisleZ === AISLES.abZ ? "between Buildings A and B" : u.aisleZ === AISLES.bcZ ? "between Buildings B and C" : "behind Building C";
    steps.push("Turn left onto the main lane", `Turn right into the lane ${lane}`, `${u.id} is on your ${(u.facing === "north") ? "right" : "left"}, roll-up door`);
  }
  let feet = 0;
  for (let i = 1; i < pts.length; i++) feet += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
  return { points: pts, steps, feet: Math.round(feet) };
}
