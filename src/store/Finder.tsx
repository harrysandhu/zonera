import React, { useMemo, useState } from "react";
import { ArrowRight, Minus, Plus, RotateCcw, Sparkles, X } from "lucide-react";
import { ITEMS, PRESETS } from "../data/catalog";
import { SIZE_INFO, UNIT_BY_ID, type UnitSize } from "../data/facility";
import { useDemo } from "../state/store";
import { Button } from "../ui";
import { FacilityView } from "../three/FacilityView";
import { availableOf, kindShort, sizeLabel, unitFacts } from "./order";
import { recommendFor } from "./sizing";

export interface FinderState {
  sel: Record<string, number>;
  preset: string | null;
  size: UnitSize | null; // a size the renter picked by hand (overrides the recommendation)
  picked: string | null;
  understood: { text: string; parts: string[] } | null;
}

export const initialFinder = (): FinderState => ({ sel: { ...PRESETS[1].items }, preset: "one-bed", size: null, picked: null, understood: null });

const GROUPS = Array.from(new Set(ITEMS.map(i => i.group)));

export function Finder({ st, set, onRent, tapId }: { st: FinderState; set: (p: Partial<FinderState>) => void; onRent: (unitId: string) => void; tapId?: string | null }) {
  useDemo();
  const rec = useMemo(() => recommendFor(st.sel), [st.sel]);
  const size: UnitSize = st.size ?? rec.size;
  const avail = availableOf(size);
  const picked = st.picked && avail.some(u => u.id === st.picked) ? st.picked : avail[0]?.id ?? null;
  const unit = picked ? UNIT_BY_ID.get(picked)! : null;
  const info = SIZE_INFO[size];
  const from = avail.length ? Math.min(...avail.map(u => u.rate)) : null;
  const fill = st.size ? Math.min(1, rec.cubic / Math.max(1, info.cubic || 1)) : rec.fill;
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const hu = hover ? UNIT_BY_ID.get(hover.id) : null;
  const total = Object.values(st.sel).reduce((s, n) => s + n, 0);

  const bump = (id: string, d: number) => {
    const n = Math.max(0, Math.min(99, (st.sel[id] ?? 0) + d));
    const sel = { ...st.sel, [id]: n };
    if (!n) delete sel[id];
    set({ sel, preset: null, size: null, picked: null, understood: null });
  };

  const pickPreset = (id: string) => set({ sel: { ...PRESETS.find(p => p.id === id)!.items }, preset: id, size: null, picked: null, understood: null });

  const onSelect = (id: string | null) => {
    if (!id) return;
    const u = UNIT_BY_ID.get(id);
    if (!u || u.status !== "vacant") return;
    set({ picked: id, size: u.size === rec.size ? null : u.size });
  };

  return (
    <div className="st-finder" id="st-finder-panel">
      <div className="st-fl">
        <div className="st-fl-h">
          <h3>What you're storing</h3>
          {total > 0 && (
            <button className="st-link" onClick={() => set({ sel: {}, preset: null, size: null, picked: null, understood: null })}>
              <RotateCcw size={12} /> Clear
            </button>
          )}
        </div>
        <div className="st-presets" role="group" aria-label="Presets">
          {PRESETS.map(p => (
            <button key={p.id} aria-pressed={st.preset === p.id} onClick={() => pickPreset(p.id)} title={p.hint}>
              {p.label}
            </button>
          ))}
        </div>
        {st.understood && (
          <div className="st-understood">
            <Sparkles size={13} />
            <p>
              <span>From “{st.understood.text}”</span>
              {st.understood.parts.join(" · ")}
            </p>
            <button aria-label="Dismiss" onClick={() => set({ understood: null })}>
              <X size={13} />
            </button>
          </div>
        )}
        <div className="st-items">
          {GROUPS.map(g => (
            <React.Fragment key={g}>
              <div className="st-items-g">{g}</div>
              {ITEMS.filter(i => i.group === g).map(i => {
                const n = st.sel[i.id] ?? 0;
                return (
                  <div key={i.id} className={`st-item ${n ? "on" : ""}`}>
                    <span className="st-item-l">{i.label}</span>
                    <span className="st-step">
                      <button aria-label={`Fewer ${i.label}`} onClick={() => bump(i.id, -1)} disabled={!n}>
                        <Minus />
                      </button>
                      <span className="tnum">{n}</span>
                      <button aria-label={`More ${i.label}`} onClick={() => bump(i.id, 1)}>
                        <Plus />
                      </button>
                    </span>
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
        <div className="st-fl-f">
          <div>
            <b className="tnum">{rec.cubic.toLocaleString()} cu ft</b>
            <span>
              {rec.packed.toLocaleString()} packed + 25% for an aisle
            </span>
          </div>
          <span className="mono faint">{total} items</span>
        </div>
      </div>

      <div className="st-fr">
        <div className="st-rec">
          <div className="st-rec-size">
            <span className="eyebrow">{st.size ? "You picked" : "Recommended"}</span>
            <div className="st-rec-big">{sizeLabel(size)}</div>
            <span className="st-rec-like">{info.like}</span>
          </div>
          <div className="st-rec-fill">
            <div className="st-rec-fill-h">
              <span>{size === "12x40" ? "Vehicle space" : total ? `About ${Math.round(fill * 100)}% full` : "Add a few things"}</span>
              <span className="mono faint">{info.cubic ? `${info.cubic.toLocaleString()} cu ft` : "12 × 40 ft"}</span>
            </div>
            <div className="st-meter">
              <i style={{ width: `${size === "12x40" ? 100 : Math.max(2, fill * 100)}%` }} />
              {[0.25, 0.5, 0.75].map(t => (
                <em key={t} style={{ left: `${t * 100}%` }} />
              ))}
            </div>
            <span className="st-rec-why">
              {st.size ? (
                <button className="st-link" onClick={() => set({ size: null, picked: null })}>
                  Back to the recommended {sizeLabel(rec.size)}
                </button>
              ) : (
                rec.reason ?? info.fits
              )}
            </span>
          </div>
          <div className="st-rec-price">
            <span className="eyebrow">From</span>
            <div className="st-rec-big tnum">
              {from ? `$${from}` : "—"}
              <small>/mo</small>
            </div>
            <span className={`st-avail ${avail.length <= 2 ? "low" : ""}`}>
              <i />
              {avail.length ? `${avail.length} available` : "Waitlist"}
            </span>
          </div>
        </div>

        <div className="st-map">
          <FacilityView
            mode="store"
            interactive
            view={{ zoom: 1.32, x: -22, z: -4 }}
            pulse={avail.map(u => u.id)}
            selected={picked}
            onSelect={onSelect}
            onHover={(id, x, y) => setHover(id ? { id, x, y } : null)}
            labels={
              unit
                ? [
                    {
                      key: "pick",
                      unitId: unit.id,
                      lift: 2,
                      children: (
                        <div className="st-tag3d">
                          <b>{unit.id}</b>
                          <span>
                            {sizeLabel(unit.size)} · ${unit.rate}
                          </span>
                        </div>
                      ),
                    },
                  ]
                : []
            }
          />
          <div className="st-map-legend">
            <span>
              <i className="on" /> Available {sizeLabel(size)}
            </span>
            <span>
              <i /> Taken
            </span>
          </div>
          <div className="st-map-hint mono">Click a blue door to pick it · drag to turn</div>
          {hu && hover && (
            <div className="st-hover" style={{ left: hover.x, top: hover.y }}>
              <b>{hu.id}</b>
              <span>
                {sizeLabel(hu.size)} · {kindShort(hu)}
              </span>
              <em className={hu.status === "vacant" ? "ok" : ""}>{hu.status === "vacant" ? `Available · $${hu.rate}/mo` : "Taken"}</em>
            </div>
          )}
        </div>

        <div className="st-pick">
          <div className="st-unitchips" role="group" aria-label={`Available ${sizeLabel(size)} units`}>
            {avail.map(u => (
              <button key={u.id} aria-pressed={u.id === picked} onClick={() => set({ picked: u.id })} data-tap={tapId === u.id ? "" : undefined}>
                <b className="mono">{u.id}</b>
                <span>{kindShort(u)}</span>
                <span className="tnum">${u.rate}</span>
              </button>
            ))}
            {!avail.length && <span className="muted">No {sizeLabel(size)} units free today. We'll text you when one opens.</span>}
          </div>
          {unit && (
            <div className="st-cta">
              <div className="st-cta-t">
                <b>
                  {unit.id} · {sizeLabel(unit.size)} {kindShort(unit).toLowerCase()}
                </b>
                <span>{unitFacts(unit).join(" · ")}</span>
              </div>
              <Button variant="primary" size="lg" onClick={() => onRent(unit.id)} data-tap={tapId === "rent" ? "" : undefined} className="st-rent">
                Rent {unit.id} <ArrowRight />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
