import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, Map as MapIcon, Plus, Minus, Maximize2, Layers, FileUp, Check } from "lucide-react";
import { PageHeader } from "../kit";
import { Button, Seg, STATUS_LABEL, Avatar } from "../../ui";
import { fmt, toast, commit, useDemo } from "../../state/store";
import { BUILDINGS, UNITS, UNIT_BY_ID, occupancy, type Unit, type UnitSize, type UnitStatus } from "../../data/facility";
import { TENANTS, tenantForUnit } from "../../data/tenants";
import { FacilityView } from "../../three/FacilityView";
import { STATUS_COLORS, type FacilityScene } from "../../three/FacilityScene";
import { SearchBox } from "./a/kit";
import { SitePlan } from "./a/SitePlan";
import { UnitDetail } from "./a/UnitDetail";
import { KIND_LABEL, SIZES, STATUS_ORDER, sizeLabel } from "./a/units";

const HOME = { x: -14, z: -8, zoom: 1.02, az: 0.62, el: 0.62 };
const BUILD_STEPS = ["Reading site-plan.pdf", "Found 6 buildings, 4 drive lanes", "Placed 181 units", "Matched rent roll · 0 discrepancies"];

export default function FacilityPage({ id }: { id?: string }) {
  useDemo();
  const scene = useRef<FacilityScene | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<"3d" | "plan">("3d");
  const [selected, setSelected] = useState<string | null>(id && UNIT_BY_ID.has(id) ? id : null);
  const [focus, setFocus] = useState<UnitStatus | null>(null);
  const [size, setSize] = useState<UnitSize | null>(null);
  const [bldg, setBldg] = useState<string | null>(null);
  const [floor, setFloor] = useState<1 | 2>(1);
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const [q, setQ] = useState("");
  const [extrudeKey, setExtrudeKey] = useState(0);
  const [building, setBuilding] = useState(-1);
  const [layers, setLayers] = useState(false);

  useEffect(() => {
    if (id && UNIT_BY_ID.has(id)) setSelected(id);
  }, [id]);

  const occ = occupancy();
  const counts = STATUS_ORDER.map(s => ({ s, n: UNITS.filter(u => u.status === s).length }));
  const filtered = !!(focus || size);
  const match = (u: Unit) => (!focus || u.status === focus) && (!size || u.size === size);
  const matchIds = UNITS.filter(match).map(u => u.id);
  const pulse = filtered ? matchIds : bldg === "D" ? UNITS.filter(u => u.building === "D" && u.floor === floor).map(u => u.id) : [];
  const statuses = useMemo(() => {
    const o: Record<string, UnitStatus> = {};
    for (const u of UNITS) o[u.id] = filtered && !match(u) ? "occupied" : u.status;
    return o;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [UNITS.map(u => u.status).join(), focus, size]);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    const units = UNITS.filter(u => u.id.toLowerCase().startsWith(s) || u.id.toLowerCase().replace("-", "").startsWith(s)).slice(0, 5).map(u => ({ unit: u, label: u.id, sub: tenantForUnit(u)?.name ?? STATUS_LABEL[u.status] }));
    const people = TENANTS.filter(t => t.name.toLowerCase().includes(s))
      .slice(0, 5)
      .map(t => ({ unit: UNIT_BY_ID.get(t.unitIds[0])!, label: t.name, sub: t.unitIds.join(", ") }))
      .filter(r => r.unit);
    return [...units, ...people].slice(0, 7);
  }, [q]);

  const pick = (u: Unit) => {
    setSelected(u.id);
    setQ("");
    if (u.kind === "climate") {
      setBldg("D");
      setFloor(u.floor as 1 | 2);
    }
  };

  const flyBuilding = (bid: string | null) => {
    setBldg(bid);
    setSelected(null);
    if (!bid) {
      scene.current?.flyTo(HOME);
      return;
    }
    const b = BUILDINGS.find(x => x.id === bid)!;
    const zoom = Math.min(2.6, Math.max(1.5, 330 / Math.max(b.w, b.d * 1.6)));
    scene.current?.flyTo({ x: b.x + b.w / 2, z: b.z + b.d / 2, zoom, el: 0.66, az: bid === "C" || bid === "P" ? Math.PI - 0.62 : 0.62 });
  };

  const rebuild = () => {
    setView("3d");
    setSelected(null);
    scene.current?.flyTo(HOME);
    setExtrudeKey(k => k + 1);
    setBuilding(0);
    BUILD_STEPS.forEach((_, i) => window.setTimeout(() => setBuilding(i + 1), 650 * (i + 1)));
    window.setTimeout(() => {
      setBuilding(-1);
      commit({ kind: "agent", text: "Rebuilt the digital twin from site-plan.pdf · 181 units matched the rent roll", who: "Zonera agent" });
      toast({ title: "Twin rebuilt from the site plan", body: "6 buildings, 181 units. Every unit matched the rent roll.", tone: "ok" });
    }, 650 * (BUILD_STEPS.length + 1));
  };

  const zoomBy = (k: number) => {
    const s = scene.current;
    if (s) s.flyTo({ zoom: Math.min(6, Math.max(0.7, s.getView().zoom * k)) });
  };

  const hu = hover ? UNIT_BY_ID.get(hover.id) : null;
  const ht = hu ? tenantForUnit(hu) : null;
  const sw = stage.current?.clientWidth ?? 1000;

  return (
    <div className={`pa-twin ${selected ? "pa-twin--sel" : ""} ${layers ? "pa-twin--layers" : ""}`}>
      <div className="pa-twin-stage" ref={stage}>
        <div className="pa-twin-3d" style={{ visibility: view === "3d" ? "visible" : "hidden" }}>
          <FacilityView
            mode="ops"
            interactive
            view={HOME}
            selected={selected}
            fly
            pulse={pulse}
            statuses={statuses}
            extrudeKey={extrudeKey}
            onReady={s => (scene.current = s)}
            onSelect={id => setSelected(id)}
            onHover={(id, x, y) => setHover(id ? { id, x, y } : null)}
          />
        </div>
        {view === "plan" && (
          <div className="pa-twin-plan">
            <SitePlan floor={floor} selected={selected} match={match} onSelect={id => id && pick(UNIT_BY_ID.get(id)!)} onHover={(id, x, y) => setHover(id ? { id, x, y } : null)} />
          </div>
        )}
      </div>

      <div className="pa-twin-top">
        <PageHeader
          title="Digital twin"
          sub={
            <>
              {occ.units} units · {fmt.pct(occ.byUnit)} occupied · {occ.vacant} available · live from the rent roll
            </>
          }
          ask="Hold a free 10×20 for Owen Murphy"
          actions={
            <>
              <div className="pa-twin-find">
                <SearchBox
                  value={q}
                  onChange={setQ}
                  placeholder="Unit or tenant"
                  onKeyDown={e => {
                    if (e.key === "Enter" && results[0]) pick(results[0].unit);
                    if (e.key === "Escape") setQ("");
                  }}
                />
                {results.length > 0 && (
                  <ul className="pa-pop">
                    {results.map(r => (
                      <li key={r.label}>
                        <button onClick={() => pick(r.unit)}>
                          {r.label.includes("-") && !r.label.includes(" ") ? <span className="pa-pop-id mono">{r.label}</span> : <Avatar name={r.label} size="sm" />}
                          <span className="pa-pop-t">{r.label.includes(" ") ? r.label : r.sub}</span>
                          <span className="pa-pop-s mono">{r.label.includes(" ") ? r.sub : sizeLabel(r.unit.size)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <Seg
                value={view}
                onChange={v => {
                  setView(v);
                  setHover(null);
                }}
                options={[
                  { value: "3d", label: <span className="pa-seg-i"><Box size={13} /> 3D</span> },
                  { value: "plan", label: <span className="pa-seg-i"><MapIcon size={13} /> Site plan</span> },
                ]}
              />
              <Button icon={<FileUp />} onClick={rebuild} disabled={building >= 0}>
                Rebuild from site plan
              </Button>
            </>
          }
        />
      </div>

      <button className="z-btn pa-twin-layers-btn" onClick={() => setLayers(l => !l)}>
        <Layers /> Layers
      </button>

      <aside className="pa-twin-left">
        <div className="pa-float">
          <div className="pa-float-h">
            <span>Status</span>
            {filtered && (
              <button
                className="pa-link"
                onClick={() => {
                  setFocus(null);
                  setSize(null);
                }}
              >
                Clear
              </button>
            )}
          </div>
          <ul className="pa-legend-list">
            {counts.map(c => (
              <li key={c.s}>
                <button aria-pressed={focus === c.s} className={focus && focus !== c.s ? "dim" : ""} onClick={() => setFocus(f => (f === c.s ? null : c.s))}>
                  <i style={{ background: c.s === "occupied" ? "var(--pa-occ-3d)" : STATUS_COLORS[c.s] }} />
                  <span>{STATUS_LABEL[c.s]}</span>
                  <em className="mono">{c.n}</em>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="pa-float">
          <div className="pa-float-h">
            <span>Size</span>
            <span className="mono faint">{filtered ? `${matchIds.length} match` : ""}</span>
          </div>
          <div className="pa-sizes">
            {SIZES.map(s => (
              <button key={s} aria-pressed={size === s} onClick={() => setSize(x => (x === s ? null : s))} className="mono">
                {sizeLabel(s)}
              </button>
            ))}
          </div>
        </div>

        <div className="pa-float">
          <div className="pa-float-h">
            <span>Buildings</span>
          </div>
          <ul className="pa-bldgs">
            <li>
              <button aria-pressed={!bldg} onClick={() => flyBuilding(null)}>
                <span className="pa-bldg-id mono">All</span>
                <span>Whole site</span>
                <em className="mono">{UNITS.length}</em>
              </button>
            </li>
            {BUILDINGS.filter(b => b.kind !== "office").map(b => {
              const us = UNITS.filter(u => u.building === b.id);
              const taken = us.filter(u => ["occupied", "delinquent", "overlocked"].includes(u.status)).length;
              return (
                <li key={b.id}>
                  <button aria-pressed={bldg === b.id} onClick={() => flyBuilding(b.id)}>
                    <span className="pa-bldg-id mono">{b.id}</span>
                    <span>{b.id === "P" ? "RV & Boat" : b.kind === "climate" ? "Climate · 2 floors" : "Drive-up"}</span>
                    <em className="mono">{Math.round((taken / us.length) * 100)}%</em>
                  </button>
                  {b.id === "D" && bldg === "D" && (
                    <div className="pa-floors">
                      {[1, 2].map(f => (
                        <button key={f} aria-pressed={floor === f} onClick={() => setFloor(f as 1 | 2)}>
                          Floor {f}
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </aside>

      {view === "3d" && (
        <div className="pa-twin-ctl">
          <button aria-label="Zoom in" onClick={() => zoomBy(1.3)}>
            <Plus />
          </button>
          <button aria-label="Zoom out" onClick={() => zoomBy(1 / 1.3)}>
            <Minus />
          </button>
          <button
            aria-label="Reset view"
            onClick={() => {
              setSelected(null);
              setBldg(null);
              scene.current?.flyTo(HOME);
            }}
          >
            <Maximize2 />
          </button>
        </div>
      )}

      <div className="pa-twin-hint mono">{view === "3d" ? "Drag to orbit · scroll to zoom · click a door" : `Plan view · 1 px ≈ 1 ft${bldg === "D" ? "" : " · D shows floor " + floor}`}</div>

      {building >= 0 && (
        <div className="pa-build">
          {BUILD_STEPS.map((s, i) => (
            <span key={s} className={i < building ? "done" : i === building ? "on" : ""}>
              {i < building ? <Check size={12} /> : <i />}
              {s}
            </span>
          ))}
        </div>
      )}

      {hu && hover && hover.id !== selected && (
        <div className="pa-tip" style={{ left: Math.min(hover.x + 14, sw - 230), top: Math.max(8, hover.y - 12) }}>
          <div className="pa-tip-h">
            <b className="mono">{hu.id}</b>
            <span className="z-status">
              <i style={{ background: hu.status === "occupied" ? "var(--pa-occ-3d)" : STATUS_COLORS[hu.status] }} />
              {STATUS_LABEL[hu.status]}
            </span>
          </div>
          <div className="pa-tip-b">
            <span>
              {sizeLabel(hu.size)} · {KIND_LABEL[hu.kind]}
              {hu.kind === "climate" ? ` · floor ${hu.floor}` : ""}
            </span>
            <span>{ht ? `${ht.name} · ${fmt.money(ht.rent)}/mo` : `${fmt.money(hu.rate)}/mo street`}</span>
            {ht && ht.balance > 0 && <span className="bad">{fmt.money(ht.balance)} past due · {ht.daysLate} days</span>}
          </div>
        </div>
      )}

      {selected && (
        <div className="pa-twin-right">
          <UnitDetail unitId={selected} variant="panel" onClose={() => setSelected(null)} />
        </div>
      )}
    </div>
  );
}
