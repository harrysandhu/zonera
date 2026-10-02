import { UNITS, UNIT_BY_ID, type Unit } from "./facility";

export interface Tenant {
  id: string;
  first: string;
  last: string;
  name: string;
  email: string;
  phone: string;
  unitIds: string[];
  rent: number; // in-place monthly rent
  balance: number;
  daysLate: number;
  autopay: boolean;
  card?: string; // "Visa •• 4242"
  moveIn: string; // ISO date
  protection: 0 | 2000 | 5000 | 10000;
  lastContact?: string;
  notes?: string;
  gateCode: string;
  business?: string;
}

const FIRST = ["Ava", "Liam", "Noah", "Emma", "Olivia", "Elijah", "Mateo", "Isabella", "Lucas", "Mia", "Amelia", "Ethan", "Harper", "Aiden", "Camila", "Logan", "Aria", "Kai", "Luna", "Ezra", "Nora", "Leo", "Zoe", "Hana", "Arjun", "Priya", "Diego", "Valentina", "Theo", "Ines", "Omar", "Leila", "Ravi", "Mei", "Tomás", "Grace", "Samuel", "Yara", "Felix", "Chloe", "Andre", "Naomi", "Jun", "Rosa", "Malik", "Sienna", "Owen", "Imani", "Nikhil", "Freya", "Hugo", "Keiko", "Marcus", "Elena", "Kofi", "Lena", "Rafael", "Sara", "Wes", "Talia"];
const LAST = ["Nguyen", "Garcia", "Patel", "Kim", "Johnson", "Martinez", "Brown", "Rossi", "Silva", "Chen", "Haddad", "Novak", "Okoye", "Larsen", "Moreno", "Walsh", "Tanaka", "Singh", "Cohen", "Ibrahim", "Fischer", "Lopez", "Murphy", "Sato", "Kowalski", "Mensah", "Duarte", "Bianchi", "Park", "Reid", "Alvarez", "Hughes", "Varga", "Costa", "Abbott", "Yamada", "Ortiz", "Lindqvist", "Banerjee", "Ferreira", "Quinn", "Dubois", "Ward", "Iyer", "Castillo", "Byrne", "Holm", "Achebe", "Romero", "Shah"];
const CARDS = ["Visa •• 4242", "Visa •• 1881", "Mastercard •• 5454", "Amex •• 1005", "Visa •• 0077", "Mastercard •• 2210", "Discover •• 6011"];

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

const r = rng(42);
const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
const pad = (n: number, l = 4) => String(n).padStart(l, "0");

function phone() {
  return `(530) 555-${pad(Math.floor(r() * 9000) + 1000)}`;
}

function dateMonthsAgo(m: number) {
  const d = new Date(2026, 9, 2);
  d.setMonth(d.getMonth() - m);
  d.setDate(1 + Math.floor(r() * 27));
  return d.toISOString().slice(0, 10);
}

// The cast. These tenants appear by name in the agent scenarios.
const STORY: Omit<Tenant, "id" | "name" | "email" | "gateCode">[] = [
  { first: "Matthew", last: "Okafor", phone: "(530) 555-0187", unitIds: ["A-122"], rent: 195, balance: 240, daysLate: 18, autopay: false, moveIn: "2024-03-14", protection: 2000, lastContact: "Sep 24 · SMS reminder", notes: "Pays cash at the office. Card on file expired in August." },
  { first: "Matthew", last: "Alvarez", phone: "(530) 555-0133", unitIds: ["B-122"], rent: 249, balance: 0, daysLate: 0, autopay: true, card: "Visa •• 4242", moveIn: "2025-06-02", protection: 5000 },
  { first: "Matthew", last: "Cho", phone: "(530) 555-0190", unitIds: ["D-207"], rent: 129, balance: 0, daysLate: 0, autopay: true, card: "Amex •• 1005", moveIn: "2026-01-19", protection: 2000 },
  { first: "Sofia", last: "Reyes", phone: "(530) 555-0121", unitIds: ["C-108"], rent: 104, balance: 0, daysLate: 0, autopay: true, card: "Mastercard •• 5454", moveIn: "2025-11-08", protection: 2000, notes: "Asked about a bigger unit on Sep 29." },
  { first: "Dana", last: "Whitfield", phone: "(530) 555-0166", unitIds: ["A-131"], rent: 179, balance: 448, daysLate: 47, autopay: false, moveIn: "2023-08-21", protection: 0, lastContact: "Sep 30 · Call, no answer", notes: "Three reminders sent. Mail returned once." },
  { first: "Ben", last: "Carter", phone: "(530) 555-0158", unitIds: ["B-141"], rent: 239, balance: 0, daysLate: 0, autopay: true, card: "Visa •• 1881", moveIn: "2025-02-11", protection: 5000, notes: "Prepaid through Oct 31." },
  { first: "Grace", last: "Lindqvist", phone: "(530) 555-0172", unitIds: ["D-118"], rent: 219, balance: 219, daysLate: 9, autopay: true, card: "Visa •• 0077", moveIn: "2024-10-30", protection: 2000, notes: "Autopay declined Sep 23 — card expired." },
];

