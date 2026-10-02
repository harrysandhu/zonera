import type { UnitSize } from "./facility";

// "What are you storing?" — items with rough packed volume in cubic feet.
// Volumes follow common moving-industry estimates; the recommender adds 25%
// for aisle space so people can still reach the back of the unit.

export interface Item { id: string; label: string; cubic: number; group: string }

export const ITEMS: Item[] = [
  { id: "box-s", label: "Small boxes", cubic: 1.5, group: "Boxes" },
  { id: "box-m", label: "Medium boxes", cubic: 3, group: "Boxes" },
  { id: "box-l", label: "Large boxes", cubic: 4.5, group: "Boxes" },
  { id: "tote", label: "Plastic totes", cubic: 2.5, group: "Boxes" },
  { id: "bed-q", label: "Queen bed", cubic: 60, group: "Bedroom" },
  { id: "bed-k", label: "King bed", cubic: 75, group: "Bedroom" },
  { id: "dresser", label: "Dresser", cubic: 35, group: "Bedroom" },
  { id: "night", label: "Nightstand", cubic: 6, group: "Bedroom" },
  { id: "sofa", label: "Sofa", cubic: 50, group: "Living" },
  { id: "chair", label: "Armchair", cubic: 20, group: "Living" },
  { id: "tv", label: "TV & stand", cubic: 15, group: "Living" },
  { id: "shelf", label: "Bookshelf", cubic: 20, group: "Living" },
  { id: "rug", label: "Rolled rug", cubic: 8, group: "Living" },
  { id: "table", label: "Dining table", cubic: 30, group: "Kitchen" },
  { id: "chairs", label: "Dining chairs", cubic: 5, group: "Kitchen" },
  { id: "fridge", label: "Refrigerator", cubic: 45, group: "Kitchen" },
  { id: "washer", label: "Washer / dryer", cubic: 30, group: "Kitchen" },
  { id: "desk", label: "Desk", cubic: 25, group: "Office" },
  { id: "bike", label: "Bikes", cubic: 15, group: "Outdoor" },
  { id: "skis", label: "Skis & snowboards", cubic: 4, group: "Outdoor" },
  { id: "kayak", label: "Kayak / SUP", cubic: 30, group: "Outdoor" },
  { id: "grill", label: "Grill", cubic: 12, group: "Outdoor" },
  { id: "patio", label: "Patio set", cubic: 40, group: "Outdoor" },
  { id: "tires", label: "Set of tires", cubic: 16, group: "Outdoor" },
];

export const PRESETS: { id: string; label: string; hint: string; items: Record<string, number> }[] = [
  { id: "studio", label: "Studio apartment", hint: "Between leases", items: { "bed-q": 1, dresser: 1, "box-m": 12, chair: 1, tv: 1, desk: 1 } },
  { id: "one-bed", label: "One-bedroom move", hint: "Most popular", items: { "bed-q": 1, dresser: 1, night: 2, sofa: 1, tv: 1, shelf: 1, table: 1, chairs: 4, "box-m": 20, "box-l": 6, bike: 1 } },
  { id: "seasonal", label: "Seasonal gear", hint: "Skis, bikes, patio", items: { skis: 4, bike: 2, kayak: 1, patio: 1, grill: 1, tote: 6, tires: 1 } },
  { id: "house", label: "Three-bedroom house", hint: "Renovating", items: { "bed-k": 1, "bed-q": 2, dresser: 3, night: 4, sofa: 2, chair: 2, tv: 2, shelf: 3, table: 1, chairs: 6, fridge: 1, washer: 2, desk: 1, "box-m": 40, "box-l": 15, bike: 3 } },
  { id: "business", label: "Business inventory", hint: "Shelving + stock", items: { shelf: 6, "box-l": 40, "box-m": 30, desk: 1, tote: 20 } },
];

const CAPACITY: { size: UnitSize; cubic: number }[] = [
  { size: "5x5", cubic: 200 },
  { size: "5x10", cubic: 400 },
  { size: "10x10", cubic: 800 },
  { size: "10x15", cubic: 1200 },
  { size: "10x20", cubic: 1600 },
  { size: "10x30", cubic: 2400 },
];

export function volumeOf(sel: Record<string, number>) {
  return Object.entries(sel).reduce((s, [id, n]) => s + (ITEMS.find(i => i.id === id)?.cubic ?? 0) * n, 0);
}

export function recommend(sel: Record<string, number>): { size: UnitSize; fill: number; cubic: number } {
  const cubic = volumeOf(sel) * 1.25;
  const fit = CAPACITY.find(c => c.cubic >= cubic) ?? CAPACITY[CAPACITY.length - 1];
  return { size: fit.size, fill: Math.min(1, cubic / fit.cubic), cubic: Math.round(cubic) };
}

export const PROTECTION = [
  { id: 2000, label: "Essential", cover: "$2,000", price: 12, note: "Fire, theft, water and pests" },
  { id: 5000, label: "Plus", cover: "$5,000", price: 19, note: "Adds mold, mildew and wind damage", popular: true },
  { id: 10000, label: "Complete", cover: "$10,000", price: 29, note: "Adds earthquake and transit to the unit" },
] as const;

export const ADMIN_FEE = 25;
