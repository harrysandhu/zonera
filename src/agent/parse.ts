import { BUILDINGS, SIZE_INFO, UNIT_BY_ID, UNITS, type UnitSize } from "../data/facility";
import { LEADS, TENANTS, type Tenant } from "../data/tenants";
import { RESERVATIONS, TODAY_ISO, isoAdd } from "./data";

// Rule-based slot parser. Turns a free-text ask into typed slots that skills
// read: people (tenants and leads, with first-name ambiguity kept), units,
// sizes, money, payment method, channel, counts, dates, time windows,
// buildings, percentages, segments ("everyone past due", "10×20 tenants"),
// a message template and its purpose. Nothing here is a model; it is
// deterministic so the demo plays the same way every time.

export interface PersonRef {
  kind: "tenant" | "lead";
  id: string; // tenant id or lead name
  name: string;
  first: string;
  phone: string;
  email: string;
  unit?: string;
  tenant?: Tenant;
}

export interface Ambiguous {
  said: string; // "Matthew"
  candidates: PersonRef[];
}

export type Channel = "sms" | "email" | "call";
export type Method = "cash" | "card" | "check";
export type Template = "reminder" | "promo" | "notice" | "welcome" | "followup" | "custom";

export interface Parsed {
  text: string;
  lower: string;
  files: string[];
  people: PersonRef[]; // resolved uniquely (full name, last name, unique first name)
  ambiguous: Ambiguous[]; // first names that match several people
  newNames: string[]; // capitalised full names that aren't in the data ("Jordan Lee")
  units: string[];
  sizes: UnitSize[];
  amounts: number[];
  method?: Method;
  channel?: Channel;
  count?: number;
  countNoun?: string;
  dates: string[]; // ISO
  window?: { from: string; to: string }; // "13:00" – "17:00"
  time?: string; // single time "15:30"
  buildings: string[];
  percent?: number;
  days?: number; // "more than 15 days"
  segment?: Segment;
  template?: Template;
  purpose?: string; // "about the gate closure on Monday"
}

// ---------------------------------------------------------------- people index

export function personFromTenant(t: Tenant): PersonRef {
  return { kind: "tenant", id: t.id, name: t.name, first: t.first, phone: t.phone, email: t.email, unit: t.unitIds[0], tenant: t };
}
export function personFromLead(l: (typeof LEADS)[number]): PersonRef {
  const r = RESERVATIONS[l.name];
  return { kind: "lead", id: l.name, name: l.name, first: l.name.split(" ")[0], phone: l.phone, email: r?.email ?? `${l.name.toLowerCase().replace(/\s+/g, ".")}@gmail.com`, unit: r?.unit };
}

function everyone(): PersonRef[] {
  return [...TENANTS.map(personFromTenant), ...LEADS.map(personFromLead)];
}

// ---------------------------------------------------------------- segments

export interface Segment {
  id: string;
  label: string; // "Everyone past due"
  noun: string; // "past-due tenants"
  resolve: () => PersonRef[];
}

type SegmentRule = { test: (lower: string, q: Parsed) => boolean; make: (lower: string, q: Parsed) => Segment };

export const SEGMENT_RULES: SegmentRule[] = [];

/** Add a segment rule. Earlier rules win. */
export function registerSegment(rule: SegmentRule) {
  SEGMENT_RULES.push(rule);
}

export const SEGMENTS = {
  pastDue: (min = 1): Segment => ({
    id: min > 1 ? `late-${min}` : "past-due",
    label: min > 1 ? `More than ${min - 1} days late` : "Everyone past due",
    noun: min > 1 ? `tenants more than ${min - 1} days late` : "past-due tenants",
    resolve: () => TENANTS.filter(t => t.daysLate >= min && t.balance > 0).sort((a, b) => b.daysLate - a.daysLate).map(personFromTenant),
  }),
  autopayFailed: (): Segment => ({ id: "autopay-failed", label: "Autopay failures", noun: "tenants whose autopay failed", resolve: () => TENANTS.filter(t => t.autopay && t.daysLate > 0 && t.balance > 0).map(personFromTenant) }),
  leads: (): Segment => ({ id: "leads", label: "This week's reservations", noun: "open reservations", resolve: () => LEADS.map(personFromLead) }),
  size: (size: UnitSize): Segment => ({
    id: "size-" + size,
    label: `${size.replace("x", "×")} tenants`,
    noun: `${size.replace("x", "×")} tenants`,
    resolve: () => TENANTS.filter(t => t.unitIds.some(u => UNIT_BY_ID.get(u)?.size === size)).map(personFromTenant),
  }),
  building: (b: string): Segment => ({
    id: "bldg-" + b,
    label: `Building ${b} tenants`,
    noun: `tenants in Building ${b}`,
    resolve: () => TENANTS.filter(t => t.unitIds.some(u => UNIT_BY_ID.get(u)?.building === b)).map(personFromTenant),
  }),
  longTerm: (): Segment => ({
    id: "long-term",
    label: "Tenants 12+ months",
    noun: "tenants here a year or more",
    resolve: () => TENANTS.filter(t => monthsSince(t.moveIn) >= 12).map(personFromTenant),
  }),
  all: (): Segment => ({ id: "all", label: "All tenants", noun: "tenants", resolve: () => TENANTS.map(personFromTenant) }),
};

