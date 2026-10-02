// Types for Zonera HQ and the Automated FDE.
//
// One onboarding object drives both sides of the story:
//   HQ (super admin) sees every requirement, task, VM and policy;
//   the owner's portal sees only the items they owe us and progress on the rest.

export type Who = "agent" | "owner" | "vendor" | "human";

export type Role = "analyst" | "architect" | "builder" | "migrator" | "integrator" | "validator";

/** Storify's onboarding state machine, kept so the demo reads like the real system. */
export type FlowState =
  | "DRAFT"
  | "DETAILS_COMPLETE"
  | "PLAN_CONFIGURED"
  | "CONTRACT_GENERATED"
  | "AWAITING_SIGNING"
  | "AWAITING_PAYMENT"
  | "ONBOARDING_IN_PROGRESS"
  | "ACTIVE";

/** Stages shown on the stage rail. */
export type Stage = "context" | "plan" | "collect" | "migrate" | "validate" | "live";

export interface Person {
  id: string;
  name: string;
  role: string;
  org: string;
  email: string;
  phone?: string;
}

export interface Line {
  id: string; // "c1-0109"
  t: string; // "01:09"
  who: string; // Person id
  text: string;
}

export interface Source {
  id: string; // "c1", "c2", "e1"
  kind: "call" | "email";
  title: string;
  when: string; // "Thu Sep 24 · 11:02 am"
  duration?: string; // "27 min"
  people: string[];
  summary: string;
  lines: Line[];
  /** Hidden until the engine delivers it (the follow-up email). */
  late?: boolean;
}

export interface Cite {
  source: string;
  line: string;
  quote: string;
}

export type Category =
  | "migration"
  | "gate"
  | "collections"
  | "legal"
  | "rates"
  | "storefront"
  | "phones"
  | "payments"
  | "team"
  | "brand"
  | "timeline"
  | "commercial";

export interface Requirement {
  id: string; // "R1"
  title: string;
  detail: string;
  category: Category;
  cites: Cite[];
  /** The Zonera capability this maps to. */
  capability: string;
  late?: boolean;
}

export type ItemKind = "credential" | "delegate" | "upload" | "confirm" | "choice" | "form" | "sign" | "pay";

/** One item in the owner's generated onboarding checklist. */
export interface OwnerItem {
  id: string; // "O1"
  kind: ItemKind;
  title: string;
  /** Why we're asking, in the owner's own words where possible. */
  why: string;
  cite?: Cite;
  reqs: string[];
  /** Rough owner effort, in minutes. */
  minutes: number;
  /** "Needs you" vs "Quick confirm". */
  group: "needs" | "confirm";
  /** Pre-filled values the agent already found. */
  prefill?: Record<string, string>;
  options?: { value: string; label: string; sub?: string }[];
  /** A way out ("Don't have it? Share your login instead"). */
  alt?: string;
  late?: boolean;
  /** Item can't start until these tasks finish (e.g. payouts after Keystone login). */
  waitsOn?: string[];
}

export interface Task {
  id: string; // "T6"
  title: string;
  role: Role;
  vm: string;
  who: Who;
  reqs: string[];
  /** Owner items or tasks that must be done first. */
  needs: string[];
  late?: boolean;
}

export type StepKind = "cmd" | "tool" | "out" | "ok" | "warn" | "note" | "think";

export interface Frame {
  screen: string; // a key the BrowserStream knows how to paint
  url: string;
  focus?: string; // element the cursor is on
  typed?: string;
  note?: string;
}

export interface Step {
  kind: StepKind;
  text: string;
  /** ms to wait before this line (at 1×). */
  wait?: number;
  frame?: Frame;
  /** Engine hooks fired when the line prints, separated by "|". */
  fire?: string;
  /** Hold this line until the named flag is set (an exception resolved). */
  until?: string;
}

export interface Script {
  task: string;
  steps: Step[];
}

export interface Vm {
  id: string; // "vm-4d90"
  role: Role;
  profile: string; // "fde-migrator"
  label: string; // "Keystone · rent roll"
  region: string;
  vcpu: number;
  memGb: number;
  browser: boolean;
  parent?: string; // sub-agent of
  scripts: Script[];
}

export interface Check {
  id: string;
  label: string;
  source: string;
  target: string;
  status: "pending" | "running" | "pass" | "fixed" | "flag";
  note?: string;
}

export interface Exception {
  id: string;
  title: string;
  detail: string;
  evidence: string[];
  recommendation: string;
  options: { id: string; label: string; primary?: boolean }[];
  /** Who resolves: the SDR (human) or the owner's team via SMS. */
  route: "human" | "owner";
}

export interface Mail {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  when: string;
  dir: "out" | "in";
}

// ---- Portfolio (HQ) -------------------------------------------------------

export type FacilityStatus = "live" | "onboarding" | "trial" | "churn-risk";

export interface PortfolioFacility {
  id: string;
  name: string;
  org: string;
  city: string;
  state: string;
  units: number;
  occupancy: number;
  plan: "Starter" | "Professional" | "Enterprise";
  mrr: number;
  status: FacilityStatus;
  since: string;
  health: number; // 0–100
  from: string; // legacy system migrated from
  gate: string;
  touches: number;
  hoursToLive: number;
  lat: number;
  lon: number;
}

export interface Onboarding {
  id: string;
  org: string;
  facilities: number;
  units: number;
  stage: Stage;
  state: FlowState;
  progress: number;
  from: string;
  gate: string;
  vms: number;
  touches: number;
  age: string;
  waitingOn?: string;
  hero?: boolean;
}

export interface FleetVm {
  id: string;
  role: Role;
  org: string;
  task: string;
  cpu: number;
  tokens: number;
  uptime: string;
  region: string;
  browser: boolean;
}
