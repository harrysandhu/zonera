// Props and answers for the facility widgets (W36 WorkOrder, W37 ImportMapper,
// W38 TwinBuild). Skills in src/agent/skills/facility build these.

export type Priority = "urgent" | "high" | "normal" | "low";

// ---- W36 WorkOrder
export interface WOVendor {
  id: string;
  name: string;
  trade: string;
  contact: string;
  phone: string;
  rating?: number;
  response: string;
  badge?: string; // "Fixed 3 doors this year"
  staff?: boolean;
}
export interface WOSlot {
  id: string;
  date: string; // ISO
  from: string; // "13:00"
  to: string;
  taken?: boolean;
  note?: string; // "Booked · WO-2047"
}
export interface WorkOrderProps {
  id: string; // "WO-2051" or "WO-2052 · new"
  existing?: boolean;
  title: string;
  location: string;
  unitId?: string;
  category: string;
  photo?: { caption: string; by: string; at: string; kind: "door" | "gate" | "light" | "hvac" | "generic" };
  priority: Priority;
  vendors: WOVendor[];
  vendorId: string;
  /** Open slots per vendor id. */
  slots: Record<string, WOSlot[]>;
  slot?: string;
  code: { on: boolean; label: string };
  notify: { on: boolean; label: string; sub?: string; disabled?: string };
  offline?: { on: boolean; label: string; sub?: string };
  log?: { at: string; text: string; agent?: boolean }[];
  cta?: string;
}
export interface WorkOrderAnswer {
  cancelled?: boolean;
  title: string;
  priority: Priority;
  vendorId: string;
  slot?: WOSlot;
  code: boolean;
  notify: boolean;
  offline: boolean;
}

// ---- W37 ImportMapper
export interface ImportFile {
  name: string;
  kind: "plan" | "roll";
  meta: string; // "PDF · 3 pages"
  found: string; // "5 buildings · 181 doors"
}
export interface ImportColumn {
  source: string; // "Unit #"
  sample: string; // "A-101"
  target: string; // "unit_id" (one of targets[].value) or "skip"
  conf: number; // 0..1
}
export interface ImportCheck {
  id: string;
  label: string; // "Phone numbers"
  detail: string; // "161 valid · 2 fixed (missing area code)"
  tone: "ok" | "warn" | "bad";
}
export interface ImportDiscrepancy {
  id: string;
  title: string; // "C-117: size and type disagree"
  detail: string;
  plan: string; // what the site plan says
  roll: string; // what the rent roll says
  options: { value: string; label: string; hint?: string }[];
  pick: string; // suggested option
  unitId?: string;
}
export interface ImportMapperProps {
  files: ImportFile[];
  columns: ImportColumn[];
  targets: { value: string; label: string }[];
  checks: ImportCheck[];
  discrepancies: ImportDiscrepancy[];
  rows: number;
  units: number;
  cta?: string;
}
export interface ImportMapperAnswer {
  mapping: Record<string, string>;
  resolutions: Record<string, string>;
}

// ---- W38 TwinBuild (show, updated live)
export interface TwinBuildProps {
  run: number; // bump to replay the extrusion
  phase: "plan" | "rising" | "done";
  title: string;
  buildings: { id: string; name: string; units: number; done: boolean }[];
  counts: { label: string; value: number; of?: number; tone?: "ok" | "warn" | "accent" }[];
  caption?: string;
  /** Render the 3D view. Turned off when the flow moves on (WebGL contexts are limited). */
  live: boolean;
  /** Units to pulse once built (discrepancies that were resolved). */
  pulse?: string[];
}
