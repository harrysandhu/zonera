import { useSyncExternalStore } from "react";
import { movie, nav, toast } from "../../state/store";
import type { FlowState, Stage, StepKind, Check } from "./types";
import { TASKS, TASK_BY_ID, OWNER_ITEMS, ITEM_BY_ID, REQ_BY_ID, PEOPLE } from "./data/deal";
import { VMS, VM_BY_ID, CHECKS, N } from "./data/vms";

// The Automated FDE, simulated.
//
// One onboarding (Brennan Storage Co. → Alder Lake) plays out as a dependency graph:
// owner items and tasks unblock tasks; each task runs as a script on its VM; scripts
// print terminal lines, drive a browser, and fire hooks that reveal requirements,
// owner items, checks, exceptions and mail. HQ and the owner portal both render from
// this one object, so a click on either side shows up on the other immediately.

export type TaskState = "hidden" | "blocked" | "queued" | "running" | "waiting" | "done";
type ItemState = "hidden" | "waiting" | "open" | "done";
type VmState = "off" | "booting" | "running" | "idle" | "done";
type ExcState = "hidden" | "open" | "resolved";

export interface TermLine {
  id: number;
  kind: StepKind | "boot";
  text: string;
  at: string;
}

export interface VmRun {
  state: VmState;
  lines: TermLine[];
  frame?: import("./types").Frame;
  cpu: number;
  tokens: number;
  task?: string;
  queue: string[];
  bootedAt?: string;
}

export interface FeedEvent {
  id: number;
  at: string;
  who: "agent" | "owner" | "vendor" | "human" | "system";
  text: string;
  /** Owner-facing wording; events without it stay internal to HQ. */
  owner?: string;
  ref?: string;
}

export const fde = {
  run: "idle" as "idle" | "running" | "live",
  speed: 1,
  autopilot: false,
  story: 0,
  focusLine: "",
  reqs: [] as string[],
  planned: false,
  portalSent: false,
  twin: false,
  bankFound: false,
  subscription: false,
  items: {} as Record<string, { state: ItemState; value?: string; at?: string }>,
  tasks: {} as Record<string, { state: TaskState; at?: string }>,
  vms: {} as Record<string, VmRun>,
  checks: {} as Record<string, Check["status"]>,
  exc: {} as Record<string, { state: ExcState; choice?: string; at?: string }>,
  mails: [] as string[],
  feed: [] as FeedEvent[],
  touches: 0,
  flow: "DRAFT" as FlowState,
};

// ---- subscription ----------------------------------------------------------

let version = 0;
const subs = new Set<() => void>();
function notify() {
  version++;
  subs.forEach(f => f());
}
function subscribe(f: () => void) {
  subs.add(f);
  return () => subs.delete(f);
}
/** Re-render when the onboarding changes. */
export function useFde() {
  return useSyncExternalStore(subscribe, () => version, () => version);
}

// ---- story clock -------------------------------------------------------------
// Minutes since the second call ended: Wed Sep 30, 6:12 pm.

const T0 = new Date(2026, 8, 30, 18, 12);
export const ANCHOR = {
  owner: 149, // Gail opens the link at 8:41 pm
  followup: 820, // Thu 7:52 am
  nudge: 948, // Thu 10:00 am
  dealerReply: 1026, // Thu 11:18 am
  sms: 828, // Thu 8:00 am, when the office opens
  smsReply: 834,
  escalate: 890, // Thu 9:02 am, Jordan's morning
  cutover: 2133, // Fri 5:45 am
};

export function clockAt(min = fde.story) {
  const d = new Date(T0.getTime() + min * 60000);
  const day = d.toLocaleDateString("en-US", { weekday: "short" });
  let h = d.getHours();
  const ap = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;
  return `${day} ${h}:${String(d.getMinutes()).padStart(2, "0")} ${ap}`;
}
export function elapsed(min = fde.story) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}
function advance(to: number) {
  fde.story = Math.max(fde.story, to);
}
function bump(min: number) {
  fde.story += min;
}

