import type { PortfolioFacility, Onboarding, FleetVm, Role, Stage, FlowState } from "../types";

// Zonera HQ's portfolio: every facility on the platform, every onboarding in flight,
// every VM in the fleet. Generated deterministically so the demo looks the same on
// every load.

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
const r = rng(1042);
const pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length)];
const weighted = <T,>(a: readonly (readonly [T, number])[]) => {
  const total = a.reduce((s, [, w]) => s + w, 0);
  let x = r() * total;
  for (const [v, w] of a) if ((x -= w) < 0) return v;
  return a[a.length - 1][0];
};

// Real cities (lat, lon) so the dot map reads as the US. Weight ≈ how many facilities.
const CITIES: [string, string, number, number, number][] = [
  ["Phoenix", "AZ", 33.45, -112.07, 26], ["Tucson", "AZ", 32.22, -110.97, 10], ["Mesa", "AZ", 33.42, -111.83, 8], ["Las Vegas", "NV", 36.17, -115.14, 18], ["Reno", "NV", 39.53, -119.81, 7],
  ["Los Angeles", "CA", 34.05, -118.24, 30], ["San Diego", "CA", 32.72, -117.16, 16], ["San Jose", "CA", 37.34, -121.89, 10], ["San Francisco", "CA", 37.77, -122.42, 8], ["Sacramento", "CA", 38.58, -121.49, 12],
  ["Fresno", "CA", 36.74, -119.79, 8], ["Bakersfield", "CA", 35.37, -119.02, 7], ["Riverside", "CA", 33.95, -117.4, 12], ["Redding", "CA", 40.59, -122.39, 4], ["South Lake Tahoe", "CA", 38.94, -119.98, 3],
  ["Portland", "OR", 45.52, -122.68, 10], ["Eugene", "OR", 44.05, -123.09, 4], ["Bend", "OR", 44.06, -121.31, 4], ["Seattle", "WA", 47.61, -122.33, 12], ["Spokane", "WA", 47.66, -117.43, 6], ["Tacoma", "WA", 47.25, -122.44, 6],
  ["Boise", "ID", 43.62, -116.2, 8], ["Salt Lake City", "UT", 40.76, -111.89, 12], ["Provo", "UT", 40.23, -111.66, 5], ["St. George", "UT", 37.1, -113.58, 5], ["Denver", "CO", 39.74, -104.99, 16], ["Colorado Springs", "CO", 38.83, -104.82, 9],
  ["Fort Collins", "CO", 40.59, -105.08, 5], ["Albuquerque", "NM", 35.08, -106.65, 8], ["Billings", "MT", 45.78, -108.5, 3], ["Cheyenne", "WY", 41.14, -104.82, 2],
  ["Dallas", "TX", 32.78, -96.8, 28], ["Fort Worth", "TX", 32.76, -97.33, 16], ["Houston", "TX", 29.76, -95.37, 30], ["Austin", "TX", 30.27, -97.74, 18], ["San Antonio", "TX", 29.42, -98.49, 18],
  ["El Paso", "TX", 31.76, -106.49, 7], ["Lubbock", "TX", 33.58, -101.85, 5], ["Corpus Christi", "TX", 27.8, -97.4, 5], ["McAllen", "TX", 26.2, -98.23, 5], ["Oklahoma City", "OK", 35.47, -97.52, 10], ["Tulsa", "OK", 36.15, -95.99, 7],
  ["Wichita", "KS", 37.69, -97.34, 5], ["Kansas City", "MO", 39.1, -94.58, 10], ["St. Louis", "MO", 38.63, -90.2, 10], ["Omaha", "NE", 41.26, -95.93, 6], ["Des Moines", "IA", 41.59, -93.62, 5],
  ["Minneapolis", "MN", 44.98, -93.27, 10], ["Sioux Falls", "SD", 43.54, -96.73, 3], ["Fargo", "ND", 46.88, -96.79, 2], ["Milwaukee", "WI", 43.04, -87.91, 6], ["Madison", "WI", 43.07, -89.4, 4],
  ["Chicago", "IL", 41.88, -87.63, 20], ["Indianapolis", "IN", 39.77, -86.16, 10], ["Detroit", "MI", 42.33, -83.05, 10], ["Grand Rapids", "MI", 42.96, -85.67, 5], ["Columbus", "OH", 39.96, -83.0, 10],
  ["Cleveland", "OH", 41.5, -81.69, 7], ["Cincinnati", "OH", 39.1, -84.51, 7], ["Louisville", "KY", 38.25, -85.76, 6], ["Nashville", "TN", 36.16, -86.78, 14], ["Memphis", "TN", 35.15, -90.05, 7], ["Knoxville", "TN", 35.96, -83.92, 6],
  ["Atlanta", "GA", 33.75, -84.39, 22], ["Savannah", "GA", 32.08, -81.09, 5], ["Birmingham", "AL", 33.52, -86.8, 7], ["Huntsville", "AL", 34.73, -86.59, 5], ["Jackson", "MS", 32.3, -90.18, 4], ["New Orleans", "LA", 29.95, -90.07, 7],
  ["Baton Rouge", "LA", 30.45, -91.19, 5], ["Little Rock", "AR", 34.75, -92.29, 5], ["Jacksonville", "FL", 30.33, -81.66, 12], ["Orlando", "FL", 28.54, -81.38, 16], ["Tampa", "FL", 27.95, -82.46, 16], ["Miami", "FL", 25.76, -80.19, 18],
  ["Fort Myers", "FL", 26.64, -81.87, 8], ["Tallahassee", "FL", 30.44, -84.28, 4], ["Pensacola", "FL", 30.42, -87.22, 4], ["Charlotte", "NC", 35.23, -80.84, 14], ["Raleigh", "NC", 35.78, -78.64, 12], ["Greensboro", "NC", 36.07, -79.79, 6],
  ["Wilmington", "NC", 34.23, -77.94, 5], ["Charleston", "SC", 32.78, -79.93, 7], ["Columbia", "SC", 34.0, -81.03, 6], ["Greenville", "SC", 34.85, -82.4, 6], ["Richmond", "VA", 37.54, -77.44, 8], ["Virginia Beach", "VA", 36.85, -75.98, 8],
  ["Washington", "DC", 38.91, -77.04, 8], ["Baltimore", "MD", 39.29, -76.61, 7], ["Philadelphia", "PA", 39.95, -75.17, 10], ["Pittsburgh", "PA", 40.44, -80.0, 7], ["Harrisburg", "PA", 40.27, -76.88, 4],
  ["Newark", "NJ", 40.74, -74.17, 7], ["New York", "NY", 40.71, -74.01, 10], ["Albany", "NY", 42.65, -73.75, 4], ["Buffalo", "NY", 42.89, -78.88, 5], ["Hartford", "CT", 41.76, -72.68, 4], ["Providence", "RI", 41.82, -71.41, 3],
  ["Boston", "MA", 42.36, -71.06, 8], ["Worcester", "MA", 42.26, -71.8, 3], ["Manchester", "NH", 42.99, -71.46, 3], ["Portland", "ME", 43.66, -70.26, 3], ["Burlington", "VT", 44.48, -73.21, 2],
  ["Anchorage", "AK", 61.22, -149.9, 2], ["Honolulu", "HI", 21.31, -157.86, 2],
];

