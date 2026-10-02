import { useSyncExternalStore } from "react";

// The demo's live state.
//
// Domain data (UNITS, TENANTS, …) lives in src/data as plain mutable objects.
// Anything that changes it — the agent recording a payment, the storefront
// renting a unit, a call-center action — mutates those objects and then calls
// commit(). Every component that called useDemo() re-renders, so an action
// taken in one surface shows up everywhere else immediately.

let version = 0;
const subs = new Set<() => void>();

export interface Activity {
  id: number;
  at: string; // "9:42"
  kind: "gate" | "payment" | "agent" | "movein" | "moveout" | "alert" | "lead" | "call" | "lease" | "rate" | "maintenance";
  text: string;
  who?: string;
}

export interface Toast {
  id: number;
  title: string;
  body?: string;
  tone?: "ok" | "info" | "warn" | "bad" | "call";
  action?: { label: string; route: string };
}

export const activity: Activity[] = [];
export const toasts: Toast[] = [];
let seq = 1;

function notify() {
  version++;
  subs.forEach(f => f());
}

export function subscribe(f: () => void) {
  subs.add(f);
  return () => subs.delete(f);
}

/** Re-render when demo data changes. Returns a version number. */
export function useDemo() {
  return useSyncExternalStore(subscribe, () => version, () => version);
}

export function clock(offsetMin = 0) {
  // The demo day is Friday, Oct 2 2026; the clock starts at 9:44 am and runs in real time.
  const d = new Date(DEMO_START.getTime() + (Date.now() - LOAD_TIME) + offsetMin * 60000);
  let h = d.getHours();
  const m = d.getMinutes();
  const ap = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ap}`;
}
const DEMO_START = new Date(2026, 9, 2, 9, 44, 0);
const LOAD_TIME = Date.now();

/** Apply a mutation to domain data and broadcast it. Optionally log it to the activity feed. */
export function commit(log?: Omit<Activity, "id" | "at"> & { at?: string }) {
  if (log) activity.unshift({ id: seq++, at: log.at ?? clock().replace(/ (am|pm)$/, ""), ...log });
  notify();
}

export function toast(t: Omit<Toast, "id">, ms = 5200) {
  const id = seq++;
  toasts.push({ id, ...t });
  notify();
  window.setTimeout(() => dismissToast(id), ms);
  return id;
}

export function dismissToast(id: number) {
  const i = toasts.findIndex(t => t.id === id);
  if (i >= 0) {
    toasts.splice(i, 1);
    notify();
  }
}

// ---- Routing -------------------------------------------------------------
// Routes are slash paths kept in memory: "store", "store/checkout", "store/access",
// "ops/overview", "ops/tenants/T-1000", "ops/agent", "brand".
// The artifact host only forwards bare #tokens, so the hash mirrors the path with
// slashes turned into dashes ("#ops-tenants-T-1000") and is parsed back on load.

export const nav = {
  route: "store",
  params: {} as Record<string, string>,
  callsOpen: false,
  agentPrompt: null as null | { text: string; key: number },
  theme: null as null | "light" | "dark",
};

export function routeParts() {
  return nav.route.split("/");
}

export function go(route: string, params: Record<string, string> = {}) {
  nav.route = route;
  nav.params = params;
  const hash = route.replace(/\//g, "-");
  if (/^[A-Za-z0-9._~-]+$/.test(hash)) {
    try {
      history.replaceState(null, "", "#" + hash);
    } catch {
      /* sandboxed */
    }
  }
  window.scrollTo?.({ top: 0 });
  notify();
}

const KNOWN = ["store", "ops", "brand", "admin", "onboard"];
export function routeFromHash() {
  const h = (location.hash || "").replace(/^#/, "");
  if (!h) return;
  const [head, ...rest] = h.split("-");
  if (!KNOWN.includes(head)) return;
  if (head === "store" || head === "brand" || head === "onboard") {
    nav.route = [head, ...rest].join("/");
    return;
  }
  // ops-<page>-<id with dashes, e.g. T-1000 or A-126>; admin-<page>-<id> the same way
  const page = rest[0] ?? "overview";
  const id = rest.slice(1).join("-");
  nav.route = id ? `${head}/${page}/${id}` : `${head}/${page}`;
}

export function setCallsOpen(open: boolean) {
  nav.callsOpen = open;
  notify();
}

/** Open agent mode with a prompt typed into the composer (and optionally sent). */
export function askAgent(text: string) {
  nav.agentPrompt = { text, key: seq++ };
  go("ops/agent");
}

export function setTheme(t: "light" | "dark" | null) {
  nav.theme = t;
  if (t) document.documentElement.setAttribute("data-theme", t);
  else document.documentElement.removeAttribute("data-theme");
  notify();
}

// ---- Movie mode -------------------------------------------------------------
// When on, scripted flows (checkout, agent scenarios, calls) type and click for
// themselves at a watchable pace, so the demo can be filmed hands-free.
export const movie = { on: false, speed: 1 };
export function setMovie(on: boolean) {
  movie.on = on;
  notify();
}

export const fmt = {
  money: (n: number, cents = false) =>
    (n < 0 ? "−" : "") + "$" + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 }),
  pct: (n: number, d = 1) => (n * 100).toFixed(d) + "%",
  date: (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
  short: (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
};

export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms / (movie.speed || 1)));
