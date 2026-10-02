import { movie, sleep, setCallsOpen, toast, nav, clock } from "../state/store";
import { typeInto } from "../ui";
import { TENANT_BY_ID } from "../data/tenants";
import { registerCallCenter, type OutboundCallRequest } from "./api";
import { calls, recent, ui, stats, campaigns, bump, nextCallId, nextEvId } from "./state";
import { SCRIPTS, genericScript, seedCampaignsAndRecent, type Purpose } from "./scripts";
import type { Call, Ev, Handler, LineEv, NoteEv, RecentCall, Script, Speaker, Step, ToolEv, Txt } from "./types";

// The simulation. Each call plays its script as an async loop: lines stream word
// by word, tools run as chips, and humans can whisper, take over and hand back
// at any point. Takeovers turn the next AI lines into copilot suggestions.

seedCampaignsAndRecent();

export const dead = (c: Call) => c.status === "ended" || c.status === "wrap";
export const isLive = (c: Call) => c.status !== "ended";
export const elapsed = (c: Call) => (c.status === "ringing" || c.status === "dialing" ? 0 : c.duration ?? Math.max(0, Math.floor((Date.now() - c.startedAt) / 1000)));
export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
export const txt = (t: Txt, c: Call) => (typeof t === "function" ? t(c) : t);
export const callById = (id: string | null | undefined) => (id ? calls.find(c => c.id === id) : undefined);
export const liveCalls = () => calls.filter(c => c.status !== "ended");
export const moodNow = (c: Call) => (c.mood.length ? c.mood[c.mood.length - 1].v : 0.1);

function makeCall(s: Script, status: Call["status"], handler: Handler = "ai"): Call {
  return {
    id: nextCallId(),
    script: s,
    direction: s.direction,
    name: s.name,
    phone: s.phone,
    tenantId: s.tenantId,
    lead: s.lead,
    intent: s.intent,
    campaign: s.campaign,
    status,
    handler,
    startedAt: Date.now(),
    createdAt: Date.now(),
    clockAt: clock(),
    events: [],
    mood: [],
    speaking: null,
    wordTick: 0,
    listening: false,
    whisperOpen: false,
    draft: "",
    reply: "",
    usedWhispers: [],
    passedKeys: [],
    _insert: [],
    _cursor: 0,
  };
}

function push<T extends Ev>(c: Call, ev: T) {
  c.events.push(ev);
  return ev;
}
function note(c: Call, tone: NoteEv["tone"], text: string) {
  push(c, { kind: "note", id: nextEvId(), text, at: elapsed(c), tone });
}

// ---- Playback ---------------------------------------------------------------------

function wordMs(w: string, who: Speaker) {
  let ms = (who === "caller" ? 200 : 186) + w.length * 13 + Math.random() * 60;
  if (/[,;:]$/.test(w)) ms += 150;
  if (/[.?!…]$/.test(w)) ms += 280;
  return ms;
}

async function stream(c: Call, who: Speaker, text: string) {
  const words = text.split(/\s+/).filter(Boolean);
  const ev = push<LineEv>(c, { kind: "line", id: nextEvId(), who, words, shown: 0, at: elapsed(c), done: false });
  c.speaking = who;
  bump();
  for (let i = 0; i < words.length; i++) {
    if (dead(c)) break;
    ev.shown = i + 1;
    c.wordTick++;
    bump();
    await sleep(wordMs(words[i], who));
  }
  ev.done = true;
  if (c.speaking === who) c.speaking = null;
  bump();
}

function askHuman(c: Call, options: string[]): Promise<string | null> {
  if (c._pendingHuman) {
    const t = c._pendingHuman;
    c._pendingHuman = undefined;
    return Promise.resolve(t);
  }
  c.suggest = options;
  bump();
  return new Promise(res => {
    c._reply = v => {
      c._reply = undefined;
      c.suggest = undefined;
      bump();
      res(v);
    };
    if (movie.on) {
      const pick = options[0];
      setTimeout(() => {
        if (c._reply && c.suggest?.[0] === pick && movie.on) c._reply(pick);
      }, 2600 / (movie.speed || 1));
    }
  });
}