export function monthsSince(iso: string) {
  const [y, m] = iso.split("-").map(Number);
  return (2026 - y) * 12 + (10 - m);
}

registerSegment({ test: l => /autopay (fail|declin)|failed autopay|declined (cards?|autopay)/.test(l), make: () => SEGMENTS.autopayFailed() });
registerSegment({ test: (l, q) => q.days !== undefined && /late|past due|behind|overdue/.test(l), make: (_l, q) => SEGMENTS.pastDue(q.days! + 1) });
registerSegment({ test: l => /(everyone|all|tenants?|people|anyone|whoever)\b.{0,24}\b(past[- ]due|late|behind|overdue|delinquen|owe)/.test(l) || /\b(past[- ]due|late|delinquent|overdue) (tenants|people|accounts|folks)/.test(l), make: () => SEGMENTS.pastDue() });
registerSegment({ test: l => /\b(leads?|reservations?|prospects?)\b/.test(l) && !/\bmove\b.*\bin\b/.test(l), make: () => SEGMENTS.leads() });
registerSegment({ test: (l, q) => q.sizes.length > 0 && /(tenants|renters|customers|everyone|people)/.test(l), make: (_l, q) => SEGMENTS.size(q.sizes[0]) });
registerSegment({ test: (l, q) => q.buildings.length > 0 && /(tenants|renters|customers|everyone|people)/.test(l), make: (_l, q) => SEGMENTS.building(q.buildings[0]) });
registerSegment({ test: l => /(long[- ]?term|loyal|a year or more|12\+? months|over a year)/.test(l), make: () => SEGMENTS.longTerm() });
registerSegment({ test: l => /\b(all|every|everyone)\b.{0,10}\b(tenants?|renters?|customers?)\b|\beveryone\b/.test(l), make: () => SEGMENTS.all() });

// ---------------------------------------------------------------- small parsers

const WORD_NUM: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30 };
const num = (s: string) => (WORD_NUM[s.toLowerCase()] ?? Number(s.replace(/,/g, "")));

const SIZES = Object.keys(SIZE_INFO) as UnitSize[];
function parseSizes(l: string): UnitSize[] {
  const out: UnitSize[] = [];
  const re = /\b(\d{1,2}|five|ten|twelve|fifteen|twenty|thirty|forty)\s*(?:x|×|by|')\s*(\d{1,2}|five|ten|fifteen|twenty|thirty|forty)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(l))) {
    const a = num(m[1]) || ({ forty: 40 } as Record<string, number>)[m[1]];
    const b = num(m[2]) || ({ forty: 40 } as Record<string, number>)[m[2]];
    const k = `${a}x${b}` as UnitSize;
    const k2 = `${b}x${a}` as UnitSize;
    if (SIZES.includes(k)) out.push(k);
    else if (SIZES.includes(k2)) out.push(k2);
  }
  return [...new Set(out)];
}

function parseAmounts(t: string): number[] {
  const out: number[] = [];
  const re = /\$\s?(\d[\d,]*(?:\.\d{1,2})?)|\b(\d[\d,]*(?:\.\d{1,2})?)\s*(?:dollars|bucks|usd)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) out.push(Number((m[1] ?? m[2]).replace(/,/g, "")));
  if (!out.length) {
    // Bare amounts after a money verb: "a check for 195", "paid 240".
    const bare = /\b(?:for|of|paid|pays|paying|pay|charge|charged|refund|refunded)\s+(\d{2,5}(?:\.\d{2})?)\b(?!\s*(?:days?|%|am|pm|x|×|units?|ft))/gi;
    while ((m = bare.exec(t))) out.push(Number(m[1]));
  }
  return out;
}

