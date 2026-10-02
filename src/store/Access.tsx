import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, CornerUpLeft, CornerUpRight, DoorOpen, KeyRound, MessageSquare, Phone, Wallet, ArrowUp, ArrowUpFromLine, MapPin } from "lucide-react";
import { AISLES, BUILDINGS, FACILITY, routeTo, type Unit } from "../data/facility";
import { go, toast, useDemo } from "../state/store";
import { Mark } from "../ui";
import { FacilityView, type SceneLabel } from "../three/FacilityView";
import { GATE_CODE, kindLabel, sizeLabel, unitOrDefault, useOrder } from "./order";

// The drive from the gate to the door, on a dark HUD map that loops forever.

type Turn = "gate" | "left" | "right" | "straight" | "arrive" | "door" | "elevator" | "hall";

interface Leg {
  icon: Turn;
  text: string;
  sub: string;
  leg: number; // route leg this step belongs to (-1 = after arriving)
}

const SPEED_FT_S = 7.3; // 5 mph

function laneName(a: { x: number; z: number }, b: { x: number; z: number }) {
  if (Math.abs(a.z - b.z) < 1) {
    const z = a.z;
    if (Math.abs(z - AISLES.southZ) < 1) return "onto the front lane, along Building A";
    if (Math.abs(z - AISLES.abZ) < 1) return "into the lane between Buildings A and B";
    if (Math.abs(z - AISLES.bcZ) < 1) return "into the lane between Buildings B and C";
    if (Math.abs(z - AISLES.northZ) < 1) return "into the lane behind Building C";
  }
  if (Math.abs(a.x - b.x) < 1 && Math.abs(a.x - AISLES.spineX) < 1) return "onto the main lane";
  return "ahead";
}

function side(dir: { x: number; z: number }, from: { x: number; z: number }, to: { x: number; z: number }) {
  const vx = to.x - from.x;
  const vz = to.z - from.z;
  return dir.x * vz - dir.z * vx > 0 ? "right" : "left";
}

export function directions(u: Unit) {
  const r = routeTo(u.id);
  const p = r.points;
  const legs: Leg[] = [];
  const dirOf = (i: number) => {
    const dx = p[i + 1].x - p[i].x;
    const dz = p[i + 1].z - p[i].z;
    const l = Math.hypot(dx, dz) || 1;
    return { x: dx / l, z: dz / l, len: l };
  };
  for (let i = 0; i < p.length - 1; i++) {
    const d = dirOf(i);
    if (i === 0) {
      legs.push({ icon: "gate", text: `Enter ${GATE_CODE}# at the gate keypad`, sub: "The arm lifts. Drive straight in.", leg: 0 });
      continue;
    }
    const pd = dirOf(i - 1);
    const turn = pd.x * d.z - pd.z * d.x > 0 ? "right" : "left";
    legs.push({ icon: turn, text: `Turn ${turn} ${laneName(p[i], p[i + 1])}`, sub: `${Math.round(d.len)} ft`, leg: i });
  }
  const end = p[p.length - 1];
  const last = dirOf(p.length - 2);
  if (u.kind === "climate") {
    const b = BUILDINGS.find(b => b.id === "D")!;
    const s = side(last, end, { x: b.x + b.w / 2, z: b.z + b.d / 2 });
    legs.push({ icon: "arrive", text: `Park at the Building D entrance on your ${s}`, sub: "Loading zone, 30 minutes", leg: -1 });
    legs.push({ icon: "door", text: `Same code opens the door: ${GATE_CODE}#`, sub: "Carts are inside on the right", leg: -1 });
    if (u.floor === 2) legs.push({ icon: "elevator", text: "Take the elevator to floor 2", sub: "Fits a cart and a mattress", leg: -1 });
    const hall = /on your (left|right)/.exec(r.steps[r.steps.length - 1])?.[1] ?? "right";
    legs.push({ icon: "hall", text: `${u.id} is down the hall on your ${hall}`, sub: `${sizeLabel(u.size)} · climate controlled`, leg: -1 });
  } else {
    const s = side(last, end, { x: u.x + u.w / 2, z: u.z + u.d / 2 });
    legs.push({ icon: "arrive", text: `${u.id} is on your ${s}`, sub: u.kind === "parking" ? "Back in, 40 ft deep" : "Roll-up door, park right at it", leg: -1 });
  }
  return { legs, route: r };
}

const ICON: Record<Turn, React.ReactNode> = {
  gate: <KeyRound />,
  left: <CornerUpLeft />,
  right: <CornerUpRight />,
  straight: <ArrowUp />,
  arrive: <MapPin />,
  door: <DoorOpen />,
  elevator: <ArrowUpFromLine />,
  hall: <MapPin />,
};