async function speak(c: Call, who: "ai" | "caller", text: string, o: { alts?: string[]; mood?: number; aiText?: string } = {}) {
  let speaker: Speaker = who;
  if (who === "ai" && c.handler === "human") {
    const choice = await askHuman(c, [text, ...(o.alts ?? [])]);
    if (dead(c)) return;
    if (choice !== null) {
      text = choice;
      speaker = "human";
    } else if (o.aiText) text = o.aiText;
  } else if (who === "ai" && o.aiText && c.tookOver) {
    // Handed back mid-branch: the AI shouldn't speak lines written for Priya.
    text = o.aiText;
  }
  await stream(c, speaker, text);
  if (o.mood !== undefined) c.mood.push({ at: elapsed(c), v: o.mood });
  bump();
  await sleep(who === "caller" ? 650 + Math.random() * 300 : 750 + Math.random() * 350);
}

async function flushInserts(c: Call) {
  while (c._insert && c._insert.some(i => !i.replaces) && !dead(c)) {
    const i = c._insert.findIndex(x => !x.replaces);
    const [ins] = c._insert.splice(i, 1);
    await speak(c, "ai", txt(ins.line, c));
  }
}

async function step(c: Call, s: Step) {
  if (s.t === "say") {
    if (s.who === "ai") {
      await flushInserts(c);
      if (dead(c)) return;
      let text = txt(s.text, c);
      if (s.key) {
        c.passedKeys.push(s.key);
        const r = c._insert?.findIndex(i => i.replaces === s.key) ?? -1;
        if (r >= 0) text = txt(c._insert!.splice(r, 1)[0].line, c);
      }
      await speak(c, "ai", text, { alts: s.alts, aiText: s.aiText ? txt(s.aiText, c) : undefined });
    } else {
      await speak(c, "caller", txt(s.text, c), { mood: s.mood });
    }
  } else if (s.t === "tool") {
    const ev = push<ToolEv>(c, { kind: "tool", id: nextEvId(), tool: s.tool, label: txt(s.running ?? s.label, c), at: elapsed(c), done: false, by: c.handler });
    bump();
    await sleep(s.ms ?? 1250);
    if (dead(c)) return;
    s.run?.(c);
    ev.label = txt(s.label, c);
    ev.done = true;
    bump();
    await sleep(450);
  } else if (s.t === "wait") {
    await sleep(s.ms);
  } else if (s.t === "do") {
    s.run(c);
    bump();
  } else if (s.t === "escalate") {
    c.alert = { reason: s.reason, detail: s.detail };
    note(c, "alert", `Zonera Voice asked for you · ${s.reason}`);
    bump();
    toast(
      { title: `${c.name} needs you`, body: `${s.reason}. Zonera Voice is holding the call.`, tone: "warn", action: { label: "Open call", route: `ops/calls/${c.id}` } },
      9000,
    );
    if (movie.on) movieTakeover(c);
    const t0 = Date.now();
    while (!dead(c) && c.handler !== "human" && Date.now() - t0 < s.timeoutMs) await new Promise(r => setTimeout(r, 200));
    if (dead(c)) return;
    c.alert = undefined;
    if (c.handler !== "human") note(c, "system", "No one joined · Zonera Voice is wrapping up");
    bump();
    await play(c, c.handler === "human" ? s.ifHuman : s.ifAI, false);
  }
}

async function play(c: Call, steps: Step[], top: boolean) {
  for (let i = top ? c._cursor : 0; i < steps.length; i++) {
    if (dead(c)) return false;
    if (top) c._cursor = i;
    await step(c, steps[i]);
  }
  if (top) {
    c._cursor = steps.length;
    await flushInserts(c);
  }
  return !dead(c);
}

async function run(c: Call) {
  const ok = await play(c, c.script.steps, true);
  if (ok) {
    await sleep(600);
    finish(c, true);
  }
}

// ---- Lifecycle --------------------------------------------------------------------

function estimate(s: Step) {
  if (s.t === "say") return (typeof s.text === "string" ? s.text.split(" ").length : 18) * 0.3 + 0.9;
  if (s.t === "tool") return 1.6;
  if (s.t === "wait") return s.ms / 1000;
  return 0;
}

/** Calls already in progress when the demo loads: play the first steps instantly. */
function startLive(s: Script) {
  const c = makeCall(s, "live");
  const n = s.preroll ?? 0;
  const offset = s.startOffset ?? 20;
  c.startedAt = Date.now() - offset * 1000;
  c.createdAt = c.startedAt;
  c.clockAt = clock(-Math.ceil(offset / 60));
  const steps = s.steps.slice(0, n);
  const est = steps.map(estimate);
  const k = (offset - 3) / Math.max(1, est.reduce((a, b) => a + b, 0));
  let at = 1;
  steps.forEach((st, i) => {
    if (st.t === "say") {
      const words = txt(st.text, c).split(/\s+/);
      push<LineEv>(c, { kind: "line", id: nextEvId(), who: st.who, words, shown: words.length, at: Math.round(at), done: true });
      if (st.who === "ai" && st.key) c.passedKeys.push(st.key);
      if (st.mood !== undefined) c.mood.push({ at: Math.round(at), v: st.mood });
    } else if (st.t === "tool") {
      st.run?.(c);
      push<ToolEv>(c, { kind: "tool", id: nextEvId(), tool: st.tool, label: txt(st.label, c), at: Math.round(at), done: true, by: "ai" });
    } else if (st.t === "do") st.run(c);
    at += est[i] * k;
  });
  c._cursor = n;
  calls.push(c);
  run(c);
  return c;
}

