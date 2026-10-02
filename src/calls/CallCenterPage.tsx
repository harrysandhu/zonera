import React, { useEffect, useState } from "react";
import { ArrowLeft, PhoneOutgoing, Play, Pause, Sparkles, ChevronDown, Check } from "lucide-react";
import { Seg, Avatar, Pill } from "../ui";
import { Stat, StatRow } from "../ops/kit";
import { go, nav, setCallsOpen, useDemo } from "../state/store";
import { useCalls, ui, bump, recent, VOICES, persona, voiceName, campaigns } from "./state";
import { callById, ensureStarted, kpis, liveCalls, mmss, moodNow, toggleListen } from "./engine";
import { CallAvatar, CallRow, HandlerBadge, MoodDot, Timer, lastLine, lastTool, speakerName, statusText } from "./bits";
import { LiveCall, ToolChip } from "./LiveCall";
import { QueueList, sortLive } from "./CallPanel";
import { VoiceWave, Playback, MiniWave } from "./Wave";
import type { Call, RecentCall } from "./types";
import "../styles/calls.css";

// Full call center (route ops/calls, ops/calls/<call id>). The page doesn't
// scroll as a whole: header and KPIs stay put and each pane scrolls on its own.

type Tab = "live" | "queue" | "recent" | "voice";

export function CallCenterPage({ id }: { id?: string }) {
  useCalls();
  useDemo();
  const [tab, setTab] = useState<Tab>("live");
  useEffect(() => {
    ensureStarted();
  }, []);
  const sel = callById(id);
  useEffect(() => {
    if (!sel) return;
    setTab("live");
    if (nav.callsOpen) setCallsOpen(false);
    if (sel._listenOnOpen) {
      sel._listenOnOpen = false;
      if (!sel.listening) toggleListen(sel);
    }
  }, [id]);

  const live = sortLive(liveCalls());
  const k = kpis();
  const queued = campaigns.reduce((s, c) => s + c.queued.length, 0);
  const v = VOICES.find(x => x.id === persona.voice)!;

  return (
    <div className="cc-page">
      <header className="cc-page-h">
        <div>
          <h1>Call center</h1>
          <p>
            Zonera Voice answers every call as {v.name} · {live.filter(c => c.status === "live").length} live now
          </p>
        </div>
        <div className="cc-page-a">
          <button
            type="button"
            className="z-btn z-btn--primary"
            onClick={() => {
              ui.dial = true;
              bump();
              setCallsOpen(true);
            }}
          >
            <PhoneOutgoing /> New call
          </button>
        </div>
      </header>

      <StatRow>
        <Stat label="Calls today" value={k.total} delta="+9" tone="ok" sub="vs last Fri" />
        <Stat label="Answered by AI" value={`${Math.round(k.aiPct * 100)}%`} delta="0 missed" tone="ok" sub="1.2s to answer" />
        <Stat label="Resolved without staff" value={`${Math.round(k.resolvedPct * 100)}%`} delta={`${k.humanN + 2} to you`} tone="neutral" sub="today" />
        <Stat label="Bookings from calls" value={k.bookings} delta={k.bookings > 3 ? `+${k.bookings - 3} live` : "+1"} tone="ok" sub="vs yesterday" />
        <Stat label="Avg handle time" value={mmss(k.handle)} delta="−0:42" tone="ok" sub="vs staff" />
        <Stat label="After-hours" value={k.afterHours} delta="0 missed" tone="ok" sub="since 10 pm" />
      </StatRow>

      <div className="cc-page-bar">
        {sel ? (
          <button type="button" className="z-btn z-btn--sm" onClick={() => go("ops/calls")}>
            <ArrowLeft /> All calls
          </button>
        ) : (
          <Seg
            value={tab}
            onChange={setTab}
            options={[
              { value: "live", label: <>Live <em className="cc-seg-n">{live.length}</em></> },
              { value: "queue", label: <>Queue <em className="cc-seg-n">{queued}</em></> },
              { value: "recent", label: <>Recent <em className="cc-seg-n">{recent.length}</em></> },
              { value: "voice", label: "Voice persona" },
            ]}
          />
        )}
        <span className="cc-page-bar-r">
          <span className="cc-on">
            <i />
            Answering
          </span>
          <span className="mono faint">
            {v.name} · {v.tone} · (530) 555-0142
          </span>
        </span>
      </div>

      <div className="cc-page-b">
        {sel ? (
          <div className="cc-split">
            <div className="cc-rail">
              <div className="cc-rail-h">Live</div>
              <div className="cc-list">
                {live.map(c => (
                  <CallRow key={c.id} call={c} selected={c.id === sel.id} quote={false} onOpen={() => go(`ops/calls/${c.id}`)} />
                ))}
                {!live.includes(sel) && <CallRow call={sel} selected quote={false} onOpen={() => {}} />}
              </div>
            </div>
            <LiveCall key={sel.id} call={sel} variant="page" onBack={() => go("ops/calls")} />
          </div>
        ) : tab === "live" ? (
          <div className="cc-livegrid">
            <div className="cc-wall cc-scroll">
              {live.map(c => (
                <LiveTile key={c.id} call={c} />
              ))}
              {live.length % 2 === 1 && (
                <div className="cc-tile cc-tile--idle">
                  <MiniWave speaking={null} live={false} />
                  <b>Line open</b>
                  <span>Zonera Voice picks up new calls on the first ring.</span>
                </div>
              )}
            </div>
            <aside className="cc-qrail cc-scroll">
              <div className="cc-rail-h">Outbound queue</div>
              <QueueList compact />
            </aside>
          </div>
        ) : tab === "queue" ? (
          <div className="cc-scroll cc-qpage">
            <QueueList />
          </div>
        ) : tab === "recent" ? (
          <RecentTable />
        ) : (
          <VoiceSettings />
        )}
      </div>
    </div>
  );
}