function Qr({ seed = 7 }: { seed?: number }) {
  const n = 25;
  const cells = useMemo(() => {
    let s = seed;
    const r = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
    const out: [number, number][] = [];
    const finder = (x: number, y: number) => x < 7 && y < 7;
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const inF = finder(x, y) || finder(n - 1 - x, y) || finder(x, n - 1 - y);
        if (inF) continue;
        if (r() > 0.52) out.push([x, y]);
      }
    return out;
  }, [seed]);
  const Finder = ({ x, y }: { x: number; y: number }) => (
    <g transform={`translate(${x} ${y})`}>
      <rect width="7" height="7" rx="1.4" fill="#111" />
      <rect x="1" y="1" width="5" height="5" rx="1" fill="#fff" />
      <rect x="2" y="2" width="3" height="3" rx="0.6" fill="#111" />
    </g>
  );
  return (
    <svg viewBox={`-1 -1 ${n + 2} ${n + 2}`} aria-label="Gate pass code">
      <rect x="-1" y="-1" width={n + 2} height={n + 2} rx="2" fill="#fff" />
      {cells.map(([x, y]) => (
        <rect key={x + "-" + y} x={x + 0.08} y={y + 0.08} width="0.84" height="0.84" rx="0.2" fill="#111" />
      ))}
      <Finder x={0} y={0} />
      <Finder x={n - 7} y={0} />
      <Finder x={0} y={n - 7} />
    </svg>
  );
}