async function ring(s: Script) {
  const c = makeCall(s, "ringing");
  c._listenOnOpen = true;
  calls.unshift(c);
  bump();
  const ten = s.tenantId ? TENANT_BY_ID.get(s.tenantId) : undefined;
  const t = ten ? `${ten.unitIds[0]}${ten.daysLate ? ` · ${ten.daysLate} days past due` : ""}. Zonera Voice is answering.` : "New number. Zonera Voice is answering.";
  toast({ title: `Incoming call · ${c.name === "New caller" ? c.phone : c.name}`, body: t, tone: "call", action: { label: "Listen", route: `ops/calls/${c.id}` } }, 8000);
  await sleep(4600);
  if (c.status === "ringing") answer(c, "ai");
}

export function answer(c: Call, who: Handler) {
  if (c.status !== "ringing") return;
  c.status = "live";
  c.handler = who;
  if (who === "human") {
    c.tookOver = true;
    note(c, "system", "Priya answered · Zonera Voice is your copilot");
  }
  c.startedAt = Date.now();
  c.clockAt = clock();
  bump();
  run(c);
}

async function dial(c: Call) {
  await sleep(3400);
  if (c.status !== "dialing") return;
  c.status = "live";
  c.startedAt = Date.now();
  c.clockAt = clock();
  note(c, "system", c.handler === "human" ? "Connected · Zonera Voice is your copilot" : "Connected");
  bump();
  run(c);
}

function toRecent(c: Call): RecentCall {
  return {
    id: c.id,
    at: c.clockAt,
    name: c.name,
    phone: c.phone,
    direction: c.direction,
    intent: c.intent,
    outcome: c.outcome ?? "",
    tone: c.tone ?? "neutral",
    duration: c.duration ?? 0,
    mood: moodNow(c),
    by: c.tookOver ? "human" : "ai",
    summary: c.summary ?? "",
    tenantId: c.tenantId,
    call: c,
  };
}

export async function finish(c: Call, completed: boolean, by = "Priya") {
  if (dead(c)) return;
  if (c.status === "ringing" || c.status === "dialing") {
    c.outcome = c.status === "ringing" ? "Declined" : "Cancelled";
    c.status = "ended";
    c.duration = 0;
    c.summary = "Call cancelled before it connected.";
    bump();
    return;
  }
  c.duration = elapsed(c);
  c.status = "wrap";
  c.speaking = null;
  c.alert = undefined;
  c.whisperOpen = false;
  const r = c._reply;
  c._reply = undefined;
  c.suggest = undefined;
  r?.(null);
  c.endedAt = Date.now();
  note(c, "system", completed ? "Call ended" : `${by} ended the call`);
  bump();
  await sleep(1900);
  const tools = c.events.filter((e): e is ToolEv => e.kind === "tool" && e.done).map(e => e.label);
  c.completed = completed;
  c.outcome = completed ? txt(c.script.outcome, c) : tools.length ? `Ended early · ${tools[tools.length - 1].split(" · ")[0]}` : "Ended early";
  c.summary = completed
    ? txt(c.script.summary, c)
    : `${c.name} · ${c.intent.toLowerCase()}. ${by} ended the call at ${mmss(c.duration)}.${tools.length ? " Done on the call: " + tools.join("; ") + "." : ""}`;
  c.tone = completed ? c.script.tone ?? "ok" : "neutral";
  c.status = "ended";
  recent.unshift(toRecent(c));
  bump();
  if (c.campaign) {
    const camp = campaigns.find(x => x.id === c.campaign);
    if (camp) {
      camp.done++;
      setTimeout(() => nextInCampaign(camp.id), 7000);
    }
  }
}