function to24(h: number, min: number, ap?: string) {
  let hh = h % 12;
  if (ap === "pm") hh += 12;
  if (!ap && h === 12) hh = 12;
  return `${String(hh).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function parseWindow(l: string) {
  const m = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|–|—|to|until|till)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/.exec(l);
  if (!m) return undefined;
  const ap2 = m[6];
  let ap1 = m[3];
  const h1 = +m[1];
  const h2 = +m[4];
  if (!ap1) ap1 = ap2 === "pm" && h1 > h2 && h1 !== 12 ? "am" : ap2;
  return { from: to24(h1, +(m[2] ?? 0), ap1), to: to24(h2, +(m[5] ?? 0), ap2) };
}

function parseTime(l: string) {
  const m = /\b(?:at|by|around)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/.exec(l) ?? /\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/.exec(l);
  if (!m) return undefined;
  return to24(+m[1], +(m[2] ?? 0), m[3]);
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function parseDates(l: string): string[] {
  const out: string[] = [];
  if (/\btoday|tonight|this (morning|afternoon|evening)\b/.test(l)) out.push(TODAY_ISO);
  if (/\btomorrow\b/.test(l)) out.push(isoAdd(TODAY_ISO, 1));
  if (/\byesterday|last night|overnight\b/.test(l)) out.push(isoAdd(TODAY_ISO, -1));
  if (/\bnext week\b/.test(l)) out.push(isoAdd(TODAY_ISO, 3));
  // Weekdays: the demo day is Friday. "Friday" means today; others mean the next one.
  DAYS.forEach((d, i) => {
    if (new RegExp(`\\b${d}\\b`).test(l)) {
      const diff = (i - 5 + 7) % 7;
      out.push(isoAdd(TODAY_ISO, diff));
    }
  });
  const re = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(l))) {
    const mi = MONTHS.indexOf(m[1].slice(0, 3));
    const y = mi < 6 ? 2027 : 2026;
    out.push(`${y}-${String(mi + 1).padStart(2, "0")}-${String(+m[2]).padStart(2, "0")}`);
  }
  return [...new Set(out)];
}

const CAP_STOP = new Set(["I", "The", "A", "An", "And", "Or", "But", "Make", "Move", "Call", "Text", "Email", "Send", "Run", "Generate", "Who", "What", "When", "Where", "How", "Why", "Can", "Could", "Please", "Lock", "Start", "Set", "Build", "Fix", "Refund", "Follow", "Give", "Show", "Find", "Take", "Put", "Let", "Clear", "Schedule", "Book", "Building", "Gate", "Unit", "October", "September", "November", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "HVAC", "SMS", "ID", "Zonera", "Alder", "Lake", "California", "Matthew's", "Priya"]);

function parsePeople(text: string, lower: string) {
  const all = everyone();
  const people: PersonRef[] = [];
  const consumed: [number, number][] = [];
  const taken = (i: number) => consumed.some(([a, b]) => i >= a && i < b);

  // Full names first.
  for (const p of all) {
    const i = lower.indexOf(p.name.toLowerCase());
    if (i >= 0 && !people.some(x => x.id === p.id)) {
      people.push(p);
      consumed.push([i, i + p.name.length]);
    }
  }

  // Then single words that are first or last names.
  const ambiguous: Ambiguous[] = [];
  const lowerOnly = text === lower;
  const re = /[A-Za-zÀ-ÿ'’-]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const w = m[0].replace(/['’]s$/, "");
    if (taken(m.index)) continue;
    if (!lowerOnly && !/^[A-ZÀ-Ý]/.test(w)) continue;
    if (CAP_STOP.has(w)) continue;
    const lw = w.toLowerCase();
    const byLast = all.filter(p => p.name.split(" ").slice(1).join(" ").toLowerCase() === lw);
    const byFirst = all.filter(p => p.first.toLowerCase() === lw);
    const hits = byLast.length ? byLast : byFirst;
    if (!hits.length) continue;
    consumed.push([m.index, m.index + m[0].length]);
    if (hits.length === 1) {
      if (!people.some(x => x.id === hits[0].id)) people.push(hits[0]);
    } else if (!ambiguous.some(a => a.said === w)) ambiguous.push({ said: w, candidates: hits });
  }

  // Capitalised two-word names we don't know (a walk-in, a vendor).
  const newNames: string[] = [];
  const re2 = /\b([A-Z][a-z]+)\s+([A-Z][a-z]+)\b/g;
  while ((m = re2.exec(text))) {
    if (taken(m.index) || CAP_STOP.has(m[1]) || CAP_STOP.has(m[2])) continue;
    const n = `${m[1]} ${m[2]}`;
    if (!all.some(p => p.name === n)) newNames.push(n);
  }
  return { people, ambiguous, newNames };
}

function parseTemplate(l: string): Template | undefined {
  if (/\b(remind|reminder|past due|late|balance|overdue|pay(ment)? link)\b/.test(l)) return "reminder";
  if (/\b(promo|promotion|offer|discount|deal|special|\$1 first month|coupon)\b/.test(l)) return "promo";
  if (/\b(notice|closure|closed|closing|maintenance|holiday|gate (will|is)|outage|repav|paving)\b/.test(l)) return "notice";
  if (/\b(welcome|thank)\b/.test(l)) return "welcome";
  if (/\b(follow ?up|check in|nudge)\b/.test(l)) return "followup";
  return undefined;
}

function parsePurpose(text: string) {
  const m = /\b(?:about|saying|that says|telling them|to let them know|letting them know|re:)\s+(.+)$/i.exec(text);
  return m ? m[1].replace(/[.?!]+$/, "").trim() : undefined;
}

// ---------------------------------------------------------------- main

export function parse(text: string, files: string[] = []): Parsed {
  const lower = text.toLowerCase().replace(/[“”]/g, '"').replace(/’/g, "'");
  const { people, ambiguous, newNames } = parsePeople(text, lower);
  const units = [...new Set((lower.match(/\b[a-dp]-?\d{1,3}\b/g) ?? []).map(s => s.toUpperCase().replace(/^([A-DP])-?/, "$1-")).filter(id => UNIT_BY_ID.has(id)))];
  const buildings = [...new Set([...(lower.match(/\bbuilding\s+([a-d])\b/g) ?? []).map(s => s.slice(-1).toUpperCase()), ...(/\bclimate (building|controlled)\b/.test(lower) ? ["D"] : [])])];
  const cm = /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(emails?|e-mails?|texts?|sms|messages?|reservations?|tenants?|people|customers?|units?|calls?|notices?|leads?|cards?)\b/.exec(lower);
  const dm = /\b(?:more than|over|at least|past|\+)\s*(\d+)\s*days?\b|\b(\d+)\+\s*days?\b/.exec(lower);
  const pm = /(\d+(?:\.\d+)?)\s*(%|percent)/.exec(lower);
  const q: Parsed = {
    text,
    lower,
    files,
    people,
    ambiguous,
    newNames,
    units,
    sizes: parseSizes(lower),
    amounts: parseAmounts(text),
    method: /\bcash\b/.test(lower) ? "cash" : /\b(check|cheque)\b/.test(lower) ? "check" : /\b(card|visa|mastercard|amex|credit|debit)\b/.test(lower) ? "card" : undefined,
    channel: /\be-?mails?\b/.test(lower) ? "email" : /\b(texts?|sms|message)\b/.test(lower) ? "sms" : /\b(call|phone|ring|dial)\b/.test(lower) ? "call" : undefined,
    count: cm ? num(cm[1]) : undefined,
    countNoun: cm ? cm[2] : undefined,
    dates: parseDates(lower),
    window: parseWindow(lower),
    time: parseTime(lower),
    buildings,
    percent: pm ? Number(pm[1]) : undefined,
    days: dm ? Number(dm[1] ?? dm[2]) : undefined,
    template: parseTemplate(lower),
    purpose: parsePurpose(text),
  };
  const rule = SEGMENT_RULES.find(r => r.test(lower, q));
  if (rule) q.segment = rule.make(lower, q);
  return q;
}

// ---------------------------------------------------------------- scoring helpers for skills

/** Sum the weights of every pattern that matches. */
export function kw(q: Parsed, pats: [RegExp, number][]) {
  return pats.reduce((s, [re, w]) => s + (re.test(q.lower) ? w : 0), 0);
}

export const allUnitsOf = (size: UnitSize) => UNITS.filter(u => u.size === size);
export const buildingName = (id: string) => BUILDINGS.find(b => b.id === id)?.name ?? `Building ${id}`;
