import React, { useEffect, useLayoutEffect, useRef } from "react";
import {
  ArrowLeft, Headphones, MessageSquareDashed, Hand, PhoneOff, Sparkles, X, Maximize2, Undo2, Send, CornerDownLeft, Check, TriangleAlert, PhoneCall, Wrench,
} from "lucide-react";
import { Button } from "../ui";
import { go, setCallsOpen } from "../state/store";
import { bump } from "./state";
import { answer, availableWhispers, dead, endCall, finish, handBack, humanSay, mmss, movieBeat, takeOver, toggleListen, whisper } from "./engine";
import { CallAvatar, ContextLink, ContextStrip, HandlerBadge, MoodStrip, Timer, callerContext, moodLabel, moodTone, speakerName } from "./bits";
import { VoiceWave } from "./Wave";
import type { Call, Ev, ToolEv } from "./types";

// The live call view: caller context, waveform, streaming transcript with tool
// chips, sentiment, and the controls (listen, whisper, take over, end).
// variant "panel" is the 420px push-in column; "page" is the full call center.

export function ToolChip({ ev }: { ev: ToolEv }) {
  return (
    <div className={`cc-tool ${ev.done ? "" : "cc-tool--run"}`}>
      <span className="cc-tool-i">{ev.done ? <Check /> : <span className="cc-spin" />}</span>
      <span className="cc-tool-n mono">{ev.tool}</span>
      <span className="cc-tool-l">{ev.label}</span>
      {ev.by === "human" && <span className="cc-tool-by">copilot</span>}
    </div>
  );
}

function Turn({ call, ev }: { call: Call; ev: Extract<Ev, { kind: "line" }> }) {
  const shown = ev.words.slice(0, Math.max(0, ev.shown - 1)).join(" ");
  const last = ev.shown > 0 ? ev.words[ev.shown - 1] : "";
  return (
    <div className={`cc-turn cc-turn--${ev.who} ${ev.done ? "" : "cc-turn--live"}`}>
      <div className="cc-turn-h">
        <b>{speakerName(call, ev.who)}</b>
        <span className="mono">{mmss(ev.at)}</span>
      </div>
      <p>
        {shown}
        {shown && " "}
        {last && (
          <span key={ev.shown} className="cc-w">
            {last}
          </span>
        )}
      </p>
    </div>
  );
}

function Note({ ev }: { ev: Extract<Ev, { kind: "note" }> }) {
  if (ev.tone === "whisper")
    return (
      <div className="cc-note cc-note--whisper">
        <span className="cc-note-h">
          <MessageSquareDashed /> Whisper from Priya · only Zonera Voice hears this
        </span>
        <p>{ev.text}</p>
      </div>
    );
  if (ev.tone === "ack")
    return (
      <div className="cc-note cc-note--ack">
        <span className="cc-note-h">
          <Sparkles /> Zonera Voice · private
        </span>
        <p>{ev.text}</p>
      </div>
    );
  if (ev.tone === "alert")
    return (
      <div className="cc-note cc-note--alert">
        <TriangleAlert /> {ev.text}
      </div>
    );
  return (
    <div className="cc-sys">
      <span>{ev.text}</span>
      <span className="mono">{mmss(ev.at)}</span>
    </div>
  );
}

export function Summary({ call }: { call: Call }) {
  if (call.status === "wrap")
    return (
      <div className="cc-sum cc-sum--wrap">
        <span className="cc-sum-h">
          <Sparkles /> Writing summary
        </span>
        <span className="z-shimmer" style={{ height: 10, width: "92%" }} />
        <span className="z-shimmer" style={{ height: 10, width: "76%" }} />
        <span className="z-shimmer" style={{ height: 10, width: "54%" }} />
      </div>
    );
  if (call.status !== "ended") return null;
  return (
    <div className="cc-sum">
      <span className="cc-sum-h">
        <Sparkles /> Summary
        <span className="mono">{mmss(call.duration ?? 0)}</span>
      </span>
      <b className={`cc-sum-o cc-sum-o--${call.tone ?? "neutral"}`}>{call.outcome}</b>
      <p>{call.summary}</p>
    </div>
  );
}

