import React, { useEffect, useState } from "react";
import { PhoneIncoming, PhoneOutgoing, ArrowUpRight } from "lucide-react";
import { Avatar } from "../ui";
import { fmt, go } from "../state/store";
import { TENANT_BY_ID, LEADS } from "../data/tenants";
import { UNIT_BY_ID } from "../data/facility";
import { elapsed, mmss, moodNow } from "./engine";
import { LEILA } from "./scripts";
import { MiniWave } from "./Wave";
import type { Call, LineEv } from "./types";

// Small shared pieces: timer, sentiment, handler badge, list row, caller context.

export function useTick(ms = 1000) {
  const [, set] = useState(0);
  useEffect(() => {
    const i = window.setInterval(() => set(n => n + 1), ms);
    return () => window.clearInterval(i);
  }, [ms]);
}

export function Timer({ call, className = "" }: { call: Call; className?: string }) {
  useTick(1000);
  if (call.status === "ringing") return <span className={`cc-timer mono ${className}`}>Ringing</span>;
  if (call.status === "dialing") return <span className={`cc-timer mono ${className}`}>Calling…</span>;
  return <span className={`cc-timer mono tnum ${className}`}>{mmss(elapsed(call))}</span>;
}

export function moodTone(v: number) {
  return v >= 0.3 ? "ok" : v > -0.2 ? "neutral" : v > -0.6 ? "warn" : "bad";
}
export function moodLabel(v: number) {
  return v >= 0.55 ? "Happy" : v >= 0.3 ? "Positive" : v > -0.2 ? "Neutral" : v > -0.6 ? "Frustrated" : "Upset";
}

export function MoodDot({ v, label }: { v: number; label?: boolean }) {
  return (
    <span className={`cc-mood cc-mood--${moodTone(v)}`} title={`Sentiment: ${moodLabel(v)}`}>
      <i />
      {label && moodLabel(v)}
    </span>
  );
}

/** Caller sentiment across the call, one segment per caller turn. */
export function MoodStrip({ call }: { call: Call }) {
  const m = call.mood.length ? call.mood : [{ at: 0, v: 0.1 }];
  const v = moodNow(call);
  return (
    <div className="cc-ms">
      <span className="cc-ms-l">Sentiment</span>
      <span className="cc-ms-bar">
        {m.map((s, i) => (
          <i key={i} className={`cc-ms-s cc-ms-s--${moodTone(s.v)}`} />
        ))}
        {Array.from({ length: Math.max(0, 8 - m.length) }, (_, i) => (
          <i key={"e" + i} className="cc-ms-s cc-ms-s--empty" />
        ))}
      </span>
      <MoodDot v={v} label />
    </div>
  );
}

export function HandlerBadge({ call }: { call: Call }) {
  if (call.status === "ended") return <span className="cc-hb cc-hb--done">{call.tookOver ? "You" : "AI"}</span>;
  if (call.handler === "human") return <span className="cc-hb cc-hb--you">You</span>;
  return <span className="cc-hb cc-hb--ai">AI</span>;
}

export function DirIcon({ call }: { call: Pick<Call, "direction"> }) {
  return <span className="cc-dir">{call.direction === "inbound" ? <PhoneIncoming /> : <PhoneOutgoing />}</span>;
}

export function CallAvatar({ call, size }: { call: Call; size?: "sm" | "lg" }) {
  return (
    <span className={`cc-av ${call.status === "ringing" || call.status === "dialing" ? "cc-av--ring" : ""}`}>
      <Avatar name={call.name === "New caller" ? "? ?" : call.name} size={size} />
      <DirIcon call={call} />
    </span>
  );
}

export function speakerName(call: Call, who: LineEv["who"]) {
  if (who === "ai") return "Zonera Voice";
  if (who === "human") return "Priya (you)";
  return call.name === "New caller" ? "Caller" : call.name.split(" ")[0];
}

export function lastLine(call: Call) {
  for (let i = call.events.length - 1; i >= 0; i--) {
    const e = call.events[i];
    if (e.kind === "line") return e;
  }
  return null;
}

export function lastTool(call: Call) {
  for (let i = call.events.length - 1; i >= 0; i--) {
    const e = call.events[i];
    if (e.kind === "tool") return e;
  }
  return null;
}

