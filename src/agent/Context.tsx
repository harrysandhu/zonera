import React from "react";
import { ArrowUpRight, Undo2, Box } from "lucide-react";
import { go, fmt } from "../state/store";
import { TENANT_BY_ID } from "../data/tenants";
import { UNIT_BY_ID } from "../data/facility";
import { Avatar, UnitStatusPill } from "../ui";
import { FacilityView } from "../three/FacilityView";
import { undoAction, type Session } from "./engine";

// Right panel: what the conversation is about. The twin follows ctx.focus,
// entity cards show the people involved, and every effect is listed with Undo.
export function Context({ s }: { s: Session }) {
  const f = s.focus;
  const sel = f.selected ? UNIT_BY_ID.get(f.selected) : undefined;
  const people = f.tenants.map(id => TENANT_BY_ID.get(id)).filter(Boolean).slice(0, 3);
  return (
    <aside className="ag-ctx" aria-label="Context">
      <div className="ag-ctx-twin">
        <FacilityView mode="ops" selected={f.selected} fly={!!f.selected} zoom={1.9} pulse={f.units} view={{ zoom: 1.1, az: 0.62, el: 0.66 }} />
        <div className="ag-ctx-cap">
          <Box size={13} />
          {sel ? (
            <>
              <span className="mono">{sel.id}</span>
              <span>{sel.size.replace("x", "×")} · {sel.kind === "climate" ? `climate, floor ${sel.floor}` : "drive-up"}</span>
              <UnitStatusPill status={sel.status} />
            </>
          ) : f.units.length ? (
            <span>{f.units.length} units highlighted</span>
          ) : (
            <span>Alder Lake · live</span>
          )}
        </div>
      </div>

      {people.length > 0 && (
        <section className="ag-ctx-sec">
          <h3>In focus</h3>
          {people.map(t => (
            <button key={t!.id} type="button" className="ag-ctx-p" onClick={() => go("ops/tenants/" + t!.id)}>
              <Avatar name={t!.name} size="sm" />
              <span className="ag-ctx-pt">
                <b>{t!.name}</b>
                <small className="mono">
                  {t!.unitIds.join(", ") || "no unit"} · {t!.phone}
                </small>
              </span>
              <span className={`ag-ctx-bal mono ${t!.balance > 0 ? "is-warn" : ""}`}>{t!.balance > 0 ? fmt.money(t!.balance, true) : "Paid up"}</span>
            </button>
          ))}
        </section>
      )}

      <section className="ag-ctx-sec ag-ctx-acts">
        <h3>
          Actions taken <em className="mono">{s.actions.length}</em>
        </h3>
        {s.actions.length === 0 ? (
          <p className="ag-ctx-empty">Nothing changed yet. Anything the agent does to your data shows up here, with Undo.</p>
        ) : (
          <ol>
            {s.actions.map(a => (
              <li key={a.id} className={a.undone ? "is-undone" : ""}>
                <span className="mono ag-ctx-t">{a.at}</span>
                <span className="ag-ctx-a">{a.text}</span>
                <span className="ag-ctx-btns">
                  {a.link && (
                    <button type="button" aria-label={a.link.label} title={a.link.label} onClick={() => go(a.link!.route)}>
                      <ArrowUpRight />
                    </button>
                  )}
                  {a.undo && !a.undone && (
                    <button type="button" aria-label="Undo" title="Undo" onClick={() => undoAction(s, a.id)}>
                      <Undo2 />
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </aside>
  );
}
