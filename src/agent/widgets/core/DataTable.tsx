import React, { useMemo, useState } from "react";
import { Table2, ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "../../../ui";
import { go } from "../../../state/store";
import { defineWidget, Frame, stateOf } from "../frame";
import type { DataTableAnswer, DataTableProps } from "./types";

// W12 · Sortable, selectable rows with a sticky bulk-action bar.
// show() it for a read-only table; ask() it with selectable + actions/cta.
// Movie mode: optional "row:<id>" to toggle rows, then "action:<id>" or "submit".
export const DataTable = defineWidget<DataTableProps, DataTableAnswer>(function DataTable(w) {
  const { p, active, locked, answer } = w;
  const [sel, setSel] = useState<Set<string>>(() => new Set(p.selected ?? p.rows.map(r => r.id)));
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [all, setAll] = useState(false);
  const rows = useMemo(() => {
    if (!sort) return p.rows;
    const val = (r: (typeof p.rows)[number]) => r.sort?.[sort.key] ?? (typeof r.cells[sort.key] === "string" || typeof r.cells[sort.key] === "number" ? (r.cells[sort.key] as string | number) : "");
    return [...p.rows].sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * sort.dir);
  }, [p.rows, sort]);
  const max = p.maxRows ?? 8;
  const shown = all ? rows : rows.slice(0, max);
  const selectable = !!p.selectable && !locked;
  const chosen = locked && answer ? new Set(answer.ids) : sel;
  const toggle = (id: string) => setSel(s => {
    const n = new Set(s);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });
  const asking = w.b.status !== "display";
  const summary = answer ? `${answer.ids.length} of ${p.rows.length} selected${answer.action ? " · " + (p.actions?.find(a => a.id === answer.action)?.label ?? answer.action) : ""}` : undefined;
  return (
    <Frame
      icon={<Table2 />}
      title={p.title}
      meta={p.meta ?? `${p.rows.length} rows`}
      {...(asking ? stateOf(w, summary) : { state: "info" as const })}
      flush
      foot={
        asking && (p.actions?.length || p.cta) ? (
          <>
            <span className="ag-foot-hint">
              <b>{sel.size}</b> selected
            </span>
            {p.actions?.map((a, i) => (
              <Button key={a.id} variant={i === p.actions!.length - 1 ? "primary" : "default"} data-auto={"action:" + a.id} disabled={!active || sel.size === 0} onClick={() => w.respond({ ids: [...sel], action: a.id })}>
                {a.label}
              </Button>
            ))}
            {!p.actions?.length && p.cta && (
              <Button variant="primary" data-auto="submit" disabled={!active || sel.size === 0} onClick={() => w.respond({ ids: [...sel] })}>
                {p.cta.replace("{n}", String(sel.size))}
              </Button>
            )}
          </>
        ) : undefined
      }
    >
      <div className="ag-table">
        <table>
          <thead>
            <tr>
              {p.selectable && (
                <th className="ag-table-c">
                  <input type="checkbox" aria-label="Select all" checked={chosen.size === p.rows.length} disabled={!selectable || !active} onChange={e => setSel(e.target.checked ? new Set(p.rows.map(r => r.id)) : new Set())} />
                </th>
              )}
              {p.columns.map(c => (
                <th key={c.key} className={c.align === "right" ? "num" : ""}>
                  <button type="button" onClick={() => setSort(s => (s?.key === c.key ? { key: c.key, dir: (s.dir * -1) as 1 | -1 } : { key: c.key, dir: 1 }))}>
                    {c.label}
                    {sort?.key === c.key && (sort.dir === 1 ? <ArrowUp /> : <ArrowDown />)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map(r => (
              <tr key={r.id} className={`${r.tone ? "is-" + r.tone : ""} ${p.selectable && !chosen.has(r.id) ? "is-off" : ""} ${r.route ? "is-link" : ""}`} onClick={() => r.route && !p.selectable && go(r.route)}>
                {p.selectable && (
                  <td className="ag-table-c">
                    <input type="checkbox" data-auto={"row:" + r.id} aria-label={`Select ${r.id}`} checked={chosen.has(r.id)} disabled={!selectable || !active} onChange={() => toggle(r.id)} />
                  </td>
                )}
                {p.columns.map(c => (
                  <td key={c.key} className={`${c.align === "right" ? "num" : ""} ${c.mono ? "mono" : ""}`}>
                    {r.cells[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > max && (
          <button type="button" className="ag-table-more" onClick={() => setAll(a => !a)}>
            {all ? "Show fewer" : `Show all ${rows.length}`}
          </button>
        )}
      </div>
    </Frame>
  );
});
