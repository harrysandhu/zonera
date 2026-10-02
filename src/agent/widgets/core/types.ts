import type React from "react";

// Props and answer types for the shared core widgets (src/agent/widgets/core).
// Category agents: import these types when building skills. Widget numbers are
// from docs/agent-catalog.md.

export type Tone = "ok" | "warn" | "bad" | "neutral";
export interface Link {
  label: string;
  route: string; // go(route), e.g. "ops/tenants/T-1000"
}

// ---- W1 QuickReplies: one question, 2–5 chips, optional "Something else…"
export interface QuickRepliesProps {
  question: string;
  options: { value: string; label: string; hint?: string }[];
  /** Placeholder for a free-text "Something else…" reply. Omit to hide it. */
  other?: string;
}
/** The chosen option value, or the typed text. */
export type QuickRepliesAnswer = string;

// ---- W2 Disambiguate: candidate rows, "Likely" badge, single select
export interface Candidate {
  id: string;
  title: string;
  sub?: string; // "A-122 · 10×10 · 18 days late"
  meta?: string; // right column, e.g. "$240.00"
  metaTone?: Tone;
  badge?: string; // "Likely match"
  avatar?: string; // name for an initials avatar
}
export interface DisambiguateProps {
  title: string;
  meta?: string;
  options: Candidate[];
}
export type DisambiguateAnswer = string; // candidate id

// ---- W3 RecipientSet: people chips + segment rows + search, live count
export interface Recipient {
  id: string; // tenant id or lead name
  name: string;
  sub?: string; // "A-122" or "Reservation · 10×20"
  phone?: string;
  email?: string;
  optOutSms?: boolean;
  /** Merge fields for BulkMessageComposer: first, unit, balance, due_date, code … */
  data?: Record<string, string>;
}
export interface SegmentOption {
  id: string;
  label: string; // "Everyone past due"
  people: Recipient[];
}
export interface RecipientSetProps {
  channel: "sms" | "email";
  selected: Recipient[];
  segments?: SegmentOption[];
  /** People that search can add. */
  pool?: Recipient[];
  cta?: string; // default "Continue with {n}"
}
export type RecipientSetAnswer = Recipient[];

// ---- W4 BulkMessageComposer
export type MsgTone = "friendly" | "firm" | "brief";
export interface BulkMessageProps {
  channel: "sms" | "email";
  /** Channels the user may switch between. Default both. */
  channels?: ("sms" | "email")[];
  recipients: Recipient[];
  subject?: string;
  /** Template per tone, with merge fields like {first} {unit} {balance} {due_date}. */
  templates: Partial<Record<MsgTone, string>>;
  tone?: MsgTone;
  /** Per-recipient drafts (recipient id → text). When set, each message is edited on its own. */
  drafts?: Record<string, string>;
  /** Merge fields offered as insert chips. Default: first, unit, balance, due_date. */
  fields?: string[];
  schedule?: "now" | "tomorrow" | "custom";
}
export interface BulkMessageAnswer {
  channel: "sms" | "email";
  subject?: string;
  tone: MsgTone;
  template: string;
  schedule: "now" | "tomorrow" | "custom";
  messages: { id: string; name: string; to: string; text: string }[];
}

// ---- W5 DeliveryTracker (show, update live)
export type DeliveryState = "queued" | "sent" | "delivered" | "read" | "replied" | "failed";
export interface DeliveryProps {
  channel: "sms" | "email" | "call";
  title?: string;
  rows: { id: string; name: string; to: string; state: DeliveryState; at?: string; reply?: string }[];
}

// ---- Charts (used by W9, W10)
export interface ChartSpec {
  kind: "bar" | "line" | "meter";
  title?: string;
  data: { label: string; value: number; note?: string }[];
  format?: "money" | "pct" | "int";
  domain?: [number, number];
  height?: number;
}

// ---- W9 ReportPreview: mini document + Send / Download / Schedule
export interface ReportPreviewProps {
  title: string; // "September 2026 owner report"
  subtitle?: string; // "Zonera Alder Lake · vs September 2025"
  kpis: { label: string; value: string; delta?: string; tone?: Tone }[];
  charts: ChartSpec[];
  narrative: string[]; // agent-written paragraphs
  pages: number;
  file: string; // "alder-lake-owner-report-2026-09.pdf"
  actions?: ("send" | "download" | "schedule")[];
  recipients?: string; // "Alder Lake Holdings · 2 recipients"
}
export type ReportPreviewAnswer = "send" | "download" | "schedule";

