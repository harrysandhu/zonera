import { useSyncExternalStore } from "react";
import type { Call, RecentCall } from "./types";

// The call center's own little store. Transcripts stream several words a second
// across several calls, so call state re-renders only call-center components;
// domain changes (a unit reserved, a balance cleared) still go through commit().

let ver = 0;
const subs = new Set<() => void>();

export function bump() {
  ver++;
  subs.forEach(f => f());
}

function subscribe(f: () => void) {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
}

/** Re-render on any call-center change. */
export function useCalls() {
  return useSyncExternalStore(subscribe, () => ver, () => ver);
}

/** Re-render only when the selected primitive changes (for the top-bar pill). */
export function useCallsSel<T extends string | number | boolean | null | undefined>(sel: () => T) {
  return useSyncExternalStore(subscribe, sel, sel);
}

export const calls: Call[] = [];
export const recent: RecentCall[] = [];

export const ui = {
  /** Call open in the push-in panel. */
  focus: null as string | null,
  tab: "live" as "live" | "queue" | "recent",
  dial: false,
  started: false,
  startedAt: 0,
};

export interface Voice { id: string; name: string; tone: string; sample: string }
export const VOICES: Voice[] = [
  { id: "ava", name: "Ava", tone: "warm, concise", sample: "Thanks for calling Zonera Alder Lake, this is Ava. How can I help?" },
  { id: "theo", name: "Theo", tone: "calm", sample: "Hi, this is Theo at Zonera Alder Lake. Take your time, I'm here to help." },
  { id: "mara", name: "Mara", tone: "bright", sample: "Hey there, Mara at Zonera Alder Lake. What can I do for you today?" },
];

export const persona = {
  voice: "ava",
  greeting: "Thanks for calling Zonera Alder Lake, this is {name}. How can I help?",
  answerAll: true,
  afterHours: "answer" as "answer" | "voicemail",
  rules: [
    { id: "person", text: "Caller asks for a person", then: "Transfer to Priya, or book a callback", on: true },
    { id: "lien", text: "Lien, legal or damage claims", then: "Ask a manager to join the call", on: true },
    { id: "upset", text: "Caller is upset two turns in a row", then: "Offer a manager", on: true },
    { id: "refund", text: "Refunds over $100", then: "Ask first", on: true },
    { id: "gate", text: "After-hours lockout at the gate", then: "Verify, then open remotely", on: true },
  ],
};

export function voiceName() {
  return VOICES.find(v => v.id === persona.voice)?.name ?? "Ava";
}

export function greeting() {
  return persona.greeting.replace("{name}", voiceName());
}

/** Today's totals before the demo started; live calls add to them. */
export const stats = {
  base: 41,
  aiAnswered: 0.96,
  resolved: 0.82,
  bookings: 3,
  handle: 161, // seconds
  afterHours: 11,
};

export interface Campaign {
  id: string;
  name: string;
  sub: string;
  purpose: string;
  queued: { name: string; tenantId?: string; phone: string; note: string }[];
  done: number;
  running: boolean;
  window: string;
}

export const campaigns: Campaign[] = [];

let seq = 2040;
export function nextCallId() {
  return `CL-${++seq}`;
}

let evSeq = 1;
export function nextEvId() {
  return evSeq++;
}
