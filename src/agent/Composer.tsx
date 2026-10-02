import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Paperclip, Mic, Square, Slash, X, FileText, FileSpreadsheet, Image as ImageIcon, CornerDownLeft } from "lucide-react";
import { abort, isBusy, notify, type Session } from "./engine";
import { submit } from "./controller";
import { SKILLS } from "./skills";
import { CATEGORIES } from "./engine";
import { FileChip } from "./Thread";

// The composer: multiline, Enter to send (Shift+Enter for a new line), "/" for
// commands, attachments, and voice mode (waveform + streaming transcript of a
// scripted utterance, then it sends; no microphone is used).

export const FILES = [
  { name: "alder-lake-site-plan.pdf", meta: "PDF · 3 pages · 2.4 MB", icon: <FileText /> },
  { name: "rent-roll-sept.csv", meta: "CSV · 163 rows", icon: <FileSpreadsheet /> },
  { name: "jordan-lee-license.jpg", meta: "Image · driver's license", icon: <ImageIcon /> },
];

const UTTERANCES = [
  { heard: "Matthew came in and paid two forty cash", text: "Matthew came in and paid $240 cash" },
  { heard: "text everyone past due a reminder", text: "Text everyone past due a reminder" },
  { heard: "make a gate code for the HVAC tech one to five today building D only", text: "Make a gate code for the HVAC tech, 1–5pm today, Building D only" },
];
let voiceTurn = 0;

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export function Composer({ s, variant, placeholder }: { s: Session; variant: "home" | "dock"; placeholder?: string }) {
  const ta = useRef<HTMLTextAreaElement>(null);
  const [menu, setMenu] = useState<null | "attach">(null);
  const [sel, setSel] = useState(0);
  const [voice, setVoice] = useState<null | { words: string[]; n: number; t0: number }>(null);
  const busy = isBusy(s);
  const draft = s.draft;
  const slash = draft.startsWith("/") && !draft.includes(" ") ? draft.slice(1).toLowerCase() : null;

  const commands = useMemo(
    () =>
      SKILLS.filter(k => k.examples.length)
        .map(k => ({ cmd: slug(k.title), title: k.title, example: k.examples[0], files: k.files ?? [], cat: CATEGORIES.find(c => c.id === k.category)?.label ?? "" }))
        .filter((c, i, a) => a.findIndex(x => x.cmd === c.cmd) === i),
    [],
  );
  const hits = slash === null ? [] : commands.filter(c => c.cmd.includes(slash) || c.title.toLowerCase().includes(slash)).slice(0, 8);

  useLayoutEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(200, el.scrollHeight) + "px";
  }, [draft, voice]);

  useEffect(() => setSel(0), [slash]);

  const setDraft = (v: string) => {
    s.draft = v;
    notify();
  };
  const send = () => {
    if (slash !== null && hits[sel]) return pick(hits[sel]);
    if (!draft.trim() && !s.files.length) return;
    submit(s, draft, s.files);
  };
  const pick = (c: (typeof commands)[number]) => {
    s.draft = c.example;
    s.files = c.files;
    notify();
    ta.current?.focus();
  };

  // Voice: waveform + streaming transcript, then normalise and send.
  const startVoice = () => {
    if (voice || busy) return;
    const u = UTTERANCES[voiceTurn++ % UTTERANCES.length];
    const words = u.heard.split(" ");
    setVoice({ words, n: 0, t0: Date.now() });
    let n = 0;
    const tick = () => {
      n++;
      setVoice(v => (v ? { ...v, n } : v));
      if (n < words.length) window.setTimeout(tick, 210 + Math.random() * 140);
      else
        window.setTimeout(() => {
          setVoice(null);
          s.draft = u.text;
          notify();
          window.setTimeout(() => submit(s, u.text, s.files), 520);
        }, 700);
    };
    window.setTimeout(tick, 650);
  };

  return (
    <div className={`ag-composer ag-composer--${variant} ${voice ? "is-voice" : ""}`} data-session={s.id}>
      {slash !== null && hits.length > 0 && (
        <div className="ag-pop ag-slash" role="listbox">
          <div className="ag-pop-h">Commands</div>
          {hits.map((c, i) => (
            <button key={c.cmd} type="button" role="option" aria-selected={i === sel} className={i === sel ? "is-on" : ""} onMouseEnter={() => setSel(i)} onClick={() => pick(c)}>
              <span className="mono">/{c.cmd}</span>
              <span className="ag-slash-ex">{c.example}</span>
              <em>{c.cat}</em>
            </button>
          ))}
        </div>
      )}
      {menu === "attach" && (
        <div className="ag-pop ag-attach">
          <div className="ag-pop-h">Recent files</div>
          {FILES.map(f => (
            <button
              key={f.name}
              type="button"
              data-auto={"file:" + f.name}
              onClick={() => {
                if (!s.files.includes(f.name)) s.files = [...s.files, f.name];
                setMenu(null);
                notify();
              }}
            >
              <span className="ag-file-ic">{f.icon}</span>
              <span>
                <b>{f.name}</b>
                <small>{f.meta}</small>
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="ag-box">
        {s.files.length > 0 && (
          <div className="ag-box-files">
            {s.files.map(f => (
              <FileChip
                key={f}
                name={f}
                onRemove={() => {
                  s.files = s.files.filter(x => x !== f);
                  notify();
                }}
              />
            ))}
          </div>
        )}
        {voice ? (
          <div className="ag-voice" aria-live="polite">
            <div className="ag-wave" aria-hidden>
              {Array.from({ length: 36 }).map((_, i) => (
                <i key={i} style={{ animationDelay: `${(i * 53) % 700}ms`, animationDuration: `${620 + ((i * 97) % 420)}ms` }} />
              ))}
            </div>
            <p className="ag-voice-t">
              {voice.words.slice(0, voice.n).join(" ")}
              <span className="ag-caret" />
            </p>
            <span className="ag-voice-l mono">Listening · {((Date.now() - voice.t0) / 1000).toFixed(1)}s</span>
          </div>
        ) : (
          <textarea
            ref={ta}
            data-auto="composer"
            rows={1}
            value={draft}
            placeholder={placeholder ?? (busy ? "Type to redirect, or wait for Zonera…" : "Ask Zonera to do something…")}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (slash !== null && hits.length) {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setSel(i => Math.min(hits.length - 1, i + 1));
                  return;
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setSel(i => Math.max(0, i - 1));
                  return;
                }
                if (e.key === "Tab") {
                  e.preventDefault();
                  pick(hits[sel]);
                  return;
                }
              }
              if (e.key === "Escape") setMenu(null);
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
          />
        )}
        <div className="ag-box-bar">
          <button type="button" className="ag-icon" aria-label="Attach a file" aria-expanded={menu === "attach"} data-auto="attach" onClick={() => setMenu(m => (m === "attach" ? null : "attach"))}>
            <Paperclip />
          </button>
          <button type="button" className="ag-icon" aria-label="Commands" onClick={() => setDraft("/")}>
            <Slash />
          </button>
          <span className="ag-box-hint">
            {voice ? (
              "Speak naturally. It sends when you stop."
            ) : (
              <>
                <span className="z-kbd">
                  <CornerDownLeft size={11} />
                </span>{" "}
                to send · <span className="z-kbd">/</span> for commands
              </>
            )}
          </span>
          <button type="button" className={`ag-icon ag-mic ${voice ? "is-on" : ""}`} aria-label={voice ? "Stop voice" : "Voice mode"} data-auto="voice" onClick={() => (voice ? setVoice(null) : startVoice())}>
            {voice ? <X /> : <Mic />}
          </button>
          {busy && !draft.trim() ? (
            <button type="button" className="ag-send ag-send--stop" aria-label="Stop" onClick={() => {
                abort(s.id);
                notify();
              }}>
              <Square />
            </button>
          ) : (
            <button type="button" className="ag-send" aria-label="Send" data-auto="send" disabled={!draft.trim() && !s.files.length} onClick={send}>
              <ArrowUp />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export { slug };
