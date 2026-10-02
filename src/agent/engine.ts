import { useSyncExternalStore } from "react";
import { clock, commit, movie, sleep, toast, type Activity } from "../state/store";

// Agent mode engine.
//
// A scenario is a typed script. It talks to the runner through a context whose
// methods are the six step kinds the product is built from:
//
//   user    a scripted user turn (typed into the composer in movie mode)
//   think   a collapsible thinking line with elapsed time
//   tool    a tool call row: spinner → check, duration, args and result JSON
//   say     streamed agent text (light markdown: **bold**, `mono`, [link](ops/route))
//   widget  an inline widget; `ask` awaits a human decision and branches on it,
//           `show` renders live output the script keeps updating
//   effect  mutate demo data + commit() so every screen updates, logged with undo
//
// Sessions run concurrently. Each has its own transcript, focus (what the context
// panel shows) and actions log. Movie mode types user turns and presses widget
// buttons on its own after a readable pause, with a visible cursor.

// ---------------------------------------------------------------------- types

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  status: "running" | "done" | "error";
  start: number;
  ms?: number;
}

export type Block =
  | { t: "think"; id: string; v: number; text: string; start: number; ms?: number }
  | { t: "tools"; id: string; v: number; calls: ToolCall[] }
  | { t: "say"; id: string; v: number; text: string; shown: number; done: boolean }
  | { t: "widget"; id: string; v: number; w: string; props: any; status: "active" | "answered" | "display" | "skipped"; answer?: any };

export type Item =
  | { t: "user"; id: string; text: string; files: string[]; at: string }
  | { t: "agent"; id: string; blocks: Block[]; at: string; done: boolean }
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
  scenarioId?: string;
}

export interface Scenario {
  id: string;
  n: number; // 1..20
  group: "Front desk" | "Money" | "Access" | "Facility" | "Growth" | "Reports";
  title: string; // tab + rail label
  prompt: string; // canonical ask
  command: string; // slash command
  files?: string[]; // attachments the canonical ask carries
  match: (text: string, files: string[]) => number; // routing score, 0 = no match
  run: (ctx: Ctx, input: { text: string; files: string[] }) => Promise<void>;
}

// ---------------------------------------------------------------------- store

let ver = 0;
const subs = new Set<() => void>();
let seq = 1;
export const uid = (p = "b") => `${p}${seq++}`;

