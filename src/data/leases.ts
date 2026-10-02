import { UNITS, UNIT_BY_ID, SIZE_INFO, type Unit } from "./facility";
import { TENANTS, TENANT_BY_ID, OPERATOR, type Tenant } from "./tenants";
import { PLAN_NAME, PREMIUM, TODAY, addDays, billingDay, ledgerFor, rng, seedOf, clockMin } from "./ledger";
import { addComm } from "./comms";
import { commit } from "../state/store";

// Rental agreements. Every tenant has one active lease (route key = tenant id);
// pending leases are out for signature (route key = reservation id), ended leases
// belong to people who moved out recently.

export type LeaseStatus = "active" | "pending" | "ending" | "ended";

export interface AuditEvent { date: string; min: number; text: string; who: string; meta?: string }
export interface Addendum { id: string; title: string; date: string; status: "Signed" | "Delivered" | "Draft" | "Sent" | "Acknowledged"; note?: string }

export interface Lease {
  key: string; // route id
  number: string;
  tenantId?: string;
  name: string;
  first: string;
  email: string;
  phone: string;
  business?: string;
  unitId: string;
  status: LeaseStatus;
  start: string;
  end?: string;
  noticeDate?: string;
  rent: number;
  base: number;
  premium: number;
  protection: Tenant["protection"];
  plan: string;
  billingDay: number;
  autopay: boolean;
  card?: string;
  gateCode?: string;
  signed?: { date: string; min: number; ip: string; device: string; via: string };
  countersigned?: { date: string; min: number; who: string };
  sent?: { date: string; min: number; to: string };
  viewed?: { date: string; min: number; device: string };
  address: string;
  alt: { name: string; rel: string; phone: string; address: string };
  idDoc: string;
  addenda: Addendum[];
  audit: AuditEvent[];
  hash: string;
}

const STREETS = ["Pine St", "Kiva Rd", "Ski Run Blvd", "Lake Tahoe Blvd", "Pioneer Trail", "Emerald Bay Rd", "Tata Ln", "Glenwood Way", "Sierra Blvd", "Black Bart Ave", "Al Tahoe Blvd", "Keller Rd"];
const TOWNS = ["South Lake Tahoe, CA 96150", "Alder Lake, CA 96150", "Meyers, CA 96150", "Stateline, NV 89449", "Pollock Pines, CA 95726"];
const ALT_FIRST = ["Marcus", "Elena", "David", "Rosa", "James", "Anita", "Peter", "Lucia", "Sam", "Joan"];
const RELS = ["Brother", "Sister", "Partner", "Parent", "Friend", "Spouse"];
const DEVICES = ["iPhone · Safari", "Android · Chrome", "Mac · Safari", "Windows · Edge", "iPad · Safari", "Counter iPad · Zonera"];

const STORY_ALT: Record<string, Lease["alt"]> = {
  "Dana Whitfield": { name: "Marcus Whitfield", rel: "Brother", phone: "(530) 555-0119", address: "77 Kiva Rd, Meyers, CA 96150" },
  "Matthew Okafor": { name: "Adaeze Okafor", rel: "Sister", phone: "(530) 555-0108", address: "1190 Emerald Bay Rd, South Lake Tahoe, CA 96150" },
};
const STORY_ADDR: Record<string, string> = {
  "Dana Whitfield": "418 Pine St, Apt 3, South Lake Tahoe, CA 96150",
  "Matthew Okafor": "2741 Lake Tahoe Blvd, Apt 12, South Lake Tahoe, CA 96150",
  "Sofia Reyes": "3320 Sierra Blvd, Alder Lake, CA 96150",
};

/** Scheduled move-outs. Ben Carter gave notice on Sep 18. */
export const MOVE_OUTS = new Map<string, { date: string; notice: string; reason: string; by: string }>();
{
  const ben = TENANTS.find(t => t.name === "Ben Carter");
  if (ben) MOVE_OUTS.set(ben.id, { date: "2026-10-31", notice: "2026-09-18", reason: "Moving to Sacramento", by: "Tenant, by email" });
}