export const TENANTS: Tenant[] = [];

for (const s of STORY) {
  const id = `T-${pad(1000 + TENANTS.length)}`;
  TENANTS.push({
    ...s,
    id,
    name: `${s.first} ${s.last}`,
    email: `${s.first.toLowerCase()}.${s.last.toLowerCase()}@${pick(["gmail.com", "icloud.com", "outlook.com", "proton.me"])}`,
    gateCode: pad(1000 + Math.floor(r() * 8999)),
  });
}

const storyUnits = new Set(STORY.flatMap(s => s.unitIds));

for (const u of UNITS) {
  if (storyUnits.has(u.id)) continue;
  if (u.status === "vacant" || u.status === "maintenance") continue;
  const first = pick(FIRST);
  const last = pick(LAST);
  const months = Math.floor(r() * 40) + 1;
  // Long-tenured tenants sit below today's street rate — that gap is what rate reviews close.
  const discount = months > 12 ? 0.78 + r() * 0.14 : 0.92 + r() * 0.08;
  const rent = Math.round((u.rate * discount) / 1) ;
  const late = u.status === "delinquent" || u.status === "overlocked";
  const daysLate = late ? (u.status === "overlocked" ? 31 + Math.floor(r() * 30) : 4 + Math.floor(r() * 24)) : 0;
  const business = r() < 0.08 ? pick(["Sierra Trail Outfitters", "Lakeside Pottery", "Basin Bikes", "Pine & Pour Catering", "Ridgeline Realty"]) : undefined;
  TENANTS.push({
    id: `T-${pad(1000 + TENANTS.length)}`,
    first,
    last,
    name: `${first} ${last}`,
    email: `${first.toLowerCase()}.${last.toLowerCase()}@${pick(["gmail.com", "icloud.com", "outlook.com", "yahoo.com", "proton.me"])}`,
    phone: phone(),
    unitIds: [u.id],
    rent,
    balance: late ? rent + (daysLate > 5 ? 45 : 0) + (daysLate > 30 ? rent : 0) : 0,
    daysLate,
    autopay: late ? r() < 0.4 : r() < 0.72,
    card: pick(CARDS),
    moveIn: dateMonthsAgo(months),
    protection: pick([0, 2000, 2000, 5000, 5000, 10000] as const),
    lastContact: late ? pick(["Sep 26 · SMS reminder", "Sep 28 · Email", "Sep 30 · Call, voicemail", "Sep 22 · SMS reminder"]) : undefined,
    gateCode: pad(1000 + Math.floor(r() * 8999)),
    business,
  });
}

for (const t of TENANTS) for (const id of t.unitIds) {
  const u = UNIT_BY_ID.get(id);
  if (u) u.tenantId = t.id;
}

export const TENANT_BY_ID = new Map(TENANTS.map(t => [t.id, t]));

export function tenantForUnit(u: Unit | string): Tenant | undefined {
  const unit = typeof u === "string" ? UNIT_BY_ID.get(u) : u;
  return unit?.tenantId ? TENANT_BY_ID.get(unit.tenantId) : undefined;
}

export function findTenants(q: string): Tenant[] {
  const s = q.trim().toLowerCase();
  return TENANTS.filter(t => t.name.toLowerCase().includes(s) || t.unitIds.some(u => u.toLowerCase() === s));
}

export const DELINQUENT = TENANTS.filter(t => t.daysLate > 0).sort((a, b) => b.daysLate - a.daysLate);

export function tenureMonths(t: Tenant) {
  const [y, m] = t.moveIn.split("-").map(Number);
  return (2026 - y) * 12 + (10 - m);
}

