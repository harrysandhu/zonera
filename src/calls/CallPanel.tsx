import React, { useEffect, useState } from "react";
import { X, Maximize2, PhoneOutgoing, Pause, Play, ChevronRight } from "lucide-react";
import { Seg, Avatar } from "../ui";
import { go, setCallsOpen, useDemo } from "../state/store";
import { useCalls, ui, bump, calls, recent, campaigns } from "./state";
import { callById, callNow, ensureStarted, kpis, liveCalls, mmss, toggleCampaign } from "./engine";
import { CallRow, MoodDot } from "./bits";
import { LiveCall } from "./LiveCall";
import { Dialer } from "./Dialer";
import { Playback } from "./Wave";
import type { Call, RecentCall } from "./types";
import "../styles/calls.css";

// Push-in call center panel (right column of the operator shell).

export function sortLive(list: Call[]) {
  const rank = (c: Call) => (c.status === "ringing" ? 0 : c.alert ? 1 : c.status === "dialing" ? 2 : 3);
  return list.slice().sort((a, b) => rank(a) - rank(b) || b.createdAt - a.createdAt);
}

export function CallPanel() {
  useCalls();
  useDemo();
  useEffect(() => {
    ensureStarted();
  }, []);
  const focus = callById(ui.focus);
  const back = () => {
    ui.focus = null;
    bump();
  };

  return (
    <div className="cc-panel">
      {ui.dial ? (
        <Dialer
          onClose={() => {
            ui.dial = false;
            bump();
          }}
        />
      ) : focus ? (
        <LiveCall key={focus.id} call={focus} variant="panel" onBack={back} />
      ) : (
        <PanelList />
      )}
    </div>
  );
}

function PanelList() {
  const live = sortLive(liveCalls());
  const k = kpis();
  const queued = campaigns.reduce((s, c) => s + c.queued.length, 0);
  const open = (id: string) => {
    ui.focus = id;
    bump();
  };
  return (
    <div className="cc-pl">
      <header className="cc-ph">
        <span className="cc-ph-t cc-ph-t--main">
          Calls
          <span className="cc-count">
            <i />
            {live.filter(c => c.status === "live").length} live
          </span>
        </span>
        <button
          type="button"
          className="z-btn z-btn--sm"
          onClick={() => {
            ui.dial = true;
            bump();
          }}
        >
          <PhoneOutgoing /> Dial
        </button>
        <button
          type="button"
          className="z-btn z-btn--ghost z-btn--sm z-iconbtn"
          aria-label="Open call center"
          title="Open call center"
          onClick={() => {
            setCallsOpen(false);
            go("ops/calls");
          }}
        >
          <Maximize2 />
        </button>
        <button type="button" className="z-btn z-btn--ghost z-btn--sm z-iconbtn" aria-label="Close calls" onClick={() => setCallsOpen(false)}>
          <X />
        </button>
      </header>
      <div className="cc-pl-seg">
        <Seg
          value={ui.tab}
          onChange={v => {
            ui.tab = v;
            bump();
          }}
          options={[
            { value: "live", label: <>Live <em className="cc-seg-n">{live.length}</em></> },
            { value: "queue", label: <>Queue <em className="cc-seg-n">{queued}</em></> },
            { value: "recent", label: <>Recent <em className="cc-seg-n">{recent.length}</em></> },
          ]}
        />
      </div>
      <div className="cc-pl-b">
        {ui.tab === "live" && (
          <>
            <div className="cc-list">
              {live.map(c => (
                <CallRow key={c.id} call={c} onOpen={() => open(c.id)} />
              ))}
              {live.length === 0 && <div className="cc-empty">No calls right now. Zonera Voice is answering.</div>}
            </div>
            <div className="cc-today">
              <div>
                <span className="mono">{k.total}</span>
                <small>calls today</small>
              </div>
              <div>
                <span className="mono">{Math.round(k.aiPct * 100)}%</span>
                <small>answered by AI</small>
              </div>
              <div>
                <span className="mono">{k.bookings}</span>
                <small>bookings</small>
              </div>
            </div>
          </>
        )}
        {ui.tab === "queue" && <QueueList compact />}
        {ui.tab === "recent" && <RecentList onOpen={open} />}
      </div>
    </div>
  );
}

export function QueueList({ compact }: { compact?: boolean }) {
  return (
    <div className="cc-q">
      {campaigns.map(c => {
        const live = calls.filter(x => x.campaign === c.id && x.status !== "ended");
        const total = c.done + c.queued.length + live.length;
        return (
          <section key={c.id} className="cc-camp">
            <div className="cc-camp-h">
              <div>
                <b>{c.name}</b>
                <span>{c.sub}</span>
              </div>
              <button type="button" className="z-btn z-btn--sm" onClick={() => toggleCampaign(c.id)}>
                {c.running ? <Pause /> : <Play />}
                {c.running ? "Pause" : "Run"}
              </button>
            </div>
            <div className="cc-camp-bar" aria-hidden>
              <i className="done" style={{ width: `${(c.done / Math.max(1, total)) * 100}%` }} />
              <i className="live" style={{ width: `${(live.length / Math.max(1, total)) * 100}%` }} />
            </div>
            <div className="cc-camp-m mono">
              <span>{c.queued.length} queued</span>
              <span>{c.done} done</span>
              {live.length > 0 && <span className="cc-camp-live">{live.length} live</span>}
              <span className="faint">{c.running ? c.window : "Paused"}</span>
            </div>
            <ul className="cc-camp-l">
              {c.queued.slice(0, compact ? 3 : 6).map((p, i) => (
                <li key={p.name + i}>
                  <Avatar name={p.name} size="sm" />
                  <span className="cc-camp-n">
                    <b>{p.name}</b>
                    <span className="mono">{p.note}</span>
                  </span>
                  <button type="button" className="z-btn z-btn--ghost z-btn--sm" onClick={() => callNow(c.id, i)}>
                    Call now
                  </button>
                </li>
              ))}
              {c.queued.length > (compact ? 3 : 6) && <li className="cc-camp-more mono">+{c.queued.length - (compact ? 3 : 6)} more</li>}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function RecentList({ onOpen }: { onOpen: (id: string) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="cc-list cc-list--recent">
      {recent.map(r => (
        <RecentRow key={r.id} r={r} open={open === r.id} onToggle={() => (r.call ? onOpen(r.call.id) : setOpen(open === r.id ? null : r.id))} />
      ))}
    </div>
  );
}

function RecentRow({ r, open, onToggle }: { r: RecentCall; open: boolean; onToggle: () => void }) {
  return (
    <div className={`cc-rr ${open ? "on" : ""}`}>
      <button type="button" className="cc-rr-h" onClick={onToggle}>
        <Avatar name={/^\(/.test(r.name) ? "? ?" : r.name} size="sm" />
        <span className="cc-rr-m">
          <span className="cc-rr-1">
            <b>{r.name}</b>
            <MoodDot v={r.mood} />
            <span className="mono faint cc-rr-t">{r.at}</span>
          </span>
          <span className="cc-rr-2">
            <span className={`cc-out cc-out--${r.tone}`}>{r.outcome}</span>
            <span className="mono faint">
              {mmss(r.duration)} · {r.by === "ai" ? "AI" : "You"}
            </span>
          </span>
        </span>
        <ChevronRight className="cc-rr-c" />
      </button>
      {open && (
        <div className="cc-rr-b">
          <p>{r.summary}</p>
          <Playback id={r.id} duration={r.duration} compact />
        </div>
      )}
    </div>
  );
}