function LiveTile({ call }: { call: Call }) {
  const ln = lastLine(call);
  const tool = lastTool(call);
  return (
    <button type="button" className={`cc-tile ${call.alert ? "cc-tile--alert" : ""} ${call.status === "ringing" || call.status === "dialing" ? "cc-tile--ring" : ""}`} onClick={() => go(`ops/calls/${call.id}`)}>
      <div className="cc-tile-h">
        <CallAvatar call={call} />
        <div className="cc-tile-who">
          <b>{call.name}</b>
          <span>{statusText(call)}</span>
        </div>
        <div className="cc-tile-r">
          <span className={`cc-state cc-state--${call.status}`}>
            <i />
            <Timer call={call} />
          </span>
          <HandlerBadge call={call} />
        </div>
      </div>
      <VoiceWave call={call} lanes={1} height={40} bar={2} gap={2} className="cc-tile-w" />
      <p className="cc-tile-q">
        {ln ? (
          <>
            <em className={ln.who === "ai" ? "ai" : ""}>{speakerName(call, ln.who)}</em>
            {ln.shown > 24 ? "… " + ln.words.slice(ln.shown - 22, ln.shown).join(" ") : ln.words.slice(0, ln.shown).join(" ")}
          </>
        ) : (
          <span className="faint">{call.status === "dialing" ? `Calling ${call.phone}…` : "Ringing…"}</span>
        )}
      </p>
      <div className="cc-tile-f">
        {tool ? <ToolChip ev={tool} /> : <span className="cc-tile-none mono">No actions yet</span>}
        <MoodDot v={moodNow(call)} label />
      </div>
    </button>
  );
}

