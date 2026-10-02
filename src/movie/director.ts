import { useSyncExternalStore } from "react";
import { activity, go, movie, nav, setCallsOpen, setMovie } from "../state/store";
import { abort, activeSession, agent, ghostHide, ghostMove, ghostPress, isBusy, isHome, type Session } from "../agent/engine";
import { askIn, launch } from "../agent/controller";
import { releaseCalls, rings } from "../calls/engine";

// The movie director: plays a story (chapters of scripted beats) across the
// dashboard, agent mode and the call center with a visible cursor and
// captions, so the demo can be filmed hands-free. Agent chains are short
// stories that run several flows in one chat.

export interface Chapter {
  id: string;
  /** Small label above the title: the surface or the time of day. */
  kicker: string;
  title: string;
  body: string;
  beats: (d: Run) => Promise<void>;
}

export interface Story {
  id: string;
  kind: "film" | "chain";
  title: string;
  sub: string;
  chapters: Chapter[];
  /** Shown on the end card. */
  end?: { title: string; body: string };
}

export const director = {
  story: null as Story | null,
  idx: 0,
  status: "idle" as "idle" | "playing" | "paused" | "done",
  launcher: false,
  captions: true,
  /** movie.on before the story started, restored when it ends. */
  prevMovie: false,
};

let ver = 0;
const subs = new Set<() => void>();
function bump() {
  ver++;
  subs.forEach(f => f());
}
export function useDirector() {
  return useSyncExternalStore(
    f => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => ver,
    () => ver,
  );
}

class Cancel extends Error {}

let token: { cancel: boolean; stop: boolean } = { cancel: false, stop: false };
const raw = (ms: number) => new Promise(r => setTimeout(r, ms));

// ---------------------------------------------------------------- the beat API

export interface Run {
  wait(ms: number): Promise<void>;
  until(cond: () => boolean, timeout?: number): Promise<boolean>;
  /** Move the cursor to an element (selector, or button text with "text:"). */
  point(target: string): Promise<void>;
  click(target: string, opts?: { optional?: boolean }): Promise<boolean>;
  scroll(target: string, block?: ScrollLogicalPosition): Promise<void>;
  /** Open an operator page from the sidebar. */
  page(id: string, route?: string): Promise<void>;
  /** Ask the agent. Types into the composer and waits for the turn to finish. */
  ask(text: string, opts?: { newTab?: boolean }): Promise<void>;
  /** Press a next-step chip under the last turn (types it if the chip isn't there). */
  chip(text: string): Promise<void>;
  /** Wait for a prompt already in flight (e.g. started by a dashboard button). */
  settle(text: string): Promise<void>;
  openCalls(): Promise<void>;
  closeCalls(): Promise<void>;
  callRow(name: string): Promise<boolean>;
}

function resolve(target: string): Element | null {
  if (target.startsWith("text:")) {
    const [sel, txt] = target.slice(5).includes("|") ? target.slice(5).split("|") : ["button", target.slice(5)];
    const want = txt.toLowerCase();
    return [...document.querySelectorAll(sel)].find(el => (el.textContent ?? "").toLowerCase().includes(want) && visible(el)) ?? null;
  }
  return [...document.querySelectorAll(target)].find(visible) ?? null;
}

function visible(el: Element) {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

/** Every user turn id that exists now, so we can spot the next one. */
function userIds() {
  const ids = new Set<string>();
  for (const s of agent.sessions) for (const it of s.items) if (it.t === "user") ids.add(it.id);
  return ids;
}

type Token = { cancel: boolean; stop: boolean };

/** The beat API bound to one playback, so a replaced playback can't keep running. */
function makeRun(t: Token): Run {
  const check = () => {
    if (t.cancel || t.stop) throw new Cancel();
  };

  async function wait(ms: number) {
    const end = Date.now() + ms / (movie.speed || 1);
    while (Date.now() < end) {
      check();
      await raw(Math.min(100, end - Date.now()));
    }
    // Paused: hold here between beats.
    while (director.status === "paused") {
      check();
      await raw(120);
    }
    check();
  }

  async function until(cond: () => boolean, timeout = 15000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      check();
      if (cond()) return true;
      await raw(150);
    }
    return false;
  }

  async function find(target: string, timeout = 6000) {
    let el: Element | null = null;
    await until(() => !!(el = resolve(target)), timeout);
    return el as Element | null;
  }

  async function settleNew(text: string, seen: Set<string>, timeout = 180000) {
    let s: Session | undefined;
    const done = await until(() => {
      s = agent.sessions.find(x => x.items.some(it => it.t === "user" && it.text === text && !seen.has(it.id)));
      if (!s) return false;
      const last = s.items[s.items.length - 1];
      return last?.t === "agent" && !isBusy(s) && (s.status === "done" || s.status === "stopped");
    }, timeout);
    if (!done && s) abort(s.id);
    // Let the result sit on screen for a beat.
    await wait(1600);
  }

  const run: Run = {
    wait,
    until,
    async point(target) {
      const el = await find(target, 4000);
      if (el) await ghostMove(el);
      check();
    },
    async click(target, opts = {}) {
      const el = await find(target, opts.optional ? 1500 : 6000);
      check();
      if (!el) return false;
      await ghostPress(el);
      check();
      return true;
    },
    async scroll(target, block = "center") {
      const el = await find(target, 3000);
      el?.scrollIntoView({ behavior: "smooth", block });
      await wait(900);
    },
    async page(id, route) {
      const label = document.querySelector(`.os-nav .os-link[data-page="${id}"]`) ? `.os-nav .os-link[data-page="${id}"]` : "";
      if (nav.route.startsWith("ops/") && label && (await run.click(label, { optional: true }))) {
        if (route && nav.route !== route) go(route);
      } else go(route ?? "ops/" + id);
      await wait(700);
    },
    async ask(text, opts = {}) {
      if (nav.route !== "ops/agent") {
        const btn = document.querySelector('.os-nav .os-link[data-page="agent"]');
        if (btn) await ghostPress(btn);
        else go("ops/agent");
        await wait(600);
      }
      const seen = userIds();
      const s = activeSession();
      if (!opts.newTab && s && !isHome(s) && !isBusy(s)) {
        // Same chat: show the cursor going to the composer, then type.
        const box = document.querySelector(`[data-session="${s.id}"] textarea[data-auto="composer"]`);
        if (box) await ghostMove(box);
        void askIn(s, text);
      } else {
        // An empty tab is reused; otherwise new work gets its own tab.
        const fresh = !!opts.newTab && !(s && isHome(s));
        if (fresh) {
          const plus = document.querySelector(".ag-tab-new");
          if (plus) await ghostPress(plus, false);
        }
        launch(text, [], { newTab: fresh });
      }
      await settleNew(text, seen);
    },
    async chip(text) {
      const seen = userIds();
      const el = resolve(`text:.ag-next-b|${text}`);
      if (el) {
        await ghostPress(el);
        await settleNew(text, seen);
      } else await run.ask(text);
    },
    async settle(text) {
      // The prompt was sent by something else (a dashboard button): wait for its turn.
      await settleNew(text, new Set<string>());
    },
    async openCalls() {
      if (nav.callsOpen) return;
      if (!(await run.click(".cc-pill", { optional: true }))) setCallsOpen(true);
      await until(() => nav.callsOpen, 3000);
      await wait(900);
    },
    async closeCalls() {
      if (!nav.callsOpen) return;
      if (!(await run.click('[aria-label="Close calls"]', { optional: true }))) setCallsOpen(false);
      await wait(500);
    },
    async callRow(name) {
      return run.click(`text:.cc-row|${name}`, { optional: true });
    },
  };
  return run;
}