// ---- W10 AnswerCard: one big number + context + mini list (or a row of tiles)
export interface AnswerTile {
  label: string;
  value: string;
  context?: string;
  delta?: { text: string; tone: Tone };
}
export interface AnswerCardProps {
  label?: string;
  value?: string;
  context?: string;
  delta?: { text: string; tone: Tone };
  tiles?: AnswerTile[];
  items?: { label: React.ReactNode; meta?: string; route?: string; action?: { label: string; ask: string } }[];
  itemsTitle?: string;
  chart?: ChartSpec;
  links?: Link[];
}

// ---- W12 DataTable: sortable, selectable, bulk-action bar
export interface Column {
  key: string;
  label: string;
  align?: "left" | "right";
  mono?: boolean;
}
export interface Row {
  id: string;
  cells: Record<string, React.ReactNode>;
  /** Sort keys per column when the cell isn't a plain string/number. */
  sort?: Record<string, number | string>;
  tone?: Tone;
  route?: string;
}
export interface DataTableProps {
  title: string;
  meta?: string;
  columns: Column[];
  rows: Row[];
  selectable?: boolean;
  selected?: string[]; // default: all
  /** Bulk actions shown in the sticky bar; answering with one returns { ids, action }. */
  actions?: { id: string; label: string }[];
  /** Primary button when there are no bulk actions. */
  cta?: string;
  maxRows?: number;
}
export interface DataTableAnswer {
  ids: string[];
  action?: string;
}

// ---- W13 Ledger
export interface LedgerRow {
  date: string; // ISO
  desc: string;
  charge?: number;
  payment?: number;
  balance: number;
  flag?: "late" | "dup" | "new" | "paying";
}
export interface LedgerProps {
  title: string;
  meta?: string;
  rows: LedgerRow[];
  foot?: string; // "Balance due"
}

// ---- W14 PaymentForm (shared because Take a payment is the reference skill)
export type PayMethod = "cash" | "card" | "new-card" | "ach" | "check" | "reader";
export interface PaymentFormProps {
  payer: string;
  title?: string;
  method: PayMethod;
  methods?: PayMethod[];
  lines: { label: string; amount: number }[]; // allocation
  receiptTo?: string;
  card?: string; // card on file / card the reader reads
  after?: string; // "Clears the balance · paid through Oct 13"
  cta?: string;
}
export interface PaymentFormAnswer {
  method: PayMethod;
  amount: number;
  sms: boolean;
  card?: string;
}

// ---- W15 Receipt
export interface ReceiptProps {
  title?: string;
  no: string;
  payer: string;
  unit?: string;
  lines: { label: string; amount: number }[];
  method: string;
  balance: number;
  paidThrough?: string;
  sentTo?: string;
  /** Things the payment triggered: "Overlock removed from A-122". */
  triggered?: string[];
  /** Session action id from ctx.effect(); enables Undo for 5 minutes. */
  actionId?: string;
  links?: Link[];
}

// ---- W29 PlanChecklist
export interface PlanItem {
  id: string;
  label: string;
  sub?: string;
  group?: string;
  on?: boolean; // default true
  tier?: "Auto" | "Ask first";
}
export interface PlanProps {
  title: string;
  meta?: string;
  items: PlanItem[];
  impact?: string;
  /** "{n}" is replaced with the count of checked items. Default "Approve and run {n} actions". */
  cta?: string;
  secondary?: string;
}
export type PlanAnswer = { ids: string[]; secondary?: false } | { ids: []; secondary: true };

// ---- W30 ProgressList (show, update live)
export interface ProgressItem {
  id: string;
  label: string;
  sub?: string;
  state: "todo" | "run" | "done" | "fail" | "skip";
  result?: string;
}
export interface ProgressProps {
  title: string;
  items: ProgressItem[];
  summary?: string;
}

// ---- W31 BatchCards (show, update live)
export interface BatchStep {
  label: string;
  state: "todo" | "run" | "done" | "fail" | "wait";
  value?: string;
}
export interface BatchCard {
  id: string;
  title: string;
  sub?: string;
  avatar?: string;
  steps: BatchStep[];
  total?: string;
}
export interface BatchProps {
  title: string;
  cards: BatchCard[];
  summary?: string;
}

// ---- W39 Diff: before / after, approve
export interface DiffProps {
  title: string;
  meta?: string;
  rows: { field: string; before: string; after: string }[];
  note?: string;
  cta?: string; // default "Approve change"
  secondary?: string; // default "Cancel"
}
export type DiffAnswer = "approve" | "cancel";

// ---- W42 CallHandoff: ask "call" first, then show it again with a live status
export interface CallHandoffProps {
  name: string;
  phone: string;
  purpose: string;
  script: string[];
  status: "ready" | "dialing" | "live" | "ended";
  callId?: string;
  outcome?: string;
}
export type CallHandoffAnswer = "call" | "cancel";

// ---- Entity card (tenant or lead)
export interface EntityProps {
  tenantId?: string;
  lead?: string; // lead name
  title?: string;
}
