import React, { useEffect } from "react";
import { Pause, Play, SkipForward, X, Captions, Clapperboard, RotateCcw, Sparkles, LayoutDashboard, Headset, Store } from "lucide-react";
import { bindGhost } from "../agent/engine";
import { go, movie, setMovie, useDemo } from "../state/store";
import { director, finish, jump, markSeeded, openLauncher, pause, play, resumeFromReload, setSpeed, skip, taken, toggleCaptions, useDirector } from "./director";
import { CHAINS, FILM, storyById } from "./stories";
import "../styles/movie.css";

// Movie mode chrome: the cursor, the caption bar with transport controls,
// the launcher (pick the film, a chapter, or an agent chain) and the end card.

const SPEEDS = [1, 1.5, 2];

const SURFACE_ICON: Record<string, React.ReactNode> = {
  Storefront: <Store />,
  Operator: <LayoutDashboard />,
  Agent: <Sparkles />,
  Call: <Headset />,
};
const surfaceIcon = (kicker: string) => SURFACE_ICON[Object.keys(SURFACE_ICON).find(k => kicker.includes(k)) ?? "Agent"];

export function Director() {
  useDemo();
  useDirector();

  useEffect(() => {
    markSeeded();
    resumeFromReload(storyById);
  }, []);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (!director.story) return;
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === " ") {
        e.preventDefault();
        pause();
      } else if (e.key === "ArrowRight") skip();
      else if (e.key === "Escape") finish();
      else if (e.key === "c") toggleCaptions();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  const st = director.story;
  const ch = st && director.status !== "done" ? st.chapters[Math.min(director.idx, st.chapters.length - 1)] : null;

  return (
    <>
      <div className="ag-ghost" ref={bindGhost} aria-hidden>
        <svg viewBox="0 0 24 24" width="22" height="22">
          <path d="M5 3.2v15.6c0 .5.6.8 1 .4l3.6-3.6 2.4 5.6c.2.4.6.6 1 .4l2-.9c.4-.2.6-.6.4-1l-2.4-5.5h5.1c.5 0 .8-.6.4-1L6 2.8c-.4-.4-1-.1-1 .4z" />
        </svg>
        <span className="ag-ghost-ring" />
      </div>

      {st && ch && (
        <div className={`mv-bar ${director.captions ? "" : "mv-bar--min"} ${st.kind === "chain" ? "mv-bar--chain" : ""}`} role="status" aria-live="polite">
          {director.captions && (
            <div className="mv-cap" key={ch.id}>
              <span className="mv-cap-ic">{surfaceIcon(ch.kicker)}</span>
              <div className="mv-cap-t">
                <span className="mv-kicker">
                  <b className="tnum">{String(director.idx + 1).padStart(2, "0")}</b>
                  <i>/</i>
                  <span className="tnum">{String(st.chapters.length).padStart(2, "0")}</span>
                  <span className="mv-kicker-l">{ch.kicker}</span>
                </span>
                <strong>{ch.title}</strong>
                <p>{ch.body}</p>
              </div>
            </div>
          )}
          <div className="mv-ctl">
            <div className="mv-dots" aria-hidden>
              {st.chapters.map((c, i) => (
                <button key={c.id} type="button" className={i < director.idx ? "done" : i === director.idx ? "on" : ""} title={c.title} onClick={() => jump(i)} />
              ))}
            </div>
            <div className="mv-btns">
              <button type="button" onClick={pause} aria-label={director.status === "paused" ? "Resume" : "Pause"} title="Pause (space)">
                {director.status === "paused" ? <Play /> : <Pause />}
              </button>
              <button type="button" onClick={skip} aria-label="Next chapter" title="Next chapter (→)">
                <SkipForward />
              </button>
              <button type="button" className="mv-speed tnum" onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(movie.speed) + 1) % SPEEDS.length] ?? 1)} title="Speed">
                {movie.speed}×
              </button>
              <button type="button" onClick={toggleCaptions} aria-pressed={director.captions} aria-label="Captions" title="Captions (c)">
                <Captions />
              </button>
              <button type="button" onClick={finish} aria-label="Stop" title="Stop (esc)">
                <X />
              </button>
            </div>
          </div>
        </div>
      )}

      {st && director.status === "done" && st.kind === "film" && (
        <div className="mv-end" role="dialog" aria-label="The end">
          <div className="mv-end-in">
            <span className="mv-end-mark" aria-hidden>
              <svg viewBox="0 0 32 32" width="40" height="40">
                <rect width="32" height="32" rx="9" fill="currentColor" />
                <path d="M10 10.5h12l-12 11h12" fill="none" stroke="var(--paper)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <h2>{st.end?.title ?? "zonera"}</h2>
            <p>{st.end?.body}</p>
            <div className="mv-end-stats">
              <span>
                <b className="tnum">{st.chapters.length}</b> scenes
              </span>
              <span>
                <b className="tnum">3</b> surfaces
              </span>
              <span>
                <b className="tnum">{taken()}</b> actions taken
              </span>
            </div>
            <div className="mv-end-b">
              <button type="button" className="z-btn z-btn--primary" onClick={() => play(FILM, 0)}>
                <RotateCcw /> Play again
              </button>
              <button
                type="button"
                className="z-btn"
                onClick={() => {
                  finish();
                  go("ops/agent");
                }}
              >
                Explore on your own
              </button>
            </div>
          </div>
        </div>
      )}

      {director.launcher && <Launcher />}
    </>
  );
}

function Launcher() {
  return (
    <div className="mv-launch" role="dialog" aria-label="Movie mode" onClick={() => openLauncher(false)}>
      <div className="mv-launch-in" onClick={e => e.stopPropagation()}>
        <header>
          <span className="mv-launch-ic">
            <Clapperboard />
          </span>
          <div>
            <h2>Movie mode</h2>
            <p>The demo plays itself with a visible cursor and captions. Space pauses, → skips, Esc stops.</p>
          </div>
          <button type="button" className="z-btn z-btn--ghost z-iconbtn" aria-label="Close" onClick={() => openLauncher(false)}>
            <X />
          </button>
        </header>

        <section className="mv-film">
          <div className="mv-film-h">
            <div>
              <b>{FILM.title}</b>
              <span>{FILM.sub}</span>
            </div>
            <button type="button" className="z-btn z-btn--primary" data-auto="play-film" onClick={() => play(FILM, 0)}>
              <Play /> Play from the start
            </button>
          </div>
          <ol className="mv-chapters">
            {FILM.chapters.map((c, i) => (
              <li key={c.id}>
                <button type="button" onClick={() => play(FILM, i)}>
                  <span className="mv-ch-n tnum">{String(i + 1).padStart(2, "0")}</span>
                  <span className="mv-ch-t">
                    <b>{c.title}</b>
                    <span>{c.kicker}</span>
                  </span>
                  <Play className="mv-ch-play" />
                </button>
              </li>
            ))}
          </ol>
        </section>

        <section className="mv-chains">
          <div className="mv-sec-h">Agent chains · several flows in one chat</div>
          <div className="mv-chain-grid">
            {CHAINS.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  go("ops/agent");
                  play(c, 0);
                }}
              >
                <b>{c.title}</b>
                <span>{c.sub}</span>
              </button>
            ))}
          </div>
        </section>

        <footer>
          <label className="mv-auto">
            <input
              type="checkbox"
              checked={movie.on}
              onChange={e => {
                setMovie(e.target.checked);
              }}
            />
            <span>
              <b>Autoplay widgets</b> · flows you start yourself type and click on their own
            </span>
          </label>
        </footer>
      </div>
    </div>
  );
}