const PREFIX = ["Sunset", "Pioneer", "Cedar", "Summit", "Harbor", "Mesa", "Prairie", "Ridgeline", "Riverbend", "Canyon", "Oak Hollow", "Bluebird", "Lakeside", "Northgate", "Southpoint", "Granite", "Redwood", "Willow", "Liberty", "Heritage", "Eastside", "Westview", "Desert Sky", "Palmetto", "Magnolia", "Iron Horse", "Frontier", "Coastal", "Highland", "Maple"];
const SUFFIX = ["Self Storage", "Storage", "Storage Center", "Mini Storage", "Self Storage", "RV & Boat Storage", "Storage Co.", "Secure Storage"];
const ORGS = ["Holloway Storage Group", "Mesa Ridge Partners", "Granite Peak Storage", "Bluebird Storage LLC", "Coastal Self Storage Co.", "Prairie Storage Holdings", "Summit Storage Partners", "Lone Star Storage Group", "Cedar Point Storage", "Northgate Holdings", "Redwood Storage Trust", "Palmetto Storage LLC"];

// Where facilities came from. The incumbents are real; Keystone is the demo's legacy system.
const FROM = [["SiteLink", 31], ["storEDGE", 18], ["Easy Storage Solutions", 11], ["Spreadsheets / paper", 12], ["Yardi Breeze", 6], ["Tenant Inc.", 4], ["QuikStor", 4], ["Keystone", 3], ["Other", 11]] as const;
const GATES = [["PTI", 34], ["OpenTech", 22], ["PDK", 14], ["Noke", 12], ["DoorKing", 8], ["None", 10]] as const;