function Transcript({ call }: { call: Call }) {
  const ref = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  });
  useEffect(() => {
    stick.current = true;
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [call.id]);
  return (
    <div
      className="cc-tx"
      ref={ref}
      onScroll={e => {
        const el = e.currentTarget;
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      }}
    >
      <div className="cc-tx-in">
        {call.status === "ringing" && (
          <div className="cc-wait">
            <span className="cc-wait-ring">
              <PhoneCall />
            </span>
            <b>Incoming call</b>
            <span>Zonera Voice will answer in a moment.</span>
          </div>
        )}
        {call.status === "dialing" && (
          <div className="cc-wait">
            <span className="cc-wait-ring">
              <PhoneCall />
            </span>
            <b>Calling {call.name.split(" ")[0]}</b>
            <span className="mono">{call.phone}</span>
          </div>
        )}
        {call.events.map(ev => (ev.kind === "line" ? <Turn key={ev.id} call={call} ev={ev} /> : ev.kind === "tool" ? <ToolChip key={ev.id} ev={ev} /> : <Note key={ev.id} ev={ev} />))}
        <Summary call={call} />
      </div>
    </div>
  );
}

function Copilot({ call }: { call: Call }) {
  const pending = !!call.suggest?.length;
  return (
    <div className="cc-co">
      <div className="cc-co-h">
        <Sparkles />
        <b>Copilot</b>
        <span>{pending ? "Your turn · suggested replies" : `Listening to ${call.name === "New caller" ? "the caller" : call.name.split(" ")[0]}…`}</span>
      </div>
      {pending ? (
        <div className="cc-co-list">
          {call.suggest!.map((s, i) => (
            <button key={s} type="button" className="cc-co-s" onClick={() => humanSay(call, s)}>
              <span>{s}</span>
              {i === 0 && <span className="z-kbd">↵</span>}
            </button>
          ))}
        </div>
      ) : (
        <div className="cc-co-wait">
          <span className="z-shimmer" style={{ height: 8, width: "70%" }} />
        </div>
      )}
      <form
        className="cc-in"
        onSubmit={e => {
          e.preventDefault();
          if (call.reply.trim()) humanSay(call, call.reply);
          else if (call.suggest?.[0]) humanSay(call, call.suggest[0]);
        }}
      >
        <input
          className="cc-in-f"
          value={call.reply}
          placeholder="Say something, or press Enter for the first suggestion"
          onChange={e => {
            call.reply = e.target.value;
            bump();
          }}
        />
        <button type="submit" className="z-btn z-btn--sm z-btn--primary z-iconbtn" aria-label="Say">
          <CornerDownLeft />
        </button>
      </form>
    </div>
  );
}

function WhisperBox({ call }: { call: Call }) {
  const chips = availableWhispers(call);
  const inRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!call.draft) inRef.current?.focus();
  }, []);
  return (
    <div className="cc-wh">
      <div className="cc-co-h">
        <MessageSquareDashed />
        <b>Whisper</b>
        <span>Only Zonera Voice hears this</span>
        <button type="button" className="cc-x" aria-label="Close whisper" onClick={() => ((call.whisperOpen = false), bump())}>
          <X />
        </button>
      </div>
      {chips.length > 0 && (
        <div className="cc-wh-chips">
          {chips.map(w => (
            <button key={w.text} type="button" onClick={() => whisper(call, w.text)}>
              {w.text}
            </button>
          ))}
        </div>
      )}
      <form
        className="cc-in"
        onSubmit={e => {
          e.preventDefault();
          whisper(call, call.draft);
        }}
      >
        <input
          ref={inRef}
          className="cc-in-f"
          value={call.draft}
          placeholder="Tell Zonera Voice what to do next"
          onChange={e => {
            call.draft = e.target.value;
            bump();
          }}
        />
        <button type="submit" className="z-btn z-btn--sm z-btn--accent z-iconbtn" aria-label="Send whisper" disabled={!call.draft.trim()}>
          <Send />
        </button>
      </form>
    </div>
  );
}

