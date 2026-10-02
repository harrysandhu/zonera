import { useSyncExternalStore } from "react";
import { clock, commit, movie, sleep, toast, type Activity } from "../state/store";
import { parse, type Parsed } from "./parse";
import type { WidgetType, WidgetProps, WidgetAnswer } from "./widgets/registry";

// Agent mode engine. See src/agent/AUTHORING.md.
//
// A skill is a parametric script. Its slots are filled from the prompt by the
// rule-based parser (parse.ts); the engine shows them as an editable
// "understanding line", then runs the skill. The skill talks to the runner
// through a context whose methods are the step kinds the product is built from:
//
//   user    a scripted user turn (typed into the composer in movie mode)
//   think   a collapsible thinking line with elapsed time
//   tool    a tool call row: spinner → check, duration, args and result JSON
//   say     streamed agent text (light markdown: **bold**, `mono`, [link](ops/route))
//   ask     an inline widget awaiting a human decision; resolves with the answer
//   show    an inline widget the script keeps updating (progress, live status)
//   effect  mutate demo data + commit() so every screen updates; logged with undo
//   event   a system event between turns ("Payment received …")
//   suggest next-step chips under the turn
//
// Sessions run concurrently. Movie mode types user turns and presses widget
// controls on its own after a readable pause, with a visible cursor.

// ---------------------------------------------------------------------- skills

export type Category = "frontdesk" | "money" | "collections" | "access" | "facility" | "growth" | "comms" | "reports" | "day" | "admin";

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: "day", label: "Day" },
  { id: "frontdesk", label: "Front desk" },
  { id: "money", label: "Money" },
  { id: "collections", label: "Collections" },
  { id: "access", label: "Access" },
  { id: "facility", label: "Facility" },
  { id: "growth", label: "Growth" },
  { id: "comms", label: "Messages" },
  { id: "reports", label: "Reports" },
  { id: "admin", label: "Admin" },
];

export interface SlotOption<V> {
  value: V;
  label: string;
}

export interface SlotSpec<V = any> {
  /** Chip label in the understanding line, e.g. "channel". */
  label: string;
  /** Read the value from the parsed prompt. Return undefined when it isn't there. */
  fill: (q: Parsed) => V | undefined;
  /** Used when fill() finds nothing. The chip is marked "default". */
  default?: V | ((q: Parsed) => V | undefined);
  /** Chip text for a value. Defaults to String(v). */
  show?: (v: V) => string;
  /** Makes the chip editable: picking an option re-runs the skill with it. */
  options?: (q: Parsed) => SlotOption<V>[];
  /** Fill but don't show as a chip. */
  hidden?: boolean;
}

export interface Skill<S extends Record<string, any> = any> {
  id: string;
  category: Category;
  title: string;
  /** Catalog number from docs/agent-catalog.md, if any. */
  n?: number;
  /** Prompts that must work. The first is canonical: the rail and movie mode use it. */
  examples: string[];
  /** Attachments the canonical prompt carries (facility setup). */
  files?: string[];
  /** Show in the rail's operations list. */
  featured?: boolean;
  slots?: { [K in keyof S]: SlotSpec<S[K]> };
  /** 0 = not mine. Higher wins. Use kw() from parse.ts. */
  match: (q: Parsed) => number;
  run: (ctx: Ctx, input: { q: Parsed; slots: Partial<S> }) => Promise<void>;
}

/** Identity helper that infers slot types. */
export function defineSkill<S extends Record<string, any>>(s: Skill<S>): Skill<S> {
  return s;
}

// ---------------------------------------------------------------------- transcript types

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  status: "running" | "done" | "error";
  start: number;
  ms?: number;
}

export interface Chip {
  key: string;
  label: string;
  text: string;
  state: "filled" | "default" | "missing";
  options?: SlotOption<any>[];
}

export type Block =
  | { t: "understand"; id: string; v: number; chips: Chip[] }
  | { t: "think"; id: string; v: number; text: string; start: number; ms?: number }
  | { t: "tools"; id: string; v: number; calls: ToolCall[] }
  | { t: "say"; id: string; v: number; text: string; shown: number; done: boolean }
  | { t: "widget"; id: string; v: number; w: string; props: any; status: "active" | "answered" | "display" | "skipped"; answer?: any };