// ---------------------------------------------------------------- transport

export function openLauncher(open = true) {
  director.launcher = open;
  bump();
}

let SEEDED = Infinity;
export function markSeeded() {
  SEEDED = activity.length;
}
/** Actions logged since the page loaded (for the end card). */
export function taken() {
  return Math.max(0, activity.length - (SEEDED === Infinity ? activity.length : SEEDED));
}

const KEY = "zonera-movie-start";

// A film is about to resume after its clean reload: hold the call center's
// morning calls before anything starts them.
try {
  if (sessionStorage.getItem(KEY)) rings.hold = true;
} catch {
  /* no storage */
}

/** Play a story from a chapter. Films reload first so every take starts clean. */
export function play(story: Story, from = 0, opts: { clean?: boolean } = {}) {
  if (story.kind === "film" && opts.clean !== false) {
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ id: story.id, from }));
      location.reload();
      return;
    } catch {
      /* no storage: play on the current state */
    }
  }
  token.stop = true;
  token = { cancel: false, stop: false };
  director.story = story;
  director.idx = from;
  director.status = "playing";
  director.launcher = false;
  director.prevMovie = movie.on;
  rings.hold = story.kind === "film";
  if (!movie.on) setMovie(true);
  document.documentElement.classList.add("mv-on");
  bump();
  void loop(token);
}

/** After a reload requested by play(), pick the story back up. */
export function resumeFromReload(find: (id: string) => Story | undefined) {
  try {
    const v = sessionStorage.getItem(KEY);
    if (!v) return;
    sessionStorage.removeItem(KEY);
    const { id, from } = JSON.parse(v);
    const st = find(id);
    if (st) setTimeout(() => play(st, from, { clean: false }), 900);
  } catch {
    /* ignore */
  }
}

async function loop(t: Token) {
  const story = director.story!;
  const run = makeRun(t);
  while (director.idx < story.chapters.length && !t.stop) {
    const ch = story.chapters[director.idx];
    bump();
    try {
      await ch.beats(run);
    } catch (e) {
      if (!(e instanceof Cancel)) console.warn("movie beat failed", ch.id, e);
    }
    if (t.stop) return;
    if (t.cancel) {
      // Skipped: stop whatever the agent was doing and move on.
      t.cancel = false;
      const s = activeSession();
      if (s && isBusy(s)) abort(s.id);
    }
    ghostHide();
    director.idx++;
  }
  if (t.stop) return;
  director.status = "done";
  ghostHide();
  if (story.kind === "chain") finish();
  bump();
}

export function pause() {
  if (director.status === "playing") director.status = "paused";
  else if (director.status === "paused") director.status = "playing";
  bump();
}

export function skip() {
  if (director.status === "paused") director.status = "playing";
  token.cancel = true;
  bump();
}

export function jump(i: number) {
  const st = director.story;
  if (!st) return;
  token.stop = true;
  const s = activeSession();
  if (s && isBusy(s)) abort(s.id);
  play(st, i, { clean: false });
}

/** End the story and put the demo back how it was. */
export function finish() {
  token.stop = true;
  const s = activeSession();
  if (s && isBusy(s)) abort(s.id);
  director.story = null;
  director.status = "idle";
  releaseCalls();
  ghostHide();
  document.documentElement.classList.remove("mv-on");
  if (movie.on !== director.prevMovie) setMovie(director.prevMovie);
  bump();
}

export function setSpeed(x: number) {
  movie.speed = x;
  bump();
}

export function toggleCaptions() {
  director.captions = !director.captions;
  bump();
}