function ip(r: () => number) {
  return `${[73, 76, 98, 24, 67, 174][Math.floor(r() * 6)]}.${Math.floor(r() * 250)}.${Math.floor(r() * 250)}.${Math.floor(r() * 250)}`;
}
function hash(s: string) {
  let h = seedOf(s);
  let out = "";
  for (let i = 0; i < 8; i++) {
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
    out += (h & 0xff).toString(16).padStart(2, "0");
  }
  return out.slice(0, 8) + "…" + out.slice(-4);
}

const CACHE = new Map<string, Lease>();

function buildLease(t: Tenant): Lease {
  const r = rng(seedOf("lease" + t.id));
  const unitId = t.unitIds[0];
  const prem = PREMIUM[t.protection];
  const mi = t.moveIn;
  const startMin = 9 * 60 + 30 + Math.floor(r() * 360);
  const online = r() < 0.62 || ["Matthew Cho", "Sofia Reyes", "Grace Lindqvist"].includes(t.name);
  const device = online ? DEVICES[Math.floor(r() * 5)] : DEVICES[5];
  const sigIp = ip(r);
  const altFirst = ALT_FIRST[Math.floor(r() * ALT_FIRST.length)];
  const alt = STORY_ALT[t.name] ?? { name: `${altFirst} ${t.last}`, rel: RELS[Math.floor(r() * RELS.length)], phone: `(530) 555-0${100 + Math.floor(r() * 899)}`, address: `${100 + Math.floor(r() * 3800)} ${STREETS[Math.floor(r() * STREETS.length)]}, ${TOWNS[Math.floor(r() * TOWNS.length)]}` };
  const address = STORY_ADDR[t.name] ?? `${100 + Math.floor(r() * 3800)} ${STREETS[Math.floor(r() * STREETS.length)]}${r() < 0.3 ? `, Apt ${1 + Math.floor(r() * 30)}` : ""}, ${TOWNS[Math.floor(r() * TOWNS.length)]}`;
  const card = t.card ?? (t.name === "Matthew Okafor" ? "Visa •• 3310" : undefined);

  const addenda: Addendum[] = [];
  addenda.push(
    t.protection
      ? { id: "AD-1", title: `Tenant protection · ${PLAN_NAME[t.protection]}`, date: mi, status: "Signed", note: `$${t.protection.toLocaleString()} coverage · $${prem}/mo` }
      : { id: "AD-1", title: "Protection declined", date: mi, status: "Signed", note: "Occupant confirmed own insurance or none" },
  );
  if (t.autopay && card) addenda.push({ id: "AD-2", title: "Autopay authorization", date: mi, status: "Signed", note: card });
  if (t.business) addenda.push({ id: "AD-3", title: "Business use", date: mi, status: "Signed", note: t.business });
  if (UNIT_BY_ID.get(unitId)?.kind === "parking") addenda.push({ id: "AD-4", title: "Vehicle and watercraft disclosure", date: mi, status: "Signed", note: "Title and registration on file" });
  const audit: AuditEvent[] = [
    { date: mi, min: startMin - 14, text: online ? "Lease created from storefront checkout" : "Lease created at the counter", who: online ? "Storefront" : OPERATOR.name },
    { date: mi, min: startMin - 11, text: "ID verified", who: "Persona", meta: `CA driver license •• ${String(1000 + Math.floor(r() * 8999))}` },
    { date: mi, min: startMin - 9, text: "Sent for signature", who: "Zonera agent", meta: t.email },
    { date: mi, min: startMin - 6, text: "Opened by occupant", who: t.name, meta: `${device} · ${sigIp}` },
    { date: mi, min: startMin, text: "Signed by occupant", who: t.name, meta: `${device} · ${sigIp}` },
    { date: mi, min: startMin + 1, text: "Countersigned", who: online ? "Zonera agent · auto-countersign" : OPERATOR.name },
    { date: mi, min: startMin + 2, text: "Gate code issued", who: "Zonera agent", meta: unitId },
  ];
  for (const e of ledgerFor(t)) {
    if (e.kind === "info" && e.text === "Rent change notice sent") {
      addenda.push({ id: `AD-r${e.date}`, title: "Rent change notice", date: e.date, status: "Delivered", note: e.detail?.split(" · ")[0] });
      audit.push({ date: e.date, min: e.min, text: "Rent change notice delivered", who: "Zonera agent", meta: e.detail });
    }
    if (e.kind === "info" && e.text === "Unit overlocked") {
      addenda.push({ id: `AD-o${e.date}`, title: "Overlock notice", date: e.date, status: "Delivered", note: "Gate access suspended until paid" });
      audit.push({ date: e.date, min: e.min, text: "Overlock notice delivered", who: e.by ?? "Zonera agent", meta: "SMS and email" });
    }
  }
  if (t.name === "Sofia Reyes") {
    addenda.push({ id: "AD-t", title: "Transfer · C-108 → C-117", date: "2026-09-29", status: "Draft", note: "Prepared by the agent, pending Saturday's visit" });
    audit.push({ date: "2026-09-29", min: 14 * 60 + 21, text: "Transfer addendum drafted", who: "Zonera agent", meta: "C-117 · $189/mo" });
  }
  if (t.name === "Dana Whitfield") {
    addenda.push({ id: "AD-l", title: "Preliminary lien notice", date: "2026-10-01", status: "Draft", note: "Bus. & Prof. Code §21703 · waiting for approval" });
    audit.push({ date: "2026-10-01", min: 9 * 60 + 15, text: "Preliminary lien notice drafted", who: "Zonera agent", meta: "Certified mail + email to occupant and alternate contact" });
  }
  if (t.name === "Grace Lindqvist") audit.push({ date: "2026-09-23", min: 8 * 60, text: "Card update link sent", who: "Zonera agent", meta: "SMS and email" });

  return {
    key: t.id,
    number: `ZAL-${mi.slice(0, 4)}-${mi.slice(5, 7)}${mi.slice(8, 10)}-${unitId.replace("-", "")}`,
    tenantId: t.id,
    name: t.name,
    first: t.first,
    email: t.email,
    phone: t.phone,
    business: t.business,
    unitId,
    status: "active",
    start: mi,
    rent: t.rent,
    base: t.rent - prem,
    premium: prem,
    protection: t.protection,
    plan: PLAN_NAME[t.protection],
    billingDay: billingDay(t),
    autopay: t.autopay,
    card,
    gateCode: t.gateCode,
    signed: { date: mi, min: startMin, ip: sigIp, device, via: online ? "Online · e-sign" : "Office · counter iPad" },
    countersigned: { date: mi, min: startMin + 1, who: online ? "Zonera agent for Zonera Alder Lake" : `${OPERATOR.name}, ${OPERATOR.role}` },
    address,
    alt,
    idDoc: audit[1].meta!,
    addenda,
    audit,
    hash: hash(t.id + mi),
  };
}