// ---- timers (cancellable on reset) -------------------------------------------

let gen = 0;
const timers = new Set<number>();
function later(ms: number, f: () => void) {
  const g = gen;
  const id = window.setTimeout(() => {
    timers.delete(id);
    if (g === gen) f();
  }, ms / fde.speed);
  timers.add(id);
}
const wait = (ms: number) => new Promise<void>(r => later(ms, r));
async function until(flag: string) {
  const g = gen;
  while (!flags.has(flag)) {
    await new Promise(r => setTimeout(r, 120));
    if (g !== gen) throw new Error("reset");
  }
}
const flags = new Set<string>();
let seq = 1;
let followupSent = false;
let driving = false;

const auto = () => fde.autopilot || movie.on;
const onHq = () => nav.route.startsWith("admin");
const onPortal = () => nav.route.startsWith("onboard");

// ---- feed ---------------------------------------------------------------------

function log(who: FeedEvent["who"], text: string, owner?: string, ref?: string) {
  fde.feed.unshift({ id: seq++, at: clockAt(), who, text, owner, ref });
}

const OWNER_COPY: Record<string, { start?: string; done: string }> = {
  T3: { done: "Pulled your public listing, permits and photos" },
  T4: { done: "Drew your facility in 3D from the 2014 site plan" },
  T5: { done: "Built your storefront at zonera.com/alder-lake" },
  T6: { start: "Signing in to Keystone to read your rent roll", done: `Rent roll moved: ${N.tenants} tenants, ${N.units} units` },
  T7: { done: `Ledgers moved: ${N.ledger.toLocaleString()} lines back to 2019` },
  T8: { done: `Leases, IDs and notes moved: ${N.docs} documents` },
  T9: { done: `${N.autopay} autopay cards moved securely. No one re-enters a card` },
  T10: { start: "Emailed Marcus at Sierra Access for PDK access", done: "Marcus sent the PDK key" },
  T11: { done: `Gate codes synced to PDK: ${N.tenants} of ${N.tenants}` },
  T12: { done: "After-hours calls forward to Zonera Voice" },
  T13: { done: "Subscription started. Nothing charged until Dec 1" },
  T14: { done: "Your lease is set up word for word" },
  T15: { done: "Late-payment playbook armed" },
  T16: { done: "Existing rents held until April 2027" },
  T17: { done: "Priya's invite is on its way" },
  T18: { start: "Checking every tenant, unit and balance against Keystone", done: "Every tenant, unit and balance matches Keystone to the cent" },
  T19: { done: "Every gate code verified against PDK" },
  T20: { done: `Autopay test passed for all ${N.autopay} cards` },
  T21: { done: "You're live. Moved before the gate opened" },
  T22: { done: "Truck rentals are on your storefront" },
};

// ---- lifecycle ------------------------------------------------------------------

/** What the onboarding adds to the portfolio once it goes live. */
export const portfolioDelta = { live: 0 };

export function resetFde() {
  gen++;
  timers.forEach(t => clearTimeout(t));
  timers.clear();
  flags.clear();
  followupSent = false;
  driving = false;
  portfolioDelta.live = 0;
  Object.assign(fde, {
    run: "idle", story: 0, focusLine: "", reqs: [], planned: false, portalSent: false, twin: false, bankFound: false, subscription: false,
    touches: 0, flow: "DRAFT", mails: [], feed: [],
  });
  fde.items = Object.fromEntries(OWNER_ITEMS.map(i => [i.id, { state: "hidden" as ItemState }]));
  fde.tasks = Object.fromEntries(TASKS.map(t => [t.id, { state: (t.late ? "hidden" : "blocked") as TaskState }]));
  fde.vms = Object.fromEntries(VMS.map(v => [v.id, { state: "off" as VmState, lines: [], cpu: 0, tokens: 0, queue: [] }]));
  fde.checks = Object.fromEntries(CHECKS.map(c => [c.id, "pending" as Check["status"]]));
  fde.exc = { size: { state: "hidden" }, dup: { state: "hidden" } };
  log("system", "Call ended: Walkthrough and terms · Brennan Storage Co. (41 min)");
  notify();
}
resetFde();