export type WidgetBlock = Extract<Block, { t: "widget" }>;

export interface RunInfo {
  skill: Skill;
  text: string;
  files: string[];
  overrides: Record<string, any>;
  effects: number;
}

export type Item =
  | { t: "user"; id: string; text: string; files: string[]; at: string }
  | { t: "agent"; id: string; blocks: Block[]; at: string; done: boolean; run?: RunInfo }
  | { t: "event"; id: string; text: string; tone: "info" | "ok" | "warn" | "call"; at: string };

export interface Focus {
  units: string[]; // pulse on the twin
  selected: string | null; // the unit in focus
  tenants: string[]; // entity cards
  leads: string[]; // lead names
  caption?: string;
}

export interface Action {
  id: string;
  at: string;
  kind: Activity["kind"];
  text: string;
  undo?: () => void;
  undone?: boolean;
  link?: { label: string; route: string };
}

export type SessionStatus = "idle" | "running" | "waiting" | "done" | "stopped";

export interface Session {
  id: string;
  title: string;
  createdAt: string;
  status: SessionStatus;
  items: Item[];
  draft: string;
  files: string[];
  focus: Focus;
  actions: Action[];
  suggest: string[];
  open: boolean;
  unread: boolean;
  skillId?: string;
}

// ---------------------------------------------------------------------- store

let ver = 0;
const subs = new Set<() => void>();
let seq = 1;
export const uid = (p = "b") => `${p}${seq++}`;

export const agent = {
  sessions: [] as Session[],
  activeId: "",
};

export function notify() {
  ver++;
  subs.forEach(f => f());
}
function subscribe(f: () => void) {
  subs.add(f);
  return () => subs.delete(f);
}
export function useAgent() {
  return useSyncExternalStore(subscribe, () => ver, () => ver);
}

export const emptyFocus = (): Focus => ({ units: [], selected: null, tenants: [], leads: [] });

export function newSession(title = "New session", open = true): Session {
  const s: Session = { id: uid("s"), title, createdAt: clock(), status: "idle", items: [], draft: "", files: [], focus: emptyFocus(), actions: [], suggest: [], open, unread: false };
  agent.sessions.push(s);
  return s;
}

export function getSession(id: string) {
  return agent.sessions.find(s => s.id === id);
}
export function activeSession() {
  return getSession(agent.activeId) ?? agent.sessions.find(s => s.open)!;
}
export function setActive(id: string) {
  const s = getSession(id);
  if (!s) return;
  s.open = true;
  s.unread = false;
  agent.activeId = id;
  notify();
}
export function closeSession(id: string) {
  const s = getSession(id);
  if (!s) return;
  abort(id);
  s.open = false;
  const open = agent.sessions.filter(x => x.open);
  if (!open.length) agent.activeId = newSession().id;
  else if (agent.activeId === id) agent.activeId = open[open.length - 1].id;
  notify();
}

/** A fresh session is "home": nothing has been asked yet. */
export const isHome = (s: Session) => s.items.length === 0;
export const isBusy = (s: Session) => s.status === "running" || s.status === "waiting";

// ---------------------------------------------------------------------- runner

class Aborted extends Error {}
const runs = new Map<string, { aborted: boolean }>();
const resolvers = new Map<string, (a: any) => void>();

export function abort(sessionId: string) {
  const r = runs.get(sessionId);
  if (r) r.aborted = true;
  runs.delete(sessionId);
  const s = getSession(sessionId);
  if (!s) return;
  for (const it of s.items) {
    if (it.t !== "agent" || it.done) continue;
    for (const b of it.blocks) {
      if (b.t === "widget" && b.status === "active") {
        b.status = "skipped";
        resolvers.delete(b.id);
      }
      if (b.t === "say" && !b.done) {
        b.done = true;
        b.shown = b.text.length;
      }
      if (b.t === "think" && b.ms === undefined) b.ms = Date.now() - b.start;
      if (b.t === "tools") for (const c of b.calls) if (c.status === "running") c.status = "error";
      b.v++;
    }
    it.done = true;
  }
  if (isBusy(s)) s.status = "stopped";
}