/** The tenant's lease, reflecting live state (move-outs, autopay, rent). */
export function leaseFor(t: Tenant): Lease {
  let l = CACHE.get(t.id);
  if (!l) {
    l = buildLease(t);
    CACHE.set(t.id, l);
  }
  const mo = MOVE_OUTS.get(t.id);
  const live: Lease = { ...l, rent: t.rent, base: t.rent - PREMIUM[t.protection], autopay: t.autopay, card: t.card ?? l.card, unitId: t.unitIds[0] ?? l.unitId, addenda: [...l.addenda], audit: [...l.audit] };
  if (mo) {
    live.status = mo.date <= TODAY ? "ended" : "ending";
    live.end = mo.date;
    live.noticeDate = mo.notice;
    live.addenda.push({ id: "AD-mo", title: "Notice to vacate", date: mo.notice, status: "Acknowledged", note: `Move-out ${mo.date.slice(5).replace("-", "/")} · ${mo.reason}` });
    live.audit.push({ date: mo.notice, min: 21 * 60 + 5, text: "Notice to vacate received", who: mo.by, meta: `Move-out ${mo.date}` });
  }
  for (const a of EXTRA_AUDIT.get(t.id) ?? []) live.audit.push(a);
  live.audit.sort((a, b) => (a.date === b.date ? a.min - b.min : a.date < b.date ? -1 : 1));
  return live;
}