function RecentTable() {
  const [open, setOpen] = useState<string | null>(recent[0]?.id ?? null);
  return (
    <div className="cc-scroll cc-recent">
      <table className="z-table cc-rt">
        <colgroup>
          <col style={{ width: 84 }} />
          <col style={{ width: 210 }} />
          <col style={{ width: 170 }} />
          <col style={{ width: 230 }} />
          <col style={{ width: 84 }} />
          <col style={{ width: 108 }} />
          <col style={{ width: 80 }} />
          <col />
          <col style={{ width: 40 }} />
        </colgroup>
        <thead>
          <tr>
            <th>Time</th>
            <th>Caller</th>
            <th>Intent</th>
            <th>Outcome</th>
            <th className="num">Duration</th>
            <th>Sentiment</th>
            <th>Handled</th>
            <th>AI summary</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {recent.map(r => (
            <RecentTr key={r.id} r={r} open={open === r.id} onToggle={() => setOpen(open === r.id ? null : r.id)} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RecentTr({ r, open, onToggle }: { r: RecentCall; open: boolean; onToggle: () => void }) {
  return (
    <>
      <tr className={`cc-rt-r ${open ? "on" : ""}`} onClick={onToggle}>
        <td className="mono faint">{r.at}</td>
        <td>
          <span className="cc-rt-c">
            <Avatar name={/^\(/.test(r.name) ? "? ?" : r.name} size="sm" />
            <span>
              <b>{r.name}</b>
              <small className="mono">
                {r.direction === "inbound" ? "In" : "Out"} · {r.phone}
                {r.afterHours ? " · after hours" : ""}
              </small>
            </span>
          </span>
        </td>
        <td className="cc-rt-i">{r.intent}</td>
        <td>
          <span className={`cc-out cc-out--${r.tone}`}>{r.outcome}</span>
        </td>
        <td className="num mono">{mmss(r.duration)}</td>
        <td>
          <MoodDot v={r.mood} label />
        </td>
        <td>{r.by === "ai" ? <span className="cc-hb cc-hb--ai">AI</span> : <span className="cc-hb cc-hb--you">You</span>}</td>
        <td className="cc-rt-s">{r.summary}</td>
        <td>
          <ChevronDown className={`cc-rt-x ${open ? "on" : ""}`} />
        </td>
      </tr>
      {open && (
        <tr className="cc-rt-d">
          <td colSpan={9}>
            <div className="cc-rt-db">
              <div className="cc-rt-sum">
                <span className="cc-sum-h">
                  <Sparkles /> AI summary
                </span>
                <p>{r.summary}</p>
                {r.call && (
                  <button type="button" className="cc-link" onClick={() => go(`ops/calls/${r.call!.id}`)}>
                    Open transcript
                  </button>
                )}
              </div>
              <div className="cc-rt-pb">
                <span className="cc-sum-h">Recording</span>
                <Playback id={r.id} duration={r.duration} />
                <span className="cc-rt-leg">
                  <i className="ai" /> Zonera Voice <i /> {r.name.startsWith("(") ? "Caller" : r.name.split(" ")[0]}
                </span>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className="cc-sw" onClick={() => onChange(!on)}>
      <i />
    </button>
  );
}

const CAN = [
  { what: "Answer questions, quote prices and promos", tier: "On its own" },
  { what: "Reserve units and send payment links", tier: "On its own" },
  { what: "Take card payments by secure link", tier: "On its own" },
  { what: "Reset gate codes and open the gate", tier: "Verified callers" },
  { what: "Pause a lien sale or waive fees", tier: "Ask first" },
  { what: "Refunds over $100", tier: "Ask first" },
  { what: "Change a tenant's rent", tier: "Never" },
];

function VoiceSettings() {
  const [playing, setPlaying] = useState<string | null>(null);
  useEffect(() => {
    if (!playing) return;
    const t = window.setTimeout(() => setPlaying(null), 3200);
    return () => window.clearTimeout(t);
  }, [playing]);
  const set = (fn: () => void) => {
    fn();
    bump();
  };
  return (
    <div className="cc-scroll cc-voice">
      <div className="cc-voice-main">
        <section className="cc-sec">
          <div className="cc-sec-h">
            <h2>Voice</h2>
            <span className="mono faint">Used on every call, inbound and outbound</span>
          </div>
          <div className="cc-voices">
            {VOICES.map(vo => (
              <div key={vo.id} className={`cc-vc ${persona.voice === vo.id ? "on" : ""}`} onClick={() => set(() => (persona.voice = vo.id))} role="radio" aria-checked={persona.voice === vo.id} tabIndex={0}>
                <div className="cc-vc-h">
                  <Avatar name={vo.name + " Voice"} size="sm" />
                  <div>
                    <b>{vo.name}</b>
                    <span>{vo.tone}</span>
                  </div>
                  {persona.voice === vo.id && (
                    <span className="cc-vc-ck">
                      <Check />
                    </span>
                  )}
                </div>
                <p>“{vo.sample}”</p>
                <div className="cc-vc-f">
                  <button
                    type="button"
                    className="cc-play-b"
                    aria-label={playing === vo.id ? "Stop sample" : `Play ${vo.name} sample`}
                    onClick={e => {
                      e.stopPropagation();
                      setPlaying(playing === vo.id ? null : vo.id);
                    }}
                  >
                    {playing === vo.id ? <Pause /> : <Play />}
                  </button>
                  <span className={`cc-vc-w ${playing === vo.id ? "on" : ""}`} aria-hidden>
                    {Array.from({ length: 22 }, (_, i) => (
                      <i key={i} style={{ animationDelay: `${(i * 97) % 600}ms`, height: `${30 + ((i * 37) % 60)}%` }} />
                    ))}
                  </span>
                  <span className="mono faint">0:04</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="cc-sec">
          <div className="cc-sec-h">
            <h2>Greeting</h2>
            <span className="mono faint">{"{name}"} is the voice's name</span>
          </div>
          <textarea className="z-input cc-greet" rows={2} value={persona.greeting} onChange={e => set(() => (persona.greeting = e.target.value))} />
          <p className="cc-greet-p">
            <Sparkles /> Callers hear: “{persona.greeting.replace("{name}", voiceName())}”
          </p>
        </section>

        <section className="cc-sec">
          <div className="cc-sec-h">
            <h2>Escalation rules</h2>
            <span className="mono faint">When Zonera Voice brings you in</span>
          </div>
          <ul className="cc-rules">
            {persona.rules.map(r => (
              <li key={r.id}>
                <div>
                  <b>{r.text}</b>
                  <span>{r.then}</span>
                </div>
                <Switch on={r.on} label={r.text} onChange={v => set(() => (r.on = v))} />
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="cc-voice-side">
        <section className="cc-sec">
          <div className="cc-sec-h">
            <h2>Hours</h2>
          </div>
          <ul className="cc-rules">
            <li>
              <div>
                <b>Answer every call</b>
                <span>Zonera Voice picks up on the first ring, day and night</span>
              </div>
              <Switch on={persona.answerAll} label="Answer every call" onChange={v => set(() => (persona.answerAll = v))} />
            </li>
            <li>
              <div>
                <b>Office hours</b>
                <span className="mono">Mon–Sat · 9:00 am – 6:00 pm</span>
              </div>
            </li>
            <li>
              <div>
                <b>Gate hours</b>
                <span className="mono">Every day · 6:00 am – 10:00 pm</span>
              </div>
            </li>
          </ul>
          <div className="cc-ah">
            <span className="cc-f-l">After hours</span>
            <Seg
              value={persona.afterHours}
              onChange={v => set(() => (persona.afterHours = v))}
              options={[
                { value: "answer", label: "Zonera Voice answers" },
                { value: "voicemail", label: "Voicemail" },
              ]}
            />
            <p>{persona.afterHours === "answer" ? "Lockouts and alarms page Priya on call. Everything else is handled or booked for the morning." : "Callers leave a message. Zonera Voice transcribes it and texts you a summary."}</p>
          </div>
        </section>

        <section className="cc-sec">
          <div className="cc-sec-h">
            <h2>What Zonera Voice can do</h2>
            <button type="button" className="cc-link" onClick={() => go("ops/settings")}>
              Permissions
            </button>
          </div>
          <ul className="cc-can">
            {CAN.map(c => (
              <li key={c.what}>
                <span>{c.what}</span>
                <Pill tone={c.tier === "Never" ? "bad" : c.tier === "Ask first" ? "warn" : c.tier === "Verified callers" ? "info" : "ok"}>{c.tier}</Pill>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