/** Skip a call to its end, applying the data changes it would have made. */
function fastForward(c: Call) {
  if (dead(c)) return;
  for (let i = c._cursor; i < c.script.steps.length; i++) {
    const s = c.script.steps[i];
    if (s.t === "tool") s.run?.(c);
    if (s.t === "do") s.run(c);
  }
  c._cursor = c.script.steps.length;
  c.duration = elapsed(c);
  c.status = "ended";
  c.speaking = null;
  c._reply?.(null);
  c.completed = true;
  c.outcome = txt(c.script.outcome, c);
  c.summary = txt(c.script.summary, c);
  c.tone = c.script.tone ?? "ok";
  recent.unshift(toRecent(c));
  bump();
}

function nextInCampaign(id: string) {
  const camp = campaigns.find(x => x.id === id);
  if (!camp || !camp.running || !camp.queued.length) return;
  if (calls.some(c => c.campaign === id && isLive(c))) return;
  const next = camp.queued.shift()!;
  const s = { ...genericScript({ name: next.name, phone: next.phone, tenantId: next.tenantId, purpose: camp.purpose }), campaign: id };
  const c = makeCall(s, "dialing");
  calls.unshift(c);
  bump();
  dial(c);
}

export function toggleCampaign(id: string) {
  const camp = campaigns.find(x => x.id === id);
  if (!camp) return;
  camp.running = !camp.running;
  bump();
  if (camp.running) setTimeout(() => nextInCampaign(id), 1200);
}

// ---- Human controls -----------------------------------------------------------------

export function takeOver(c: Call) {
  if (dead(c) || c.handler === "human") return;
  c.handler = "human";
  c.tookOver = true;
  c.whisperOpen = false;
  c.alert = undefined;
  note(c, "system", "Priya joined the call · Zonera Voice is now your copilot");
  bump();
}

export function handBack(c: Call) {
  if (dead(c) || c.handler === "ai") return;
  c.handler = "ai";
  c.reply = "";
  note(c, "system", "Priya handed the call back to Zonera Voice");
  const r = c._reply;
  bump();
  r?.(null);
}

/** Priya says something: a suggestion she clicked or her own words. */
export function humanSay(c: Call, text: string) {
  const t = text.trim();
  if (!t || dead(c) || c.handler !== "human") return;
  c.reply = "";
  if (c._reply) c._reply(t);
  else {
    c._pendingHuman = t;
    bump();
  }
}

export function toggleListen(c: Call) {
  c.listening = !c.listening;
  bump();
}

export function endCall(c: Call) {
  finish(c, false, c.handler === "human" ? "Priya" : "Priya");
}