/** Answer a widget that is waiting for a decision. */
export function respond(blockId: string, answer: any) {
  const r = resolvers.get(blockId);
  if (!r) return;
  resolvers.delete(blockId);
  r(answer);
}

export function isWaiting(blockId: string) {
  return resolvers.has(blockId);
}

export interface WidgetHandle<P = any> {
  id: string;
  readonly props: P;
  update: (patch: Partial<P> | ((p: P) => Partial<P>)) => void;
}

export interface ToolSpec {
  name: string;
  args: Record<string, unknown>;
  result: unknown | (() => unknown);
  ms?: number;
}

export interface EffectSpec {
  kind: Activity["kind"];
  text: string;
  /** The data change. Omit for a log-only action (a message that went out). */
  run?: () => void;
  undo?: () => void;
  link?: { label: string; route: string };
}

export interface Ctx {
  session: Session;
  /** A scripted user turn. In movie mode it is typed into the composer first. */
  user: (text: string, files?: string[]) => Promise<void>;
  think: (text: string, ms?: number) => Promise<void>;
  tool: <R = any>(name: string, args: Record<string, unknown>, result: R | (() => R), ms?: number) => Promise<R>;
  /** Several tool calls in parallel; they finish at their own pace. */
  tools: (specs: ToolSpec[]) => Promise<any[]>;
  say: (text: string) => Promise<void>;
  /** Show a widget and wait for the decision. `auto` is the movie-mode script. */
  ask: <K extends WidgetType>(w: K, props: WidgetProps<K>, auto?: string[]) => Promise<WidgetAnswer<K>>;
  /** Show a widget that doesn't wait. Keep the handle to update it live. */
  show: <K extends WidgetType>(w: K, props: WidgetProps<K>) => WidgetHandle<WidgetProps<K>>;
  /** Apply a data change, log it (with undo) and commit(). Returns the action id. */
  effect: (e: EffectSpec) => string;
  event: (text: string, tone?: "info" | "ok" | "warn" | "call") => void;
  focus: (f: Partial<Focus>) => void;
  suggest: (s: string[]) => void;
  wait: (ms: number) => Promise<void>;
  title: (t: string) => void;
  readonly movie: boolean;
}

function lastAgentItem(s: Session) {
  const it = s.items[s.items.length - 1];
  return it && it.t === "agent" ? it : null;
}

/** Fill a skill's slots from the parsed prompt and any chip edits. */
export function fillSlots(skill: Skill, q: Parsed, overrides: Record<string, any>) {
  const values: Record<string, any> = {};
  const chips: Chip[] = [];
  for (const [key, spec] of Object.entries((skill.slots ?? {}) as Record<string, SlotSpec>)) {
    let v = key in overrides ? overrides[key] : spec.fill(q);
    let state: Chip["state"] = v === undefined ? "missing" : "filled";
    if (v === undefined && spec.default !== undefined) {
      v = typeof spec.default === "function" ? (spec.default as (q: Parsed) => any)(q) : spec.default;
      if (v !== undefined) state = "default";
    }
    values[key] = v;
    if (spec.hidden || v === undefined) continue;
    chips.push({ key, label: spec.label, text: spec.show ? spec.show(v) : String(v), state, options: spec.options?.(q) });
  }
  return { values, chips };
}

export interface RunInput {
  text: string;
  files: string[];
  overrides?: Record<string, any>;
}