export const agent = {
  sessions: [] as Session[],
  activeId: "",
  voice: null as null | { sessionId: string; level: number },
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
  if (!open.length) {
    const n = newSession();
    agent.activeId = n.id;
  } else if (agent.activeId === id) {
    agent.activeId = open[open.length - 1].id;
  }
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
    if (it.t !== "agent") continue;
    for (const b of it.blocks) {
      if (b.t === "widget" && b.status === "active") {
        b.status = "skipped";
        b.v++;
        resolvers.delete(b.id);
      }
      if (b.t === "say" && !b.done) {
        b.done = true;
        b.shown = b.text.length;
        b.v++;
      }
      if (b.t === "think" && b.ms === undefined) {
        b.ms = Date.now() - b.start;
        b.v++;
      }
      if (b.t === "tools") {
        for (const c of b.calls) if (c.status === "running") c.status = "error";
        b.v++;
      }
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
  props: P;
  update: (patch: Partial<P> | ((p: P) => Partial<P>)) => void;
}

export interface ToolSpec {
  name: string;
  args: Record<string, unknown>;
  result: unknown | (() => unknown);
  ms?: number;
}

export interface Ctx {
  session: Session;
  /** A scripted user turn. In movie mode it is typed into the composer first. */
  user: (text: string, files?: string[]) => Promise<void>;
  think: (text: string, ms?: number) => Promise<void>;
  tool: <R = any>(name: string, args: Record<string, unknown>, result: R | (() => R), ms?: number) => Promise<R>;
  tools: (specs: ToolSpec[]) => Promise<any[]>;
  say: (text: string) => Promise<void>;
  ask: <A = any>(w: string, props: any, auto?: string[]) => Promise<A>;
  show: <P = any>(w: string, props: P) => WidgetHandle<P>;
  effect: (e: { kind: Activity["kind"]; text: string; run: () => void; undo?: () => void; link?: { label: string; route: string }; toast?: boolean }) => void;
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

export async function run(session: Session, scenario: Scenario, input: { text: string; files: string[] }) {
  abort(session.id);
  const token = { aborted: false };
  runs.set(session.id, token);
  session.status = "running";
  session.scenarioId = scenario.id;
  if (session.title === "New session") session.title = scenario.title;
  session.suggest = [];

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
      it = { t: "agent", id: uid("a"), blocks: [], at: clock(), done: false };
      session.items.push(it);
    }
    return it;
  };
  const push = (b: Block) => {
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
      const b = push({ t: "think", id: uid(), v: 0, text, start: Date.now() }) as Extract<Block, { t: "think" }>;
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
      await wait(180);
      return results;
    },
    async say(text) {
      check();
      const b = push({ t: "say", id: uid(), v: 0, text, shown: 0, done: false }) as Extract<Block, { t: "say" }>;
      while (b.shown < text.length) {
        check();
        // Stream in word-ish chunks, like a model would.
        const step = 3 + Math.floor(Math.random() * 5);
        b.shown = Math.min(text.length, b.shown + step);
        b.v++;
        notify();
        await sleep(26);
      }
      b.done = true;
      b.v++;
      notify();
      await wait(260);
    },
    async ask(w, props, auto) {
      check();
      const b = push({ t: "widget", id: uid("w"), v: 0, w, props, status: "active" }) as Extract<Block, { t: "widget" }>;
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
      await wait(380);
      return answer;
    },
    show(w, props) {
      check();
      const b = push({ t: "widget", id: uid("w"), v: 0, w, props, status: "display" }) as Extract<Block, { t: "widget" }>;
      return {
        id: b.id,
        get props() {
          return b.props;
        },
        update(patch) {
          const p = typeof patch === "function" ? patch(b.props) : patch;
          b.props = { ...b.props, ...p };
          b.v++;
          notify();
        },
      };
    },
    effect(e) {
      check();
      e.run();
      const a: Action = { id: uid("x"), at: clock(), kind: e.kind, text: e.text, undo: e.undo, link: e.link };
      session.actions.unshift(a);
      commit({ kind: e.kind, text: e.text, who: "Zonera agent" });
      if (e.toast && !visible()) toast({ title: e.text, tone: "ok" });
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
      session.suggest = s;
      notify();
    },
    wait,
    title(t) {
      session.title = t;
      notify();
    },
  };

  try {
    await scenario.run(ctx, input);
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
    const it = lastAgentItem(session);
    if (it && runs.get(session.id) === token) it.done = true;
    if (runs.get(session.id) === token) runs.delete(session.id);
    notify();
  }
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
    await sleep(22 + Math.random() * 26 + (ch === "," || ch === "." ? 90 : 0));
  }
  await sleep(380);
}

const ghost = {
  el: null as HTMLDivElement | null,
  x: -60,
  y: -60,
};

export function bindGhost(el: HTMLDivElement | null) {
  ghost.el = el;
}

async function ghostTo(target: Element) {
  const el = ghost.el;
  const r = target.getBoundingClientRect();
  const x = r.left + Math.min(r.width / 2, 48 + r.width * 0.12);
  const y = r.top + r.height / 2;
  if (!el) return;
  if (ghost.x < 0) {
    // Enter from the lower right of the target.
    ghost.x = x + 160;
    ghost.y = y + 120;
    el.style.transition = "none";
    el.style.transform = `translate(${ghost.x}px, ${ghost.y}px)`;
    el.getBoundingClientRect();
  }
  el.classList.add("ag-ghost--on");
  el.style.transition = "transform .62s cubic-bezier(.3,.7,.2,1), opacity .2s";
  el.style.transform = `translate(${x}px, ${y}px)`;
  ghost.x = x;
  ghost.y = y;
  await sleep(680);
}

export async function ghostPress(target: Element) {
  target.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  await sleep(160);
  await ghostTo(target);
  ghost.el?.classList.add("ag-ghost--down");
  target.classList.add("ag-pressing");
  await sleep(200);
  ghost.el?.classList.remove("ag-ghost--down");
  (target as HTMLElement).click();
  await sleep(160);
  target.classList.remove("ag-pressing");
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
 * Play a widget's scripted answer: a list of steps like
 *   "opt:T-1000"            press the element tagged data-auto="opt:T-1000"
 *   "submit"                press the element tagged data-auto="submit"
 *   "type:alt:Sam Lee"      type into the input tagged data-auto="alt"
 *   "slide:cap:10"          move the range input tagged data-auto="cap" to 10
 *   "wait:800"              pause
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
    const el = await find(blockId, special ? key : step, onScreen ? 4000 : 300);
    if (!el) continue;
    if (!onScreen) {
      if (!special) (el as HTMLElement).click();
      continue;
    }
    if (verb === "type") {
      const input = el as HTMLInputElement | HTMLTextAreaElement;
      await ghostPress(input);
      input.focus();
      for (let i = 1; i <= val.length; i++) {
        setNativeValue(input, val.slice(0, i));
        await sleep(26 + Math.random() * 30);
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
  ghostHide();
}