function swap(s: string, question: boolean) {
  let out = s
    .replace(/\b(she|he) is\b/gi, "you are")
    .replace(/\b(she|he)'s\b/gi, "you're")
    .replace(/\b(she|he|they)\b/gi, "you")
    .replace(/\b(her|his|their)\b/gi, "your")
    .replace(/\b(him|them)\b/gi, "you");
  out = question ? out.replace(/^you (\w+?)s\b/i, "do you $1").replace(/\byou (\w+?)s\b/gi, "you $1") : out.replace(/\byou (\w+?)s\b/gi, "you $1");
  return out;
}

function genericLine(w: string) {
  let s = w.trim().replace(/[.!]+$/, "");
  s = s.replace(/^(please\s+)?(tell|remind|let)\s+(her|him|them)\s+(know\s+)?(that\s+)?/i, "");
  const offer = /^offer\s+(her|him|them)?\s*/i;
  if (offer.test(s)) return `I can also offer you ${swap(s.replace(offer, ""), false)}.`;
  const ask = /^ask\s+(her|him|them)?\s*(if|whether)?\s*/i;
  if (ask.test(s)) {
    const q = swap(s.replace(ask, ""), true);
    return `Quick question: ${q.charAt(0).toLowerCase() + q.slice(1)}?`;
  }
  s = s.replace(/^(mention|say|explain)\s+(that\s+)?/i, "");
  const body = swap(s, false);
  return `Just so you know, ${body.charAt(0).toLowerCase() + body.slice(1)}.`;
}

export function availableWhispers(c: Call) {
  return (c.script.whispers ?? []).filter(w => !c.usedWhispers.includes(w.text) && !(w.replaces && c.passedKeys.includes(w.replaces)));
}

export function whisper(c: Call, text: string) {
  const t = text.trim();
  if (!t || dead(c)) return;
  note(c, "whisper", t);
  c.draft = "";
  c.whisperOpen = false;
  const w = availableWhispers(c).find(x => x.text === t || x.match.test(t));
  c.usedWhispers.push(w?.text ?? t);
  bump();
  setTimeout(() => {
    if (dead(c)) return;
    note(c, "ack", w ? w.ack : "Understood. I'll work that in next.");
    c._insert!.push(w ? { line: w.line, replaces: w.replaces } : { line: genericLine(t) });
    bump();
  }, 1000);
}

// ---- Movie mode ----------------------------------------------------------------------

/** When a call view opens in movie mode, play its whisper beat. */
export function movieBeat(c: Call) {
  if (!movie.on || c.movieDone || dead(c) || c.status !== "live" || c.handler !== "ai") return;
  const w = availableWhispers(c)[0];
  if (!w) return;
  c.movieDone = true;
  setTimeout(async () => {
    if (dead(c) || c.handler !== "ai") return;
    c.whisperOpen = true;
    bump();
    await sleep(500);
    await typeInto(w.text, s => {
      c.draft = s;
      bump();
    }, 30);
    await sleep(600);
    whisper(c, w.text);
  }, 2400 / (movie.speed || 1));
}

function movieTakeover(c: Call) {
  setTimeout(() => {
    if (dead(c) || c.handler === "human") return;
    const onPage = nav.route === `ops/calls/${c.id}`;
    if (!onPage) openCall(c.id);
    setTimeout(() => takeOver(c), 1800 / (movie.speed || 1));
  }, 1600 / (movie.speed || 1));
}

// ---- Public API -----------------------------------------------------------------------

export function ensureStarted() {
  if (ui.started) return;
  ui.started = true;
  ui.startedAt = Date.now();
  startLive(SCRIPTS["matthew-gate"]);
  startLive(SCRIPTS["grace-autopay"]);
  startLive(SCRIPTS["leila-inbound"]);
  setTimeout(() => ring(SCRIPTS["dana-lien"]), 40000);
  setTimeout(() => ring(SCRIPTS["price-shopper"]), 150000);
  bump();
}

export function openCall(id: string) {
  ensureStarted();
  if (callById(id)) ui.focus = id;
  ui.tab = "live";
  ui.dial = false;
  setCallsOpen(true);
  bump();
}

export function placeCall(req: OutboundCallRequest & { kind?: Purpose }, mode: Handler = "ai") {
  ensureStarted();
  const known = req.scriptId ? SCRIPTS[req.scriptId] : undefined;
  if (known?.id === "leila-reservation") {
    const inbound = calls.find(x => x.script.id === "leila-inbound" && !dead(x));
    if (inbound) fastForward(inbound);
  }
  const base = known ?? genericScript(req);
  const s: Script = { ...base, name: req.name || base.name, phone: req.phone ?? base.phone, tenantId: req.tenantId ?? base.tenantId };
  const c = makeCall(s, "dialing", mode);
  if (mode === "human") c.tookOver = true;
  calls.unshift(c);
  ui.focus = c.id;
  ui.tab = "live";
  ui.dial = false;
  setCallsOpen(true);
  bump();
  dial(c);
  return c.id;
}

export function callNow(campaignId: string, idx: number) {
  const camp = campaigns.find(x => x.id === campaignId);
  if (!camp) return;
  const [p] = camp.queued.splice(idx, 1);
  if (!p) return;
  const id = placeCall({ name: p.name, phone: p.phone, tenantId: p.tenantId, purpose: camp.purpose, scriptId: p.name === "Leila Haddad" ? "leila-reservation" : undefined });
  const c = callById(id);
  if (c && campaignId === "autopay") c.campaign = campaignId;
}

/** KPI numbers for the page header: earlier today plus this session. */
export function kpis() {
  const session = calls.filter(c => c.status !== "ringing" && c.status !== "dialing");
  const total = stats.base + session.length;
  const aiN = Math.round(stats.base * stats.aiAnswered) + session.filter(c => c.direction === "inbound" && !(c.tookOver && c.events.length < 3)).length + session.filter(c => c.direction === "outbound").length;
  const humanN = session.filter(c => c.tookOver).length;
  const ended = session.filter(c => c.status === "ended");
  const resolvedN = Math.round(stats.base * stats.resolved) + ended.filter(c => !c.tookOver).length;
  const done = session.filter(c => c.status === "ended" && c.duration);
  const handle = done.length ? (stats.handle * stats.base + done.reduce((a, c) => a + (c.duration ?? 0), 0)) / (stats.base + done.length) : stats.handle;
  return {
    total,
    aiPct: Math.min(1, aiN / total),
    resolvedPct: Math.min(1, resolvedN / (stats.base + ended.length)),
    humanN,
    bookings: stats.bookings,
    handle,
    afterHours: stats.afterHours,
  };
}

registerCallCenter({
  startOutboundCall: req => placeCall(req, "ai"),
  openCall,
});

export { calls, recent, ui, campaigns };
