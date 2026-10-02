import type { UnitKind, UnitSize, UnitStatus } from "../../../data/facility";
import type { ProSpec, ProResult } from "./prorate";

// Props and answers for the front-desk widgets (W19–W25, W33 and the access
// pass). Every widget is generic over its data: the skill passes what to show,
// the widget returns what the person decided.

// ---- W19 UnitPicker3D · W20 UnitCompare
export interface UnitOption {
  id: string;
  size: UnitSize;
  kind: UnitKind;
  building: string;
  floor: number;
  price: number; // monthly
  feet: number; // walking/driving distance from the gate
  features: string[]; // "Drive-up", "Ground floor", "Climate controlled"
  badge?: string; // "Best match", "Held for Owen"
  note?: string; // "3 doors from C-108"
  status?: UnitStatus;
}

export interface UnitPickerProps {
  title?: string;
  meta?: string;
  options: UnitOption[];
  selected?: string;
  /** The unit the person has today (transfers, second units). Shown on the twin. */
  current?: string;
  cta?: string;
  note?: string;
}
export interface UnitPickerAnswer {
  unit: string;
  compared?: string[];
}

export interface UnitCompareProps {
  title?: string;
  meta?: string;
  /** What the person has now. Its monthly price is the baseline for deltas. */
  current?: UnitOption & { label?: string };
  options: UnitOption[];
  selected?: string;
  cta?: string;
  tier?: string;
}
export interface UnitCompareAnswer {
  unit: string;
}

// ---- W21 Proration
export interface ProrationProps {
  title?: string;
  meta?: string;
  spec: ProSpec;
  /** Label for the editable date: "Move-in date", "Move-out date", "Transfer date". */
  dateLabel?: string;
  editableDate?: boolean;
  /** Offer "Bill on the {n}th" vs "Align to the 1st" (move-ins). */
  allowBilling?: boolean;
  min?: string;
  max?: string;
  /** "Charge to Visa •• 4242 on approval" / "Refund to Visa •• 1881". */
  settle?: string;
  cta?: string; // "{total}" is replaced
  tier?: string;
  note?: string;
}
export interface ProrationAnswer extends ProResult {
  date: string;
  billing?: "anniversary" | "first";
}

// ---- W22 PersonForm
export interface PersonField {
  key: string;
  label: string;
  value?: string;
  type?: "text" | "tel" | "email" | "date" | "select";
  options?: string[];
  required?: boolean;
  placeholder?: string;
  /** Where the value came from: "ID scan", "Reservation", "Lease". */
  source?: string;
  /** Half-width field. */
  half?: boolean;
}
export interface PersonFormProps {
  title?: string;
  meta?: string;
  fields: PersonField[];
  cta?: string;
  note?: string;
  /** Optional toggle under the form ("Text a welcome message", "Require ID on first visit"). */
  toggle?: { key: string; label: string; on: boolean };
}
export type PersonFormAnswer = Record<string, string> & { _toggle?: string };

// ---- W23 IdScan
export interface IdField {
  key: string;
  label: string;
  value: string;
  confidence: number; // 0..1
}
export interface IdScanProps {
  title?: string;
  doc: string; // "California driver license"
  name: string;
  fields: IdField[];
  /** Where the capture comes from. */
  source?: string; // "Counter camera"
}
export interface IdScanAnswer {
  verified: boolean;
  manual?: boolean;
  fields: Record<string, string>;
}

// ---- W24 ProtectionPicker
export type Cover = 0 | 2000 | 5000 | 10000;
export interface ProtectionProps {
  title?: string;
  meta?: string;
  value?: Cover;
  /** Highlight the tier the agent suggests. */
  suggest?: Cover;
  note?: string;
}
export interface ProtectionAnswer {
  cover: Cover;
  price: number;
  label: string;
  own?: { carrier: string; file: string; policy: string };
}

// ---- W25 EsignTracker (show, update live)
export type EsignStatus = "draft" | "sent" | "opened" | "signed";
export interface EsignProps {
  title?: string; // "Lease" | "Transfer addendum"
  doc: string; // "Rental agreement"
  no: string; // "ZAL-2026-1002-C109"
  pages: number;
  signer: string;
  to: string; // "Counter iPad" | "(530) 555-0136 · jordan.lee@gmail.com"
  via: "ipad" | "sms" | "email";
  status: EsignStatus;
  times?: Partial<Record<Exclude<EsignStatus, "draft">, string>>;
  terms: [string, string][];
  countersign?: string; // "Priya Raman for Zonera Alder Lake"
  link?: { label: string; route: string };
}

// ---- W33 SlotPicker (shared)
export interface Slot {
  t: string; // "14:30"
  taken?: boolean;
  note?: string; // "Marco on site"
}
export interface SlotDay {
  iso: string;
  slots: Slot[];
  closed?: string; // "Office closed"
}
export interface SlotPickerProps {
  title?: string;
  meta?: string;
  days: SlotDay[];
  selected?: { iso: string; t: string };
  duration?: number; // minutes
  attendees?: { id: string; name: string; role?: string }[];
  attendee?: string;
  where?: string;
  cta?: string;
  note?: string;
  tier?: string;
}
export interface SlotPickerAnswer {
  iso: string;
  t: string;
  label: string; // "Sat, Oct 3 · 2:30 pm"
  attendee?: string;
  attendeeName?: string;
}

// ---- Access pass (gate code issued at move-in, transfer, authorized user)
export interface AccessPassProps {
  title?: string;
  name: string;
  code: string;
  replaced?: string; // previous code, shown struck through
  units: string[];
  zones: string[];
  status?: "active" | "suspended";
  sentTo?: string;
  route?: string; // unit id to draw the route to
  note?: string;
  /** Ask mode: the person confirms before the code is issued. */
  cta?: string;
  sms?: { to: string; on: boolean };
  tier?: string;
}
export interface AccessPassAnswer {
  sms: boolean;
}

export type { ProSpec, ProResult };