/** Kick off: the second call just ended. */
export function startFde() {
  if (fde.run !== "idle") return;
  fde.run = "running";
  log("system", "Recording and transcript ingested. Automated FDE started");
  reconcile();
  notify();
}

export function setSpeed(n: number) {
  fde.speed = n;
  notify();
}

export function setAutopilot(on: boolean) {
  fde.autopilot = on;
  notify();
  if (on) driveOwner();
}

// ---- dependency graph -------------------------------------------------------------

function satisfied(need: string) {
  if (need.startsWith("O")) return fde.items[need]?.state === "done";
  return fde.tasks[need]?.state === "done";
}

function reconcile() {
  if (fde.run === "idle") return;
  for (const t of TASKS) {
    const st = fde.tasks[t.id];
    if (st.state !== "blocked") continue;
    if (!t.needs.every(satisfied)) continue;
    st.state = "queued";
    const vm = fde.vms[t.vm];
    vm.queue.push(t.id);
    pump(t.vm);
  }
  // O7 opens once the migrator has found the deposit account.
  const o7 = fde.items.O7;
  if (o7.state === "waiting" && fde.bankFound) o7.state = "open";
  notify();
}


async function pump(vmId: string) {
  const vm = fde.vms[vmId];
  if (vm.state === "running" || vm.state === "booting") return;
  const next = vm.queue.shift();
  if (!next) return;
  const g = gen;
  try {
    if (vm.state === "off") await boot(vmId);
    await runTask(vmId, next);
  } catch {
    return; // reset mid-run
  }
  if (g !== gen) return;
  vm.state = "idle";
  vm.task = undefined;
  vm.cpu = 2;
  notify();
  pump(vmId);
}

async function boot(vmId: string) {
  const vm = fde.vms[vmId];
  const def = VM_BY_ID.get(vmId)!;
  vm.state = "booting";
  vm.bootedAt = clockAt();
  vm.cpu = 12;
  log("agent", `${vmId} booted · ${def.profile}${def.parent ? ` · sub-agent of ${def.parent}` : ""}`, undefined, vmId);
  const boot = [
    `microVM ${vmId} · ${def.vcpu} vCPU · ${def.memGb} GB · ${def.region}`,
    `codex harness ready · profile ${def.profile}${def.browser ? " · chromium + computer use" : ""}`,
    `policy ${def.profile}@brennan attached · staging writes only · egress allow-list`,
  ];
  for (const text of boot) {
    vm.lines.push({ id: seq++, kind: "boot", text, at: clockAt() });
    notify();
    await wait(260);
  }
}

async function runTask(vmId: string, taskId: string) {
  const vm = fde.vms[vmId];
  const def = VM_BY_ID.get(vmId)!;
  const script = def.scripts.find(s => s.task === taskId);
  const t = TASK_BY_ID.get(taskId)!;
  vm.state = "running";
  vm.task = taskId;
  fde.tasks[taskId].state = "running";
  fde.tasks[taskId].at = clockAt();
  if (taskId === "T18") bump(4);
  const copy = OWNER_COPY[taskId];
  log("agent", `${vmId} started ${taskId} · ${t.title}`, copy?.start, vmId);
  notify();
  if (!script) return;
  if (vm.lines.length && vm.lines[vm.lines.length - 1].kind !== "boot") vm.lines.push({ id: seq++, kind: "note", text: "", at: clockAt() });
  for (const step of script.steps) {
    if (step.until) {
      vm.cpu = 3;
      notify();
      await until(step.until);
    }
    await wait(step.wait ?? 500);
    vm.cpu = 38 + Math.round(Math.random() * 50);
    vm.tokens += 600 + Math.round(Math.random() * 2400);
    vm.lines.push({ id: seq++, kind: step.kind, text: step.text, at: clockAt() });
    if (step.frame) vm.frame = step.frame;
    if (step.fire) step.fire.split("|").forEach(fire);
    notify();
  }
  if (taskId === "T10") {
    // The VM is released while the vendor answers; the reply re-opens the task.
    fde.tasks[taskId].state = "waiting";
    notify();
    return;
  }
  fde.tasks[taskId].state = "done";
  bump(taskId === "T6" ? 5 : taskId === "T7" ? 6 : 2);
  if (copy) log("agent", `${taskId} done · ${t.title}`, copy.done, vmId);
  if (taskId === "T1") fde.flow = "DETAILS_COMPLETE";
  if (taskId === "T6") maybeFollowup();
  reconcile();
}

