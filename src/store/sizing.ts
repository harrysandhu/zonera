import { ITEMS, PRESETS, recommend, volumeOf } from "../data/catalog";
import type { UnitSize } from "../data/facility";

// Turns "a one-bedroom and two bikes" into item counts, and counts into a size.

const NUM: Record<string, number> = { a: 1, an: 1, one: 1, single: 1, pair: 2, couple: 2, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, few: 3, some: 4, several: 5, dozen: 12 };

const PRESET_WORDS: [RegExp, string][] = [
  [/\b(studio|dorm|between leases)\b/, "studio"],
  [/\b(one|1)[ -]?(bed(room)?|br)\b|\bapartment\b|\bflat\b/, "one-bed"],
  [/\b(two|three|four|2|3|4)[ -]?(bed(room)?|br)\b|\bhouse\b|\bhome\b|\brenovat/, "house"],
  [/\b(business|inventory|stock|office|shop|store front|merch)\b/, "business"],
  [/\b(seasonal|winter|summer)\b/, "seasonal"],
];

const ITEM_WORDS: [RegExp, string][] = [
  [/bikes?|bicycles?/, "bike"],
  [/kayaks?|paddle ?boards?|sups?|canoes?/, "kayak"],
  [/skis?|snowboards?/, "skis"],
  [/grills?|bbqs?|barbecues?/, "grill"],
  [/patio( set| furniture)?/, "patio"],
  [/tires?|tyres?/, "tires"],
  [/king( size)?( beds?)?/, "bed-k"],
  [/(queen )?beds?|mattress(es)?/, "bed-q"],
  [/dressers?/, "dresser"],
  [/nightstands?|bedside tables?/, "night"],
  [/sofas?|couch(es)?|sectionals?/, "sofa"],
  [/arm ?chairs?|recliners?/, "chair"],
  [/tvs?|televisions?/, "tv"],
  [/book ?(shel(f|ves)|cases?)|shel(f|ves)/, "shelf"],
  [/rugs?/, "rug"],
  [/dining tables?|tables?/, "table"],
  [/dining chairs?|chairs?/, "chairs"],
  [/fridges?|refrigerators?/, "fridge"],
  [/washers?|dryers?/, "washer"],
  [/desks?/, "desk"],
  [/totes?|bins?/, "tote"],
  [/large boxes|big boxes/, "box-l"],
  [/small boxes/, "box-s"],
  [/boxes|box/, "box-m"],
];

export interface Parsed {
  preset: string | null;
  sel: Record<string, number>;
  matched: string[]; // human-readable pieces we understood
}

export function parseStuff(text: string): Parsed | null {
  let s = " " + text.toLowerCase().replace(/[,.;!?]/g, " ").replace(/\s+/g, " ") + " ";
  let preset: string | null = null;
  for (const [re, id] of PRESET_WORDS) {
    if (re.test(s)) {
      preset = id;
      s = s.replace(re, " ");
      break;
    }
  }
  const sel: Record<string, number> = preset ? { ...PRESETS.find(p => p.id === preset)!.items } : {};
  const matched: string[] = preset ? [PRESETS.find(p => p.id === preset)!.label] : [];
  for (const [re, id] of ITEM_WORDS) {
    const m = new RegExp(`(?:\\b(\\d+|${Object.keys(NUM).join("|")})\\s+(?:(?:big|small|large|old|kids?'?|of|my)\\s+)*)?\\b(?:${re.source})\\b`).exec(s);
    if (!m) continue;
    const plural = /s\b/.test(m[0].trim()) && !/(boxes|totes)$/.test(m[0].trim()) ? 2 : 1;
    const n = m[1] ? (/^\d+$/.test(m[1]) ? Number(m[1]) : NUM[m[1]]) : id.startsWith("box") || id === "tote" ? 10 : plural;
    sel[id] = n;
    s = s.slice(0, m.index) + " " + s.slice(m.index + m[0].length);
    const item = ITEMS.find(i => i.id === id)!;
    matched.push(`${n} ${item.label[0].toLowerCase()}${item.label.slice(1)}`);
  }
  if (!matched.length) return null;
  return { preset, sel, matched };
}

const ORDER: UnitSize[] = ["5x5", "5x10", "10x10", "10x15", "10x20", "10x30"];
const CAP: Record<string, number> = { "5x5": 200, "5x10": 400, "10x10": 800, "10x15": 1200, "10x20": 1600, "10x30": 2400 };

export interface Rec {
  size: UnitSize;
  fill: number;
  cubic: number;
  packed: number;
  reason: string | null;
}

/** The catalog's recommendation, plus two practical rules: leave headroom, and long things need a 10-foot unit. */
export function recommendFor(sel: Record<string, number>): Rec {
  const base = recommend(sel);
  let i = ORDER.indexOf(base.size);
  let reason: string | null = null;
  if ((sel.kayak ?? 0) > 0 && i < 1) {
    i = 1;
    reason = "A kayak needs 10 feet of depth";
  }
  if (base.cubic / CAP[ORDER[i]] > 0.88 && i < ORDER.length - 1) {
    i++;
    reason = reason ?? "Sized up so you can still reach the back";
  }
  const size = ORDER[i];
  return { size, fill: Math.min(1, base.cubic / CAP[size]), cubic: base.cubic, packed: Math.round(volumeOf(sel)), reason };
}