function Controls({ call, onBack }: { call: Call; onBack?: () => void }) {
  if (call.status === "ringing")
    return (
      <div className="cc-ctl">
        <div className="cc-ctl-row cc-ctl-row--2">
          <button type="button" className="cc-cb" onClick={() => answer(call, "human")}>
            <PhoneCall /> Answer myself
          </button>
          <button type="button" className="cc-cb cc-cb--ai" onClick={() => answer(call, "ai")}>
            <Sparkles /> Let Zonera Voice answer
          </button>
        </div>
      </div>
    );
  if (call.status === "dialing")
    return (
      <div className="cc-ctl">
        <div className="cc-ctl-row cc-ctl-row--1">
          <button type="button" className="cc-cb cc-cb--end" onClick={() => finish(call, false)}>
            <PhoneOff /> Cancel call
          </button>
        </div>
      </div>
    );
  if (dead(call))
    return onBack ? (
      <div className="cc-ctl">
        <div className="cc-ctl-row cc-ctl-row--1">
          <button type="button" className="cc-cb" onClick={onBack}>
            <ArrowLeft /> Back to calls
          </button>
        </div>
      </div>
    ) : null;
  const human = call.handler === "human";
  return (
    <div className="cc-ctl">
      {call.alert && (
        <div className="cc-alert">
          <TriangleAlert />
          <div>
            <b>Zonera Voice is asking for you</b>
            <span>{call.alert.detail}</span>
          </div>
          <Button size="sm" variant="primary" onClick={() => takeOver(call)}>
            Take over
          </Button>
        </div>
      )}
      {human && <Copilot call={call} />}
      {!human && call.whisperOpen && <WhisperBox call={call} />}
      <div className="cc-ctl-row">
        <button type="button" className="cc-cb" aria-pressed={call.listening} onClick={() => toggleListen(call)}>
          <Headphones /> {call.listening ? "Listening" : "Listen"}
        </button>
        <button
          type="button"
          className="cc-cb"
          aria-pressed={call.whisperOpen}
          disabled={human}
          onClick={() => {
            call.whisperOpen = !call.whisperOpen;
            bump();
          }}
        >
          <MessageSquareDashed /> Whisper
        </button>
        {human ? (
          <button type="button" className="cc-cb" onClick={() => handBack(call)}>
            <Undo2 /> Hand back
          </button>
        ) : (
          <button type="button" className="cc-cb cc-cb--take" onClick={() => takeOver(call)}>
            <Hand /> Take over
          </button>
        )}
        <button type="button" className="cc-cb cc-cb--end" onClick={() => endCall(call)}>
          <PhoneOff /> End
        </button>
      </div>
    </div>
  );
}

function WaveBlock({ call, height }: { call: Call; height: number }) {
  const human = call.handler === "human";
  return (
    <div className={`cc-wb ${call.listening ? "cc-wb--listen" : ""}`}>
      <div className="cc-wb-l">
        <span className={`cc-wb-n ${call.speaking === "ai" || call.speaking === "human" ? "on" : ""} ${human ? "you" : "ai"}`}>
          <i />
          {human ? "Priya (you)" : "Zonera Voice"}
        </span>
        <span className={`cc-wb-n ${call.speaking === "caller" ? "on" : ""}`}>
          <i />
          {call.name === "New caller" ? "Caller" : call.name.split(" ")[0]}
        </span>
      </div>
      <VoiceWave call={call} lanes={2} height={height} />
      {call.listening && (
        <span className="cc-wb-live mono">
          <Headphones /> Listening
        </span>
      )}
    </div>
  );
}