export async function run(session: Session, skill: Skill, input: RunInput) {
  abort(session.id);
  const token = { aborted: false };
  runs.set(session.id, token);
  session.status = "running";
  session.skillId = skill.id;
  if (session.title === "New session") session.title = skill.title;
  session.suggest = [];
  const overrides = input.overrides ?? {};
  const info: RunInfo = { skill, text: input.text, files: input.files, overrides, effects: 0 };

  const check = () => {
    if (token.aborted) throw new Aborted();
  };
  const wait = async (ms: number) => {
    const end = Date.now() + ms / (movie.speed || 1);
    while (Date.now() < end) {
      check();
      await sleep(Math.min(120, end - Date.now()));
    }
    check();
  };

  const agentItem = (): Extract<Item, { t: "agent" }> => {
    let it = lastAgentItem(session);
    if (!it || it.done) {
      it = { t: "agent", id: uid("a"), blocks: [], at: clock(), done: false, run: info };
      session.items.push(it);
    }
    return it;
  };
  const push = <B extends Block>(b: B) => {
    agentItem().blocks.push(b);
    notify();
    return b;
  };
  const visible = () => agent.activeId === session.id;

  const ctx: Ctx = {
    session,
    get movie() {
      return movie.on;
    },
    async user(text, files = []) {
      check();
      const it = lastAgentItem(session);
      if (it) it.done = true;
      if (movie.on && visible()) await typeDraft(session, text, () => token.aborted);
      check();
      session.draft = "";
      session.items.push({ t: "user", id: uid("u"), text, files, at: clock() });
      notify();
      await wait(350);
    },
    async think(text, ms = 1200) {
      check();
      const b = push({ t: "think", id: uid(), v: 0, text, start: Date.now() } as Extract<Block, { t: "think" }>);
      await wait(ms);
      b.ms = Date.now() - b.start;
      b.v++;
      notify();
    },
    async tool(name, args, result, ms = 700) {
      const [r] = await ctx.tools([{ name, args, result, ms }]);
      return r;
    },
    async tools(specs) {
      check();
      const it = agentItem();
      let blk = it.blocks[it.blocks.length - 1];
      if (!blk || blk.t !== "tools") {
        blk = { t: "tools", id: uid(), v: 0, calls: [] };
        it.blocks.push(blk);
      }
      const group = blk;
      const calls: ToolCall[] = specs.map(s => ({ id: uid("c"), name: s.name, args: s.args, status: "running", start: Date.now() }));
      group.calls.push(...calls);
      group.v++;
      notify();
      const results = await Promise.all(
        specs.map(async (s, i) => {
          await wait((s.ms ?? 700) * (0.85 + Math.random() * 0.3));
          const res = typeof s.result === "function" ? (s.result as () => unknown)() : s.result;
          calls[i].result = res;
          calls[i].status = "done";
          calls[i].ms = Date.now() - calls[i].start;
          group.v++;
          notify();
          return res;
        }),
      );
      await wait(160);
      return results;
    },
    async say(text) {
      check();
      const b = push({ t: "say", id: uid(), v: 0, text, shown: 0, done: false } as Extract<Block, { t: "say" }>);
      while (b.shown < text.length) {
        check();
        b.shown = Math.min(text.length, b.shown + 3 + Math.floor(Math.random() * 5));
        b.v++;
        notify();
        await sleep(24);
      }
      b.done = true;
      b.v++;
      notify();
      await wait(240);
    },
    async ask(w, props, auto) {
      check();
      const b = push({ t: "widget", id: uid("w"), v: 0, w, props, status: "active" } as WidgetBlock);
      session.status = "waiting";
      if (!visible()) {
        session.unread = true;
        toast({ title: "Zonera needs a decision", body: session.title, tone: "info" }, 4200);
      }
      notify();
      const answer = await new Promise<any>(res => {
        resolvers.set(b.id, res);
        if (movie.on && auto?.length) void autoplay(session, b.id, auto, token);
      });
      check();
      b.answer = answer;
      b.status = "answered";
      b.v++;
      session.status = "running";
      notify();
      await wait(360);
      return answer;
    },
    show(w, props) {
      check();
      const b = push({ t: "widget", id: uid("w"), v: 0, w, props, status: "display" } as WidgetBlock);
      return {
        id: b.id,
        get props() {
          return b.props;
        },
        update(patch: any) {
          const p = typeof patch === "function" ? patch(b.props) : patch;
          b.props = { ...b.props, ...p };
          b.v++;
          notify();
        },
      };
    },
    effect(e) {
      check();
      e.run?.();
      info.effects++;
      const id = uid("x");
      session.actions.unshift({ id, at: clock(), kind: e.kind, text: e.text, undo: e.undo, link: e.link });
      commit({ kind: e.kind, text: e.text, who: "Zonera agent" });
      return id;
    },
    event(text, tone = "info") {
      check();
      const it = lastAgentItem(session);
      if (it) it.done = true;
      session.items.push({ t: "event", id: uid("e"), text, tone, at: clock() });
      notify();
    },
    focus(f) {
      session.focus = { ...session.focus, ...f };
      notify();
    },
    suggest(s) {
      // Never offer the ask that was just answered.
      const asked = input.text.trim().toLowerCase();
      session.suggest = s.filter(x => x.trim().toLowerCase() !== asked);
      notify();
    },
    wait,
    title(t) {
      session.title = t;
      notify();
    },
  };

  try {
    const q = parse(input.text, input.files);
    const { values, chips } = fillSlots(skill, q, overrides);
    if (chips.length) push({ t: "understand", id: uid(), v: 0, chips });
    await skill.run(ctx, { q, slots: values });
    session.status = "done";
    if (!visible()) {
      session.unread = true;
      toast({ title: `Done: ${session.title}`, tone: "ok", body: "Open Agent mode to review what changed." }, 4200);
    }
  } catch (e) {
    if (!(e instanceof Aborted)) {
      console.error(e);
      session.status = "done";
    }
  } finally {
    if (runs.get(session.id) === token) {
      const it = lastAgentItem(session);
      if (it) it.done = true;
      runs.delete(session.id);
    }
    notify();
  }
}