const EXTRA_AUDIT = new Map<string, AuditEvent[]>();
export function logLease(key: string, e: Omit<AuditEvent, "date" | "min">) {
  const list = EXTRA_AUDIT.get(key) ?? [];
  list.push({ ...e, date: TODAY, min: clockMin() });
  EXTRA_AUDIT.set(key, list);
}

export function scheduleMoveOut(t: Tenant, date: string, reason: string) {
  MOVE_OUTS.set(t.id, { date, notice: TODAY, reason, by: OPERATOR.name });
  addComm(t.id, { channel: "system", who: OPERATOR.name, body: `Move-out scheduled for ${date.slice(5).replace("-", "/")} · ${reason}` });
  commit({ kind: "moveout", text: `Move-out scheduled · ${t.unitIds[0]} ${t.name} · ${date.slice(5).replace("-", "/")}`, who: OPERATOR.name });
}

// ---- pending and ended ------------------------------------------------------------

function pickUnit(size: string, avoid: string[], kind?: Unit["kind"]) {
  return UNITS.find(u => u.size === size && u.status === "vacant" && !avoid.includes(u.id) && (!kind || u.kind === kind));
}

function pendingLease(o: { key: string; name: string; email: string; phone: string; unit?: Unit; protection: Tenant["protection"]; start: string; sent: { date: string; min: number }; viewed?: { date: string; min: number; device: string }; via: string }): Lease {
  const unit = o.unit ?? UNITS.find(u => u.status === "vacant")!;
  const prem = PREMIUM[o.protection];
  const rent = unit.rate + prem;
  const first = o.name.split(" ")[0];
  const audit: AuditEvent[] = [
    { date: o.sent.date, min: o.sent.min - 4, text: "Lease created", who: o.via },
    { date: o.sent.date, min: o.sent.min - 2, text: "ID verified", who: "Persona", meta: "CA driver license" },
    { date: o.sent.date, min: o.sent.min, text: "Sent for signature", who: "Zonera agent", meta: `${o.email} · SMS ${o.phone}` },
  ];
  if (o.viewed) audit.push({ date: o.viewed.date, min: o.viewed.min, text: "Opened by occupant", who: o.name, meta: o.viewed.device });
  return {
    key: o.key,
    number: `ZAL-${o.start.slice(0, 4)}-${o.start.slice(5, 7)}${o.start.slice(8, 10)}-${unit.id.replace("-", "")}`,
    name: o.name,
    first,
    email: o.email,
    phone: o.phone,
    unitId: unit.id,
    status: "pending",
    start: o.start,
    rent,
    base: unit.rate,
    premium: prem,
    protection: o.protection,
    plan: PLAN_NAME[o.protection],
    billingDay: +o.start.slice(8, 10),
    autopay: true,
    card: undefined,
    sent: { ...o.sent, to: o.email },
    viewed: o.viewed,
    address: "Collected at signing",
    alt: { name: "Collected at signing", rel: "", phone: "", address: "" },
    idDoc: "CA driver license",
    addenda: [
      { id: "AD-1", title: `Tenant protection · ${PLAN_NAME[o.protection]}`, date: o.sent.date, status: "Sent", note: `$${o.protection.toLocaleString()} coverage · $${prem}/mo` },
      { id: "AD-2", title: "Autopay authorization", date: o.sent.date, status: "Sent", note: "Card collected at signing" },
    ],
    audit,
    hash: hash(o.key),
  };
}

const jordanUnit = pickUnit("10x10", ["A-126", "C-117"], "drive-up");
const hanaUnit = pickUnit("5x10", ["C-117"], "climate") ?? pickUnit("5x10", []);

export const PENDING: Lease[] = [
  pendingLease({ key: "R-3107", name: "Jordan Lee", email: "jordan.lee@gmail.com", phone: "(530) 555-0136", unit: jordanUnit, protection: 2000, start: TODAY, sent: { date: TODAY, min: 9 * 60 + 20 }, via: OPERATOR.name }),
  pendingLease({ key: "R-3094", name: "Hana Sato", email: "hana.sato@icloud.com", phone: "(530) 555-0129", unit: hanaUnit, protection: 2000, start: "2026-10-05", sent: { date: "2026-09-29", min: 16 * 60 + 2 }, viewed: { date: "2026-09-30", min: 21 * 60 + 47, device: "iPhone · Safari" }, via: "Storefront reservation" }),
];

