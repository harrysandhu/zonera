import React, { useState } from "react";
import { Columns3, Check } from "lucide-react";
import { Button } from "../../../ui";
import { SIZE_INFO } from "../../../data/facility";
import { defineWidget, Frame, stateOf } from "../frame";
import type { UnitCompareAnswer, UnitCompareProps, UnitOption } from "./types";
import { kindLabel, sizeText, usd0 } from "./util";
import "../../../styles/agent-frontdesk.css";

// W20 · UnitCompare. 2–3 units side by side against what the person has now:
// size, price and delta, price per sq ft, type, location, distance, what fits.
// Movie mode: "pick:<unit id>", "submit".

export function CompareTable({
  current,
  options,
  selected,
  onPick,
  disabled,
}: {
  current?: UnitOption & { label?: string };
  options: UnitOption[];
  selected?: string;
  onPick?: (id: string) => void;
  disabled?: boolean;
}) {
  const cols: (UnitOption & { label?: string; now?: boolean })[] = [...(current ? [{ ...current, now: true }] : []), ...options];
  const base = current?.price;
  const cheapestSqft = Math.min(...options.map(o => o.price / (SIZE_INFO[o.size].sqft || 1)));
  const row = (label: string, cell: (o: (typeof cols)[number]) => React.ReactNode) => (
    <tr>
      <th scope="row">{label}</th>
      {cols.map(o => (
        <td key={o.id} className={`${o.now ? "is-now" : ""} ${o.id === selected ? "is-on" : ""}`}>
          {cell(o)}
        </td>
      ))}
    </tr>
  );
  return (
    <div className="agf-cmp">
      <table>
        <thead>
          <tr>
            <th />
            {cols.map(o => (
              <th key={o.id} className={`${o.now ? "is-now" : ""} ${o.id === selected ? "is-on" : ""}`}>
                {o.now || !onPick ? (
                  <span className="agf-cmp-h">
                    <span className="ag-lbl">{o.now ? o.label ?? "Now" : o.badge ?? "Option"}</span>
                    <b className="mono">{o.id}</b>
                  </span>
                ) : (
                  <button type="button" className="agf-cmp-h agf-cmp-pick" data-auto={"pick:" + o.id} disabled={disabled} aria-pressed={o.id === selected} onClick={() => onPick(o.id)}>
                    <span className="ag-lbl">{o.badge ?? "Option"}</span>
                    <b className="mono">{o.id}</b>
                    <span className={`agf-radio ${o.id === selected ? "is-on" : ""}`}>{o.id === selected && <Check />}</span>
                  </button>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {row("Size", o => (
            <>
              {sizeText(o.size)} <span className="faint">· {SIZE_INFO[o.size].sqft || "—"} sq ft</span>
            </>
          ))}
          {row("Monthly", o => (
            <span className="agf-cmp-price">
              <b className="tnum">{usd0(o.price)}</b>
              {!o.now && base !== undefined && (
                <span className={`ag-delta ${o.price > base ? "is-warn" : "is-ok"}`}>
                  {o.price >= base ? "+" : "−"}
                  {usd0(Math.abs(o.price - base))}
                </span>
              )}
            </span>
          ))}
          {row("Per sq ft", o => {
            const v = o.price / (SIZE_INFO[o.size].sqft || 1);
            return (
              <span className="tnum">
                ${v.toFixed(2)}
                {!o.now && options.length > 1 && Math.abs(v - cheapestSqft) < 0.005 && <span className="agf-best">best value</span>}
              </span>
            );
          })}
          {row("Type", o => (
            <>
              {kindLabel(o.kind)}
              {o.kind === "climate" ? ` · floor ${o.floor}` : ""}
            </>
          ))}
          {row("Location", o => (
            <>
              {o.building === "P" ? "RV & boat" : `Building ${o.building}`}
              {o.note && <small className="agf-cmp-note">{o.note}</small>}
            </>
          ))}
          {row("From gate", o => <span className="tnum">{o.feet} ft</span>)}
          {row("Fits", o => <span className="agf-cmp-fits">{SIZE_INFO[o.size].fits}</span>)}
        </tbody>
      </table>
    </div>
  );
}

export const UnitCompare = defineWidget<UnitCompareProps, UnitCompareAnswer>(function UnitCompare(w) {
  const { p, active, answer } = w;
  const [sel, setSel] = useState(p.selected ?? p.options[0]?.id);
  const o = p.options.find(x => x.id === sel);
  const chosen = p.options.find(x => x.id === answer?.unit);
  const delta = o && p.current ? o.price - p.current.price : 0;
  return (
    <Frame
      icon={<Columns3 />}
      title={p.title ?? "Compare units"}
      meta={p.meta}
      tier={p.tier}
      flush
      {...stateOf(w, chosen ? `${chosen.id} · ${sizeText(chosen.size)} · ${usd0(chosen.price)}/mo` : undefined)}
      foot={
        <>
          {o && p.current && (
            <span className="agf-foot-sum">
              {p.current.id} → <b className="mono">{o.id}</b>
              <span className="faint">
                {" "}
                · {delta >= 0 ? "+" : "−"}
                {usd0(Math.abs(delta))}/mo
              </span>
            </span>
          )}
          <Button variant="primary" data-auto="submit" disabled={!active || !o} onClick={() => o && w.respond({ unit: o.id })}>
            {(p.cta ?? "Choose {unit}").replace("{unit}", o?.id ?? "")}
          </Button>
        </>
      }
    >
      <CompareTable current={p.current} options={p.options} selected={sel} onPick={setSel} disabled={!active} />
    </Frame>
  );
});
