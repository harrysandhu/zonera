import React from "react";
import { fde, overallProgress, stage } from "../fde/engine";
import { LINE_BY_ID, TASK_BY_ID, ITEM_BY_ID } from "../fde/data/deal";
import type { Cite, Stage } from "../fde/types";
import type { TaskState } from "../fde/engine";

// Small helpers shared by the owner portal screens (prefix ob-).

/** Where a citation came from, in Gail's words. */
export function sourceLabel(cite: Cite) {
  if (cite.source === "e1") return "Your email · Oct 1";
  if (cite.source === "c1") return "Your call with Jordan · Sep 24";
  return "Your call with Jordan · Sep 30";
}

export function lineTime(cite: Cite) {
  return LINE_BY_ID.get(cite.line)?.t ?? "";
}

export function Quote({ cite, className = "" }: { cite: Cite; className?: string }) {
  const t = lineTime(cite);
  return (
    <figure className={`ob-quote ${className}`}>
      <blockquote>“{cite.quote}”</blockquote>
      <figcaption>
        {sourceLabel(cite)}
        {t && cite.source !== "e1" && <span className="mono"> · {t}</span>}
      </figcaption>
    </figure>
  );
}

// ---- story clock helpers ----------------------------------------------------
// The engine stamps events with clockAt() strings ("Wed 8:41 pm"). The story starts
// Wed Sep 30 at 6:12 pm, so we can turn a stamp back into story minutes.

const DAYS = ["Wed", "Thu", "Fri", "Sat", "Sun", "Mon", "Tue"];
const START = 18 * 60 + 12;

export function storyMinutes(at: string) {
  const m = /^(\w{3}) (\d{1,2}):(\d{2}) (am|pm)$/.exec(at.trim());
  if (!m) return null;
  const day = DAYS.indexOf(m[1]);
  let h = +m[2] % 12;
  if (m[4] === "pm") h += 12;
  return Math.max(0, day) * 1440 + h * 60 + +m[3] - START;
}

export function relTime(at: string) {
  const min = storyMinutes(at);
  if (min == null) return at;
  const d = Math.max(0, fde.story - min);
  if (d < 1) return "Just now";
  if (d < 60) return `${Math.round(d)} min ago`;
  if (d < 1440) return `${Math.floor(d / 60)} hr ago`;
  return at;
}

/** "8:41 pm" for today, "Thu 8:41 pm" otherwise. */
export function shortAt(at?: string) {
  if (!at) return "";
  const min = storyMinutes(at);
  if (min == null) return at;
  const now = Math.floor((fde.story + START) / 1440);
  const then = Math.floor((min + START) / 1440);
  return now === then ? at.replace(/^\w{3} /, "") : at;
}

export function greeting() {
  const h = Math.floor(((START + fde.story) % 1440) / 60);
  if (h >= 4 && h < 12) return "Good morning";
  if (h >= 12 && h < 17) return "Good afternoon";
  return "Good evening";
}

export const STAGE_WORDS: Record<Stage, string> = {
  context: "Reading your call",
  plan: "Planning",
  collect: "Getting started",
  migrate: "Moving your data",
  validate: "Checking everything",
  live: "Live",
};

export function pct() {
  return Math.round(overallProgress() * 100);
}

export function stageWords() {
  return STAGE_WORDS[stage()];
}

// ---- agent work, in owner words --------------------------------------------------

export const TASK_WORDS: Record<string, string> = {
  T1: "Read your two calls with Jordan",
  T2: "Write your plan and this checklist",
  T23: "Read your email from this morning",
  T3: "Find your listing, permits and photos",
  T4: "Draw Alder Lake in 3D from the site plan",
  T5: "Build your storefront",
  T6: "Move your rent roll and units",
  T7: "Move ledgers and payment history",
  T8: "Move leases, IDs and notes",
  T9: "Move autopay cards securely",
  T10: "Get PDK access from Marcus",
  T11: "Sync every gate code to PDK",
  T12: "Forward after-hours calls",
  T13: "Set up billing and payouts",
  T14: "Set up your lease word for word",
  T15: "Arm the late-payment playbook",
  T16: "Hold existing rents",
  T17: "Set up Priya's login",
  T22: "Add truck rentals to your storefront",
  T18: "Check every tenant, unit and balance",
  T19: "Check every gate code in PDK",
  T20: "Test every autopay card",
  T21: "Switch over before the gate opens",
};

export const WORK_GROUPS: { id: string; label: string; tasks: string[] }[] = [
  { id: "read", label: "Read your calls and email", tasks: ["T1", "T2", "T23"] },
  { id: "move", label: "Move everything out of Keystone", tasks: ["T6", "T7", "T8", "T9"] },
  { id: "gate", label: "Connect your gate and phones", tasks: ["T10", "T11", "T12"] },
  { id: "setup", label: "Set up your storefront and rules", tasks: ["T3", "T4", "T5", "T14", "T15", "T16", "T17", "T13", "T22"] },
  { id: "check", label: "Check every record", tasks: ["T18", "T19", "T20"] },
  { id: "switch", label: "Switch over", tasks: ["T21"] },
];

export type WorkState = "done" | "running" | "waiting" | "you" | "later";

/** Owner-facing state of one agent task. */
export function taskWork(id: string): { state: WorkState; label: string } {
  const st: TaskState = fde.tasks[id]?.state ?? "hidden";
  if (st === "done") return { state: "done", label: "Done" };
  if (st === "running") return { state: "running", label: id === "T18" && fde.exc.dup?.state === "open" ? "With Jordan" : "Working" };
  if (st === "queued") return { state: "running", label: "Starting" };
  if (st === "waiting") return { state: "waiting", label: id === "T10" ? "Waiting on Marcus" : "Waiting" };
  const t = TASK_BY_ID.get(id);
  const owed = t?.needs.find(n => n.startsWith("O") && fde.items[n]?.state !== "done");
  if (owed && fde.portalSent) {
    const it = ITEM_BY_ID.get(owed);
    return { state: "you", label: it ? `After: ${shortItem(owed)}` : "Waiting on you" };
  }
  return { state: "later", label: "Later" };
}

const SHORT: Record<string, string> = {
  O1: "your Keystone login",
  O2: "your yes on PDK",
  O3: "your lease",
  O4: "your playbook",
  O5: "your rent choice",
  O6: "your storefront name",
  O7: "your payout account",
  O8: "Priya's invite",
  O9: "after-hours calls",
  O10: "your signature",
  O11: "your subscription",
  O12: "truck rentals",
};
export function shortItem(id: string) {
  return SHORT[id] ?? id;
}

export function groupWork(tasks: string[]) {
  const visible = tasks.filter(id => fde.tasks[id] && fde.tasks[id].state !== "hidden");
  const states = visible.map(id => taskWork(id));
  const done = states.filter(s => s.state === "done").length;
  const runningIdx = states.findIndex(s => s.state === "running");
  let state: WorkState = "later";
  if (visible.length && done === visible.length) state = "done";
  else if (runningIdx >= 0) state = "running";
  else if (states.some(s => s.state === "waiting")) state = "waiting";
  else if (states.some(s => s.state === "you")) state = "you";
  else if (done > 0) state = "running";
  return { visible, done, total: visible.length, state, now: runningIdx >= 0 ? visible[runningIdx] : undefined };
}

export function Spinner({ size = 14 }: { size?: number }) {
  return <span className="ob-spin" style={{ width: size, height: size }} aria-hidden />;
}