// ---- hooks fired by script lines ------------------------------------------------------

function fire(h: string) {
  const [k, a, b] = h.split(":");
  switch (k) {
    case "line":
      fde.focusLine = a ?? "";
      break;
    case "req":
      if (!fde.reqs.includes(a)) fde.reqs.push(a);
      bump(0.2);
      break;
    case "plan":
      fde.planned = true;
      fde.flow = "PLAN_CONFIGURED";
      advance(6);
      log("agent", "Plan compiled: 22 tasks across 8 VMs");
      break;
    case "item": {
      const it = ITEM_BY_ID.get(a)!;
      fde.items[a].state = it.waitsOn && !fde.bankFound ? "waiting" : "open";
      if (it.late) {
        log("agent", "Owner checklist updated: truck rentals", "New from your email: truck rentals at the front desk");
        if (onPortal()) toast({ title: "Added from your email", body: "Truck rentals at the front desk", tone: "info" });
      }
      break;
    }
    case "task":
      if (fde.tasks[a].state === "hidden") fde.tasks[a].state = "blocked";
      break;
    case "flow":
      fde.flow = a as FlowState;
      break;
    case "mail":
      deliver(a);
      break;
    case "found":
      fde.bankFound = true;
      log("agent", "Found the deposit account in Keystone settings: Sierra Pacific ••••0918", "Found your payout account in Keystone. Confirm it when you're ready");
      break;
    case "twin":
      fde.twin = true;
      break;
    case "stripe":
      fde.subscription = true;
      break;
    case "check":
      fde.checks[a] = b as Check["status"];
      break;
    case "exc":
      openException(a);
      break;
    case "vendor":
      later(21000, () => deliver("dealerNudge"));
      later(29000, () => vendorReplied());
      break;
    case "clock":
      if (a === "cutover") advance(ANCHOR.cutover);
      break;
    case "live":
      goLive();
      break;
  }
}

function deliver(id: string) {
  if (fde.mails.includes(id)) return;
  if (id === "portal") {
    advance(7);
    fde.portalSent = true;
    log("agent", "Portal sent to Gail: 5 things, about 9 minutes", "Jordan sent you this page");
    if (onHq()) toast({ title: "Portal sent to Gail Brennan", body: "11 items generated from 2 calls. No template.", tone: "ok", action: { label: "View as Gail", route: "onboard/home" } });
    if (auto()) driveOwner();
  }
  if (id === "dealer") {
    bump(1);
    log("vendor", "Emailed Marcus Webb (Sierra Access) for PDK API access, Gail cc'd", "We emailed Marcus at Sierra Access for your PDK key. You're copied");
  }
  if (id === "dealerNudge") {
    advance(ANCHOR.nudge);
    log("vendor", "Nudged Marcus Webb: no reply overnight");
  }
  if (id === "dealerReply") {
    advance(ANCHOR.dealerReply);
    log("vendor", "Marcus Webb replied with the PDK API key · site 4471", "Marcus sent the PDK key");
  }
  if (id === "followup") {
    advance(ANCHOR.followup);
    log("owner", "New email from Gail: “we're a U-Haul dealer at the front desk”");
    if (onHq()) toast({ title: "New context from Gail", body: "“We're a U-Haul dealer at the front desk.” Re-planning.", tone: "info" });
    fde.tasks.T23.state = "blocked";
  }
  if (id === "priyaSms") advance(ANCHOR.sms);
  if (id === "priyaReply") advance(ANCHOR.smsReply);
  fde.mails.push(id);
  notify();
  reconcile();
}