export const FACILITIES: PortfolioFacility[] = [];
const cityWeights = CITIES.map(c => [c, c[4]] as const);
let orgIdx = 0;
while (FACILITIES.length < 1042) {
  const [city, st, lat, lon] = weighted(cityWeights);
  // Most operators run one or two sites; a few run many.
  const orgSize = weighted([[1, 52], [2, 22], [3, 12], [5, 8], [9, 4], [16, 2]] as const);
  const brand = pick(PREFIX);
  const org = orgSize >= 9 ? ORGS[orgIdx++ % ORGS.length] : orgSize > 1 ? `${brand} ${pick(["Storage Partners", "Storage Group", "Holdings", "Properties"])}` : "";
  for (let k = 0; k < orgSize && FACILITIES.length < 1042; k++) {
    const name = orgSize > 1 && orgSize < 9 && k === 0 ? `${brand} ${pick(SUFFIX)}` : `${pick(PREFIX)} ${pick(SUFFIX)}`;
    const units = Math.round(60 + Math.pow(r(), 1.6) * 820);
    const plan = orgSize >= 9 ? "Enterprise" : orgSize >= 2 ? "Professional" : "Starter";
    const months = Math.floor(r() * 30);
    const since = new Date(2026, 8 - months, 1 + Math.floor(r() * 27));
    const health = Math.round(72 + r() * 28 - (r() < 0.05 ? 30 : 0));
    FACILITIES.push({
      id: `F-${String(10000 + FACILITIES.length)}`,
      name,
      org: org || `${name} LLC`,
      city,
      state: st,
      units,
      occupancy: 0.78 + r() * 0.2,
      plan,
      mrr: plan === "Starter" ? 499 : plan === "Professional" ? Math.round(999 / Math.min(orgSize, 5)) : 2900 / 9 + Math.round(units * 0.4),
      status: health < 55 ? "churn-risk" : months < 2 ? "trial" : "live",
      since: since.toISOString().slice(0, 10),
      health,
      from: weighted(FROM),
      gate: weighted(GATES),
      touches: weighted([[0, 62], [1, 28], [2, 8], [3, 2]] as const),
      hoursToLive: Math.round(18 + Math.pow(r(), 2) * 70),
      lat: lat + (r() - 0.5) * 0.9,
      lon: lon + (r() - 0.5) * 1.1,
    });
  }
}

// The facilities from the operator demo are already live under Brennan.
FACILITIES[0] = { ...FACILITIES[0], id: "F-10000", name: "Zonera Dolores", org: "Brennan Storage Co.", city: "San Francisco", state: "CA", units: 184, occupancy: 0.937, plan: "Professional", mrr: 333, status: "trial", since: "2026-09-18", health: 96, from: "Keystone", gate: "PDK", touches: 0, hoursToLive: 29, lat: 37.76, lon: -122.42 };
FACILITIES[1] = { ...FACILITIES[1], id: "F-10001", name: "Zonera Pier 7", org: "Brennan Storage Co.", city: "San Francisco", state: "CA", units: 96, occupancy: 0.884, plan: "Professional", mrr: 333, status: "trial", since: "2026-09-18", health: 94, from: "Keystone", gate: "PDK", touches: 1, hoursToLive: 31, lat: 37.8, lon: -122.4 };

export const ALDER_LAKE: PortfolioFacility = {
  id: "F-11042", name: "Zonera Alder Lake", org: "Brennan Storage Co.", city: "Alder Lake", state: "CA", units: 181, occupancy: 0.889, plan: "Professional", mrr: 333,
  status: "live", since: "2026-10-02", health: 98, from: "Keystone", gate: "PDK", touches: 1, hoursToLive: 36, lat: 38.94, lon: -120.04,
};

export const SUMMARY = (() => {
  const live = FACILITIES.filter(f => f.status !== "onboarding");
  const mrr = live.reduce((a, f) => a + f.mrr, 0);
  const units = live.reduce((a, f) => a + f.units, 0);
  const orgs = new Set(live.map(f => f.org)).size;
  const touches = live.reduce((a, f) => a + f.touches, 0) / live.length;
  const hours = live.map(f => f.hoursToLive).sort((a, b) => a - b);
  const byFrom = new Map<string, number>();
  live.forEach(f => byFrom.set(f.from, (byFrom.get(f.from) ?? 0) + 1));
  return {
    facilities: live.length,
    orgs,
    units,
    mrr,
    arr: mrr * 12,
    touches,
    medianHours: hours[Math.floor(hours.length / 2)],
    from: [...byFrom.entries()].sort((a, b) => b[1] - a[1]),
    sdrs: 1,
  };
})();

// Weekly go-lives over the last 26 weeks, for the growth chart.
export const GO_LIVES = Array.from({ length: 26 }, (_, i) => Math.round(8 + i * 1.9 + Math.sin(i / 2) * 4 + r() * 6));