function Actions({ call }: { call: Call }) {
  const tools = call.events.filter((e): e is ToolEv => e.kind === "tool");
  return (
    <ol className="cc-acts">
      {tools.length === 0 && <li className="faint">Nothing yet</li>}
      {tools.map(t => (
        <li key={t.id} className={t.done ? "" : "run"}>
          <span className="cc-acts-i">{t.done ? <Check /> : <span className="cc-spin" />}</span>
          <div>
            <b>{t.label}</b>
            <span className="mono">
              {t.tool} · {mmss(t.at)}
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}

function MoodChart({ call }: { call: Call }) {
  const pts = call.mood.length ? call.mood : [{ at: 0, v: 0.1 }];
  const W = 260, H = 56;
  const maxT = Math.max(30, ...pts.map(p => p.at));
  const x = (t: number) => (t / maxT) * (W - 8) + 4;
  const y = (v: number) => H / 2 - v * (H / 2 - 6);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${x(p.at).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <div className="cc-mc">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
        <line x1="0" x2={W} y1={H / 2} y2={H / 2} className="cc-mc-z" />
        <path d={d} className="cc-mc-l" vectorEffect="non-scaling-stroke" />
        {pts.map((p, i) => (
          <circle key={i} cx={x(p.at)} cy={y(p.v)} r={i === pts.length - 1 ? 3.2 : 2} className={`cc-mc-d cc-mc-d--${moodTone(p.v)}`} />
        ))}
      </svg>
      <div className="cc-mc-f">
        <span className={`cc-mood cc-mood--${moodTone(last.v)}`}>
          <i />
          {moodLabel(last.v)}
        </span>
        <span className="mono faint">{call.mood.length} turns</span>
      </div>
    </div>
  );
}

export function LiveCall({ call, variant, onBack }: { call: Call; variant: "panel" | "page"; onBack: () => void }) {
  useEffect(() => {
    movieBeat(call);
  }, [call.id]);
  const ctx = callerContext(call);

  const head = (
    <div className="cc-lc-who">
      <CallAvatar call={call} />
      <div className="cc-lc-who-t">
        <b>{call.name}</b>
        <span>
          {call.direction === "inbound" ? "Inbound" : "Outbound"} · <span className="mono">{call.phone}</span>
          {call.campaign && " · campaign"}
        </span>
      </div>
      <div className="cc-lc-who-r">
        <span className={`cc-state cc-state--${call.status}`}>
          <i />
          <Timer call={call} />
        </span>
        <HandlerBadge call={call} />
      </div>
    </div>
  );

  if (variant === "panel") {
    return (
      <div className="cc-lc cc-lc--panel">
        <header className="cc-ph">
          <button type="button" className="z-btn z-btn--ghost z-btn--sm z-iconbtn" aria-label="Back to calls" onClick={onBack}>
            <ArrowLeft />
          </button>
          <span className="cc-ph-t">{call.intent}</span>
          <button
            type="button"
            className="z-btn z-btn--ghost z-btn--sm z-iconbtn"
            aria-label="Open in call center"
            title="Open in call center"
            onClick={() => {
              setCallsOpen(false);
              go(`ops/calls/${call.id}`);
            }}
          >
            <Maximize2 />
          </button>
          <button type="button" className="z-btn z-btn--ghost z-btn--sm z-iconbtn" aria-label="Close calls" onClick={() => setCallsOpen(false)}>
            <X />
          </button>
        </header>
        <div className="cc-lc-top">
          {head}
          <div className="cc-lc-ctx">
            <div className="cc-lc-ctx-h">
              <span>{ctx.kind}</span>
              <ContextLink call={call} />
            </div>
            <ContextStrip call={call} />
          </div>
          <WaveBlock call={call} height={52} />
          <MoodStrip call={call} />
        </div>
        <Transcript call={call} />
        <Controls call={call} onBack={onBack} />
      </div>
    );
  }

  return (
    <div className="cc-lc cc-lc--page">
      <div className="cc-lc-main">
        <div className="cc-lc-top">
          {head}
          <WaveBlock call={call} height={72} />
        </div>
        <Transcript call={call} />
        <Controls call={call} />
      </div>
      <aside className="cc-lc-side">
        <section className="cc-side-s">
          <div className="cc-side-h">
            <h3>Caller</h3>
            <ContextLink call={call} />
          </div>
          <span className="cc-side-k">{ctx.kind}</span>
          <ContextStrip call={call} />
        </section>
        <section className="cc-side-s">
          <div className="cc-side-h">
            <h3>Sentiment</h3>
          </div>
          <MoodChart call={call} />
        </section>
        <section className="cc-side-s cc-side-s--grow">
          <div className="cc-side-h">
            <h3>Agent actions</h3>
            <span className="mono faint">
              <Wrench size={12} /> {call.events.filter(e => e.kind === "tool").length}
            </span>
          </div>
          <Actions call={call} />
        </section>
      </aside>
    </div>
  );
}

