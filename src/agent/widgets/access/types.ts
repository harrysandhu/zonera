// Props and answers for the access widgets (W26 GateCodeBuilder, W27 AccessToggle,
// W28 EventLog). Skills in src/agent/skills/access and /facility build these.

export type DoorId = "G1" | "G2" | "PED" | "D1" | "ELV" | "RV";
export type Who = "tenant" | "vendor" | "staff" | "authorized";

// ---- W26 GateCodeBuilder
export interface GateCodeProps {
  title?: string;
  who: Who;
  holder: string; // "Dev Patel"
  company?: string; // "Lakeside Mechanical · HVAC"
  /** For an authorized user: whose unit it opens. */
  forTenant?: string; // "Sofia Reyes · C-108"
  doors: DoorId[];
  /** Doors the holder needs to reach their zone; shown with a hint, still toggleable. */
  path?: DoorId[];
  from: string; // "13:00"
  to: string; // "17:00"
  mode: "once" | "recurring";
  date?: string; // ISO, one-time
  /** Dates offered as chips for a one-time code. */
  dates?: string[];
  days?: number[]; // 0 = Sunday, recurring
  code: string; // "604 913"
  /** Code this one replaces, shown as a note. */
  replaces?: string;
  sms: boolean;
  to_phone: string;
  /** SMS template; {code}, {window}, {doors} are merged live. */
  text: string;
  note?: string;
  cta?: string;
}
export interface GateCodeAnswer {
  cancelled?: boolean;
  who: Who;
  holder: string;
  doors: DoorId[];
  from: string;
  to: string;
  mode: "once" | "recurring";
  date?: string;
  days?: number[];
  code: string;
  sms: boolean;
  to_phone: string;
  text: string;
}

// ---- W27 AccessToggle
export interface AccessToggleProps {
  action: "lock" | "unlock";
  unitId: string;
  unitSub: string; // "10×10 climate · Building D, floor 1"
  tenant?: string;
  code?: string; // tenant code "3762"
  balance?: number;
  daysLate?: number;
  reasons: string[];
  reason: string;
  policy?: string; // warning shown above the controls
  overlock: { on: boolean; label: string; sub: string };
  notify: { on: boolean; to?: string; text: string; disabled?: string };
  cta?: string;
}
export interface AccessToggleAnswer {
  cancelled?: boolean;
  reason: string;
  overlock: boolean;
  notify: boolean;
  text: string;
}

// ---- W28 EventLog (show; optional answer when cta is set)
export type LogKind = "entry" | "exit" | "denied" | "system" | "camera";
export interface LogEvent {
  id: string;
  day: string; // "Oct 1", "Today"
  at: string; // "10:38 pm"
  min: number; // sort key
  door: string;
  kind: LogKind;
  who: string;
  unit?: string;
  tenantId?: string;
  code?: string; // "••62"
  note?: string;
  cam?: string; // camera label → shows a still
}
export interface EventLogProps {
  title: string;
  meta?: string;
  events: LogEvent[];
  /** Highlighted rows (the answer to the question). */
  highlight?: string[];
  /** Initially selected filter. */
  filter?: "all" | "entry" | "exit" | "denied" | "camera" | "flagged";
  /** Events per hour, with the after-hours part marked. */
  hist?: { label: string; value: number; after?: boolean }[];
  histNote?: string; // "Gate hours end 10:00 pm"
  /** Event whose camera still opens first. */
  open?: string;
  maxRows?: number;
}

// ---- Change summary (W15 for non-money changes: codes, lock-outs, work orders, units)
export interface OpsReceiptProps {
  title: string;
  no?: string; // "AC-312", "WO-2052"
  subject: string; // "Dev Patel · Lakeside Mechanical"
  sub?: string;
  /** Big mono value, e.g. a gate code. */
  code?: string;
  codeLabel?: string;
  rows: [string, string][];
  triggered?: string[];
  actionId?: string;
  links?: { label: string; route: string }[];
}