/**
 * Re-run a turn with one slot changed (the user edited a chip in the
 * understanding line). Only allowed before the turn has changed any data.
 */
export function editSlot(s: Session, itemId: string, key: string, value: any) {
  const idx = s.items.findIndex(i => i.id === itemId);
  const it = s.items[idx];
  if (!it || it.t !== "agent" || !it.run || it.run.effects > 0) return;
  abort(s.id);
  const info = it.run;
  s.items.splice(idx);
  void run(s, info.skill, { text: info.text, files: info.files, overrides: { ...info.overrides, [key]: value } });
}

/** Undo an action from the context panel. */
export function undoAction(s: Session, id: string) {
  const a = s.actions.find(x => x.id === id);
  if (!a || !a.undo || a.undone) return;
  a.undo();
  a.undone = true;
  commit({ kind: "agent", text: `Undid: ${a.text}`, who: "Priya Raman" });
}

// ---------------------------------------------------------------------- movie mode

/** Type text into a session's composer draft at a readable pace. */
export async function typeDraft(s: Session, text: string, stop: () => boolean = () => false) {
  s.draft = "";
  notify();
  for (let i = 1; i <= text.length; i++) {
    if (stop()) return;
    s.draft = text.slice(0, i);
    notify();
    const ch = text[i - 1];
    await sleep(20 + Math.random() * 24 + (ch === "," || ch === "." ? 80 : 0));
  }
  await sleep(360);
}

const ghost = { el: null as HTMLDivElement | null, x: -1, y: -1 };

export function bindGhost(el: HTMLDivElement | null) {
  ghost.el = el;
}

async function ghostTo(target: Element) {
  const el = ghost.el;
  const r = target.getBoundingClientRect();
  const x = r.left + Math.min(r.width / 2, 40 + r.width * 0.15);
  const y = r.top + r.height / 2;
  if (!el) return;
  if (ghost.x < 0 || !el.classList.contains("ag-ghost--on")) {
    ghost.x = x + 140;
    ghost.y = y + 110;
    el.style.transition = "none";
    el.style.transform = `translate(${ghost.x}px, ${ghost.y}px)`;
    el.getBoundingClientRect();
  }
  el.classList.add("ag-ghost--on");
  el.style.transition = "transform .6s cubic-bezier(.3,.7,.2,1), opacity .25s";
  el.style.transform = `translate(${x}px, ${y}px)`;
  ghost.x = x;
  ghost.y = y;
  await sleep(660);
}

