import React, { useState } from "react";
import { ListChecks, ShieldCheck } from "lucide-react";
import { Button } from "../../../ui";
import { defineWidget, Frame, stateOf } from "../frame";
import type { PlanAnswer, PlanProps } from "./types";

// W29 · Proposed actions with toggles and permission badges → "Approve and run N actions".
// Movie mode: optional "item:<id>" to toggle an item, then "submit" (or "secondary").
export const PlanChecklist = defineWidget<PlanProps, PlanAnswer>(function PlanChecklist(w) {
  const { p, active, locked, answer } = w;
  const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries(p.items.map(i => [i.id, i.on !== false])));
  const n = p.items.filter(i => on[i.id]).length;
  const cta = (p.cta ?? "Approve and run {n} actions").replace("{n}", String(n)).replace(/ 1 actions/, " 1 action");
  const groups = [...new Set(p.items.map(i => i.group ?? ""))];
  const summary = answer ? (answer.secondary ? p.secondary : `Approved ${answer.ids.length} of ${p.items.length} actions`) : undefined;
  return (
    <Frame
      icon={<ListChecks />}
      title={p.title}
      meta={p.meta}
      {...stateOf(w, summary)}
      flush
      foot={
        <>
          {p.impact && <span className="ag-foot-hint">{p.impact}</span>}
          {p.secondary && (
            <Button data-auto="secondary" disabled={!active} onClick={() => w.respond({ ids: [], secondary: true })}>
              {p.secondary}
            </Button>
          )}
          <Button variant="primary" data-auto="submit" disabled={!active || n === 0} onClick={() => w.respond({ ids: p.items.filter(i => on[i.id]).map(i => i.id) })}>
            {cta}
          </Button>
        </>
      }
    >
      <div className="ag-plan">
        {groups.map(g => (
          <div key={g} className="ag-plan-g">
            {g && <div className="ag-plan-gh">{g}</div>}
            {p.items
              .filter(i => (i.group ?? "") === g)
              .map(i => {
                const checked = locked && answer ? (answer.ids as string[]).includes(i.id) : on[i.id];
                return (
                  <label key={i.id} className={`ag-plan-i ${checked ? "is-on" : ""}`}>
                    <input type="checkbox" data-auto={"item:" + i.id} checked={checked} disabled={!active} onChange={e => setOn(o => ({ ...o, [i.id]: e.target.checked }))} />
                    <span className="ag-plan-t">
                      <b>{i.label}</b>
                      {i.sub && <small>{i.sub}</small>}
                    </span>
                    {i.tier && (
                      <span className={`ag-tierb ${i.tier === "Ask first" ? "is-ask" : ""}`}>
                        {i.tier === "Ask first" && <ShieldCheck />}
                        {i.tier}
                      </span>
                    )}
                  </label>
                );
              })}
          </div>
        ))}
      </div>
    </Frame>
  );
});