function maybeFollowup() {
  if (followupSent) return;
  followupSent = true;
  later(2600, () => deliver("followup"));
}

function vendorReplied() {
  deliver("dealerReply");
  const vm = fde.vms["vm-5a08"];
  vm.lines.push({ id: seq++, kind: "out", text: "email.recv from Marcus Webb · API key + site 4471", at: clockAt() });
  vm.lines.push({ id: seq++, kind: "tool", text: "vault.put pdk/alder-lake · scope credentials, events", at: clockAt() });
  vm.lines.push({ id: seq++, kind: "ok", text: "PDK access in hand", at: clockAt() });
  fde.tasks.T10.state = "done";
  log("agent", "T10 done · PDK access in hand", OWNER_COPY.T10.done, "vm-5a08");
  reconcile();
}

// ---- exceptions -------------------------------------------------------------------------

function openException(id: string) {
  const e = fde.exc[id];
  if (e.state !== "hidden") return;
  e.state = "open";
  e.at = clockAt();
  if (id === "size") {
    log("agent", "D-209: Keystone says 10×15, 2014 site plan says 10×10. Texting Priya when the office opens");
    later(1100, () => deliver("priyaSms"));
    later(2600, () => {
      deliver("priyaReply");
      e.state = "resolved";
      e.choice = "10x10";
      flags.add("size");
      log("owner", "Priya: “It's a 10×10. Keystone's been wrong since 2019.” D-209 corrected", "Priya confirmed D-209 is a 10×10");
      notify();
    });
  }
  if (id === "dup") {
    advance(ANCHOR.escalate);
    log("human", "Escalated to Jordan: two Keystone records for Matthew Okafor");
    if (onHq()) toast({ title: "Needs you · 1 decision", body: "Two Keystone records look like the same person.", tone: "warn", action: { label: "Decide", route: "admin/queue" } }, 8000);
    if (auto()) later(5200, () => resolveException("dup", "merge"));
  }
  notify();
}

export function resolveException(id: string, choice: string) {
  const e = fde.exc[id];
  if (e.state !== "open") return;
  e.state = "resolved";
  e.choice = choice;
  e.at = clockAt();
  bump(7);
  fde.touches++;
  flags.add(id);
  log("human", choice === "merge" ? "Jordan merged the two Okafor records and kept the 2023 history" : "Jordan kept the Okafor records separate", undefined);
  notify();
}

// ---- owner actions -------------------------------------------------------------------------

const OWNER_LOG: Record<string, string> = {
  O1: "Gail shared the Keystone login (vaulted · read-only · revoked after cutover)",
  O2: "Gail said yes: ask Marcus at Sierra Access for PDK access",
  O3: "Gail uploaded the lease (March revision, 14 pages)",
  O4: "Gail confirmed the late-payment playbook",
  O5: "Gail chose: hold existing rents for 6 months",
  O6: "Gail chose the storefront name: Zonera Alder Lake",
  O7: "Gail confirmed payouts to Sierra Pacific ••••0918",
  O8: "Gail invited Priya as manager (no financials)",
  O9: "Gail turned on after-hours calls",
  O10: "Gail signed the MSA",
  O11: "Gail started the subscription (test card, trial to Dec 1)",
  O12: "Gail turned on truck rentals",
};

export function ownerDo(id: string, value?: string) {
  const it = fde.items[id];
  if (!it || it.state !== "open") return;
  if (fde.story < ANCHOR.owner) advance(ANCHOR.owner);
  else bump(1);
  it.state = "done";
  it.value = value;
  it.at = clockAt();
  log("owner", OWNER_LOG[id] ?? `Gail completed ${id}`);
  if (id === "O10") fde.flow = "AWAITING_PAYMENT";
  if (id === "O11") fde.flow = "ONBOARDING_IN_PROGRESS";
  notify();
  reconcile();
}

