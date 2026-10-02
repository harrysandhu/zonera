// Call center domain types. A call is a mutable object the simulation streams
// into; components read it after the call store bumps its version.

export type Speaker = "ai" | "caller" | "human";
export type CallStatus = "ringing" | "dialing" | "live" | "wrap" | "ended";
export type Handler = "ai" | "human";
export type Direction = "inbound" | "outbound";

/** Text that may depend on live state (persona name, which unit got reserved). */
export type Txt = string | ((c: Call) => string);

export type Step =
  | { t: "say"; who: "ai" | "caller"; text: Txt; mood?: number; alts?: string[]; key?: string; aiText?: Txt }
  | { t: "tool"; tool: string; label: Txt; running?: Txt; ms?: number; run?: (c: Call) => void }
  | { t: "wait"; ms: number }
  | { t: "do"; run: (c: Call) => void }
  | { t: "escalate"; reason: string; detail: string; timeoutMs: number; ifHuman: Step[]; ifAI: Step[] };

export interface Whisper {
  /** Chip label and the text that gets sent. */
  text: string;
  /** Free-typed whispers that match this pattern use this variant. */
  match: RegExp;
  /** What Zonera Voice says back privately. */
  ack: string;
  /** The line Zonera Voice says next because of the whisper. */
  line: Txt;
  /** If set, replaces the scripted AI line with this key instead of inserting before the next one. */
  replaces?: string;
}

export interface Script {
  id: string;
  direction: Direction;
  name: string;
  phone: string;
  tenantId?: string;
  lead?: boolean;
  intent: string;
  campaign?: string;
  /** Steps already played when the demo loads (for calls live at load). */
  preroll?: number;
  /** Seconds the call has been running at load. */
  startOffset?: number;
  steps: Step[];
  whispers?: Whisper[];
  outcome: Txt;
  summary: Txt;
  /** Outcome tone in the recent list. */
  tone?: "ok" | "info" | "warn" | "bad" | "neutral";
  /** First AI line said when the call connects in human mode is a suggestion. */
  human?: boolean;
}

export interface LineEv { kind: "line"; id: number; who: Speaker; words: string[]; shown: number; at: number; done: boolean }
export interface ToolEv { kind: "tool"; id: number; tool: string; label: string; at: number; done: boolean; by: Handler }
export interface NoteEv { kind: "note"; id: number; text: string; at: number; tone: "whisper" | "ack" | "system" | "alert" }
export type Ev = LineEv | ToolEv | NoteEv;

export interface Call {
  id: string;
  script: Script;
  direction: Direction;
  name: string;
  phone: string;
  tenantId?: string;
  lead?: boolean;
  intent: string;
  campaign?: string;
  status: CallStatus;
  handler: Handler;
  startedAt: number;
  createdAt: number;
  endedAt?: number;
  clockAt: string; // "9:44 am"
  events: Ev[];
  mood: { at: number; v: number }[];
  speaking: Speaker | null;
  wordTick: number;
  listening: boolean;
  alert?: { reason: string; detail: string };
  suggest?: string[];
  outcome?: string;
  summary?: string;
  tone?: Script["tone"];
  duration?: number;
  completed?: boolean;
  tookOver?: boolean;
  /** UI state the simulation can drive in movie mode. */
  whisperOpen: boolean;
  draft: string;
  reply: string;
  usedWhispers: string[];
  passedKeys: string[];
  movieDone?: boolean;
  /** Runtime hooks (not rendered). */
  _reply?: (text: string | null) => void;
  _insert?: { line: Txt; replaces?: string }[];
  _cursor: number;
  _pendingHuman?: string;
  _listenOnOpen?: boolean;
}

export interface RecentCall {
  id: string;
  at: string;
  name: string;
  phone: string;
  direction: Direction;
  intent: string;
  outcome: string;
  tone: "ok" | "info" | "warn" | "bad" | "neutral";
  duration: number;
  mood: number;
  by: "ai" | "human";
  summary: string;
  afterHours?: boolean;
  tenantId?: string;
  call?: Call;
}
