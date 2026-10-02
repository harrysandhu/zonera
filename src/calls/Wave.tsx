import React, { useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";
import type { Call, Speaker } from "./types";
import { mmss } from "./engine";

// Waveforms. Live ones are canvases fed by one shared animation loop; they read
// the call object directly every frame (who is speaking) so streaming never has
// to re-render React to move the bars.

type Draw = (t: number) => void;
const drawers = new Set<Draw>();
let raf = 0;
const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function loop(t: number) {
  drawers.forEach(d => d(t));
  raf = drawers.size ? requestAnimationFrame(loop) : 0;
}

function useFrame(draw: Draw) {
  const ref = useRef(draw);
  ref.current = draw;
  useEffect(() => {
    const d: Draw = t => ref.current(t);
    drawers.add(d);
    if (!raf) raf = requestAnimationFrame(loop);
    return () => {
      drawers.delete(d);
    };
  }, []);
}

interface Palette { accent: string; ink: string; ink3: string; line: string }
function readPalette(el: Element): Palette {
  const cs = getComputedStyle(el);
  const v = (n: string, f: string) => cs.getPropertyValue(n).trim() || f;
  return { accent: v("--accent", "#0358f7"), ink: v("--ink", "#1d1f1d"), ink3: v("--ink-3", "#8d918d"), line: v("--line-2", "rgba(0,0,0,.14)") };
}

interface Sample { a: number; w: Speaker | null }

function nextAmp(prev: number, speaking: boolean) {
  const target = speaking ? 0.22 + 0.78 * Math.pow(Math.random(), 0.75) : 0.03 + Math.random() * 0.05;
  return prev + (target - prev) * (speaking ? 0.72 : 0.5);
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const r = Math.min(w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

/**
 * Live voice waveform. lanes=2 draws the agent side (Zonera Voice in blue, or
 * Priya in ink after a takeover) above the caller; lanes=1 merges both into one
 * strip colored by who spoke.
 */
export function VoiceWave({ call, lanes = 2, height = 64, bar = 2, gap = 2, className = "" }: { call: Call; lanes?: 1 | 2; height?: number; bar?: number; gap?: number; className?: string }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const st = useRef({ w: 0, hist: [[], []] as Sample[][], last: 0, pal: null as Palette | null, frame: 0, lvl: [0, 0] });

  useEffect(() => {
    const el = cv.current;
    if (!el) return;
    const box = el.parentElement!;
    const ro = new ResizeObserver(() => {
      const w = Math.max(10, Math.round(box.clientWidth));
      st.current.w = w;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      el.width = w * dpr;
      el.height = height * dpr;
      const n = Math.ceil(w / (bar + gap)) + 1;
      st.current.hist = st.current.hist.map(h => {
        const out = h.slice(-n);
        while (out.length < n) out.unshift({ a: 0.03 + Math.random() * 0.03, w: null });
        return out;
      });
    });
    ro.observe(box);
    return () => ro.disconnect();
  }, [height, bar, gap]);

  useFrame(t => {
    const el = cv.current;
    const s = st.current;
    if (!el || !s.w) return;
    if (!s.pal || s.frame++ % 40 === 0) s.pal = readPalette(el);
    const live = call.status === "live";
    const step = reduced ? 400 : 58;
    if (t - s.last >= step && live) {
      s.last = t;
      const agentSide = call.speaking === "ai" || call.speaking === "human";
      s.lvl[0] = nextAmp(s.lvl[0], agentSide);
      s.lvl[1] = nextAmp(s.lvl[1], call.speaking === "caller");
      s.hist[0].push({ a: s.lvl[0], w: agentSide ? call.speaking : null });
      s.hist[1].push({ a: s.lvl[1], w: call.speaking === "caller" ? "caller" : null });
      s.hist[0].shift();
      s.hist[1].shift();
    } else if (live) return;
    else if (s.frame % 20 !== 1) return;

    const ctx = el.getContext("2d")!;
    const dpr = el.width / s.w;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, s.w, height);
    const pal = s.pal!;
    const laneH = lanes === 2 ? height / 2 : height;
    const n = s.hist[0].length;
    const ringing = call.status === "ringing" || call.status === "dialing";
    for (let i = 0; i < n; i++) {
      const x = s.w - (n - i) * (bar + gap) + gap;
      if (x < -bar) continue;
      const fade = Math.min(1, (x + 40) / (s.w * 0.22));
      if (lanes === 2) {
        for (let l = 0; l < 2; l++) {
          const smp = s.hist[l][i];
          const cy = laneH * l + laneH / 2;
          const h = Math.max(2, smp.a * (laneH - 6));
          ctx.globalAlpha = fade * (smp.w === "caller" ? 0.78 : smp.w ? 1 : 0.35);
          ctx.fillStyle = smp.w === "ai" ? pal.accent : smp.w ? pal.ink : pal.ink3;
          rr(ctx, x, cy - h / 2, bar, h);
        }
      } else {
        const a0 = s.hist[0][i];
        const a1 = s.hist[1][i];
        const top = a0.a >= a1.a ? a0 : a1;
        const h = Math.max(2, top.a * (laneH - 4));
        ctx.globalAlpha = fade * (top.w ? 1 : 0.35);
        ctx.fillStyle = top.w === "ai" ? pal.accent : top.w ? pal.ink : pal.ink3;
        if (ringing) ctx.fillStyle = pal.ink3;
        rr(ctx, x, laneH / 2 - h / 2, bar, h);
      }
    }
    ctx.globalAlpha = 1;
  });

  // The canvas is absolutely positioned so its pixel size never feeds back into layout.
  return (
    <div className={`cc-wave ${className}`} style={{ height }} aria-hidden>
      <canvas ref={cv} />
    </div>
  );
}

/** Four tiny bars for list rows and the top-bar pill. Pure CSS. */
export function MiniWave({ speaking, live = true }: { speaking: Speaker | null; live?: boolean }) {
  return (
    <span className={`cc-mw ${live ? "" : "cc-mw--off"}`} data-s={speaking ?? ""} aria-hidden>
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

function hash(s: string) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** Recorded call playback: a static waveform with a scrubber. Mock audio. */
export function Playback({ id, duration, compact }: { id: string; duration: number; compact?: boolean }) {
  const n = compact ? 64 : 120;
  const bars = React.useMemo(() => {
    let s = hash(id);
    const r = () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0) / 4294967296;
    let who: "ai" | "caller" = "ai";
    let run = 0;
    return Array.from({ length: n }, (_, i) => {
      if (run-- <= 0) {
        who = who === "ai" ? "caller" : "ai";
        run = 6 + Math.floor(r() * 12);
      }
      const gapBar = r() < 0.08;
      return { who, a: gapBar ? 0.08 : 0.2 + 0.8 * Math.pow(r(), 0.8), i };
    });
  }, [id, n]);
  const [pos, setPos] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    let f = 0;
    const tick = (t: number) => {
      const dt = (t - last) / 1000;
      last = t;
      setPos(p => {
        const np = p + dt / Math.max(1, duration);
        if (np >= 1) {
          setPlaying(false);
          return 1;
        }
        return np;
      });
      f = requestAnimationFrame(tick);
    };
    f = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(f);
  }, [playing, duration]);
  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setPos(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)));
  };
  return (
    <div className={`cc-play ${compact ? "cc-play--c" : ""}`}>
      <button
        type="button"
        className="cc-play-b"
        aria-label={playing ? "Pause" : "Play recording"}
        onClick={e => {
          e.stopPropagation();
          if (pos >= 1) setPos(0);
          setPlaying(p => !p);
        }}
      >
        {playing ? <Pause /> : <Play />}
      </button>
      <div className="cc-play-w" onClick={e => (e.stopPropagation(), seek(e))} role="slider" aria-valuenow={Math.round(pos * duration)} aria-valuemin={0} aria-valuemax={duration} aria-label="Scrub">
        {bars.map(b => (
          <i key={b.i} className={`${b.who === "ai" ? "ai" : ""} ${b.i / n <= pos ? "on" : ""}`} style={{ height: `${Math.round(b.a * 100)}%` }} />
        ))}
        <span className="cc-play-h" style={{ left: `${pos * 100}%` }} />
      </div>
      <span className="cc-play-t mono">
        {mmss(pos * duration)} / {mmss(duration)}
      </span>
    </div>
  );
}