// ---- Money, months, activity -----------------------------------------------

export const MONTHLY = [
  { m: "Oct", y: 2025, revenue: 71840, occupancy: 0.861, moveIns: 29, moveOuts: 24 },
  { m: "Nov", y: 2025, revenue: 72310, occupancy: 0.858, moveIns: 22, moveOuts: 25 },
  { m: "Dec", y: 2025, revenue: 72950, occupancy: 0.852, moveIns: 18, moveOuts: 22 },
  { m: "Jan", y: 2026, revenue: 73480, occupancy: 0.849, moveIns: 24, moveOuts: 23 },
  { m: "Feb", y: 2026, revenue: 74120, occupancy: 0.856, moveIns: 27, moveOuts: 20 },
  { m: "Mar", y: 2026, revenue: 75660, occupancy: 0.868, moveIns: 33, moveOuts: 21 },
  { m: "Apr", y: 2026, revenue: 77210, occupancy: 0.879, moveIns: 35, moveOuts: 23 },
  { m: "May", y: 2026, revenue: 79040, occupancy: 0.891, moveIns: 41, moveOuts: 26 },
  { m: "Jun", y: 2026, revenue: 80980, occupancy: 0.902, moveIns: 44, moveOuts: 30 },
  { m: "Jul", y: 2026, revenue: 82150, occupancy: 0.909, moveIns: 39, moveOuts: 33 },
  { m: "Aug", y: 2026, revenue: 83020, occupancy: 0.911, moveIns: 36, moveOuts: 34 },
  { m: "Sep", y: 2026, revenue: 84210, occupancy: 0.906, moveIns: 31, moveOuts: 29 },
];

export const SEPT_LAST_YEAR = { revenue: 70420, occupancy: 0.853, moveIns: 26, moveOuts: 27, delinquency: 0.061 };

export interface FeedItem { t: string; kind: "gate" | "payment" | "agent" | "movein" | "alert" | "lead"; text: string; who?: string }

export const FEED: FeedItem[] = [
  { t: "9:42", kind: "movein", text: "Maya Chen rented A-126 online — lease signed, gate code issued", who: "Storefront" },
  { t: "9:38", kind: "agent", text: "Sent autopay-failure texts to 5 tenants; 2 already updated their card", who: "Zonera agent" },
  { t: "9:31", kind: "gate", text: "Gate 1 · B-122 Matthew Alvarez · entry" },
  { t: "9:17", kind: "payment", text: "$249.00 autopay · B-122 Matthew Alvarez" },
  { t: "9:04", kind: "lead", text: "New web reservation · 10×20 · Owen Murphy, moving Oct 12" },
  { t: "8:52", kind: "alert", text: "Gate 2 exit sensor reported offline — work order opened" },
  { t: "8:30", kind: "gate", text: "Gate 1 · D-207 Matthew Cho · entry" },
  { t: "8:02", kind: "agent", text: "Overnight: no after-hours gate attempts. Climate in Building D held 62–64°F" },
];

export const LEADS = [
  { name: "Owen Murphy", size: "10x20", source: "Web reservation", moving: "Oct 12", reserved: "Oct 2", phone: "(530) 555-0114", note: "Moving from Reno, has a truck rental" },
  { name: "Hana Sato", size: "5x10", source: "Web reservation", moving: "Oct 5", reserved: "Sep 29", phone: "(530) 555-0129", note: "Student, needs it through May" },
  { name: "Rafael Costa", size: "10x30", source: "Phone call", moving: "Oct 20", reserved: "Sep 30", phone: "(530) 555-0102", note: "Restaurant equipment, asked about insurance" },
  { name: "Leila Haddad", size: "10x10", source: "Web reservation", moving: "This week", reserved: "Sep 28", phone: "(530) 555-0175", note: "Abandoned at payment step" },
  { name: "Wes Abbott", size: "12x40", source: "Google Business", moving: "Nov 1", reserved: "Sep 27", phone: "(530) 555-0168", note: "26′ boat on a trailer" },
  { name: "Imani Mensah", size: "10x15", source: "Web reservation", moving: "Oct 8", reserved: "Sep 30", phone: "(530) 555-0149", note: "Asked if units are drive-up" },
];

export const OPERATOR = { name: "Priya Raman", role: "Facility manager", initials: "PR" };