/** Leases that ended recently (units since re-listed). */
export const ENDED: Lease[] = (() => {
  const r = rng(991);
  const names = ["Chloe Park", "Andre Silva", "Naomi Reid", "Felix Bianchi", "Yara Haddad", "Hugo Larsen", "Talia Moreno", "Omar Castillo"];
  const vac = UNITS.filter(u => u.status === "vacant" && !["A-126", "C-117", jordanUnit?.id, hanaUnit?.id].includes(u.id));
  return names.map((name, i) => {
    const unit = vac[(i * 3) % vac.length];
    const end = addDays(TODAY, -(3 + i * 6 + Math.floor(r() * 4)));
    const start = addDays(end, -(120 + Math.floor(r() * 700)));
    const prot = ([0, 2000, 5000, 2000] as const)[i % 4];
    const l = pendingLease({ key: `X-${4200 + i}`, name, email: `${name.split(" ")[0].toLowerCase()}.${name.split(" ")[1].toLowerCase()}@gmail.com`, phone: `(530) 555-0${300 + i * 17}`, unit, protection: prot, start, sent: { date: start, min: 10 * 60 + i * 23 }, via: "Storefront" });
    const sigIp = ip(r);
    return {
      ...l,
      status: "ended" as const,
      end,
      rent: Math.round(unit.rate * 0.94) + PREMIUM[prot],
      signed: { date: start, min: 10 * 60 + i * 23 + 6, ip: sigIp, device: DEVICES[i % 5], via: "Online · e-sign" },
      countersigned: { date: start, min: 10 * 60 + i * 23 + 7, who: "Zonera agent for Zonera Alder Lake" },
      address: `${200 + i * 311} ${STREETS[i % STREETS.length]}, ${TOWNS[i % 3]}`,
      audit: [
        ...l.audit,
        { date: start, min: 10 * 60 + i * 23 + 6, text: "Signed by occupant", who: name, meta: sigIp },
        { date: addDays(end, -21), min: 14 * 60, text: "Notice to vacate received", who: name },
        { date: end, min: 15 * 60 + 30, text: "Move-out inspection passed", who: OPERATOR.name, meta: "Broom-clean · lock removed" },
        { date: end, min: 15 * 60 + 41, text: "Lease ended · unit re-listed", who: "Zonera agent", meta: `Final statement $0.00` },
      ],
      addenda: l.addenda.map(a => ({ ...a, status: "Signed" as const })),
    };
  });
})();

export function allLeases(): Lease[] {
  return [...PENDING.filter(p => !SIGNED_NOW.has(p.key)), ...TENANTS.map(leaseFor), ...ENDED];
}

export function leaseByKey(key: string): Lease | undefined {
  const t = TENANT_BY_ID.get(key);
  if (t) return leaseFor(t);
  return PENDING.find(p => p.key === key) ?? ENDED.find(p => p.key === key);
}

/** Pending leases that the occupant signed during the demo. */
export const SIGNED_NOW = new Set<string>();
export const REMINDED = new Map<string, number>();

export function remindSigner(l: Lease) {
  REMINDED.set(l.key, (REMINDED.get(l.key) ?? 0) + 1);
  l.audit.push({ date: TODAY, min: clockMin(), text: "Signature reminder sent", who: OPERATOR.name, meta: `SMS ${l.phone} · email` });
  commit({ kind: "lease", text: `Signature reminder sent to ${l.name} · ${l.unitId}`, who: OPERATOR.name });
}

export function sizeLabel(unitId: string) {
  const u = UNIT_BY_ID.get(unitId);
  if (!u) return "";
  return `${u.size.replace("x", "×")} ${u.kind === "climate" ? "climate" : u.kind === "parking" ? "parking" : "drive-up"}`;
}

export function sqft(unitId: string) {
  const u = UNIT_BY_ID.get(unitId);
  return u ? SIZE_INFO[u.size].sqft || u.w * u.d : 0;
}
