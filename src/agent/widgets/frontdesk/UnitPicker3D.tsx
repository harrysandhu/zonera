import React, { useState } from "react";
import { Box, Check, Navigation } from "lucide-react";
import { Button } from "../../../ui";
import { UNIT_BY_ID } from "../../../data/facility";
import { FacilityView } from "../../../three/FacilityView";
import { defineWidget, Frame, stateOf } from "../frame";
import type { UnitPickerAnswer, UnitPickerProps } from "./types";
import { CompareTable } from "./UnitCompare";
import { kindLabel, sizeText, usd0 } from "./util";
import "../../../styles/agent-frontdesk.css";

// W19 · UnitPicker3D. A mini clay twin with the candidate doors lit, and the
// list beside it: id, size, floor, price, distance from the gate. Tick up to
// three to compare. The 3D view only lives while the decision is open.
// Movie mode: "unit:<id>", optional "cmp:<id>", "submit".

export const UnitPicker3D = defineWidget<UnitPickerProps, UnitPickerAnswer>(function UnitPicker3D(w) {
  const { p, active, answer } = w;
  const [sel, setSel] = useState(p.selected ?? p.options[0]?.id);
  const [cmp, setCmp] = useState<string[]>([]);
  const o = p.options.find(x => x.id === sel);
  const chosen = p.options.find(x => x.id === answer?.unit);
  const ids = p.options.map(x => x.id);
  const toggleCmp = (id: string) => setCmp(c => (c.includes(id) ? c.filter(x => x !== id) : c.length >= 3 ? [...c.slice(1), id] : [...c, id]));
  const climate = o ? UNIT_BY_ID.get(o.id)?.kind === "climate" : false;

  const labels = [
    ...(o ? [{ key: "sel", unitId: o.id, lift: climate ? 4 : 2, children: <span className="agf-tag3d"><b>{o.id}</b>{usd0(o.price)}/mo</span> }] : []),
    ...(p.current && p.current !== o?.id ? [{ key: "cur", unitId: p.current, lift: 2, children: <span className="agf-tag3d agf-tag3d--now">Now · {p.current}</span> }] : []),
  ];

  return (
    <Frame
      icon={<Box />}
      title={p.title ?? "Pick a unit"}
      meta={p.meta ?? `${p.options.length} free · nearest the gate first`}
      flush
      {...stateOf(w, chosen ? `${chosen.id} · ${sizeText(chosen.size)} ${kindLabel(chosen.kind).toLowerCase()} · ${usd0(chosen.price)}/mo` : undefined)}
      foot={
        <>
          {o && (
            <span className="agf-foot-sum">
              <b className="mono">{o.id}</b> · {sizeText(o.size)} {kindLabel(o.kind).toLowerCase()} · <span className="tnum">{o.feet} ft</span> from the gate
            </span>
          )}
          <Button variant="primary" data-auto="submit" disabled={!active || !o} onClick={() => o && w.respond({ unit: o.id, compared: cmp.length ? cmp : undefined })}>
            {(p.cta ?? "Use {unit} · {price}/mo").replace("{unit}", o?.id ?? "").replace("{price}", o ? usd0(o.price) : "")}
          </Button>
        </>
      }
    >
      <div className="agf-picker">
        <div className="agf-twin">
          {active ? (
            <FacilityView
              mode="store"
              interactive
              view={{ zoom: 1.12, x: -24, z: -4, az: 0.62, el: 0.64 }}
              pulse={ids}
              selected={sel ?? null}
              fly
              zoom={climate ? 2.0 : 1.9}
              labels={labels}
              onSelect={id => id && ids.includes(id) && setSel(id)}
            />
          ) : (
            <div className="agf-twin-off">
              <Box />
              <span>{o ? `${o.id} on the twin` : "Twin"}</span>
            </div>
          )}
          <span className="agf-twin-key">
            <i /> Available {sizeText(p.options[0]?.size ?? "")}
            {p.current && (
              <>
                <i className="is-now" /> Current unit
              </>
            )}
          </span>
        </div>
        <div className="agf-ulist" role="listbox" aria-label="Units">
          {p.options.map(x => (
            <div key={x.id} className={`agf-urow ${x.id === sel ? "is-on" : ""}`}>
              <button type="button" role="option" aria-selected={x.id === sel} className="agf-urow-main" data-auto={"unit:" + x.id} disabled={!active} onClick={() => setSel(x.id)}>
                <span className={`agf-radio ${x.id === sel ? "is-on" : ""}`}>{x.id === sel && <Check />}</span>
                <span className="agf-urow-t">
                  <b className="mono">{x.id}</b>
                  <small>
                    {sizeText(x.size)} {kindLabel(x.kind).toLowerCase()} · {x.kind === "climate" ? `floor ${x.floor}` : x.building === "P" ? "RV & boat" : `Bldg ${x.building}`}
                  </small>
                </span>
                {x.badge && <span className="ag-badge">{x.badge}</span>}
                <span className="agf-urow-ft tnum">
                  <Navigation />
                  {x.feet} ft
                </span>
                <span className="agf-urow-p tnum">
                  {usd0(x.price)}
                  <small>/mo</small>
                </span>
              </button>
              {p.options.length > 1 && (
                <label className="agf-urow-cmp" title="Compare">
                  <input type="checkbox" data-auto={"cmp:" + x.id} checked={cmp.includes(x.id)} disabled={!active} onChange={() => toggleCmp(x.id)} />
                  <span>Compare</span>
                </label>
              )}
            </div>
          ))}
          {p.note && <p className="ag-w-note agf-ulist-note">{p.note}</p>}
        </div>
      </div>
      {cmp.length >= 2 && active && (
        <div className="agf-picker-cmp">
          <span className="ag-lbl">Comparing {cmp.length}</span>
          <CompareTable
            options={cmp.map(id => p.options.find(x => x.id === id)!).filter(Boolean)}
            selected={sel}
            onPick={id => setSel(id)}
            disabled={!active}
          />
        </div>
      )}
    </Frame>
  );
});
