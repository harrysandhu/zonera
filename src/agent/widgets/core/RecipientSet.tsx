import React, { useMemo, useState } from "react";
import { Users, X, Plus, Search, TriangleAlert } from "lucide-react";
import { Avatar, Button } from "../../../ui";
import { defineWidget, Frame, stateOf } from "../frame";
import type { Recipient, RecipientSetAnswer, RecipientSetProps } from "./types";

export function reachable(r: Recipient, channel: "sms" | "email") {
  if (channel === "email") return r.email ? null : "No email on file";
  if (r.optOutSms) return "Opted out of texts";
  return r.phone ? null : "No mobile number";
}

// W3 · Who gets it: people chips, segment rows, search to add, × to remove.
// Movie mode: optional "seg:<id>", "remove:<id>", then "submit".
export const RecipientSet = defineWidget<RecipientSetProps, RecipientSetAnswer>(function RecipientSet(w) {
  const { p, active, locked, answer } = w;
  const [list, setList] = useState<Recipient[]>(p.selected);
  const [q, setQ] = useState("");
  const people = locked && answer ? answer : list;
  const add = (rs: Recipient[]) => setList(l => [...l, ...rs.filter(r => !l.some(x => x.id === r.id))]);
  const hits = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return (p.pool ?? []).filter(r => r.name.toLowerCase().includes(s) && !list.some(x => x.id === r.id)).slice(0, 5);
  }, [q, p.pool, list]);
  const warn = people.filter(r => reachable(r, p.channel));
  const n = people.length;
  return (
    <Frame
      icon={<Users />}
      title={`Recipients · ${p.channel === "sms" ? "text" : "email"}`}
      meta={`${n} ${n === 1 ? "person" : "people"}`}
      {...stateOf(w, `${n} ${n === 1 ? "person" : "people"}${warn.length ? ` · ${warn.length} unreachable by ${p.channel === "sms" ? "text" : "email"}` : ""}`)}
      foot={
        <Button variant="primary" data-auto="submit" disabled={!active || n === 0} onClick={() => w.respond(list)}>
          {(p.cta ?? "Continue with {n}").replace("{n}", String(n))}
        </Button>
      }
    >
      <div className="ag-rcpt">
        <div className="ag-rcpt-chips">
          {people.map(r => {
            const issue = reachable(r, p.channel);
            return (
              <span key={r.id} className={`ag-pchip ${issue ? "is-warn" : ""}`} title={issue ?? r.phone ?? r.email}>
                <Avatar name={r.name} size="sm" />
                <span>
                  {r.name}
                  {r.sub && <small>{r.sub}</small>}
                </span>
                {issue && <TriangleAlert />}
                {!locked && (
                  <button type="button" data-auto={"remove:" + r.id} aria-label={`Remove ${r.name}`} disabled={!active} onClick={() => setList(l => l.filter(x => x.id !== r.id))}>
                    <X />
                  </button>
                )}
              </span>
            );
          })}
          {!locked && (
            <span className="ag-rcpt-search">
              <Search />
              <input placeholder="Add a person…" value={q} disabled={!active} onChange={e => setQ(e.target.value)} data-auto="search" />
              {hits.length > 0 && (
                <span className="ag-rcpt-hits">
                  {hits.map(h => (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => {
                        add([h]);
                        setQ("");
                      }}
                    >
                      <Avatar name={h.name} size="sm" />
                      {h.name}
                      {h.sub && <small>{h.sub}</small>}
                    </button>
                  ))}
                </span>
              )}
            </span>
          )}
        </div>
        {warn.length > 0 && (
          <p className="ag-w-warn">
            <TriangleAlert />
            {warn.map(r => r.name.split(" ")[0]).join(", ")}: {reachable(warn[0], p.channel)?.toLowerCase()}
            {p.channel === "email" ? ". I'll text them instead." : ". I'll email them instead."}
          </p>
        )}
        {!locked && p.segments && p.segments.length > 0 && (
          <div className="ag-rcpt-segs">
            {p.segments.map(sg => (
              <button key={sg.id} type="button" className="ag-seg-row" data-auto={"seg:" + sg.id} disabled={!active} onClick={() => add(sg.people)}>
                <Plus />
                <span>{sg.label}</span>
                <em className="mono">{sg.people.length}</em>
              </button>
            ))}
          </div>
        )}
      </div>
    </Frame>
  );
});