export function statusText(call: Call) {
  if (call.status === "ringing") return "Incoming · Zonera Voice answering";
  if (call.status === "dialing") return call.handler === "human" ? "Calling · you'll take it" : "Calling · Zonera Voice";
  if (call.status === "wrap") return "Wrapping up · writing summary";
  if (call.alert) return `Requests you · ${call.alert.reason}`;
  return call.intent;
}

/** Compact call row used in the panel list and the page's left rail. */
export function CallRow({ call, onOpen, selected, quote = true }: { call: Call; onOpen: () => void; selected?: boolean; quote?: boolean }) {
  const ln = lastLine(call);
  const text = ln ? ln.words.slice(0, ln.shown).join(" ") : "";
  return (
    <button type="button" className={`cc-row ${selected ? "on" : ""} ${call.alert ? "cc-row--alert" : ""} ${call.status === "ringing" ? "cc-row--ring" : ""}`} onClick={onOpen}>
      <CallAvatar call={call} />
      <span className="cc-row-m">
        <span className="cc-row-1">
          <b>{call.name}</b>
          <MoodDot v={moodNow(call)} />
          <Timer call={call} className="cc-row-t" />
        </span>
        <span className="cc-row-2">
          <span className={call.alert ? "cc-row-alert" : ""}>{statusText(call)}</span>
          <MiniWave speaking={call.speaking} live={call.status === "live"} />
          <HandlerBadge call={call} />
        </span>
        {quote && text && (
          <span className="cc-row-q">
            <em className={ln!.who === "ai" ? "ai" : ""}>{speakerName(call, ln!.who)}</em> {text}
          </span>
        )}
      </span>
    </button>
  );
}

export interface Ctx { kind: string; cells: { k: string; v: React.ReactNode; tone?: string }[]; link?: { label: string; route: string } }

/** Caller context: who this is to the facility. */
export function callerContext(call: Call): Ctx {
  const t = call.tenantId ? TENANT_BY_ID.get(call.tenantId) : undefined;
  if (t) {
    const u = UNIT_BY_ID.get(t.unitIds[0]);
    return {
      kind: `Tenant · since ${new Date(t.moveIn + "T12:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" })}`,
      cells: [
        { k: "Unit", v: <span className="mono">{t.unitIds.join(", ")}{u ? ` · ${u.size.replace("x", "×")}` : ""}</span> },
        { k: "Balance", v: <span className="mono">{fmt.money(t.balance)}</span>, tone: t.balance > 0 ? (t.daysLate > 30 ? "bad" : "warn") : "ok" },
        { k: t.balance > 0 ? "Past due" : "Autopay", v: t.balance > 0 ? <span className="mono">{t.daysLate} days</span> : t.autopay ? <span className="mono">{t.card ?? "On"}</span> : "Off" },
      ],
      link: { label: "Profile", route: `ops/tenants/${t.id}` },
    };
  }
  const l = LEADS.find(x => x.name === call.name);
  if (l || call.lead) {
    const res = call.name === "Leila Haddad" && LEILA.reserved ? LEILA.unit : null;
    return {
      kind: `Lead · ${l?.source ?? "Web reservation"}`,
      cells: [
        { k: "Wants", v: <span className="mono">{(l?.size ?? "10x10").replace("x", "×")}</span> },
        { k: "Moving", v: l?.moving ?? "This week" },
        { k: "Unit", v: res ? <span className="mono">{res}</span> : <span className="faint">Not held</span>, tone: res ? "info" : undefined },
      ],
      link: { label: "Reservations", route: "ops/leads" },
    };
  }
  return {
    kind: "New caller",
    cells: [
      { k: "Number", v: <span className="mono">{call.phone}</span> },
      { k: "Location", v: "Alder Lake, CA" },
      { k: "History", v: <span className="faint">First call</span> },
    ],
  };
}

export function ContextStrip({ call }: { call: Call }) {
  const ctx = callerContext(call);
  return (
    <div className="cc-ctx">
      {ctx.cells.map(c => (
        <div key={c.k} className={`cc-ctx-c ${c.tone ? "cc-ctx-c--" + c.tone : ""}`}>
          <span>{c.k}</span>
          <b>{c.v}</b>
        </div>
      ))}
    </div>
  );
}

export function ContextLink({ call }: { call: Call }) {
  const ctx = callerContext(call);
  if (!ctx.link) return null;
  return (
    <button type="button" className="cc-link" onClick={() => go(ctx.link!.route)}>
      {ctx.link.label} <ArrowUpRight />
    </button>
  );
}