export function Access() {
  useDemo();
  const o = useOrder();
  const unit = unitOrDefault(o.unitId);
  const first = o.tenantId ? o.first : "Maya";
  const full = o.tenantId ? `${o.first} ${o.last}` : "Maya Chen";
  const phone = o.tenantId ? o.phone : "(530) 555-0198";
  const { legs, route } = useMemo(() => directions(unit), [unit.id]);
  const live = useRef({ phase: "overview" as "overview" | "drive" | "arrive", t: 0, leg: 0, at: 0 });
  const [p, setP] = useState(live.current);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    const t = window.setInterval(() => setP({ ...live.current }), 120);
    return () => clearInterval(t);
  }, []);

  const onRoute = (e: { phase: "overview" | "drive" | "arrive"; t: number; leg: number }) => {
    const c = live.current;
    if (e.phase !== c.phase) c.at = performance.now();
    c.phase = e.phase;
    c.t = e.t;
    c.leg = e.leg;
  };

  // Which instruction is current.
  const after = legs.filter(l => l.leg === -1);
  let cur = 0;
  if (p.phase === "drive") cur = Math.max(0, legs.findIndex(l => l.leg === p.leg));
  else if (p.phase === "arrive") {
    const k = Math.min(after.length - 1, Math.floor(((performance.now() - p.at) / 3200) * after.length));
    cur = legs.length - after.length + Math.max(0, k);
  }
  const left = p.phase === "arrive" ? 0 : Math.round(route.feet * (1 - (p.phase === "drive" ? p.t : 0)));
  const eta = Math.round(left / SPEED_FT_S);
  const pts = route.points;

  const labels: SceneLabel[] = [
    {
      key: "gate",
      at: { x: FACILITY.gate.x, y: 10, z: FACILITY.gate.z + 8 },
      children: (
        <div className="st-hl">
          <KeyRound /> Gate · {GATE_CODE}#
        </div>
      ),
    },
    ...pts.slice(1, -1).map((pt, i) => {
      const lg = legs[i + 1];
      return {
        key: "turn" + i,
        at: { x: pt.x, y: 4, z: pt.z },
        children: <div className={`st-hl st-hl--turn ${p.phase === "drive" && p.leg === i + 1 ? "on" : ""}`}>{lg?.icon === "left" ? "Turn left" : lg?.icon === "right" ? "Turn right" : "Continue"}</div>,
      };
    }),
    {
      key: "car",
      at: "car",
      children: (
        <div className="st-hl st-hl--car">
          {first} · {p.phase === "drive" ? "5 mph" : p.phase === "arrive" ? "Arrived" : "At the gate"}
        </div>
      ),
    },
    {
      key: "unit",
      unitId: unit.id,
      lift: 18,
      children: (
        <div className="st-hl st-hl--unit">
          <b>{unit.id}</b> {sizeLabel(unit.size)}
          {unit.kind === "climate" ? ` · floor ${unit.floor}` : ""}
        </div>
      ),
    },
  ];

  return (
    <div className="st-hud">
      <div className="st-hud-map">
        <FacilityView mode="hud" route={unit.id} follow labels={labels} onRoute={onRoute} />
      </div>
      <svg className="st-hud-grid" aria-hidden>
        <defs>
          <pattern id="st-grid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M48 0H0V48" fill="none" stroke="currentColor" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#st-grid)" />
      </svg>
      {["tl", "tr", "bl", "br"].map(c => (
        <span key={c} className={`st-hud-c st-c-${c}`} />
      ))}

      <header className="st-hud-top">
        <div className="st-hud-brand">
          <Mark size={22} />
          <span>Alder Lake</span>
        </div>
        <div className="st-hud-status mono">
          <i className={p.phase} />
          {p.phase === "overview" ? "Route ready" : p.phase === "drive" ? `Driving · leg ${p.leg + 1} of ${pts.length - 1}` : "Arrived"} · {unit.id}
        </div>
        <button className="st-hud-btn" onClick={() => go("store")}>
          <ArrowLeft /> Storefront
        </button>
      </header>

      <aside className="st-hud-l">
        <div className="st-hud-hello">
          <span className="mono">
            <Check /> Lease signed · gate code active
          </span>
          <h1>You're all set, {first}.</h1>
        </div>
        <div className="st-hud-code">
          <span className="mono">Gate code</span>
          <b className="mono">{GATE_CODE}#</b>
          <p>
            Keypad at the gate, {FACILITY.gateHours.replace(", every day", " daily")}.{unit.kind === "climate" ? " Also opens the Building D door." : ""}
          </p>
        </div>
        <div className="st-hud-unit">
          <div>
            <span className="mono">Unit</span>
            <b>{unit.id}</b>
          </div>
          <div>
            <span className="mono">Size</span>
            <b>{sizeLabel(unit.size)}</b>
          </div>
          <div>
            <span className="mono">Type</span>
            <b>{unit.kind === "climate" ? `Climate · fl ${unit.floor}` : kindLabel(unit).replace("RV & boat parking", "Parking")}</b>
          </div>
        </div>
        <ol className="st-hud-steps">
          {legs.map((l, i) => (
            <li key={i} className={i === cur ? "on" : i < cur ? "past" : ""}>
              <span className="st-hud-ic">{i < cur ? <Check /> : ICON[l.icon]}</span>
              <div>
                <b>{l.text}</b>
                <span>{l.sub}</span>
              </div>
            </li>
          ))}
        </ol>
        <div className="st-hud-tele">
          <div>
            <span className="mono">Distance</span>
            <b className="mono">{left} ft</b>
          </div>
          <div>
            <span className="mono">ETA</span>
            <b className="mono">
              {Math.floor(eta / 60)}:{String(eta % 60).padStart(2, "0")}
            </b>
          </div>
          <div>
            <span className="mono">Speed</span>
            <b className="mono">{p.phase === "drive" ? "5 mph" : "0 mph"}</b>
          </div>
        </div>
        <div className="st-hud-bar">
          <i style={{ width: `${(p.phase === "arrive" ? 1 : p.phase === "drive" ? p.t : 0) * 100}%` }} />
        </div>
      </aside>

      <aside className="st-hud-r">
        <div className={`st-pass ${added ? "added" : ""}`}>
          <div className="st-pass-h">
            <span className="st-pass-logo">
              <Mark size={20} />
              Zonera Alder Lake
            </span>
            <span className="st-pass-k">
              <em>Unit</em>
              <b>{unit.id}</b>
            </span>
          </div>
          <div className="st-pass-big">
            <em>Gate code</em>
            <b>{GATE_CODE}#</b>
          </div>
          <div className="st-pass-row">
            <span>
              <em>Renter</em>
              <b>{full}</b>
            </span>
            <span>
              <em>Size</em>
              <b>{sizeLabel(unit.size)}</b>
            </span>
            <span>
              <em>Since</em>
              <b>Oct 2</b>
            </span>
          </div>
          <div className="st-pass-qr">
            <Qr seed={unit.id.charCodeAt(2) * 31 + 7} />
            <span className="mono">Scan at the gate if the keypad is busy</span>
          </div>
        </div>
        <button
          className="st-wallet"
          onClick={() => {
            setAdded(true);
            toast({ title: "Added to Apple Wallet", body: `Your ${unit.id} pass will show up near the gate.`, tone: "ok" }, 3200);
          }}
        >
          <Wallet /> {added ? "In Apple Wallet" : "Add to Apple Wallet"}
        </button>
        <button className="st-hud-btn st-hud-btn--wide" onClick={() => toast({ title: "Directions sent", body: `Texted the route to ${phone}.`, tone: "ok" }, 3200)}>
          <MessageSquare /> Text me directions
        </button>
        <dl className="st-hud-info">
          <div>
            <dt className="mono">Gate hours</dt>
            <dd>6:00 am – 10:00 pm daily</dd>
          </div>
          <div>
            <dt className="mono">Office</dt>
            <dd>9:00 am – 6:00 pm Mon–Sat</dd>
          </div>
          <div>
            <dt className="mono">Help line</dt>
            <dd>
              <a href={`tel:${FACILITY.phone.replace(/\D/g, "")}`}>
                <Phone /> {FACILITY.phone}
              </a>
            </dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}