// ---- onboardings in flight -----------------------------------------------------

const STAGE_FLOW: [Stage, FlowState, number][] = [
  ["context", "DETAILS_COMPLETE", 0.08],
  ["plan", "PLAN_CONFIGURED", 0.16],
  ["collect", "AWAITING_SIGNING", 0.3],
  ["collect", "AWAITING_PAYMENT", 0.4],
  ["migrate", "ONBOARDING_IN_PROGRESS", 0.58],
  ["validate", "ONBOARDING_IN_PROGRESS", 0.82],
];
const WAITING = ["Owner: signature", "Owner: Keystone login", "Vendor: OpenTech API key", "Owner: lease upload", "Vendor: PTI dealer", "Bank: micro-deposit", "Owner: card", undefined, undefined, undefined];

export const ONBOARDINGS: Onboarding[] = [
  { id: "brennan", org: "Brennan Storage Co.", facilities: 3, units: 461, stage: "context", state: "DRAFT", progress: 0, from: "Keystone 8.4", gate: "PDK", vms: 0, touches: 0, age: "now", hero: true },
];
for (let i = 0; i < 62; i++) {
  const [stage, state, p] = weighted(STAGE_FLOW.map(s => [s, s[0] === "migrate" ? 3 : s[0] === "collect" ? 3 : 2] as const));
  const facs = weighted([[1, 60], [2, 22], [3, 10], [6, 6], [14, 2]] as const);
  ONBOARDINGS.push({
    id: `ob-${2400 + i}`,
    org: i < ORGS.length && facs >= 6 ? ORGS[i] : `${pick(PREFIX)} ${pick(["Storage", "Self Storage", "Storage Co.", "Mini Storage"])}`,
    facilities: facs,
    units: Math.round(facs * (90 + r() * 400)),
    stage,
    state,
    progress: Math.min(0.96, p + r() * 0.12),
    from: weighted(FROM),
    gate: weighted(GATES),
    vms: stage === "migrate" ? 4 + Math.floor(r() * 5) : stage === "validate" ? 1 + Math.floor(r() * 2) : stage === "collect" ? Math.floor(r() * 2) : 1 + Math.floor(r() * 2),
    touches: weighted([[0, 70], [1, 25], [2, 5]] as const),
    age: `${Math.floor(r() * 40) + 2}h`,
    waitingOn: stage === "collect" ? pick(WAITING.filter(Boolean)) : r() < 0.25 ? pick(WAITING) : undefined,
  });
}

// ---- fleet --------------------------------------------------------------------------

const TASKS_BY_ROLE: Record<Role, string[]> = {
  analyst: ["Reading discovery call", "Re-reading context: new email", "Extracting requirements from 3 calls"],
  architect: ["Compiling owner checklist", "Generating MSA order form", "Configuring collections playbook", "Lease template + lien workflow"],
  builder: ["Building 3D twin from site plan", "Generating storefront", "Importing street rates"],
  migrator: ["SiteLink: rent roll export", "storEDGE: ledger history", "SiteLink: tenant documents", "Easy Storage: unit list", "Spreadsheet: tenant import", "Yardi Breeze: ledgers"],
  integrator: ["OpenTech: syncing codes", "PTI: mapping keypads", "Stripe: token transfer", "Carrier: after-hours forwarding", "Noke: lock assignments"],
  validator: ["Reconciling balances", "Gate code read-back", "Autopay $0 auth run", "Unit matrix check"],
};

export const FLEET: FleetVm[] = [];
const inflight = ONBOARDINGS.filter(o => !o.hero);
for (const o of inflight) {
  for (let k = 0; k < o.vms; k++) {
    const role: Role = o.stage === "migrate" ? pick(["migrator", "migrator", "integrator", "builder"] as Role[]) : o.stage === "validate" ? "validator" : o.stage === "plan" ? "architect" : o.stage === "context" ? "analyst" : pick(["builder", "integrator"] as Role[]);
    FLEET.push({
      id: `vm-${Math.floor(r() * 0xffff).toString(16).padStart(4, "0")}`,
      role,
      org: o.org,
      task: pick(TASKS_BY_ROLE[role]),
      cpu: Math.round(20 + r() * 75),
      tokens: Math.round(20000 + r() * 400000),
      uptime: `${Math.floor(r() * 50) + 2}m`,
      region: pick(["us-west-2", "us-east-1", "us-east-2"]),
      browser: role === "migrator",
    });
  }
}

export const LEGACY_SHARE = FROM.map(([name, w]) => ({ name, w }));