/** Autopilot: Gail works through her checklist on her own. */
async function driveOwner() {
  if (driving || !fde.portalSent) return;
  driving = true;
  const g = gen;
  const order = ["O1", "O2", "O3", "O4", "O5", "O6", "O8", "O9", "O10", "O11", "O7", "O12"];
  try {
    for (let pass = 0; pass < 400 && g === gen && auto(); pass++) {
      const next = order.find(id => fde.items[id].state === "open");
      if (!next) {
        if (fde.run === "live" || order.every(id => fde.items[id].state === "done")) break;
        await wait(900);
        continue;
      }
      await wait(next === "O1" ? 2200 : 1050);
      if (g !== gen) break;
      ownerDo(next, ITEM_BY_ID.get(next)!.prefill?.value);
    }
  } catch {
    /* reset */
  }
  driving = false;
}

// ---- go-live -----------------------------------------------------------------------------

function goLive() {
  fde.run = "live";
  fde.flow = "ACTIVE";
  portfolioDelta.live = 1;
  Object.values(fde.vms).forEach(v => {
    if (v.state !== "off") v.state = "done";
    v.cpu = 0;
  });
  deliver("live");
  log("system", `Alder Lake is live · ${elapsed()} from call to cutover · ${fde.touches} human touch${fde.touches === 1 ? "" : "es"}`, "You're live on Zonera");
  toast({ title: "Alder Lake is live", body: `${elapsed()} from the call. ${fde.touches} human touch.`, tone: "ok", action: { label: "Open console", route: "ops/overview" } }, 9000);
  notify();
}

// ---- derived ---------------------------------------------------------------------------------

export function stage(): Stage {
  const st = (id: string) => fde.tasks[id]?.state;
  if (fde.run === "live") return "live";
  if (["T18", "T19", "T20", "T21"].some(id => st(id) === "running" || st(id) === "done")) return "validate";
  if (["T6", "T7", "T8", "T11"].some(id => st(id) === "running" || st(id) === "done")) return "migrate";
  if (fde.portalSent) return "collect";
  if (st("T2") === "running" || fde.planned) return "plan";
  return "context";
}

export const STAGES: { id: Stage; label: string }[] = [
  { id: "context", label: "Context" },
  { id: "plan", label: "Plan" },
  { id: "collect", label: "Collect" },
  { id: "migrate", label: "Migrate" },
  { id: "validate", label: "Validate" },
  { id: "live", label: "Live" },
];

export function ownerProgress() {
  const visible = OWNER_ITEMS.filter(i => fde.items[i.id].state !== "hidden");
  const done = visible.filter(i => fde.items[i.id].state === "done");
  const minutes = visible.filter(i => fde.items[i.id].state !== "done").reduce((a, i) => a + i.minutes, 0);
  return { total: visible.length, done: done.length, minutes: Math.ceil(minutes) };
}

export function taskProgress() {
  const visible = TASKS.filter(t => fde.tasks[t.id].state !== "hidden");
  const done = visible.filter(t => fde.tasks[t.id].state === "done");
  return { total: visible.length, done: done.length, pct: visible.length ? done.length / visible.length : 0 };
}

export function overallProgress() {
  if (fde.run === "live") return 1;
  const o = ownerProgress();
  const t = taskProgress();
  const total = (o.total || 11) + t.total;
  return (o.done + t.done) / total;
}

export function runningVms() {
  return Object.entries(fde.vms).filter(([, v]) => v.state === "running" || v.state === "booting").map(([id]) => id);
}

export function openExceptions() {
  return Object.entries(fde.exc).filter(([, e]) => e.state === "open").map(([id]) => id);
}

export function whoName(id: string) {
  return PEOPLE[id]?.name ?? id;
}

export { REQ_BY_ID };