/** Move the movie cursor to an element and press it. */
export async function ghostPress(target: Element, click = true) {
  target.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  await sleep(180);
  await ghostTo(target);
  ghost.el?.classList.add("ag-ghost--down");
  target.classList.add("ag-pressing");
  await sleep(200);
  ghost.el?.classList.remove("ag-ghost--down");
  if (click) (target as HTMLElement).click();
  await sleep(160);
  target.classList.remove("ag-pressing");
}

/** Move the movie cursor to an element without pressing it. */
export async function ghostMove(target: Element) {
  target.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  await sleep(160);
  await ghostTo(target);
}

export function ghostHide() {
  ghost.el?.classList.remove("ag-ghost--on");
}

function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

async function find(blockId: string, key: string, timeout = 4000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const el = document.querySelector(`[data-block="${blockId}"] [data-auto="${CSS.escape(key)}"]`);
    if (el && !(el as HTMLButtonElement).disabled) return el;
    await sleep(80);
  }
  return null;
}

/**
 * Play a widget's scripted answer, a list of steps:
 *   "opt:T-1000"          press the element tagged data-auto="opt:T-1000"
 *   "submit"              press the element tagged data-auto="submit"
 *   "type:alt:Sam Lee"    type into the input tagged data-auto="alt" (replaces its value)
 *   "slide:cap:10"        move the range input tagged data-auto="cap" to 10
 *   "wait:800"            pause
 */
async function autoplay(s: Session, blockId: string, steps: string[], token: { aborted: boolean }) {
  await sleep(1500);
  for (const step of steps) {
    if (token.aborted || !isWaiting(blockId)) break;
    const [verb, key, ...rest] = step.split(":");
    const val = rest.join(":");
    if (verb === "wait") {
      await sleep(+key || 600);
      continue;
    }
    // If the presenter is looking at another session, answer without the show.
    const onScreen = agent.activeId === s.id && !!document.querySelector(`[data-block="${blockId}"]`);
    const special = verb === "type" || verb === "slide";
    let el = await find(blockId, special ? key : step, onScreen ? (ALIAS[step] ? 1200 : 5000) : 400);
    if (!el && ALIAS[step]) el = await find(blockId, ALIAS[step], onScreen ? 3000 : 400);
    if (!el) continue;
    if (!onScreen) {
      if (!special) (el as HTMLElement).click();
      else setNativeValue(el as HTMLInputElement, val);
      continue;
    }
    if (verb === "type") {
      const input = el as HTMLInputElement | HTMLTextAreaElement;
      await ghostPress(input, false);
      input.focus();
      for (let i = 1; i <= val.length; i++) {
        setNativeValue(input, val.slice(0, i));
        await sleep(24 + Math.random() * 30);
      }
      await sleep(350);
      continue;
    }
    if (verb === "slide") {
      const input = el as HTMLInputElement;
      await ghostTo(input);
      ghost.el?.classList.add("ag-ghost--down");
      const from = +input.value;
      const to = +val;
      const n = 16;
      for (let i = 1; i <= n; i++) {
        setNativeValue(input, String(Math.round((from + ((to - from) * i) / n) * 10) / 10));
        await sleep(55);
      }
      ghost.el?.classList.remove("ag-ghost--down");
      await sleep(500);
      continue;
    }
    await ghostPress(el);
    await sleep(520);
  }
  // A script that didn't land its answer: press the widget's primary button so the film never stalls.
  if (!token.aborted && isWaiting(blockId)) {
    const el = await find(blockId, "submit", 1500);
    if (el && isWaiting(blockId)) {
      if (agent.activeId === s.id) await ghostPress(el);
      else (el as HTMLElement).click();
    }
  }
  ghostHide();
}

/** Script verbs that name the outcome rather than the button. */
const ALIAS: Record<string, string> = { approve: "submit", call: "submit", confirm: "submit", ok: "submit", continue: "submit" };
